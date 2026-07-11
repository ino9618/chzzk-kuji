import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import { getSetting, setSetting, type Db } from '../../src/server/db';
import { createChzzkOauthRouter } from '../../src/server/routes/chzzkOauth';
import { registerAdminToken, requireAdmin } from '../../src/server/middleware/adminAuth';
import { decryptToken } from '../../src/server/chzzkAuth';
import { createTestDb, resetDb } from '../helpers/testDb';

let db: Db;
const key = crypto.randomBytes(32);

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await resetDb(db);
});

/**
 * Routes fetches by URL so the token exchange and the users/me profile
 * lookup can each return their own shape within one OAuth flow.
 */
function routedFetch(overrides?: { me?: { channelId?: string; channelName?: string }; meFails?: boolean }) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('/auth/v1/token')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ content: { accessToken: 'access-1', refreshToken: 'refresh-1' } }),
      });
    }
    if (url.includes('/users/me')) {
      if (overrides?.meFails) {
        return Promise.resolve({ ok: false, status: 403, json: async () => ({}) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ content: overrides?.me ?? { channelId: 'owner-1', channelName: '미노' } }),
      });
    }
    throw new Error(`unexpected fetch to ${url}`);
  });
}

function buildApp(fetchImpl: typeof fetch, onTokensSaved?: (tokens: unknown) => void) {
  const app = express();
  app.use(cookieParser());
  app.use(
    '/api/chzzk/oauth',
    createChzzkOauthRouter(db, {
      clientId: 'cid',
      clientSecret: 'secret',
      redirectUri: 'http://localhost:3000/api/chzzk/oauth/callback',
      encryptionKey: key,
      fetchImpl,
      onTokensSaved,
    })
  );
  // Probe route for asserting that a login flow issued a working admin cookie.
  app.get('/probe', requireAdmin, (_req, res) => {
    res.json({ ok: true, admin: res.locals.admin });
  });
  return app;
}

async function startLoginFlow(app: express.Express): Promise<string> {
  const startRes = await request(app).get('/api/chzzk/oauth/login');
  expect(startRes.status).toBe(302);
  expect(startRes.headers.location).toContain('https://chzzk.naver.com/account-interlock');
  return new URL(startRes.headers.location).searchParams.get('state')!;
}

