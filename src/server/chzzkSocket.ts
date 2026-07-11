import { EventEmitter } from 'node:events';
import type { DonationEvent } from './donationProcessor';
import { refreshAccessToken, type TokenResponse } from './chzzkAuth';

interface RawDonationData {
  donationType: 'CHAT' | 'VIDEO';
  channelId: string;
  donatorChannelId: string;
  donatorNickname: string;
  payAmount: string | number;
  donationText: string;
}

export function parseDonationPayload(raw: unknown): DonationEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const envelope = raw as { type?: unknown; data?: unknown };
  if (envelope.type !== 'DONATION' || !envelope.data || typeof envelope.data !== 'object') return null;
  const data = envelope.data as RawDonationData;
  const amount = Number(data.payAmount);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return {
    channelId: data.donatorChannelId,
    nickname: data.donatorNickname || '익명',
    amount,
    message: data.donationText ?? '',
  };
}

/**
 * CHZZK's session socket speaks Engine.IO v3 + Socket.IO v2-style framing, not a bare WebSocket
 * protocol: the client must open a session via the Engine.IO handshake (path `/socket.io/`,
 * `EIO=3`), then unwrap each message as a Socket.IO EVENT packet (`2["eventName", "...json..."]`)
 * before the inner `{type, data}` envelope (SYSTEM connected message / DONATION event) appears.
 * This was verified against a live account — a raw WebSocket connection to the session URL
 * (as CHZZK's own docs/gists imply) is rejected with HTTP 400; only the Engine.IO handshake
 * succeeds.
 */
