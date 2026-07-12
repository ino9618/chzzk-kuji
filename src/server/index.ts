import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { createPgDb, getSetting, setSetting, listPendingIssues, type Db } from './db';
import { createAuthRouter } from './routes/auth';
import { createAdminRouter } from './routes/admin';
import { createOverlayRouter, buildBoardPayload } from './routes/overlay';
import { createChzzkOauthRouter } from './routes/chzzkOauth';
import { processDonation } from './donationProcessor';
import { ChzzkSocketClient } from './chzzkSocket';
import { loadTokens, saveTokens } from './chzzkAuth';
import { broadcastBoardUpdate, broadcastQueueUpdate, broadcastConnectionStatus } from './broadcast';
import { isValidAdminToken } from './middleware/adminAuth';

/**
 * Extracts the value of a single cookie by name from a raw Cookie header
 * string (e.g. "key1=val1; key2=val2"). Returns undefined if the cookie
 * is not present.
 */
export function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eqIndex + 1).trim());
    }
  }
  return undefined;
}

/**
 * Registers connection handling for the Socket.IO server: sends the
 * current board state to every new connection, and joins the socket to
 * the 'admin' room if it presents a valid admin_token cookie. Sockets in
 * the 'admin' room receive admin-only broadcasts (queue:update,
 * connection:status); all sockets receive board:update.
 */
export function registerSocketHandlers(io: SocketIOServer, db: Db): void {
  io.on('connection', (socket) => {
    buildBoardPayload(db)
      .then((board) => socket.emit('board:update', board))
      .catch(() => {
        /* a transient DB error on connect just skips the initial snapshot */
      });

    const cookieHeader = socket.handshake.headers.cookie;
    const token = parseCookie(cookieHeader, 'admin_token');
    if (isValidAdminToken(token)) {
      socket.join('admin');
    }

    socket.on('overlay:test', (input, acknowledge) => {
      if (!socket.rooms.has('admin')) {
        acknowledge?.({ ok: false, error: 'unauthorized' });
        return;
      }

      const payload = input && typeof input === 'object' ? input as Record<string, unknown> : {};
      const number = Number(payload.number);
      const testEvent = {
        number: Number.isInteger(number) && number > 0 ? Math.min(number, 9999) : 1,
        grade: String(payload.grade ?? 'A').trim().slice(0, 8) || 'A',
        prizeName: String(payload.prizeName ?? '테스트 상품').trim().slice(0, 80) || '테스트 상품',
        nickname: String(payload.nickname ?? '테스트 후원자').trim().slice(0, 40) || '테스트 후원자',
      };
      io.emit('overlay:test', testEvent);
      acknowledge?.({ ok: true });
    });
  });
}

export interface AppOptions {
  adminPasswordHash: string;
  disconnectChzzk?: () => Promise<void> | void;
  simulateDonation?: (event: import('./donationProcessor').DonationEvent) => Promise<import('./donationProcessor').ProcessDonationResult>;
}

