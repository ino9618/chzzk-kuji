import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { ChzzkSocketClient, parseDonationPayload, parseSocketIoEventPacket } from '../../src/server/chzzkSocket';

describe('parseDonationPayload', () => {
  it('parses a CHAT donation message into a DonationEvent', () => {
    const raw = {
      type: 'DONATION',
      data: {
        donationType: 'CHAT',
        channelId: 'streamer-channel',
        donatorChannelId: 'viewer-channel',
        donatorNickname: '홍길동',
        payAmount: 1000,
        donationText: '3번',
      },
    };
    expect(parseDonationPayload(raw)).toEqual({
      channelId: 'viewer-channel',
      nickname: '홍길동',
      amount: 1000,
      message: '3번',
    });
  });

  it('parses payAmount as the string documented by the official CHZZK API', () => {
    expect(parseDonationPayload({ type: 'DONATION', data: { donationType: 'CHAT', channelId: 'streamer', donatorChannelId: 'viewer', donatorNickname: '실사용자', payAmount: '1000', donationText: '1번' } })).toEqual({
      channelId: 'viewer', nickname: '실사용자', amount: 1000, message: '1번',
    });
  });

  it('normalizes a fully anonymous donation without a nickname or channel id', () => {
    const raw = {
      type: 'DONATION',
      data: {
        donationType: 'CHAT',
        channelId: 'streamer-channel',
        donatorChannelId: '',
        donatorNickname: '   ',
        payAmount: 1000,
        donationText: '3번',
      },
    };
    expect(parseDonationPayload(raw)).toMatchObject({ channelId: 'anonymous', nickname: '익명 후원자' });
  });

  it('returns null for a non-donation message', () => {
    expect(parseDonationPayload({ type: 'connected', data: { sessionKey: 'abc' } })).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseDonationPayload(null)).toBeNull();
    expect(parseDonationPayload('not json')).toBeNull();
  });
});

describe('parseSocketIoEventPacket', () => {
  it('unwraps a Socket.IO EVENT packet as observed against a live CHZZK account', () => {
    const raw = '2["SYSTEM","{\\"type\\":\\"connected\\",\\"data\\":{\\"sessionKey\\":\\"abc-123\\"}}"]';
    expect(parseSocketIoEventPacket(raw)).toEqual({ type: 'connected', data: { sessionKey: 'abc-123' } });
  });

  it('preserves the official Socket.IO event name around a direct donation body', () => {
    const raw = '2["DONATION","{\\"donationType\\":\\"CHAT\\",\\"payAmount\\":\\"1000\\",\\"donationText\\":\\"1번\\"}"]';
    expect(parseSocketIoEventPacket(raw)).toEqual({ type: 'DONATION', data: { donationType: 'CHAT', payAmount: '1000', donationText: '1번' } });
  });

  it('returns null for a bare Engine.IO control packet (e.g. "0" CONNECT ack)', () => {
    expect(parseSocketIoEventPacket('0')).toBeNull();
  });

  it('returns null for malformed packets', () => {
    expect(parseSocketIoEventPacket('not a packet')).toBeNull();
    expect(parseSocketIoEventPacket(null)).toBeNull();
  });
});

/**
 * Simulates engine.io-client's Socket class. CHZZK's session socket speaks
 * Engine.IO v3 + Socket.IO EVENT framing (verified against a live account —
 * see chzzkSocket.ts's module doc comment), so this double emits 'message'
 * with raw Socket.IO-wire-format strings (e.g. `2["SYSTEM","...json..."]`),
 * not bare JSON, matching what the real engine.io-client Socket delivers.
 */
class FakeEioSocket extends EventEmitter {
  static instances: FakeEioSocket[] = [];
  sent: string[] = [];
  constructor(public uri: string, public opts: Record<string, unknown>) {
    super();
    FakeEioSocket.instances.push(this);
  }
  close() {
    this.emit('close');
  }
  send(data: string) {
    this.sent.push(data);
  }
  /** Simulates receiving a Socket.IO EVENT packet wrapping the given inner payload. */
  simulateMessage(payload: unknown) {
    const wire = `2["SYSTEM",${JSON.stringify(JSON.stringify(payload))}]`;
    this.emit('message', wire);
  }
}