export function parseSocketIoEventPacket(raw: unknown): unknown | null {
  const text = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
  const match = text.match(/^2\d*(\[.*\])$/s);
  if (!match) return null;
  let arr: unknown;
  try {
    arr = JSON.parse(match[1]);
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr.length < 1) return null;
  const eventType = typeof arr[0] === 'string' ? arr[0] : undefined;
  const payload = arr[1] ?? arr[0];
  let parsedPayload = payload;
  if (typeof payload === 'string') {
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (parsedPayload && typeof parsedPayload === 'object' && 'type' in parsedPayload) return parsedPayload;
  return eventType ? { type: eventType, data: parsedPayload } : parsedPayload;
}

export interface EioSocketLike extends EventEmitter {
  send(data: string): void;
  close(): void;
}

export type EioSocketConstructor = new (uri: string, opts: Record<string, unknown>) => EioSocketLike;

export interface ChzzkSocketClientOptions {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
  EioSocketImpl?: EioSocketConstructor;
  reconnectDelayMs?: number;
  onTokensRefreshed?: (tokens: TokenResponse) => void;
}

const API_BASE = 'https://openapi.chzzk.naver.com';

export class ChzzkSocketClient extends EventEmitter {
  private fetchImpl: typeof fetch;
  private EioSocketImpl: EioSocketConstructor;
  private reconnectDelayMs: number;
  private socket: EioSocketLike | null = null;
  private shouldReconnect = true;
  private needsReauth = false;
  private accessToken: string;
  private refreshToken: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private options: ChzzkSocketClientOptions) {
    super();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.EioSocketImpl = options.EioSocketImpl ?? getDefaultEioSocketConstructor();
    this.reconnectDelayMs = options.reconnectDelayMs ?? 3000;
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
  }

  private authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Client-Id': this.options.clientId,
      'Client-Secret': this.options.clientSecret,
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  /**
   * Refreshes the access/refresh token pair via chzzkAuth.refreshAccessToken,
   * updates the in-memory tokens, and notifies the caller (e.g. to persist
   * the new tokens). If the refresh itself fails (refresh token dead too),
   * emits a 'needs_reauth' status, stops any further reconnect attempts
   * (there's no point retrying with a dead refresh token), and rethrows so
   * the caller aborts the in-flight request.
   *
   * IMPORTANT: When 'needs_reauth' is emitted here, completing OAuth at
   * /api/chzzk/oauth/start will persist new tokens but does NOT automatically
   * reconnect the live ChzzkSocketClient instance — a full server restart is
   * required for donation reception to resume. The admin UI displays a banner
   * instructing the admin to restart after re-auth.
   */
  private async refreshTokens(): Promise<void> {
    try {
      const tokens = await refreshAccessToken({
        clientId: this.options.clientId,
        clientSecret: this.options.clientSecret,
        refreshToken: this.refreshToken,
        fetchImpl: this.fetchImpl,
      });
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
      this.options.onTokensRefreshed?.(tokens);
    } catch (err) {
      this.shouldReconnect = false;
      this.needsReauth = true;
      this.emit('status', 'needs_reauth');
      throw err;
    }
  }

  private async fetchSocketUrl(): Promise<string> {
    let res = await this.fetchImpl(`${API_BASE}/open/v1/sessions/auth`, {
      headers: this.authHeaders(),
    });
    if (res.status === 401) {
      await this.refreshTokens();
      res = await this.fetchImpl(`${API_BASE}/open/v1/sessions/auth`, {
        headers: this.authHeaders(),
      });
    }
    if (!res.ok) throw new Error(`Failed to fetch CHZZK socket URL: ${res.status}`);
    const json = (await res.json()) as { content: { url: string } };
    return json.content.url;
  }

  private async subscribeDonation(sessionKey: string): Promise<void> {
    let res = await this.fetchImpl(
      `${API_BASE}/open/v1/sessions/events/subscribe/donation?sessionKey=${sessionKey}`,
      { method: 'POST', headers: this.authHeaders() }
    );
    if (res.status === 401) {
      await this.refreshTokens();
      res = await this.fetchImpl(
        `${API_BASE}/open/v1/sessions/events/subscribe/donation?sessionKey=${sessionKey}`,
        { method: 'POST', headers: this.authHeaders() }
      );
    }
    if (!res.ok) throw new Error(`Failed to subscribe to donation events: ${res.status}`);
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true;
    this.needsReauth = false;
    return this.connectOnce();
  }

  /**
   * Attempts a single connection. Regardless of whether the failure happens
   * before a socket is ever constructed (e.g. fetchSocketUrl() rejects) or
   * after a successful connection later drops (the 'close' handler below), a
   * rejection here schedules exactly one retry via scheduleReconnect() as
   * long as shouldReconnect is still true. The promise returned by THIS call
   * still rejects/resolves normally so the first connect() caller's .catch()
   * still observes the outcome.
   */
  private connectOnce(): Promise<void> {
    const attempt = new Promise<void>((resolve, reject) => {
      this.fetchSocketUrl()
        .then((url) => {
          const target = new URL(url);
          const origin = `${target.protocol}//${target.host}`;
          const query = Object.fromEntries(target.searchParams);

          const socket = new this.EioSocketImpl(origin, {
            path: '/socket.io/',
            query,
            transports: ['polling', 'websocket'],
          });
          this.socket = socket;

          // engine.io-client exposes the transport layer only. Complete the
          // Socket.IO root-namespace handshake that io.connect() normally sends.
          socket.once('open', () => socket.send('0'));

          socket.on('message', (raw: unknown) => {
            const unwrapped = parseSocketIoEventPacket(raw);
            if (!unwrapped) return;

            const envelope = unwrapped as { type?: string; data?: { sessionKey?: string } };
            if (envelope.type === 'connected' && envelope.data?.sessionKey) {
              this.subscribeDonation(envelope.data.sessionKey)
                .then(() => {
                  this.emit('status', 'connected');
                  resolve();
                })
                .catch((err) => {
                  socket.close();
                  reject(err);
                });
              return;
            }

            const donation = parseDonationPayload(unwrapped);
            if (donation) {
              this.emit('donation', donation);
            }
          });

          socket.on('close', () => {
            this.socket = null;
            this.scheduleReconnect();
          });

          socket.on('error', () => {
            // 'close' fires after 'error' on engine.io-client; no separate handling needed.
          });
        })
        .catch(reject);
    });

    // Any rejection of this attempt (whether from fetchSocketUrl(),
    // subscribeDonation(), or refreshTokens() inside them) should arm a
    // retry too — not just a 'close' event on a socket that may never have
    // been constructed. scheduleReconnect() is a no-op (beyond emitting
    // 'disconnected'/'needs_reauth' status where relevant) when
    // shouldReconnect is false, so this doesn't cause double-scheduling
    // when the close handler above already handled it.
    attempt.catch(() => {
      this.scheduleReconnect();
    });

    return attempt;
  }

  /**
   * Arms a single reconnect attempt if shouldReconnect is still true
   * (it's set to false by disconnect() or by a failed token refresh in
   * refreshTokens()). Emits 'reconnecting' before scheduling, or
   * 'disconnected' if an explicit disconnect() is why reconnection should
   * not proceed. If reconnection was disabled because refreshTokens()
   * already emitted 'needs_reauth', do nothing further — that status was
   * already communicated and 'disconnected' would be a confusing regression
   * for admin UI purposes. Safe to call more than once for the same failed
   * attempt (e.g. once from the 'close' handler and once from
   * connectOnce()'s rejection handler) because the second call's
   * setTimeout just races a second connectOnce() that will itself either
   * succeed or fail harmlessly.
   */
  private scheduleReconnect(): void {
    if (this.needsReauth) {
      return;
    }
    if (!this.shouldReconnect) {
      this.emit('status', 'disconnected');
      return;
    }
    if (this.reconnectTimer) return;
    this.emit('status', 'reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectOnce().catch(() => {
        /* connectOnce() already arms the next retry via scheduleReconnect() */
      });
    }, this.reconnectDelayMs);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
  }
}

function getDefaultEioSocketConstructor(): EioSocketConstructor {
  // engine.io-client v3 is CommonJS and exposes its Socket class as a
  // property of the default export (not a named ESM export).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const eio = require('engine.io-client');
  return eio.Socket as EioSocketConstructor;
}
