import { describe, expect, it } from 'vitest';
import { filterTickets, filterWinners, getOperationsStatus, validateTestDonation } from '../../src/client/admin/adminModel';
import type { Ticket, Winner } from '../../src/client/admin/api';

describe('getOperationsStatus', () => {
  it('reports ready only when connection, feature, session, and queue are ready', () => {
    expect(getOperationsStatus({ connected: true, enabled: true, active: true, issueCount: 0 })).toEqual({
      tone: 'ready',
      label: '방송 준비 완료',
      detail: '후원과 이치방쿠지 자동 배정이 정상 작동 중입니다.',
    });
  });

  it('reports an idle state when there is no active session', () => {
    expect(getOperationsStatus({ connected: true, enabled: true, active: false, issueCount: 0 }).label).toBe(
      '회차 없음'
    );
  });

  it.each([
    { connected: false, enabled: true, active: true, issueCount: 0 },
    { connected: true, enabled: false, active: true, issueCount: 0 },
    { connected: true, enabled: true, active: true, issueCount: 1 },
  ])('reports warning when operations require attention', (input) => {
    expect(getOperationsStatus(input).tone).toBe('warning');
  });
});

const tickets: Ticket[] = [
  { number: 1, prizeName: 'A상', status: 'available', ownerNickname: null },
  { number: 2, prizeName: 'B상', status: 'sold', ownerNickname: '홍길동' },
];

describe('filterTickets', () => {
  it('filters tickets by availability', () => {
    expect(filterTickets(tickets, 'all')).toHaveLength(2);
    expect(filterTickets(tickets, 'available').map((ticket) => ticket.number)).toEqual([1]);
    expect(filterTickets(tickets, 'sold').map((ticket) => ticket.number)).toEqual([2]);
  });
});

describe('validateTestDonation', () => {
  const session = { active: true as const, ticketPrice: 1000, tickets };
  it('accepts matching amounts and available numbers without changing state', () => {
    expect(validateTestDonation(session, 1000, '1번').ok).toBe(true);
    expect(tickets[0].status).toBe('available');
  });
  it('rejects amount, count, and unavailable-number mismatches', () => {
    expect(validateTestDonation(session, 1500, '1번').ok).toBe(false);
    expect(validateTestDonation(session, 2000, '1번').ok).toBe(false);
    expect(validateTestDonation(session, 1000, '2번').ok).toBe(false);
  });
});

const winners: Winner[] = [
  {
    sessionId: 1,
    sessionName: '여름 회차',
    number: 2,
    prizeName: '아메리카노',
    prizeGrade: 'A',
    ownerNickname: '홍길동',
    ownerChannelId: 'channel-1',
    soldAt: '2026-07-11T00:00:00.000Z',
  },
  {
    sessionId: 2,
    sessionName: '가을 회차',
    number: 7,
    prizeName: '케이크',
    prizeGrade: 'B',
    ownerNickname: '김철수',
    ownerChannelId: 'channel-2',
    soldAt: '2026-07-12T00:00:00.000Z',
  },
];

describe('filterWinners', () => {
  it('matches nickname, prize, session, and number without case sensitivity', () => {
    expect(filterWinners(winners, '홍길동')).toHaveLength(1);
    expect(filterWinners(winners, '아메리카노')).toHaveLength(1);
    expect(filterWinners(winners, '가을')).toHaveLength(1);
    expect(filterWinners(winners, '7')).toHaveLength(1);
    expect(filterWinners(winners, '')).toHaveLength(2);
  });
});
