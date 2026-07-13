import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Db } from '../../src/server/db';
import { createApp } from '../../src/server/index';
import { createTestDb, resetDb } from '../helpers/testDb';

let db: Db;
let agent: ReturnType<typeof request.agent>;
const PASSWORD = 'test-password-123';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 10);

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await resetDb(db);
  const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ password: PASSWORD });
});

describe('admin session routes', () => {
  it('does not expose the removed donation simulator endpoint', async () => {
    const res = await agent.post('/api/admin/donation-simulator').send({ nickname: '테스트', amount: 1000, message: '1번' });
    expect(res.status).toBe(404);
  });

  it('reports no active session initially', async () => {
    const res = await agent.get('/api/admin/session');
    expect(res.body).toEqual({ active: false });
  });

  it('creates a session and then reports it as active', async () => {
    const createRes = await agent.post('/api/admin/session').send({
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 2,
      tickets: [
        { number: 1, prizeName: 'A상' },
        { number: 2, prizeName: 'B상' },
      ],
    });
    expect(createRes.status).toBe(200);

    const getRes = await agent.get('/api/admin/session');
    expect(getRes.body.active).toBe(true);
    expect(getRes.body.tickets).toHaveLength(2);
  });

  it('closes the active session', async () => {
    await agent.post('/api/admin/session').send({
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 1,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });
    await agent.post('/api/admin/session/close');
    const getRes = await agent.get('/api/admin/session');
    expect(getRes.body).toEqual({ active: false });
  });

  it('rejects unauthenticated requests', async () => {
    const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
    const res = await request(app).get('/api/admin/session');
    expect(res.status).toBe(401);
  });

  it('returns previous sessions with their ticket configuration', async () => {
    await agent.post('/api/admin/session').send({
      name: '지난 회차', ticketPrice: 1500, numberRangeMin: 1, numberRangeMax: 2,
      tickets: [{ number: 1, prizeName: '커피', prizeGrade: 'A' }, { number: 2, prizeName: '케이크', prizeGrade: 'B' }],
    });
    await agent.post('/api/admin/session/close');

    const res = await agent.get('/api/admin/sessions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: '지난 회차', ticketPrice: 1500, status: 'closed', soldCount: 0 });
    expect(res.body[0].tickets).toEqual(expect.arrayContaining([
      expect.objectContaining({ number: 1, prizeName: '커피', prizeGrade: 'A' }),
      expect.objectContaining({ number: 2, prizeName: '케이크', prizeGrade: 'B' }),
    ]));
  });

  it('rejects unsupported prize image data', async () => {
    const res = await agent.post('/api/admin/session').send({
      name: '잘못된 이미지', ticketPrice: 1000, numberRangeMin: 1, numberRangeMax: 1,
      tickets: [{ number: 1, prizeName: '상품', prizeImageUrl: 'https://example.com/image.png' }],
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid_prize_image' });
  });
});

describe('roulette settings', () => {
  it('saves weighted items and can run a test spin', async () => {
    const config = { enabled: true, minimumAmount: 2000, registrationAmount: 5000, items: [{ label: '노래', weight: 3 }, { label: '미션', weight: 1 }] };
    expect((await agent.post('/api/admin/roulette').send(config)).body).toEqual(config);
    expect((await agent.get('/api/admin/roulette')).body).toEqual(config);
    const spin = await agent.post('/api/admin/roulette/test');
    expect(spin.status).toBe(200);
    expect(spin.body.status).toBe('triggered');
    expect(['노래', '미션']).toContain(spin.body.result.label);
    expect((await agent.get('/api/admin/roulette/log')).body).toHaveLength(1);
  });

  it('rejects invalid roulette weights', async () => {
    const res = await agent.post('/api/admin/roulette').send({ enabled: true, minimumAmount: 1000, registrationAmount: 5000, items: [{ label: 'A', weight: 0 }, { label: 'B', weight: 1 }] });
    expect(res.status).toBe(400);
  });
});

describe('admin queue and log routes', () => {
  it('lists pending issues and marks them resolved', async () => {
    await agent.post('/api/admin/session').send({
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 1,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });

    // Simulate an amount_mismatch by calling processDonation indirectly is not exposed via HTTP;
    // instead exercise the queue endpoints against the DB directly through db helpers.
    const { insertDonationLog } = await import('../../src/server/db');
    await insertDonationLog(db, {
      sessionId: null,
      donorNickname: 'bad',
      donorChannelId: 'c1',
      amount: 1500,
      rawMessage: '???',
      status: 'amount_mismatch',
      needsAttention: true,
    });
    await insertDonationLog(db, {
      sessionId: null,
      donorNickname: 'also-bad',
      donorChannelId: 'c2',
      amount: 1000,
      rawMessage: '',
      status: 'number_missing',
      needsAttention: true,
    });

    const queueRes = await agent.get('/api/admin/queue');
    expect(queueRes.body).toHaveLength(2);
    const logId = queueRes.body[0].id;

    const resolveRes = await agent.post(`/api/admin/queue/${logId}/resolve`);
    expect(resolveRes.status).toBe(200);

    const queueAfter = await agent.get('/api/admin/queue');
    expect(queueAfter.body).toHaveLength(1);

    const resolveAllRes = await agent.post('/api/admin/queue/resolve-all');
    expect(resolveAllRes.body).toEqual({ ok: true, resolvedCount: 1 });
    expect((await agent.get('/api/admin/queue')).body).toHaveLength(0);
  });
});

describe('winners list', () => {
  it('lists sold tickets across a closed session and the current active one', async () => {
    await agent.post('/api/admin/session').send({
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 1,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });
    const { processDonation } = await import('../../src/server/donationProcessor');
    await processDonation(db, { channelId: 'c1', nickname: '홍길동', amount: 1000, message: '1번' });
    await agent.post('/api/admin/session/close');

    await agent.post('/api/admin/session').send({
      name: '2회차',
      ticketPrice: 2000,
      numberRangeMin: 1,
      numberRangeMax: 1,
      tickets: [{ number: 1, prizeName: 'B상' }],
    });
    await processDonation(db, { channelId: 'c2', nickname: '김철수', amount: 2000, message: '1번' });

    const res = await agent.get('/api/admin/winners');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((w: any) => w.sessionName).sort()).toEqual(['1회차', '2회차']);
  });

  it('rejects unauthenticated requests', async () => {
    const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
    const res = await request(app).get('/api/admin/winners');
    expect(res.status).toBe(401);
  });
});

describe('nickname mode setting', () => {
  it('defaults to masked and can be switched to full', async () => {
    const getRes = await agent.get('/api/admin/nickname-mode');
    expect(getRes.body).toEqual({ mode: 'masked' });

    await agent.post('/api/admin/nickname-mode').send({ mode: 'full' });
    const getRes2 = await agent.get('/api/admin/nickname-mode');
    expect(getRes2.body).toEqual({ mode: 'full' });
  });
});

describe('kuji-enabled setting', () => {
  it('defaults to enabled and can be turned off/on', async () => {
    const getRes = await agent.get('/api/admin/kuji-enabled');
    expect(getRes.body).toEqual({ enabled: true });

    await agent.post('/api/admin/kuji-enabled').send({ enabled: false });
    const getRes2 = await agent.get('/api/admin/kuji-enabled');
    expect(getRes2.body).toEqual({ enabled: false });

    await agent.post('/api/admin/kuji-enabled').send({ enabled: true });
    const getRes3 = await agent.get('/api/admin/kuji-enabled');
    expect(getRes3.body).toEqual({ enabled: true });
  });

  it('rejects unauthenticated requests', async () => {
    const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
    const res = await request(app).get('/api/admin/kuji-enabled');
    expect(res.status).toBe(401);
  });
});

describe('chzzk connection summary', () => {
  it('returns the linked owner and current connection state', async () => {
    const { setSetting } = await import('../../src/server/db');
    await setSetting(db, 'owner_channel_id', 'owner-1');
    await setSetting(db, 'owner_channel_name', '테스트 채널');
    const res = await agent.get('/api/admin/chzzk-connection');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'not_configured', channelId: 'owner-1', channelName: '테스트 채널', lastEventAt: null });
  });

  it('removes stored tokens and owner information on disconnect', async () => {
    const { getSetting, setSetting } = await import('../../src/server/db');
    await setSetting(db, 'owner_channel_id', 'owner-1');
    await setSetting(db, 'owner_channel_name', '테스트 채널');
    await setSetting(db, 'chzzk_access_token', 'encrypted-access');
    await setSetting(db, 'chzzk_refresh_token', 'encrypted-refresh');
    const res = await agent.post('/api/admin/chzzk-connection/disconnect');
    expect(res.status).toBe(200);
    expect(await getSetting(db, 'owner_channel_id')).toBeUndefined();
    expect(await getSetting(db, 'chzzk_access_token')).toBeUndefined();
  });
});

describe('basic settings', () => {
  it('returns defaults and saves all shared settings together', async () => {
    expect((await agent.get('/api/admin/basic-settings')).body).toEqual({ kujiEnabled: true, defaultTicketPrice: 1000, nicknameMode: 'masked' });
    const saved = await agent.post('/api/admin/basic-settings').send({ kujiEnabled: false, defaultTicketPrice: 2500, nicknameMode: 'full' });
    expect(saved.status).toBe(200);
    expect((await agent.get('/api/admin/basic-settings')).body).toEqual({ kujiEnabled: false, defaultTicketPrice: 2500, nicknameMode: 'full' });
  });

  it('rejects invalid ticket prices', async () => {
    const res = await agent.post('/api/admin/basic-settings').send({ kujiEnabled: true, defaultTicketPrice: 0, nicknameMode: 'masked' });
    expect(res.status).toBe(400);
  });
});
