import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createSession, type Db } from '../../src/server/db';
import { registerSocketHandlers, parseCookie } from '../../src/server/index';
import { createTestDb } from '../helpers/testDb';
import { broadcastQueueUpdate, broadcastConnectionStatus, broadcastBoardUpdate } from '../../src/server/broadcast';
import { registerAdminToken } from '../../src/server/middleware/adminAuth';

describe('parseCookie', () => {
  it('extracts a named cookie value from a raw cookie header', () => {
    expect(parseCookie('admin_token=abc123; other=xyz', 'admin_token')).toBe('abc123');
  });

  it('returns undefined when the cookie is not present', () => {
    expect(parseCookie('other=xyz', 'admin_token')).toBeUndefined();
  });

  it('returns undefined for an undefined header', () => {
    expect(parseCookie(undefined, 'admin_token')).toBeUndefined();
  });

  it('handles a single cookie with no trailing separators', () => {
    expect(parseCookie('admin_token=onlyone', 'admin_token')).toBe('onlyone');
  });
});

describe('admin-room broadcast scoping (integration)', () => {
  let db: Db;
  let httpServer: HttpServer;
  let io: SocketIOServer;
  let port: number;
  let adminClient: ClientSocket;
  let publicClient: ClientSocket;

  beforeEach(async () => {
    db = await createTestDb();
    httpServer = createServer();
    io = new SocketIOServer(httpServer, { cors: { origin: true } });
    registerSocketHandlers(io, db);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    const address = httpServer.address();
    port = typeof address === 'object' && address ? address.port : 0;
  });

  afterEach(async () => {
    await db.close();
    adminClient?.close();
    publicClient?.close();
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('delivers queue:update and connection:status only to sockets with a valid admin_token cookie', async () => {
    const token = 'test-admin-token';
    registerAdminToken(token);

    adminClient = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      extraHeaders: { Cookie: `admin_token=${token}` },
    });
    publicClient = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((resolve) => adminClient.on('connect', () => resolve())),
      new Promise<void>((resolve) => publicClient.on('connect', () => resolve())),
    ]);

    // Give the server a tick to process the room join after connection.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const adminReceived: unknown[] = [];
    const publicReceived: unknown[] = [];
    adminClient.on('queue:update', (payload) => adminReceived.push(payload));
    publicClient.on('queue:update', (payload) => publicReceived.push(payload));

    broadcastQueueUpdate(io, { pending: ['issue-1'] });
    broadcastConnectionStatus(io, 'connected');

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(adminReceived).toEqual([{ pending: ['issue-1'] }]);
    expect(publicReceived).toEqual([]);
  });

  it('still broadcasts board:update to every connected socket regardless of admin status', async () => {
    publicClient = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => publicClient.on('connect', () => resolve()));

    const received: unknown[] = [];
    publicClient.on('board:update', (payload) => received.push(payload));

    broadcastBoardUpdate(io, { board: 'public-data' });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // The initial connection also emits a board:update, so we expect at least our broadcast.
    expect(received).toContainEqual({ board: 'public-data' });
  });

  it('lets an authenticated admin trigger a public overlay test without allowing public clients to trigger one', async () => {
    const image = 'data:image/webp;base64,UklGRg==';
    await createSession(db, { name: '이미지 회차', ticketPrice: 1000, numberRangeMin: 7, numberRangeMax: 7, tickets: [{ number: 7, prizeName: '한정판 피규어', prizeGrade: 'A', prizeImageUrl: image }] });
    const token = 'overlay-admin-token';
    registerAdminToken(token);
    adminClient = ioClient(`http://localhost:${port}`, { transports: ['websocket'], extraHeaders: { Cookie: `admin_token=${token}` } });
    publicClient = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
    await Promise.all([
      new Promise<void>((resolve) => adminClient.on('connect', resolve)),
      new Promise<void>((resolve) => publicClient.on('connect', resolve)),
    ]);

    const received: unknown[] = [];
    publicClient.on('overlay:test', (payload) => received.push(payload));
    const denied = await publicClient.emitWithAck('overlay:test', { number: 99 });
    expect(denied).toEqual({ ok: false, error: 'unauthorized' });

    const accepted = await adminClient.emitWithAck('overlay:test', {
      number: 99,
      grade: 'C',
      prizeName: '직접 입력 상품',
      nickname: '테스트 후원자',
      sourceTicketNumber: 7,
    });
    expect(accepted).toEqual({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(received).toContainEqual({ number: 7, grade: 'A', prizeName: '한정판 피규어', prizeImageUrl: image, nickname: '테스트 후원자' });

    expect(await adminClient.emitWithAck('overlay:test', {
      number: 3,
      grade: 'B',
      prizeName: '예시 상품',
      nickname: '예시 후원자',
      prizeImageUrl: '/assets/mascot-success-example.png',
    })).toEqual({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(received).toContainEqual({ number: 3, grade: 'B', prizeName: '예시 상품', prizeImageUrl: '/assets/mascot-success-example.png', nickname: '예시 후원자' });
  });

  it('broadcasts roulette overlay tests without recording a real roulette result', async () => {
    const token = 'roulette-overlay-admin-token';
    registerAdminToken(token);
    adminClient = ioClient(`http://localhost:${port}`, { transports: ['websocket'], extraHeaders: { Cookie: `admin_token=${token}` } });
    publicClient = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
    await Promise.all([
      new Promise<void>((resolve) => adminClient.on('connect', resolve)),
      new Promise<void>((resolve) => publicClient.on('connect', resolve)),
    ]);

    const received: unknown[] = [];
    publicClient.on('roulette:result', (payload) => received.push(payload));
    expect(await publicClient.emitWithAck('overlay:roulette-test', { label: '비공개' })).toEqual({ ok: false, error: 'unauthorized' });
    expect(await adminClient.emitWithAck('overlay:roulette-test', { label: 'A상', nickname: '후원자', amount: 5000 })).toEqual({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(received).toContainEqual(expect.objectContaining({ label: 'A상', nickname: '후원자', amount: 5000, items: expect.arrayContaining(['A상']), test: true }));
  });
});
