import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createSession, listDonationLog, setSetting, type Db } from '../../src/server/db';
import { processDonation } from '../../src/server/donationProcessor';
import { createTestDb, resetDb } from '../helpers/testDb';

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await resetDb(db);
});

describe('processDonation', () => {
  it('returns session_inactive and logs it when there is no active session', async () => {
    const result = await processDonation(db, { channelId: 'c1', nickname: '홍길동', amount: 1000, message: '1번' });
    expect(result).toEqual({ status: 'session_inactive' });
    expect(await listDonationLog(db, 10)).toHaveLength(1);
    expect((await listDonationLog(db, 10))[0].status).toBe('session_inactive');
  });

  it('returns amount_mismatch when amount is not a multiple of the ticket price', async () => {
    await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 5,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });
    const result = await processDonation(db, { channelId: 'c1', nickname: '홍길동', amount: 1500, message: '1번' });
    expect(result).toEqual({ status: 'amount_mismatch', ticketPrice: 1000 });
  });

  it('returns number_missing when the parsed number count does not match the paid ticket count', async () => {
    await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 5,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });
    const result = await processDonation(db, { channelId: 'c1', nickname: '홍길동', amount: 2000, message: '1번' });
    expect(result).toEqual({ status: 'number_missing', expectedCount: 2, foundNumbers: [1] });
  });

  it('assigns tickets and returns processed with outcomes on a valid donation', async () => {
    const session = await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 5,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });
    const result = await processDonation(db, { channelId: 'c1', nickname: '홍길동', amount: 1000, message: '1번' });
    expect(result).toEqual({
      status: 'processed',
      sessionId: session.id,
      outcomes: [{ number: 1, result: 'success', prizeName: 'A상' }],
    });
    const logs = await listDonationLog(db, 10);
    expect(logs[0].status).toBe('processed');
    expect(logs[0].needsAttention).toBe(false);
    expect(JSON.parse(logs[0].outcomes)).toEqual([{ number: 1, result: 'success', prizeName: 'A상' }]);
  });

  it('marks the log as needing attention when any ticket outcome is not a success', async () => {
    await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 5,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });
    await processDonation(db, { channelId: 'c1', nickname: 'first', amount: 1000, message: '1번' });
    await processDonation(db, { channelId: 'c2', nickname: 'second', amount: 1000, message: '1번' });

    const logs = await listDonationLog(db, 10);
    const secondLog = logs.find((l) => l.donorNickname === 'second')!;
    expect(secondLog.needsAttention).toBe(true);
    expect(JSON.parse(secondLog.outcomes)).toEqual([{ number: 1, result: 'duplicate_rejected' }]);
  });

  it('logs feature_disabled and skips assignment entirely when kuji_enabled is turned off, even with an active session and a valid donation', async () => {
    const session = await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 5,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });
    await setSetting(db, 'kuji_enabled', 'false');

    const result = await processDonation(db, { channelId: 'c1', nickname: '홍길동', amount: 1000, message: '1번' });
    expect(result).toEqual({ status: 'feature_disabled' });

    const logs = await listDonationLog(db, 10);
    expect(logs[0].status).toBe('feature_disabled');
    expect(logs[0].needsAttention).toBe(true);

    // The ticket must remain untouched -- confirm via a follow-up donation
    // with the feature re-enabled, which should still be able to claim it.
    await setSetting(db, 'kuji_enabled', 'true');
    const secondResult = await processDonation(db, { channelId: 'c2', nickname: '김철수', amount: 1000, message: '1번' });
    expect(secondResult).toEqual({
      status: 'processed',
      sessionId: session.id,
      outcomes: [{ number: 1, result: 'success', prizeName: 'A상' }],
    });
  });

  it('treats an unset kuji_enabled setting as enabled (default on)', async () => {
    await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 5,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });
    const result = await processDonation(db, { channelId: 'c1', nickname: '홍길동', amount: 1000, message: '1번' });
    expect(result.status).toBe('processed');
  });
});
