import { Router } from 'express';
import { getActiveSession, getTicketsForSession, getSetting, type Db, type Ticket } from '../db';
import { maskNickname } from '../maskNickname';

export interface GradeSummary {
  grade: string;
  prizeName: string;
  total: number;
  claimed: number;
}

/**
 * Aggregates per-grade totals/claimed counts for the public prize legend
 * (e.g. "A상 - 스타벅스 기프티콘 - 1개"), WITHOUT exposing which specific
 * ticket numbers belong to each grade -- that mapping stays secret until a
 * ticket is actually sold, matching how a real ichiban-kuji board works.
 * Tickets with no grade set are excluded (grade is optional).
 */
export function buildGradeSummary(tickets: Ticket[]): GradeSummary[] {
  const byGrade = new Map<string, GradeSummary>();
  for (const t of tickets) {
    if (!t.prizeGrade) continue;
    const existing = byGrade.get(t.prizeGrade);
    if (existing) {
      existing.total += 1;
      if (t.status === 'sold') existing.claimed += 1;
    } else {
      byGrade.set(t.prizeGrade, {
        grade: t.prizeGrade,
        prizeName: t.prizeName,
        total: 1,
        claimed: t.status === 'sold' ? 1 : 0,
      });
    }
  }
  return [...byGrade.values()];
}

export async function buildBoardPayload(db: Db) {
  const session = await getActiveSession(db);
  if (!session) return { active: false as const };

  const mode = (await getSetting(db, 'nickname_display_mode')) ?? 'masked';
  const allTickets = await getTicketsForSession(db, session.id);
  const tickets = allTickets.map((t) => ({
    number: t.number,
    status: t.status,
    ownerNickname: t.ownerNickname ? (mode === 'full' ? t.ownerNickname : maskNickname(t.ownerNickname)) : null,
    // Prize name/grade are only revealed once a ticket is sold -- keeping
    // them hidden while available preserves the ichiban-kuji "surprise"
    // (numbers are randomly assigned to grades, so nobody should be able
    // to see which number holds which prize before it's drawn).
    prizeName: t.status === 'sold' ? t.prizeName : null,
    prizeGrade: t.status === 'sold' ? t.prizeGrade : null,
    prizeImageUrl: t.status === 'sold' ? t.prizeImageUrl : null,
  }));

  return {
    active: true as const,
    sessionId: session.id,
    name: session.name,
    ticketPrice: session.ticketPrice,
    numberRangeMin: session.numberRangeMin,
    numberRangeMax: session.numberRangeMax,
    tickets,
    grades: buildGradeSummary(allTickets),
  };
}

export function createOverlayRouter(db: Db): Router {
  const router = Router();

  router.get('/board', async (_req, res) => {
    res.json(await buildBoardPayload(db));
  });

  return router;
}
