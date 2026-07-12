import { useState } from 'react';
import type { SessionHistoryEntry } from '../api';
import { CopyIcon } from '../components/Icons';
import { Mascot } from '../components/Mascot';

export function SessionHistoryPage({ sessions, activeSession, onClone }: { sessions: SessionHistoryEntry[]; activeSession: boolean; onClone: (session: SessionHistoryEntry) => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return <div className="admin-page session-history-page">
    <header className="page-header"><div><h1>회차 기록</h1><p>이전 회차의 판매 결과를 확인하고 같은 구성으로 새 회차를 준비합니다.</p></div></header>
    {sessions.length === 0 ? <div className="page-empty"><Mascot state="waiting" /><p>저장된 회차가 없습니다.</p></div> : <div className="session-history-list">{sessions.map((session) => {
      const isExpanded = expanded === session.id;
      return <section className="history-session" key={session.id}>
        <div className="history-session-summary">
          <button className="history-expand" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : session.id)}><span><strong>{session.name}</strong><small>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(session.createdAt))}</small></span><span className={`history-status ${session.status}`}>{session.status === 'active' ? '진행 중' : '종료'}</span><span className="history-count">{session.soldCount} / {session.tickets.length} 판매</span><span aria-hidden="true">{isExpanded ? '−' : '+'}</span></button>
          <button className="secondary-button history-clone" disabled={activeSession} title={activeSession ? '현재 회차를 종료한 후 불러올 수 있습니다.' : undefined} onClick={() => onClone(session)}><CopyIcon />신규 회차로 불러오기</button>
        </div>
        {isExpanded && <div className="history-ticket-list">{session.tickets.map((ticket) => <div className={`history-ticket ${ticket.status}`} key={ticket.number}><strong>{ticket.number}번</strong><span>{ticket.prizeGrade ? `${ticket.prizeGrade}상 · ` : ''}{ticket.prizeName}</span><small>{ticket.status === 'sold' ? ticket.ownerNickname : '미판매'}</small></div>)}</div>}
      </section>;
    })}</div>}
    {activeSession && <p className="history-help">현재 회차를 종료하면 이전 구성을 신규 회차로 불러올 수 있습니다.</p>}
  </div>;
}
