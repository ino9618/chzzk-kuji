import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createSession, setSetting, type Db } from '../../src/server/db';
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

describe('GET /api/overlay/board', () => {
  it('exposes a non-cacheable version for automatic OBS refresh', async () => {
    const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
    const res = await request(app).get('/api/overlay/version');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.body.version).toEqual(expect.any(String));
  });

  it('requires no authentication and masks nicknames by default', async () => {
    await agent.post('/api/admin/session').send({
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 1,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });

    const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
    const { processDonation } = await import('../../src/server/donationProcessor');
    await processDonation(db, { channelId: 'c1', nickname: '홍길동', amount: 1000, message: '1번' });

    const res = await request(app).get('/api/overlay/board');
    expect(res.status).toBe(200);
    expect(res.body.tickets[0].ownerNickname).toBe('홍*동');
  });

  it('shows full nicknames when the admin sets full display mode', async () => {
    await agent.post('/api/admin/session').send({
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 1,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });
    await agent.post('/api/admin/nickname-mode').send({ mode: 'full' });

    const { processDonation } = await import('../../src/server/donationProcessor');
    await processDonation(db, { channelId: 'c1', nickname: '홍길동', amount: 1000, message: '1번' });

    const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
    const res = await request(app).get('/api/overlay/board');
    expect(res.body.tickets[0].ownerNickname).toBe('홍길동');
  });

  it('reveals the prize name only for sold tickets, keeping it hidden for tickets still available', async () => {
    await agent.post('/api/admin/session').send({
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 2,
      tickets: [
        { number: 1, prizeName: 'A상', prizeGrade: 'A' },
        { number: 2, prizeName: 'B상', prizeGrade: 'B' },
      ],
    });
    const { processDonation } = await import('../../src/server/donationProcessor');
    await processDonation(db, { channelId: 'c1', nickname: '홍길동', amount: 1000, message: '1번' });

    const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
    const res = await request(app).get('/api/overlay/board');

    const sold = res.body.tickets.find((t: any) => t.number === 1);
    const available = res.body.tickets.find((t: any) => t.number === 2);
    expect(sold).toMatchObject({ status: 'sold', prizeName: 'A상', prizeGrade: 'A' });
    expect(available.prizeName).toBeNull();
    expect(available.prizeGrade).toBeNull();
  });

  it('reveals a prize image only after its ticket is sold', async () => {
    const image = 'data:image/webp;base64,UklGRg==';
    const session = await createSession(db, {
      name: '이미지 회차', ticketPrice: 1000, numberRangeMin: 1, numberRangeMax: 1,
      tickets: [{ number: 1, prizeName: '사진 상품', prizeGrade: 'A', prizeImageUrl: image }],
    });
    const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
    expect((await request(app).get('/api/overlay/board')).body.tickets[0].prizeImageUrl).toBeNull();
    const { processDonation } = await import('../../src/server/donationProcessor');
    await processDonation(db, { channelId: 'c1', nickname: '홍길동', amount: 1000, message: '1번' });
    expect((await request(app).get('/api/overlay/board')).body.tickets[0].prizeImageUrl).toBe(image);
    expect(session.id).toBeGreaterThan(0);
  });

  it('includes a grade summary with claimed/total counts, without revealing which numbers belong to each grade', async () => {
    await agent.post('/api/admin/session').send({
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 3,
      tickets: [
        { number: 1, prizeName: '스타벅스 기프티콘', prizeGrade: 'A' },
        { number: 2, prizeName: '올리브영 상품권', prizeGrade: 'B' },
        { number: 3, prizeName: '올리브영 상품권', prizeGrade: 'B' },
      ],
    });
    const { processDonation } = await import('../../src/server/donationProcessor');
    await processDonation(db, { channelId: 'c1', nickname: '홍길동', amount: 1000, message: '2번' });

    const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
    const res = await request(app).get('/api/overlay/board');

    expect(res.body.grades).toEqual(
      expect.arrayContaining([
        { grade: 'A', prizeName: '스타벅스 기프티콘', total: 1, claimed: 0 },
        { grade: 'B', prizeName: '올리브영 상품권', total: 2, claimed: 1 },
      ])
    );
    expect(res.body.grades).toHaveLength(2);
  });

  it('omits the grade summary entirely when the session has no graded tickets', async () => {
    await agent.post('/api/admin/session').send({
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 1,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });

    const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
    const res = await request(app).get('/api/overlay/board');
    expect(res.body.grades).toEqual([]);
  });
});

describe('GET /api/overlay/audio-settings', () => {
  it('is public, non-cacheable, and reflects saved audio switches', async () => {
    await setSetting(db, 'overlay_sound_enabled', 'false');
    await setSetting(db, 'overlay_tts_enabled', 'true');
    const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
    const res = await request(app).get('/api/overlay/audio-settings');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.body).toEqual({ soundEnabled: false, ttsEnabled: true });
  });
});

describe('GET /api/overlay/roulette', () => {
  it('exposes the configured items with their exact weighted probabilities', async () => {
    await agent.post('/api/admin/roulette').send({
      enabled: true,
      minimumAmount: 3000,
      registrationAmount: 5000,
      items: [{ label: '노래 한 곡', weight: 3 }, { label: '랜덤 미션', weight: 1 }],
    });

    const { app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH });
    const res = await request(app).get('/api/overlay/roulette');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.body).toEqual({
      enabled: true,
      minimumAmount: 3000,
      items: [
        { label: '노래 한 곡', weight: 3, probability: 75 },
        { label: '랜덤 미션', weight: 1, probability: 25 },
      ],
    });
  });
});
