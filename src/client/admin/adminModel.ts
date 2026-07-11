import type { Ticket, Winner } from './api';

export type AdminPage = 'operations' | 'board' | 'winners' | 'log' | 'connection' | 'settings' | 'session-setup' | 'overlay' | 'more';
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