function fakeFetchSequence(responses: Array<{ ok: boolean; status?: number; json: () => Promise<unknown> }>) {
  let call = 0;
  return vi.fn().mockImplementation(() => Promise.resolve(responses[Math.min(call++, responses.length - 1)]));
}

/**
 * A fetch double whose behavior is driven by a handler function so we can
 * respond differently per-URL (e.g. the token refresh endpoint vs. the
 * CHZZK session endpoints), rather than a fixed call-order sequence.
 */
function fakeFetchRouter(
  handler: (url: string, init?: RequestInit) => { ok: boolean; status?: number; json: () => Promise<unknown> }
) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => Promise.resolve(handler(url, init)));
}

// connect()/connectOnce() resolve the socket URL through a chain of awaited
// promises (fetchImpl() then res.json()) before constructing the socket, so
// FakeEioSocket.instances[n] does not exist in the same synchronous tick or
// even after a fixed number of microtask flushes (the exact hop count
// depends on the async call chain). Poll microtasks until it shows up
// instead of guessing a magic number of `await Promise.resolve()` calls.
async function waitForInstance(index: number): Promise<FakeEioSocket> {
  for (let i = 0; i < 100; i++) {
    if (FakeEioSocket.instances[index]) return FakeEioSocket.instances[index];
    await Promise.resolve();
  }
  throw new Error(`FakeEioSocket.instances[${index}] was never created`);
}

