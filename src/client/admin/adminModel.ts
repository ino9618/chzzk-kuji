import type { Ticket, Winner } from './api';

export type AdminPage = 'operations' | 'preflight' | 'board' | 'winners' | 'session-history' | 'log' | 'donation-simulator' | 'connection' | 'settings' | 'session-setup' | 'overlay' | 'more';
export type TicketFilter = 'all' | 'available' | 'sold';

export interface OperationsStatusInput {
  connected: boolean;
  enabled: boolean;
  active: boolean;
  issueCount: number;
}

export interface OperationsStatus {
  tone: 'ready' | 'warning' | 'idle';
  label: string;
  detail: string;
}

export function getOperationsStatus(input: OperationsStatusInput): OperationsStatus {
  if (!input.connected) {
    return { tone: 'warning', label: '확인 필요', detail: '치지직 연결 상태를 확인해 주세요.' };
  }
  if (!input.enabled) {
    return { tone: 'warning', label: '확인 필요', detail: '이치방쿠지 자동 배정이 일시정지되어 있습니다.' };
  }
  if (input.issueCount > 0) {
    return {
      tone: 'warning',
      label: '확인 필요',
      detail: `처리가 필요한 후원이 ${input.issueCount}건 있습니다.`,
    };
  }
  if (!input.active) {
    return { tone: 'idle', label: '회차 없음', detail: '새 회차를 만들면 방송 운영을 시작할 수 있습니다.' };
  }
  return {
    tone: 'ready',
    label: '방송 준비 완료',
    detail: '후원과 이치방쿠지 자동 배정이 정상 작동 중입니다.',
  };
}

export function filterTickets(tickets: Ticket[], filter: TicketFilter): Ticket[] {
  if (filter === 'all') return [...tickets];
  return tickets.filter((ticket) => ticket.status === filter);
}

export function filterWinners(winners: Winner[], query: string): Winner[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
  if (!normalizedQuery) return [...winners];

  return winners.filter((winner) =>
    [winner.ownerNickname, winner.prizeName, winner.sessionName, String(winner.number)]
      .join(' ')
      .toLocaleLowerCase('ko-KR')
      .includes(normalizedQuery)
  );
}

export function validateTestDonation(session: import('./api').SessionState, amount: number, message: string): { ok: boolean; message: string } {
  if (!session.active || !session.ticketPrice || !session.tickets) return { ok: false, message: '진행 중인 회차가 필요합니다.' };
  if (!Number.isFinite(amount) || amount < 1 || amount % session.ticketPrice !== 0) return { ok: false, message: `후원 금액은 ${session.ticketPrice.toLocaleString('ko-KR')}치즈의 배수여야 합니다.` };
  const numbers = (message.match(/\d+/g) ?? []).map(Number);
  const expected = amount / session.ticketPrice;
  if (numbers.length !== expected) return { ok: false, message: `${expected}개의 번호를 입력해야 합니다. 현재 ${numbers.length}개가 인식됩니다.` };
  const unavailable = numbers.filter((number) => !session.tickets?.some((ticket) => ticket.number === number && ticket.status === 'available'));
  if (unavailable.length > 0) return { ok: false, message: `${unavailable.join(', ')}번은 판매할 수 없는 번호입니다.` };
  return { ok: true, message: `${numbers.join(', ')}번이 정상적으로 배정될 조건입니다. 실제 판매 내역은 변경되지 않았습니다.` };
}
