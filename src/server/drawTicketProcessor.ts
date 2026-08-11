import {
  getActiveDrawTicketSession,
  type Db,
  type DrawTicketItem,
} from './db';
import type { DonationEvent } from './donationProcessor';

export interface DrawTicketResult {
  sessionId: number;
  label: string;
  nickname: string;
  amount: number;
  probability: number;
  remainingTotal: number;
}

export type DrawTicketProcessResult =
  | { status: 'ignored' }
  | { status: 'inactive' }
  | { status: 'amount_mismatch'; ticketPrice: number }
  | { status: 'sold_out' }
  | { status: 'triggered'; result: DrawTicketResult };

function containsCommand(message: string, command: string): boolean {
  return message.trim().split(/\s+/u).includes(command);
}

export function pickDrawTicketItem(items: DrawTicketItem[], random = Math.random): { item: DrawTicketItem; probability: number } {
  const available = items.filter((item) => item.remainingQuantity > 0 && item.weight > 0);
  if (available.length === 0) throw new Error('draw_ticket_sold_out');
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * totalWeight;
  for (const item of available) {
    cursor -= item.weight;
    if (cursor < 0) return { item, probability: item.weight / totalWeight * 100 };
  }
  const item = available[available.length - 1];
  return { item, probability: item.weight / totalWeight * 100 };
}

export async function previewDrawTicket(db: Db, event: DonationEvent, random = Math.random): Promise<DrawTicketProcessResult> {
  const session = await getActiveDrawTicketSession(db);
  if (!session) return containsCommand(event.message, '!뽑기') ? { status: 'inactive' } : { status: 'ignored' };
  if (!containsCommand(event.message, session.command)) return { status: 'ignored' };
  if (event.amount !== session.ticketPrice) return { status: 'amount_mismatch', ticketPrice: session.ticketPrice };
  const available = session.items.filter((item) => item.remainingQuantity > 0);
  if (available.length === 0) return { status: 'sold_out' };
  const { item, probability } = pickDrawTicketItem(available, random);
  return {
    status: 'triggered',
    result: {
      sessionId: session.id,
      label: item.label,
      nickname: event.nickname?.trim() || '익명 후원자',
      amount: event.amount,
      probability,
      remainingTotal: available.reduce((sum, current) => sum + current.remainingQuantity, 0),
    },
  };
}

export async function processDrawTicketDonation(db: Db, event: DonationEvent, random = Math.random): Promise<DrawTicketProcessResult> {
  const current = await getActiveDrawTicketSession(db);
  if (!current) return containsCommand(event.message, '!뽑기') ? { status: 'inactive' } : { status: 'ignored' };
  if (!containsCommand(event.message, current.command)) return { status: 'ignored' };
  if (event.amount !== current.ticketPrice) return { status: 'amount_mismatch', ticketPrice: current.ticketPrice };

  return db.transaction(async (tx) => {
    const { rows: sessions } = await tx.query(`SELECT * FROM draw_ticket_sessions WHERE id = $1 AND status = 'active' FOR UPDATE`, [current.id]);
    if (!sessions[0]) return { status: 'inactive' };
    const { rows } = await tx.query(
      `SELECT * FROM draw_ticket_items WHERE session_id = $1 AND remaining_quantity > 0 AND weight > 0 ORDER BY position ASC, id ASC FOR UPDATE`,
      [current.id],
    );
    const items: DrawTicketItem[] = rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      label: row.label,
      weight: row.weight,
      totalQuantity: row.total_quantity,
      remainingQuantity: row.remaining_quantity,
      position: row.position,
    }));
    if (items.length === 0) return { status: 'sold_out' };
    const { item, probability } = pickDrawTicketItem(items, random);
    const nickname = event.nickname?.trim() || '익명 후원자';
    const channelId = event.channelId?.trim() || 'anonymous';
    await tx.query(`UPDATE draw_ticket_items SET remaining_quantity = remaining_quantity - 1 WHERE id = $1`, [item.id]);
    await tx.query(
      `INSERT INTO draw_ticket_results (session_id, item_id, donor_nickname, donor_channel_id, amount, result_label, probability) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [current.id, item.id, nickname, channelId, event.amount, item.label, probability],
    );
    const remainingTotal = items.reduce((sum, candidate) => sum + candidate.remainingQuantity, 0) - 1;
    if (remainingTotal === 0) {
      await tx.query(`UPDATE draw_ticket_sessions SET status = 'closed', closed_at = now() WHERE id = $1`, [current.id]);
    }
    return {
      status: 'triggered',
      result: { sessionId: current.id, label: item.label, nickname, amount: event.amount, probability, remainingTotal },
    };
  });
}