describe('ChzzkSocketClient', () => {
  it('sends the Socket.IO root namespace CONNECT frame after Engine.IO opens', async () => {
    FakeEioSocket.instances = [];
    const fetchImpl = fakeFetchSequence([{ ok: true, json: async () => ({ content: { url: 'https://fake.example/sessions/abc?auth=xyz' } }) }]);
    const client = new ChzzkSocketClient({ clientId: 'cid', clientSecret: 'secret', accessToken: 'token', refreshToken: 'refresh', fetchImpl: fetchImpl as unknown as typeof fetch, EioSocketImpl: FakeEioSocket as any });
    client.connect().catch(() => undefined);
    const socket = await waitForInstance(0);
    socket.emit('open');
    expect(socket.sent).toEqual(['0']);
    client.disconnect();
  });

  it('fetches a socket URL, connects, and subscribes to donation events', async () => {
    FakeEioSocket.instances = [];
    const fetchImpl = fakeFetchSequence([
      { ok: true, json: async () => ({ content: { url: 'https://fake.example/sessions/abc?auth=xyz' } }) },
      { ok: true, json: async () => ({ content: {} }) },
    ]);

    const client = new ChzzkSocketClient({
      clientId: 'cid',
      clientSecret: 'secret',
      accessToken: 'token',
      refreshToken: 'refresh',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      EioSocketImpl: FakeEioSocket as any,
    });

    const statusEvents: string[] = [];
    client.on('status', (s) => statusEvents.push(s));

    const connectPromise = client.connect();
    const socket = await waitForInstance(0);
    socket.simulateMessage({ type: 'connected', data: { sessionKey: 'session-key-1' } });
    await connectPromise;

    expect(statusEvents).toContain('connected');
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/open/v1/sessions/events/subscribe/donation?sessionKey=session-key-1'),
      expect.objectContaining({ method: 'POST' })
    );
    // The socket must be constructed against the Socket.IO path/transports,
    // not a bare WebSocket, per the live-verified protocol.
    expect(socket.opts).toMatchObject({ path: '/socket.io/', transports: ['polling', 'websocket'] });
  });

  it('emits a donation event when the socket receives a DONATION message', async () => {
    FakeEioSocket.instances = [];
    const fetchImpl = fakeFetchSequence([
      { ok: true, json: async () => ({ content: { url: 'https://fake.example/sessions/abc?auth=xyz' } }) },
      { ok: true, json: async () => ({ content: {} }) },
    ]);

    const client = new ChzzkSocketClient({
      clientId: 'cid',
      clientSecret: 'secret',
      accessToken: 'token',
      refreshToken: 'refresh',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      EioSocketImpl: FakeEioSocket as any,
    });

    const donations: unknown[] = [];
    client.on('donation', (d) => donations.push(d));

    const connectPromise = client.connect();
    const socket = await waitForInstance(0);
    socket.simulateMessage({ type: 'connected', data: { sessionKey: 'session-key-1' } });
    await connectPromise;

    socket.simulateMessage({
      type: 'DONATION',
      data: {
        donationType: 'CHAT',
        channelId: 'streamer-channel',
        donatorChannelId: 'viewer-channel',
        donatorNickname: '홍길동',
        payAmount: 1000,
        donationText: '3번',
      },
    });

    expect(donations).toEqual([{ channelId: 'viewer-channel', nickname: '홍길동', amount: 1000, message: '3번' }]);
  });

  it('emits reconnecting then connected status when the socket closes unexpectedly', async () => {
    FakeEioSocket.instances = [];
    const fetchImpl = fakeFetchSequence([
      { ok: true, json: async () => ({ content: { url: 'https://fake.example/sessions/abc?auth=xyz' } }) },
      { ok: true, json: async () => ({ content: {} }) },
      { ok: true, json: async () => ({ content: { url: 'https://fake.example/sessions/def?auth=xyz' } }) },
      { ok: true, json: async () => ({ content: {} }) },
    ]);

    const client = new ChzzkSocketClient({
      clientId: 'cid',
      clientSecret: 'secret',
      accessToken: 'token',
      refreshToken: 'refresh',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      EioSocketImpl: FakeEioSocket as any,
      reconnectDelayMs: 0,
    });

    const statusEvents: string[] = [];
    client.on('status', (s) => statusEvents.push(s));

    const connectPromise = client.connect();
    const socket0 = await waitForInstance(0);
    socket0.simulateMessage({ type: 'connected', data: { sessionKey: 'session-key-1' } });
    await connectPromise;

    socket0.emit('close');
    await new Promise((resolve) => setTimeout(resolve, 10));
    // The reconnect path re-enters connectOnce() -> fetchSocketUrl(), which
    // goes through the same async chain before FakeEioSocket.instances[1] exists.
    const socket1 = await waitForInstance(1);
    socket1.simulateMessage({ type: 'connected', data: { sessionKey: 'session-key-2' } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(statusEvents).toEqual(['connected', 'reconnecting', 'connected']);
  });

  it('refreshes tokens on a 401 from fetchSocketUrl, retries with the new token, and still delivers donations', async () => {
    FakeEioSocket.instances = [];
    const authCalls: string[] = [];
    const fetchImpl = fakeFetchRouter((url, init) => {
      if (url.includes('/auth/v1/token')) {
        return { ok: true, json: async () => ({ content: { accessToken: 'new-token', refreshToken: 'new-refresh' } }) };
      }
      if (url.includes('/sessions/auth')) {
        const authHeader = (init?.headers as Record<string, string>)?.Authorization ?? '';
        authCalls.push(authHeader);
        if (authHeader === 'Bearer old-token') {
          return { ok: false, status: 401, json: async () => ({}) };
        }
        return { ok: true, json: async () => ({ content: { url: 'https://fake.example/sessions/abc?auth=xyz' } }) };
      }
      if (url.includes('/subscribe/donation')) {
        return { ok: true, json: async () => ({ content: {} }) };
      }
      throw new Error(`unexpected fetch to ${url}`);
    });

    const onTokensRefreshed = vi.fn();
    const client = new ChzzkSocketClient({
      clientId: 'cid',
      clientSecret: 'secret',
      accessToken: 'old-token',
      refreshToken: 'old-refresh',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      EioSocketImpl: FakeEioSocket as any,
      onTokensRefreshed,
    });

    const statusEvents: string[] = [];
    client.on('status', (s) => statusEvents.push(s));

    const connectPromise = client.connect();
    const socket = await waitForInstance(0);
    socket.simulateMessage({ type: 'connected', data: { sessionKey: 'session-key-1' } });
    await connectPromise;

    expect(statusEvents).toContain('connected');
    expect(authCalls).toEqual(['Bearer old-token', 'Bearer new-token']);
    expect(onTokensRefreshed).toHaveBeenCalledWith({ accessToken: 'new-token', refreshToken: 'new-refresh' });

    const donations: unknown[] = [];
    client.on('donation', (d) => donations.push(d));
    socket.simulateMessage({
      type: 'DONATION',
      data: {
        donationType: 'CHAT',
        channelId: 'streamer-channel',
        donatorChannelId: 'viewer-channel',
        donatorNickname: '홍길동',
        payAmount: 1000,
        donationText: '3번',
      },
    });
    expect(donations).toEqual([{ channelId: 'viewer-channel', nickname: '홍길동', amount: 1000, message: '3번' }]);
  });

  it('emits needs_reauth and stops reconnecting when the refresh token is also invalid', async () => {
    FakeEioSocket.instances = [];
    const fetchImpl = fakeFetchRouter((url) => {
      if (url.includes('/auth/v1/token')) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      if (url.includes('/sessions/auth')) {
        return { ok: false, status: 401, json: async () => ({}) };
      }
      throw new Error(`unexpected fetch to ${url}`);
    });

    const client = new ChzzkSocketClient({
      clientId: 'cid',
      clientSecret: 'secret',
      accessToken: 'old-token',
      refreshToken: 'dead-refresh',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      EioSocketImpl: FakeEioSocket as any,
      reconnectDelayMs: 0,
    });

    const statusEvents: string[] = [];
    client.on('status', (s) => statusEvents.push(s));

    await expect(client.connect()).rejects.toThrow();

    // Give any (incorrect) scheduled retry a chance to fire before asserting
    // that no further connection attempts happen.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(statusEvents).toEqual(['needs_reauth']);
    expect(FakeEioSocket.instances.length).toBe(0);
  });

  it('schedules a retry when a connection attempt fails before a socket is ever constructed', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      FakeEioSocket.instances = [];
      let sessionsAuthCalls = 0;
      const fetchImpl = fakeFetchRouter((url) => {
        if (url.includes('/sessions/auth')) {
          sessionsAuthCalls++;
          if (sessionsAuthCalls === 1) {
            // Simulate a network-style failure that is NOT a 401, so no
            // token refresh is attempted — just a plain fetch-stage failure
            // before any socket is constructed.
            return { ok: false, status: 500, json: async () => ({}) };
          }
          return { ok: true, json: async () => ({ content: { url: 'https://fake.example/sessions/retry?auth=xyz' } }) };
        }
        if (url.includes('/subscribe/donation')) {
          return { ok: true, json: async () => ({ content: {} }) };
        }
        throw new Error(`unexpected fetch to ${url}`);
      });

      const client = new ChzzkSocketClient({
        clientId: 'cid',
        clientSecret: 'secret',
        accessToken: 'token',
        refreshToken: 'refresh',
        fetchImpl: fetchImpl as unknown as typeof fetch,
        EioSocketImpl: FakeEioSocket as any,
        reconnectDelayMs: 0,
      });

      const statusEvents: string[] = [];
      client.on('status', (s) => statusEvents.push(s));

      // The first connect() call's returned promise must still reject with
      // the original error, preserving the external contract that index.ts
      // relies on for its initial .catch(...) logging.
      await expect(client.connect()).rejects.toThrow();

      // No socket should have been constructed for the failed first attempt.
      expect(FakeEioSocket.instances.length).toBe(0);

      // The retry is armed via a real setTimeout (reconnectDelayMs: 0), which
      // requires a macrotask tick to fire — not just microtask flushing — so
      // give the timer queue a chance to run before polling for the instance.
      await new Promise((resolve) => setTimeout(resolve, 10));
      const socket = await waitForInstance(0);
      socket.simulateMessage({ type: 'connected', data: { sessionKey: 'session-key-retry' } });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(statusEvents).toEqual(['reconnecting', 'connected']);
    }
  });
});
