import { tryAssignTicket, type AssignOutcome, type Db } from './db';

export async function assignNumbers(
  db: Db,
  sessionId: number,
  numbers: number[],
  nickname: string,
  channelId: string,
  donationLogId: number
): Promise<AssignOutcome[]> {
  // Sequential on purpose: preserves the order numbers were requested in,
  // matching the first-come-first-served semantics of the board.
  const outcomes: AssignOutcome[] = [];
  for (const number of numbers) {
    outcomes.push(await tryAssignTicket(db, sessionId, number, nickname, channelId, donationLogId));
  }
  return outcomes;
}
