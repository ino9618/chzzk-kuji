import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDrawTicketSession, getActiveDrawTicketSession, listDrawTicketResults, type Db } from '../../src/server/db';
import { pickDrawTicketItem, previewDrawTicket, processDrawTicketDonation } from '../../src/server/drawTicketProcessor';
import { createTestDb, resetDb } from '../helpers/testDb';

let db: Db;
beforeAll(async () => { db = await createTestDb(); });
beforeEach(async () => { await resetDb(db); });
afterAll(async () => { await db.close(); });

async function createDraw() {
  return createDrawTicketSession(db, {
    name: '테스트 뽑기', command: '!뽑기', ticketPrice: 3000,
    items: [{ label: 'A 상품', weight: 3, quantity: 1 }, { label: 'B 상품', weight: 1, quantity: 2 }],
  });
}

describe('draw ticket processor', () => {
  it('uses streamer weights and ignores unrelated messages', async () => {
    const session = await createDraw();
    expect(pickDrawTicketItem(session.items, () => 0.74).item.label).toBe('A 상품');
    expect(pickDrawTicketItem(session.items, () => 0.76).item.label).toBe('B 상품');
    expect(await processDrawTicketDonation(db, { channelId: 'c1', nickname: '시청자', amount: 3000, message: '안녕하세요' })).toEqual({ status: 'ignored' });
  });

  it('requires the configured exact amount and command', async () => {
    await createDraw();
    expect(await processDrawTicketDonation(db, { channelId: 'c1', nickname: '시청자', amount: 2999, message: '!뽑기' })).toEqual({ status: 'amount_mismatch', ticketPrice: 3000 });
  });

  it('depletes inventory and never selects a sold-out item again', async () => {
    await createDraw();
    const first = await processDrawTicketDonation(db, { channelId: 'c1', nickname: '첫째', amount: 3000, message: '!뽑기' }, () => 0);
    expect(first).toMatchObject({ status: 'triggered', result: { label: 'A 상품', remainingTotal: 2 } });
    const second = await processDrawTicketDonation(db, { channelId: 'c2', nickname: '둘째', amount: 3000, message: '!뽑기' }, () => 0);
    expect(second).toMatchObject({ status: 'triggered', result: { label: 'B 상품', remainingTotal: 1 } });
    const third = await processDrawTicketDonation(db, { channelId: 'c3', nickname: '셋째', amount: 3000, message: '!뽑기' }, () => 0);
    expect(third).toMatchObject({ status: 'triggered', result: { label: 'B 상품', remainingTotal: 0 } });
    expect(await getActiveDrawTicketSession(db)).toBeUndefined();
    expect(await listDrawTicketResults(db)).toHaveLength(3);
  });

  it('previews without consuming inventory', async () => {
    await createDraw();
    const result = await previewDrawTicket(db, { channelId: 'test', nickname: '테스트', amount: 3000, message: '!뽑기' }, () => 0);
    expect(result).toMatchObject({ status: 'triggered', result: { label: 'A 상품', remainingTotal: 3 } });
    expect((await getActiveDrawTicketSession(db))?.items.map((item) => item.remainingQuantity)).toEqual([1, 2]);
    expect(await listDrawTicketResults(db)).toEqual([]);
  });
});
