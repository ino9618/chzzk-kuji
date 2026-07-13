import { getSetting, insertRouletteLog, type Db } from './db';
import type { DonationEvent } from './donationProcessor';

export interface RouletteItem {
  label: string;
  weight: number;
}

export interface RouletteConfig {
  enabled: boolean;
  minimumAmount: number;
  items: RouletteItem[];
}

export interface RouletteResult {
  label: string;
  nickname: string;
  amount: number;
}

export type RouletteProcessResult =
  | { status: 'ignored' }
  | { status: 'disabled' }
  | { status: 'below_minimum'; minimumAmount: number }
  | { status: 'triggered'; result: RouletteResult };

const DEFAULT_ITEMS: RouletteItem[] = [
  { label: '노래 한 곡', weight: 3 },
  { label: '랜덤 미션', weight: 2 },
  { label: '다시 돌리기', weight: 1 },
];

export async function getRouletteConfig(db: Db): Promise<RouletteConfig> {
  const [enabled, amount, rawItems] = await Promise.all([
    getSetting(db, 'roulette_enabled'), getSetting(db, 'roulette_minimum_amount'), getSetting(db, 'roulette_items'),
  ]);
  let items = DEFAULT_ITEMS;
  try {
    const parsed = JSON.parse(rawItems ?? 'null');
    if (Array.isArray(parsed) && parsed.length > 0) items = parsed;
  } catch { /* use defaults */ }
  return { enabled: enabled === 'true', minimumAmount: Math.max(1, Number(amount) || 1000), items };
}

export function pickRouletteItem(items: RouletteItem[], random = Math.random): RouletteItem {
  const valid = items.filter((item) => item.label.trim() && Number.isFinite(item.weight) && item.weight > 0);
  if (valid.length === 0) throw new Error('roulette_has_no_items');
  const total = valid.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * total;
  for (const item of valid) {
    cursor -= item.weight;
    if (cursor < 0) return item;
  }
  return valid[valid.length - 1];
}

export async function processRouletteDonation(db: Db, event: DonationEvent, random = Math.random): Promise<RouletteProcessResult> {
  if (!/(?:^|\s)!룰렛(?:\s|$)/u.test(event.message)) return { status: 'ignored' };
  const config = await getRouletteConfig(db);
  if (!config.enabled) return { status: 'disabled' };
  if (event.amount < config.minimumAmount) return { status: 'below_minimum', minimumAmount: config.minimumAmount };
  const item = pickRouletteItem(config.items, random);
  const result = { label: item.label, nickname: event.nickname, amount: event.amount };
  await insertRouletteLog(db, { donorNickname: event.nickname, donorChannelId: event.channelId, amount: event.amount, resultLabel: item.label });
  return { status: 'triggered', result };
}
