import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  createSession,
  getActiveSession,
  closeSession,
  getTicketsForSession,
  tryAssignTicket,
  insertDonationLog,
  updateDonationLogOutcomes,
  listPendingIssues,
  resolveDonationLog,
  listDonationLog,
  listAllWinners,
  getSetting,
  setSetting,
  type Db,
} from '../../src/server/db';
import { createTestDb, resetDb } from '../helpers/testDb';

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.close();
});

describe('sessions', () => {
  it('creates a session with tickets and marks it active', async () => {
    const session = await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 3,
      tickets: [
        { number: 1, prizeName: 'A상' },
        { number: 2, prizeName: 'B상' },
        { number: 3, prizeName: 'C상' },
      ],
    });
    expect(session.status).toBe('active');
    expect((await getActiveSession(db))?.id).toBe(session.id);
    expect(await getTicketsForSession(db, session.id)).toHaveLength(3);
  });

  it('closing a session removes it from getActiveSession', async () => {
    const session = await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 1,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });
    await closeSession(db, session.id);
    expect(await getActiveSession(db)).toBeUndefined();
  });
});

describe('tryAssignTicket', () => {
  it('assigns an available ticket successfully', async () => {
    const session = await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 5,
      tickets: [{ number: 3, prizeName: 'B상' }],
    });
    const logId = await insertDonationLog(db, {
      sessionId: session.id,
      donorNickname: '홍길동',
      donorChannelId: 'c1',
      amount: 1000,
      rawMessage: '3번',
      status: 'processed',
      needsAttention: false,
    });
    const outcome = await tryAssignTicket(db, session.id, 3, '홍길동', 'c1', logId);
    expect(outcome).toEqual({ number: 3, result: 'success', prizeName: 'B상' });
    const ticket = (await getTicketsForSession(db, session.id))[0];
    expect(ticket.status).toBe('sold');
    expect(ticket.ownerNickname).toBe('홍길동');
  });

  it('rejects an already-sold ticket as duplicate_rejected', async () => {
    const session = await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 5,
      tickets: [{ number: 3, prizeName: 'B상' }],
    });
    const logId1 = await insertDonationLog(db, {
      sessionId: session.id,
      donorNickname: 'first',
      donorChannelId: 'c1',
      amount: 1000,
      rawMessage: '3번',
      status: 'processed',
      needsAttention: false,
    });
    await tryAssignTicket(db, session.id, 3, 'first', 'c1', logId1);

    const logId2 = await insertDonationLog(db, {
      sessionId: session.id,
      donorNickname: 'second',
      donorChannelId: 'c2',
      amount: 1000,
      rawMessage: '3번',
      status: 'processed',
      needsAttention: false,
    });
    const outcome = await tryAssignTicket(db, session.id, 3, 'second', 'c2', logId2);
    expect(outcome).toEqual({ number: 3, result: 'duplicate_rejected' });
  });

  it('rejects an out-of-range number', async () => {
    const session = await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 5,
      tickets: [{ number: 3, prizeName: 'B상' }],
    });
    const logId = await insertDonationLog(db, {
      sessionId: session.id,
      donorNickname: '홍길동',
      donorChannelId: 'c1',
      amount: 1000,
      rawMessage: '99번',
      status: 'processed',
      needsAttention: false,
    });
    const outcome = await tryAssignTicket(db, session.id, 99, '홍길동', 'c1', logId);
    expect(outcome).toEqual({ number: 99, result: 'out_of_range' });
  });
});

describe('donation log queue', () => {
  it('lists only entries needing attention that are unresolved, and resolving removes them', async () => {
    const session = await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 5,
      tickets: [{ number: 1, prizeName: 'A상' }],
    });
    const okLogId = await insertDonationLog(db, {
      sessionId: session.id,
      donorNickname: 'ok',
      donorChannelId: 'c1',
      amount: 1000,
      rawMessage: '1번',
      status: 'processed',
      needsAttention: false,
    });
    await updateDonationLogOutcomes(db, okLogId, [{ number: 1, result: 'success', prizeName: 'A상' }], false);

    const badLogId = await insertDonationLog(db, {
      sessionId: session.id,
      donorNickname: 'bad',
      donorChannelId: 'c2',
      amount: 1500,
      rawMessage: '???',
      status: 'amount_mismatch',
      needsAttention: true,
    });

    const pending = await listPendingIssues(db);
    expect(pending.map((p) => p.id)).toEqual([badLogId]);

    await resolveDonationLog(db, badLogId);
    expect(await listPendingIssues(db)).toHaveLength(0);

    expect((await listDonationLog(db, 10)).map((e) => e.id).sort()).toEqual([okLogId, badLogId].sort());
  });
});

describe('settings', () => {
  it('returns undefined for unset keys and stores/retrieves values', async () => {
    expect(await getSetting(db, 'nickname_display_mode')).toBeUndefined();
    await setSetting(db, 'nickname_display_mode', 'masked');
    expect(await getSetting(db, 'nickname_display_mode')).toBe('masked');
    await setSetting(db, 'nickname_display_mode', 'full');
    expect(await getSetting(db, 'nickname_display_mode')).toBe('full');
  });
});

describe('listAllWinners', () => {
  it('returns sold tickets across both closed and the active session, including the session name', async () => {
    const session1 = await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 2,
      tickets: [
        { number: 1, prizeName: 'A상' },
        { number: 2, prizeName: 'B상' },
      ],
    });
    const log1 = await insertDonationLog(db, {
      sessionId: session1.id,
      donorNickname: '홍길동',
      donorChannelId: 'c1',
      amount: 1000,
      rawMessage: '1번',
      status: 'processed',
      needsAttention: false,
    });
    await tryAssignTicket(db, session1.id, 1, '홍길동', 'c1', log1);
    await closeSession(db, session1.id);

    const session2 = await createSession(db, {
      name: '2회차',
      ticketPrice: 2000,
      numberRangeMin: 1,
      numberRangeMax: 2,
      tickets: [
        { number: 1, prizeName: 'C상' },
        { number: 2, prizeName: 'D상' },
      ],
    });
    const log2 = await insertDonationLog(db, {
      sessionId: session2.id,
      donorNickname: '김철수',
      donorChannelId: 'c2',
      amount: 2000,
      rawMessage: '2번',
      status: 'processed',
      needsAttention: false,
    });
    await tryAssignTicket(db, session2.id, 2, '김철수', 'c2', log2);

    const winners = await listAllWinners(db);
    expect(winners).toHaveLength(2);
    expect(winners.map((w) => w.sessionName).sort()).toEqual(['1회차', '2회차']);

    const fromSession2 = winners.find((w) => w.sessionName === '2회차');
    expect(fromSession2).toMatchObject({
      number: 2,
      prizeName: 'D상',
      ownerNickname: '김철수',
      ownerChannelId: 'c2',
    });
  });

  it('excludes tickets that are still available (unsold)', async () => {
    const session = await createSession(db, {
      name: '1회차',
      ticketPrice: 1000,
      numberRangeMin: 1,
      numberRangeMax: 2,
      tickets: [
        { number: 1, prizeName: 'A상' },
        { number: 2, prizeName: 'B상' },
      ],
    });
    const logId = await insertDonationLog(db, {
      sessionId: session.id,
      donorNickname: '홍길동',
      donorChannelId: 'c1',
      amount: 1000,
      rawMessage: '1번',
      status: 'processed',
      needsAttention: false,
    });
    await tryAssignTicket(db, session.id, 1, '홍길동', 'c1', logId);

    const winners = await listAllWinners(db);
    expect(winners).toHaveLength(1);
    expect(winners[0].number).toBe(1);
  });
});
