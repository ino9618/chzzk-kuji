import { Router } from 'express';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { getAuthorizeUrl, exchangeCodeForToken, fetchUserMe, saveTokens } from '../chzzkAuth';
import { requireAdmin, issueAdminSession } from '../middleware/adminAuth';
import { getSetting, setSetting, type Db } from '../db';

export interface ChzzkOauthRouterOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: Buffer;
  fetchImpl?: typeof fetch;
  /**
   * Fired whenever fresh tokens are persisted (connect flow, owner login,
   * first-login claim). Lets the server hot-start/replace the donation
   * socket immediately instead of requiring a process restart.
   */
  onTokensSaved?: (tokens: { accessToken: string; refreshToken: string }) => void;
}

/**
 * CHZZK apps register a single redirect URI, so both flows share one
 * callback and are told apart by the purpose recorded per state:
 * - 'connect': admin-authenticated flow that re-links the streamer's account
 *   (stores tokens + records the channel as the board's owner)
 * - 'login': unauthenticated "네이버 계정으로 로그인". The very first channel
 *   to log in claims ownership of the board; afterwards only that channel is
 *   ever granted an admin session.
 */
const pendingStates = new Map<string, 'connect' | 'login'>();

export function createChzzkOauthRouter(db: Db, options: ChzzkOauthRouterOptions): Router {
  const router = Router();

  const startAuth = (purpose: 'connect' | 'login') => (_req: Request, res: Response) => {
    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.set(state, purpose);
    res.redirect(getAuthorizeUrl(options.clientId, options.redirectUri, state));
  };

  router.get('/start', requireAdmin, startAuth('connect'));
  router.get('/login', startAuth('login'));

  router.get('/callback', async (req, res) => {
    const { code, state } = req.query as { code?: string; state?: string };
    const purpose = state ? pendingStates.get(state) : undefined;
    if (!code || !state || !purpose) {
      res.status(400).send('Invalid or expired OAuth state.');
      return;
    }
    pendingStates.delete(state);

    try {
      const tokens = await exchangeCodeForToken({
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        code,
        state,
        fetchImpl: options.fetchImpl,
      });

      if (purpose === 'connect') {
        await saveTokens(db, tokens, options.encryptionKey);
        options.onTokensSaved?.(tokens);
        try {
          const me = await fetchUserMe({
            accessToken: tokens.accessToken,
            clientId: options.clientId,
            clientSecret: options.clientSecret,
            fetchImpl: options.fetchImpl,
          });
          await setSetting(db, 'owner_channel_id', me.channelId);
          await setSetting(db, 'owner_channel_name', me.channelName);
        } catch {
          // Owner recording is best-effort: the connect (token storage) must
          // succeed even if the profile scope is missing. Naver login simply
          // stays unavailable until a connect run records the owner.
        }
        res.redirect('/admin.html?chzzk=connected');
        return;
      }

      // Login flow: the first channel ever to log in claims the board;
      // afterwards only that owner may sign in. A stranger completing OAuth
      // gets no cookie, and their tokens must never overwrite the
      // streamer's stored tokens.
      const me = await fetchUserMe({
        accessToken: tokens.accessToken,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        fetchImpl: options.fetchImpl,
      });
      const owner = await getSetting(db, 'owner_channel_id');
      if (owner && owner !== me.channelId) {
        res.redirect('/admin.html?login=denied');
        return;
      }
      if (!owner) {
        await setSetting(db, 'owner_channel_id', me.channelId);
        await setSetting(db, 'owner_channel_name', me.channelName);
      }
      // Same account -> refreshing the stored tokens on every login is a
      // free way to keep the 30-day refresh token from ever going stale.
      await saveTokens(db, tokens, options.encryptionKey);
      options.onTokensSaved?.(tokens);
      issueAdminSession(res);
      res.redirect('/admin.html');
    } catch {
      if (purpose === 'login') {
        res.redirect('/admin.html?login=error');
        return;
      }
      res.status(502).send('Failed to exchange CHZZK authorization code for a token.');
    }
  });

  return router;
}
