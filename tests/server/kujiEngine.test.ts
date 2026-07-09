import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { createSession, insertDonationLog, getTicketsForSession, type Db } from '../../src/server/db';
import { assignNumbers } from '../../src/server/kujiEngine';
import { createTestDb, resetDb } from '../helpers/testDb';

let db: Db;
let sessionId: number;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await resetDb(db);
  const session = await createSession(db, {
    name: '1회차',
    ticketPrice: 1000,
    numberRangeMin: 1,
    numberRangeMax: 5,
    tickets: [
      { number: 1, prizeName: 'A상' },
      { number: 2, prizeName: 'B상' },
      { number: 3, prizeName: 'C상' },
    ],
  });
  sessionId = session.id;
});

describe('assignNumbers', () => {
  it('assigns every requested number when all are available', async () => {
    const logId = await insertDonationLog(db, {
      sessionId,
      donorNickname: '홍길동',
      donorChannelId: 'c1',
      amount: 2000,
      rawMessage: '1번 2번',
      status: 'processed',
      needsAttention: false,
    });
    const outcomes = await assignNumbers(db, sessionId, [1, 2], '홍길동', 'c1', logId);
    expect(outcomes).toEqual([
      { number: 1, result: 'success', prizeName: 'A상' },
      { number: 2, result: 'success', prizeName: 'B상' },
    ]);
  });

  it('allows partial success: one number succeeds, one is rejected as duplicate', async () => {
    const firstLogId = await insertDonationLog(db, {
      sessionId,
      donorNickname: 'first',
      donorChannelId: 'c1',
      amount: 1000,
      rawMessage: '2번',
      status: 'processed',
      needsAttention: false,
    });
    await assignNumbers(db, sessionId, [2], 'first', 'c1', firstLogId);

    const secondLogId = await insertDonationLog(db, {
      sessionId,
      donorNickname: 'second',
      donorChannelId: 'c2',
      amount: 2000,
      rawMessage: '1번 2번',
      status: 'processed',
      needsAttention: false,
    });
    const outcomes = await assignNumbers(db, sessionId, [1, 2], 'second', 'c2', secondLogId);
    expect(outcomes).toEqual([
      { number: 1, result: 'success', prizeName: 'A상' },
      { number: 2, result: 'duplicate_rejected' },
    ]);

    const tickets = await getTicketsForSession(db, sessionId);
    expect(tickets.find((t) => t.number === 2)?.ownerNickname).toBe('first');
    expect(tickets.find((t) => t.number === 1)?.ownerNickname).toBe('second');
  });

  it('reports out-of-range numbers without touching valid ones', async () => {
    const logId = await insertDonationLog(db, {
      sessionId,
      donorNickname: '홍길동',
      donorChannelId: 'c1',
      amount: 2000,
      rawMessage: '1번 99번',
      status: 'processed',
      needsAttention: false,
    });
    const outcomes = await assignNumbers(db, sessionId, [1, 99], '홍길동', 'c1', logId);
    expect(outcomes).toEqual([
      { number: 1, result: 'success', prizeName: 'A상' },
      { number: 99, result: 'out_of_range' },
    ]);
  });
});
