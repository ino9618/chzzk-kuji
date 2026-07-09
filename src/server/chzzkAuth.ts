import crypto from 'node:crypto';
import { getSetting, setSetting, type Db } from './db';

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

const TOKEN_ENDPOINT = 'https://openapi.chzzk.naver.com/auth/v1/token';

export function getAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL('https://chzzk.naver.com/account-interlock');
  url.searchParams.set('clientId', clientId);
  url.searchParams.set('redirectUri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

async function postToken(body: Record<string, string>, fetchImpl: typeof fetch): Promise<TokenResponse> {
  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`CHZZK token request failed with status ${res.status}`);
  }
  const json = (await res.json()) as { content: { accessToken: string; refreshToken: string } };
  return { accessToken: json.content.accessToken, refreshToken: json.content.refreshToken };
}

export async function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  state: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenResponse> {
  return postToken(
    {
      grantType: 'authorization_code',
      clientId: params.clientId,
      clientSecret: params.clientSecret,
      code: params.code,
      state: params.state,
    },
    params.fetchImpl ?? fetch
  );
}

export async function refreshAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenResponse> {
  return postToken(
    {
      grantType: 'refresh_token',
      clientId: params.clientId,
      clientSecret: params.clientSecret,
      refreshToken: params.refreshToken,
    },
    params.fetchImpl ?? fetch
  );
}

export interface ChzzkUser {
  channelId: string;
  channelName: string;
}

// TODO(verify): The /open/v1/users/me endpoint and its {content:{channelId,channelName}}
// envelope follow the official docs' user section, but have not been exercised against a
// live account yet. After the next real OAuth login, log the raw response once to confirm
// the field names match.
export async function fetchUserMe(params: {
  accessToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}): Promise<ChzzkUser> {
  const f = params.fetchImpl ?? fetch;
  const res = await f('https://openapi.chzzk.naver.com/open/v1/users/me', {
    headers: {
      'Client-Id': params.clientId,
      'Client-Secret': params.clientSecret,
      Authorization: `Bearer ${params.accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`CHZZK users/me request failed with status ${res.status}`);
  }
  const json = (await res.json()) as { content?: { channelId?: string; channelName?: string } };
  if (!json.content?.channelId) {
    throw new Error('CHZZK users/me response did not include a channelId');
  }
  return { channelId: json.content.channelId, channelName: json.content.channelName ?? '' };
}

const IV_LENGTH = 12;

export function encryptToken(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptToken(encrypted: string, key: Buffer): string {
  const buf = Buffer.from(encrypted, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buf.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export async function saveTokens(db: Db, tokens: TokenResponse, key: Buffer): Promise<void> {
  await setSetting(db, 'chzzk_access_token', encryptToken(tokens.accessToken, key));
  await setSetting(db, 'chzzk_refresh_token', encryptToken(tokens.refreshToken, key));
}

export async function loadTokens(db: Db, key: Buffer): Promise<TokenResponse | undefined> {
  const encAccess = await getSetting(db, 'chzzk_access_token');
  const encRefresh = await getSetting(db, 'chzzk_refresh_token');
  if (!encAccess || !encRefresh) return undefined;
  return {
    accessToken: decryptToken(encAccess, key),
    refreshToken: decryptToken(encRefresh, key),
  };
}