describe('GET /api/chzzk/oauth/start', () => {
  it('requires admin auth and redirects to the CHZZK authorize URL', async () => {
    const app = buildApp(vi.fn() as unknown as typeof fetch);
    const token = 'test-token';
    registerAdminToken(token);

    const res = await request(app).get('/api/chzzk/oauth/start').set('Cookie', `admin_token=${token}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('https://chzzk.naver.com/account-interlock');
  });

  it('rejects unauthenticated requests', async () => {
    const app = buildApp(vi.fn() as unknown as typeof fetch);
    const res = await request(app).get('/api/chzzk/oauth/start');
    expect(res.status).toBe(401);
  });

  it('rejects a member session so only the owner can replace the linked channel', async () => {
    const app = buildApp(vi.fn() as unknown as typeof fetch);
    const token = 'member-token';
    registerAdminToken(token, { role: 'member', channelId: 'mod-1', channelName: '매니저' });

    const res = await request(app).get('/api/chzzk/oauth/start').set('Cookie', `admin_token=${token}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/chzzk/oauth/callback (connect)', () => {
  it('rejects a callback with an unknown state', async () => {
    const app = buildApp(vi.fn() as unknown as typeof fetch);
    const res = await request(app).get('/api/chzzk/oauth/callback?code=abc&state=unknown-state');
    expect(res.status).toBe(400);
  });

  it('exchanges a valid code/state for tokens, saves them encrypted, and records the channel owner', async () => {
    const app = buildApp(routedFetch() as unknown as typeof fetch);
    const token = 'test-token';
    registerAdminToken(token);

    const startRes = await request(app).get('/api/chzzk/oauth/start').set('Cookie', `admin_token=${token}`);
    const state = new URL(startRes.headers.location).searchParams.get('state')!;

    const callbackRes = await request(app).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state}`);
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('/admin.html?chzzk=connected');

    const stored = (await getSetting(db, 'chzzk_access_token'))!;
    expect(decryptToken(stored, key)).toBe('access-1');
    expect(await getSetting(db, 'owner_channel_id')).toBe('owner-1');
    expect(await getSetting(db, 'owner_channel_name')).toBe('미노');
  });

  it('still completes the connect even when the users/me lookup fails (owner recording is best-effort)', async () => {
    const app = buildApp(routedFetch({ meFails: true }) as unknown as typeof fetch);
    const token = 'test-token';
    registerAdminToken(token);

    const startRes = await request(app).get('/api/chzzk/oauth/start').set('Cookie', `admin_token=${token}`);
    const state = new URL(startRes.headers.location).searchParams.get('state')!;

    const callbackRes = await request(app).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state}`);
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('/admin.html?chzzk=connected');
    expect(await getSetting(db, 'owner_channel_id')).toBeUndefined();
  });
});

describe('Naver (CHZZK) login flow', () => {
  it('lets anyone start the login flow without auth', async () => {
    const app = buildApp(vi.fn() as unknown as typeof fetch);
    await startLoginFlow(app);
  });

  it('issues an admin session when the logged-in channel matches the stored owner', async () => {
    await setSetting(db, 'owner_channel_id', 'owner-1');
    const app = buildApp(routedFetch() as unknown as typeof fetch);

    const state = await startLoginFlow(app);
    const callbackRes = await request(app).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state}`);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('/admin.html');
    const cookies = callbackRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const probeRes = await request(app).get('/probe').set('Cookie', cookies);
    expect(probeRes.status).toBe(200);
    expect(probeRes.body.admin).toEqual({ role: 'owner', channelId: 'owner-1', channelName: '미노' });

    // A successful owner login also refreshes the stored tokens.
    expect(decryptToken((await getSetting(db, 'chzzk_access_token'))!, key)).toBe('access-1');
  });

  it('issues an admin session to a different channel without replacing owner tokens', async () => {
    await setSetting(db, 'owner_channel_id', 'someone-else');
    const app = buildApp(routedFetch() as unknown as typeof fetch);

    const state = await startLoginFlow(app);
    const callbackRes = await request(app).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state}`);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('/admin.html');
    expect(callbackRes.headers['set-cookie']).toBeDefined();
    const probeRes = await request(app).get('/probe').set('Cookie', callbackRes.headers['set-cookie']);
    expect(probeRes.body.admin).toEqual({ role: 'member', channelId: 'owner-1', channelName: '미노' });
    // Tokens of another administrator must never overwrite the streamer's stored tokens.
    expect(await getSetting(db, 'chzzk_access_token')).toBeUndefined();
  });

  it('claims ownership on the very first login (no owner yet) and issues a session', async () => {
    const onTokensSaved = vi.fn();
    const app = buildApp(routedFetch() as unknown as typeof fetch, onTokensSaved);

    const state = await startLoginFlow(app);
    const callbackRes = await request(app).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state}`);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('/admin.html');
    const cookies = callbackRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // The first channel to log in becomes the board's owner...
    expect(await getSetting(db, 'owner_channel_id')).toBe('owner-1');
    expect(await getSetting(db, 'owner_channel_name')).toBe('미노');
    // ...their tokens are stored so the donation socket can start...
    expect(decryptToken((await getSetting(db, 'chzzk_access_token'))!, key)).toBe('access-1');
    // ...and the server is notified so it can hot-start the socket without a restart.
    expect(onTokensSaved).toHaveBeenCalledWith({ accessToken: 'access-1', refreshToken: 'refresh-1' });

    // A different channel can log in, but cannot replace the claimed owner.
    const app2 = buildApp(routedFetch({ me: { channelId: 'intruder', channelName: '침입자' } }) as unknown as typeof fetch);
    const state2 = await startLoginFlow(app2);
    const otherLogin = await request(app2).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state2}`);
    expect(otherLogin.headers.location).toBe('/admin.html');
    expect(await getSetting(db, 'owner_channel_id')).toBe('owner-1');
  });

  it('notifies onTokensSaved on the connect flow too', async () => {
    const onTokensSaved = vi.fn();
    const app = buildApp(routedFetch() as unknown as typeof fetch, onTokensSaved);
    const token = 'test-token';
    registerAdminToken(token);

    const startRes = await request(app).get('/api/chzzk/oauth/start').set('Cookie', `admin_token=${token}`);
    const state = new URL(startRes.headers.location).searchParams.get('state')!;
    await request(app).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state}`);

    expect(onTokensSaved).toHaveBeenCalledWith({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  });

  it('redirects with login=error when the profile lookup fails during login', async () => {
    await setSetting(db, 'owner_channel_id', 'owner-1');
    const app = buildApp(routedFetch({ meFails: true }) as unknown as typeof fetch);

    const state = await startLoginFlow(app);
    const callbackRes = await request(app).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state}`);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('/admin.html?login=error');
    expect(callbackRes.headers['set-cookie']).toBeUndefined();
  });
});

describe('open multi-account login', () => {
  it('lets any channel log in without touching the owner tokens', async () => {
    await setSetting(db, 'owner_channel_id', 'owner-1');
    const onTokensSaved = vi.fn();
    const app = buildApp(routedFetch({ me: { channelId: 'mod-1', channelName: '매니저' } }) as unknown as typeof fetch, onTokensSaved);

    const state = await startLoginFlow(app);
    const res = await request(app).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin.html');
    expect(res.headers['set-cookie']).toBeDefined();
    const probeRes = await request(app).get('/probe').set('Cookie', res.headers['set-cookie']);
    expect(probeRes.body.admin).toEqual({ role: 'member', channelId: 'mod-1', channelName: '매니저' });
    // A member is NOT the streamer: their tokens must not overwrite the
    // owner's donation-socket tokens, and the socket is not restarted.
    expect(await getSetting(db, 'chzzk_access_token')).toBeUndefined();
    expect(onTokensSaved).not.toHaveBeenCalled();
  });

  it('allows consecutive new accounts without an invite', async () => {
    await setSetting(db, 'owner_channel_id', 'owner-1');
    const app = buildApp(routedFetch({ me: { channelId: 'mod-2', channelName: '스탭' } }) as unknown as typeof fetch);

    const state = await startLoginFlow(app);
    const res = await request(app).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin.html');
    expect(res.headers['set-cookie']).toBeDefined();

    // A different new account is also admitted without an invite.
    const app2 = buildApp(routedFetch({ me: { channelId: 'stranger', channelName: '남' } }) as unknown as typeof fetch);
    const state2 = await startLoginFlow(app2);
    const nextLogin = await request(app2).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state2}`);
    expect(nextLogin.headers.location).toBe('/admin.html');
    expect(nextLogin.headers['set-cookie']).toBeDefined();
  });
});
