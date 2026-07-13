import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, resetDb } from '../helpers/testDb';
import { listRouletteLog, setSetting, type Db } from '../../src/server/db';
import { pickRouletteItem, processRouletteDonation } from '../../src/server/rouletteProcessor';

let db: Db;
beforeAll(async () => { db = await createTestDb(); });
beforeEach(async () => { await resetDb(db); });
afterAll(async () => { await db.close(); });

async function enableRoulette() {
  await setSetting(db, 'roulette_enabled', 'true');
  await setSetting(db, 'roulette_minimum_amount', '1000');
  await setSetting(db, 'roulette_items', JSON.stringify([{ label: 'A', weight: 3 }, { label: 'B', weight: 1 }]));
}

describe('roulette processor', () => {
  it('ignores normal donation messages and enforces the minimum amount', async () => {
    await enableRoulette();
    expect(await processRouletteDonation(db, { channelId: 'c1', nickname: '시청자', amount: 1000, message: '1번' })).toEqual({ status: 'ignored' });
    expect(await processRouletteDonation(db, { channelId: 'c1', nickname: '시청자', amount: 500, message: '!룰렛' })).toEqual({ status: 'below_minimum', minimumAmount: 1000 });
  });

  it('uses item weights deterministically at their boundaries', () => {
    const items = [{ label: 'A', weight: 3 }, { label: 'B', weight: 1 }];
    expect(pickRouletteItem(items, () => 0.74).label).toBe('A');
    expect(pickRouletteItem(items, () => 0.76).label).toBe('B');
  });

  it('records a triggered anonymous roulette result', async () => {
    await enableRoulette();
    const result = await processRouletteDonation(db, { channelId: 'anonymous', nickname: '익명 후원자', amount: 1000, message: '!룰렛' }, () => 0.9);
    expect(result).toEqual({ status: 'triggered', result: { label: 'B', nickname: '익명 후원자', amount: 1000 } });
    expect(await listRouletteLog(db)).toEqual([expect.objectContaining({ donorNickname: '익명 후원자', resultLabel: 'B' })]);
  });
});
