import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import { createTestDb } from '../helpers/testDb';
import {
  getAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  fetchUserMe,
  encryptToken,
  decryptToken,
  saveTokens,
  loadTokens,
} from '../../src/server/chzzkAuth';

describe('getAuthorizeUrl', () => {
  it('builds the CHZZK account-interlock URL with the required query params', () => {
    const url = getAuthorizeUrl('my-client-id', 'https://example.com/callback', 'abc123');
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://chzzk.naver.com/account-interlock');
    expect(parsed.searchParams.get('clientId')).toBe('my-client-id');
    expect(parsed.searchParams.get('redirectUri')).toBe('https://example.com/callback');
    expect(parsed.searchParams.get('state')).toBe('abc123');
  });
});

describe('exchangeCodeForToken', () => {
  it('posts the authorization_code grant and returns the parsed tokens', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: { accessToken: 'access-1', refreshToken: 'refresh-1' } }),
    });
    const tokens = await exchangeCodeForToken({
      clientId: 'cid',
      clientSecret: 'secret',
      code: 'auth-code',
      state: 'state-1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(tokens).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://openapi.chzzk.naver.com/auth/v1/token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          grantType: 'authorization_code',
          clientId: 'cid',
          clientSecret: 'secret',
          code: 'auth-code',
          state: 'state-1',
        }),
      })
    );
  });
});

describe('refreshAccessToken', () => {
  it('posts the refresh_token grant and returns the parsed tokens', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: { accessToken: 'access-2', refreshToken: 'refresh-2' } }),
    });
    const tokens = await refreshAccessToken({
      clientId: 'cid',
      clientSecret: 'secret',
      refreshToken: 'refresh-1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(tokens).toEqual({ accessToken: 'access-2', refreshToken: 'refresh-2' });
  });
});

describe('fetchUserMe', () => {
  it('fetches the authenticated user profile with client and bearer headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: { channelId: 'ch-1', channelName: '미노' } }),
    });
    const me = await fetchUserMe({
      accessToken: 'tok-1',
      clientId: 'cid',
      clientSecret: 'secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(me).toEqual({ channelId: 'ch-1', channelName: '미노' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://openapi.chzzk.naver.com/open/v1/users/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-1',
          'Client-Id': 'cid',
          'Client-Secret': 'secret',
        }),
      })
    );
  });

  it('throws on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(
      fetchUserMe({ accessToken: 'bad', clientId: 'cid', clientSecret: 'secret', fetchImpl: fetchImpl as unknown as typeof fetch })
    ).rejects.toThrow();
  });

  it('throws when the response has no channelId', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: {} }) });
    await expect(
      fetchUserMe({ accessToken: 'tok', clientId: 'cid', clientSecret: 'secret', fetchImpl: fetchImpl as unknown as typeof fetch })
    ).rejects.toThrow();
  });
});

describe('token encryption', () => {
  it('round-trips a token through encryptToken/decryptToken', () => {
    const key = crypto.randomBytes(32);
    const encrypted = encryptToken('super-secret-token', key);
    expect(encrypted).not.toContain('super-secret-token');
    expect(decryptToken(encrypted, key)).toBe('super-secret-token');
  });
});

describe('saveTokens / loadTokens', () => {
  it('persists tokens encrypted and reloads them decrypted', async () => {
    const db = await createTestDb();
    const key = crypto.randomBytes(32);
    await saveTokens(db, { accessToken: 'access-3', refreshToken: 'refresh-3' }, key);
    expect(await loadTokens(db, key)).toEqual({ accessToken: 'access-3', refreshToken: 'refresh-3' });
    await db.close();
  });

  it('returns undefined when no tokens have been saved', async () => {
    const db = await createTestDb();
    const key = crypto.randomBytes(32);
    expect(await loadTokens(db, key)).toBeUndefined();
    await db.close();
  });
});
