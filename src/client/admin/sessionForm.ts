export interface PrizeGroup {
  grade: string;
  prizeName: string;
  count: number;
  prizeImageUrl?: string;
}

export interface SessionDraft {
  name: string;
  ticketPrice: number;
  groups: PrizeGroup[];
}

export interface SessionErrors {
  name?: string;
  ticketPrice?: string;
  groups?: string;
}

export interface TicketDraft {
  number: number;
  prizeName: string;
  prizeGrade?: string;
  prizeImageUrl?: string;
}

export function validateSessionDraft(draft: SessionDraft): SessionErrors {
  const errors: SessionErrors = {};
  if (!draft.name.trim()) errors.name = '회차 이름을 입력해 주세요.';
  if (!Number.isFinite(draft.ticketPrice) || draft.ticketPrice < 1) errors.ticketPrice = '장당 가격은 1 이상이어야 합니다.';
  if (draft.groups.length === 0 || draft.groups.every((group) => group.count < 1 || !group.prizeName.trim())) {
    errors.groups = '상품을 한 개 이상 추가해 주세요.';
  }
  return errors;
}

export function buildTickets(groups: PrizeGroup[]): TicketDraft[] {
  return groups
    .filter((group) => group.count > 0 && group.prizeName.trim())
    .flatMap((group) => Array.from({ length: Math.floor(group.count) }, () => ({ prizeName: group.prizeName.trim(), prizeGrade: group.grade.trim() || undefined, prizeImageUrl: group.prizeImageUrl || undefined })))
    .map((ticket, index) => ({ number: index + 1, ...ticket }));
}
