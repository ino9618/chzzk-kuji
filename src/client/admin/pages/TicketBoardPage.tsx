import { useState } from 'react';
import type { SessionState } from '../api';
import { filterTickets, type TicketFilter } from '../adminModel';

export function TicketBoardPage({ session, onNavigateSetup }: { session: SessionState; onNavigateSetup: () => void }) {
  const [filter, setFilter] = useState<TicketFilter>('all');
  if (!session.active) {
    return <div className="admin-page"><header className="page-header"><h1>판매 번호판</h1></header><div className="page-empty"><p>진행 중인 회차가 없습니다.</p><button onClick={onNavigateSetup}>새 회차 만들기</button></div></div>;
  }
  const tickets = session.tickets ?? [];
  const sold = tickets.filter((ticket) => ticket.status === 'sold').length;
  const visibleTickets = filterTickets(tickets, filter);
  return (
    <div className="admin-page board-page">
      <header className="page-header board-header">
        <div><h1>판매 번호판</h1><p>{session.name} · {(session.ticketPrice ?? 0).toLocaleString('ko-KR')} 치즈 · {sold} / {tickets.length} 판매</p></div>
        <div className="segmented-control" aria-label="번호 상태 필터">
          {([['all', '전체'], ['available', '판매 가능'], ['sold', '판매 완료']] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
      </header>
      <div className="board-grid">
        {visibleTickets.map((ticket) => (
          <div key={ticket.number} className={`board-ticket ${ticket.status}`}>
            <strong>{ticket.number}</strong>
            <span>{ticket.prizeGrade || ticket.prizeName}</span>
            {ticket.status === 'sold' && <small title={ticket.ownerNickname ?? ''}>{ticket.ownerNickname}</small>}
          </div>
        ))}
      </div>
    </div>
  );
}
