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

function buildApp(fetchImpl: typeof fetch) {
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
    })
  );
  // Probe route for asserting that a login flow issued a working admin cookie.
  app.get('/probe', requireAdmin, (_req, res) => {
    res.json({ ok: true });
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

    // A successful owner login also refreshes the stored tokens.
    expect(decryptToken((await getSetting(db, 'chzzk_access_token'))!, key)).toBe('access-1');
  });

  it('denies login (no cookie) when the channel does not match the owner', async () => {
    await setSetting(db, 'owner_channel_id', 'someone-else');
    const app = buildApp(routedFetch() as unknown as typeof fetch);

    const state = await startLoginFlow(app);
    const callbackRes = await request(app).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state}`);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('/admin.html?login=denied');
    expect(callbackRes.headers['set-cookie']).toBeUndefined();
    // Tokens of a stranger must never overwrite the streamer's stored tokens.
    expect(await getSetting(db, 'chzzk_access_token')).toBeUndefined();
  });

  it('redirects to not_configured when no owner has been established yet', async () => {
    const app = buildApp(routedFetch() as unknown as typeof fetch);

    const state = await startLoginFlow(app);
    const callbackRes = await request(app).get(`/api/chzzk/oauth/callback?code=auth-code&state=${state}`);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('/admin.html?login=not_configured');
    expect(callbackRes.headers['set-cookie']).toBeUndefined();
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