export async function createApp(db: Db, options: AppOptions) {
  const app = express();
  // Railway/Render/most PaaS terminate TLS at a proxy; without this Express
  // would refuse to set `secure` cookies because it sees plain HTTP.
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());

  let chzzkStatus: 'connected' | 'disconnected' | 'reconnecting' | 'not_configured' | 'needs_reauth' =
    'not_configured';

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/', (_req, res) => {
    res.redirect('/admin.html');
  });

  // Seed only if no hash is stored yet, so a password changed at runtime
  // (via POST /api/auth/password) survives createApp() being called again
  // against the same db (e.g. on the next server start).
  if (!(await getSetting(db, 'admin_password_hash'))) {
    await setSetting(db, 'admin_password_hash', options.adminPasswordHash);
  }

  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/admin', createAdminRouter(db, {
    getChzzkStatus: () => chzzkStatus,
    disconnectChzzk: options.disconnectChzzk,
    simulateDonation: options.simulateDonation ?? ((event) => processDonation(db, event)),
  }));
  app.use('/api/overlay', createOverlayRouter(db));

  return {
    app,
    setChzzkStatus: (status: typeof chzzkStatus) => {
      chzzkStatus = status;
    },
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL env var must be set (e.g. the Supabase Postgres connection string). ' +
        'See README "배포하기" for setup.'
    );
  }
  const db = await createPgDb(databaseUrl);

  let adminPasswordHash = await getSetting(db, 'admin_password_hash');
  if (!adminPasswordHash) {
    const plainPassword = process.env.ADMIN_PASSWORD;
    if (!plainPassword) {
      throw new Error('ADMIN_PASSWORD env var must be set on first run to initialize the admin password.');
    }
    adminPasswordHash = bcrypt.hashSync(plainPassword, 10);
    await setSetting(db, 'admin_password_hash', adminPasswordHash);
  }

  let disconnectActiveChzzk = () => undefined;
  let simulateDonation = (event: import('./donationProcessor').DonationEvent) => processDonation(db, event);
  const { app, setChzzkStatus } = await createApp(db, {
    adminPasswordHash,
    disconnectChzzk: () => disconnectActiveChzzk(),
    simulateDonation: (event) => simulateDonation(event),
  });

  if (process.env.NODE_ENV === 'production') {
    const path = require('node:path') as typeof import('node:path');
    app.use(express.static(path.join(__dirname, '../../dist/client')));
  }

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: true } });

  registerSocketHandlers(io, db);
  simulateDonation = async (event) => {
    const result = await processDonation(db, event);
    broadcastBoardUpdate(io, await buildBoardPayload(db));
    broadcastQueueUpdate(io, await listPendingIssues(db));
    return result;
  };

  const encryptionKey = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? '', 'hex');
  const tokens = encryptionKey.length === 32 ? await loadTokens(db, encryptionKey) : undefined;

  // Spell out exactly which env vars block the CHZZK integration: a missing
  // or malformed one otherwise surfaces only as a confusing "Cannot GET
  // /api/chzzk/oauth/..." 404 with no clue in the logs.
  const missingForOauth: string[] = [];
  if (!process.env.CHZZK_CLIENT_ID) missingForOauth.push('CHZZK_CLIENT_ID');
  if (!process.env.CHZZK_CLIENT_SECRET) missingForOauth.push('CHZZK_CLIENT_SECRET');
  if (encryptionKey.length !== 32) missingForOauth.push('TOKEN_ENCRYPTION_KEY (must be 64 hex chars)');
  if (missingForOauth.length > 0) {
    console.warn(
      `CHZZK OAuth routes are DISABLED — missing/invalid env vars: ${missingForOauth.join(', ')}. ` +
        '/api/chzzk/oauth/* will return 404 until these are set.'
    );
  }

  // Creates (or replaces) the donation socket with the given tokens.
  // Called at boot when stored tokens exist, and again whenever the OAuth
  // flow saves fresh tokens (first login / re-auth) so the connection
  // starts immediately — no server restart needed.
  let activeSocketClient: ChzzkSocketClient | undefined;
  disconnectActiveChzzk = () => {
    activeSocketClient?.removeAllListeners();
    activeSocketClient?.disconnect();
    activeSocketClient = undefined;
    setChzzkStatus('not_configured');
    broadcastConnectionStatus(io, 'not_configured');
  };
  const startChzzkSocket = (t: { accessToken: string; refreshToken: string }) => {
    if (!process.env.CHZZK_CLIENT_ID || !process.env.CHZZK_CLIENT_SECRET) return;
    if (activeSocketClient) {
      activeSocketClient.removeAllListeners();
      activeSocketClient.disconnect();
    }
    const socketClient = new ChzzkSocketClient({
      clientId: process.env.CHZZK_CLIENT_ID,
      clientSecret: process.env.CHZZK_CLIENT_SECRET,
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
      onTokensRefreshed: (newTokens) => {
        saveTokens(db, newTokens, encryptionKey).catch((err) =>
          console.error('Failed to persist refreshed CHZZK tokens:', err)
        );
      },
    });
    activeSocketClient = socketClient;

    socketClient.on('status', (status) => {
      setChzzkStatus(status);
      broadcastConnectionStatus(io, status);
    });
    socketClient.on('connection_error', (err) => {
      console.error('CHZZK session connection error:', err instanceof Error ? err.message : err);
    });

    socketClient.on('donation', (event) => {
      (async () => {
        await processDonation(db, event);
        broadcastBoardUpdate(io, await buildBoardPayload(db));
        broadcastQueueUpdate(io, await listPendingIssues(db));
      })().catch((err) => console.error('Failed to process a donation event:', err));
    });

    socketClient.connect().catch((err) => {
      console.error('Failed to connect to CHZZK session socket:', err);
    });
  };

  if (encryptionKey.length === 32 && process.env.CHZZK_CLIENT_ID && process.env.CHZZK_CLIENT_SECRET) {
    app.use(
      '/api/chzzk/oauth',
      createChzzkOauthRouter(db, {
        clientId: process.env.CHZZK_CLIENT_ID,
        clientSecret: process.env.CHZZK_CLIENT_SECRET,
        redirectUri: process.env.CHZZK_REDIRECT_URI ?? 'http://localhost:3000/api/chzzk/oauth/callback',
        encryptionKey,
        onTokensSaved: startChzzkSocket,
      })
    );
  }

  if (tokens) {
    startChzzkSocket(tokens);
  } else {
    console.warn(
      'CHZZK tokens not stored yet — donation events will start flowing after the first Naver login on /admin.html.'
    );
  }

  const port = Number(process.env.PORT ?? 3000);
  httpServer.listen(port, () => {
    console.log(`chzzk-kuji server listening on port ${port}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
