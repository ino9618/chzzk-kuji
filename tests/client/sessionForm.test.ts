import { describe, expect, it } from 'vitest';
import { buildTickets, validateSessionDraft, type SessionDraft } from '../../src/client/admin/sessionForm';

describe('validateSessionDraft', () => {
  it('returns field-specific errors for an incomplete draft', () => {
    const errors = validateSessionDraft({ name: '', ticketPrice: 0, groups: [] });
    expect(errors.name).toBe('회차 이름을 입력해 주세요.');
    expect(errors.ticketPrice).toBe('장당 가격은 1 이상이어야 합니다.');
    expect(errors.groups).toBe('상품을 한 개 이상 추가해 주세요.');
  });

  it('accepts a complete draft', () => {
    const draft: SessionDraft = { name: '7월 회차', ticketPrice: 1000, groups: [{ grade: 'A', prizeName: '상품', count: 2 }] };
    expect(validateSessionDraft(draft)).toEqual({});
  });
});

describe('buildTickets', () => {
  it('expands group quantities into numbered tickets', () => {
    const tickets = buildTickets([
      { grade: 'A', prizeName: '상품 A', count: 2 },
      { grade: 'B', prizeName: '상품 B', count: 1 },
    ]);
    expect(tickets).toHaveLength(3);
    expect(tickets.map((ticket) => ticket.number)).toEqual([1, 2, 3]);
    expect(tickets.filter((ticket) => ticket.prizeGrade === 'A')).toHaveLength(2);
  });
});
