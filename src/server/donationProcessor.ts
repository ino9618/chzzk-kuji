import { extractNumbers } from './donationParser';
import { assignNumbers } from './kujiEngine';
import {
  getActiveSession,
  getSetting,
  insertDonationLog,
  updateDonationLogOutcomes,
  type AssignOutcome,
  type Db,
} from './db';

export interface DonationEvent {
  channelId: string;
  nickname: string;
  amount: number;
  message: string;
}

export type ProcessDonationResult =
  | { status: 'feature_disabled' }
  | { status: 'session_inactive' }
  | { status: 'amount_mismatch'; ticketPrice: number }
  | { status: 'number_missing'; expectedCount: number; foundNumbers: number[] }
  | { status: 'processed'; sessionId: number; outcomes: AssignOutcome[] };

export async function processDonation(db: Db, event: DonationEvent): Promise<ProcessDonationResult> {
  if ((await getSetting(db, 'kuji_enabled')) === 'false') {
    await insertDonationLog(db, {
      sessionId: null,
      donorNickname: event.nickname,
      donorChannelId: event.channelId,
      amount: event.amount,
      rawMessage: event.message,
      status: 'feature_disabled',
      needsAttention: true,
    });
    return { status: 'feature_disabled' };
  }

  const session = await getActiveSession(db);

  if (!session) {
    await insertDonationLog(db, {
      sessionId: null,
      donorNickname: event.nickname,
      donorChannelId: event.channelId,
      amount: event.amount,
      rawMessage: event.message,
      status: 'session_inactive',
      needsAttention: true,
    });
    return { status: 'session_inactive' };
  }

  if (event.amount % session.ticketPrice !== 0) {
    await insertDonationLog(db, {
      sessionId: session.id,
      donorNickname: event.nickname,
      donorChannelId: event.channelId,
      amount: event.amount,
      rawMessage: event.message,
      status: 'amount_mismatch',
      needsAttention: true,
    });
    return { status: 'amount_mismatch', ticketPrice: session.ticketPrice };
  }

  const expectedCount = event.amount / session.ticketPrice;
  const foundNumbers = extractNumbers(event.message);

  if (foundNumbers.length !== expectedCount) {
    await insertDonationLog(db, {
      sessionId: session.id,
      donorNickname: event.nickname,
      donorChannelId: event.channelId,
      amount: event.amount,
      rawMessage: event.message,
      status: 'number_missing',
      needsAttention: true,
    });
    return { status: 'number_missing', expectedCount, foundNumbers };
  }

  const logId = await insertDonationLog(db, {
    sessionId: session.id,
    donorNickname: event.nickname,
    donorChannelId: event.channelId,
    amount: event.amount,
    rawMessage: event.message,
    status: 'processed',
    needsAttention: false,
  });

  const outcomes = await assignNumbers(db, session.id, foundNumbers, event.nickname, event.channelId, logId);
  const needsAttention = outcomes.some((o) => o.result !== 'success');
  await updateDonationLogOutcomes(db, logId, outcomes, needsAttention);

  return { status: 'processed', sessionId: session.id, outcomes };
}
