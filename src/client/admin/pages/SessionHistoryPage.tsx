import { useState } from 'react';
import type { SessionHistoryEntry } from '../api';
import { ArrowLeftIcon, ChevronRightIcon, CopyIcon } from '../components/Icons';
import { Mascot } from '../components/Mascot';

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
});

interface DetailProps {
  session: SessionHistoryEntry;
  activeSession: boolean;
  onBack: () => void;
  onClone: (session: SessionHistoryEntry) => void;
}

export function SessionHistoryDetail({ session, activeSession, onBack, onClone }: DetailProps) {
  return <div className="admin-page session-history-detail">
    <header className="page-header history-detail-header">
      <div><button className="history-back" onClick={onBack}><ArrowLeftIcon />목록으로</button><h1>{session.name}</h1><p>{dateFormatter.format(new Date(session.createdAt))} 시작한 회차의 상세 내역입니다.</p></div>
      <button className="secondary-button history-clone" disabled={activeSession} title={activeSession ? '현재 회차를 종료한 후 불러올 수 있습니다.' : undefined} onClick={() => onClone(session)}><CopyIcon />신규 회차로 불러오기</button>
    </header>
    <section className="history-detail-summary" aria-label="회차 요약">
      <div><span>상태</span><strong className={`history-status ${session.status}`}>{session.status === 'active' ? '진행 중' : '종료'}</strong></div>
      <div><span>판매</span><strong>{session.soldCount} / {session.tickets.length}</strong></div>
      <div><span>장당 가격</span><strong>{session.ticketPrice.toLocaleString('ko-KR')} 치즈</strong></div>
      <div><span>번호 범위</span><strong>{session.numberRangeMin}–{session.numberRangeMax}번</strong></div>
    </section>
    <section className="history-detail-panel">
      <div className="workflow-heading"><h2>티켓 상세</h2><span>{session.tickets.length}장</span></div>
      <div className="history-ticket-list">{session.tickets.map((ticket) => <div className={`history-ticket ${ticket.status} ${ticket.prizeImageUrl ? 'with-image' : ''}`} key={ticket.number}>{ticket.prizeImageUrl && <img src={ticket.prizeImageUrl} alt="" />}<strong>{ticket.number}번</strong><span>{ticket.prizeGrade ? `${ticket.prizeGrade}상 · ` : ''}{ticket.prizeName}</span><small>{ticket.status === 'sold' ? ticket.ownerNickname : '미판매'}</small></div>)}</div>
    </section>
    {activeSession && <p className="history-help">현재 회차를 종료하면 이 구성을 신규 회차로 불러올 수 있습니다.</p>}
  </div>;
}

export function SessionHistoryPage({ sessions, activeSession, onClone }: { sessions: SessionHistoryEntry[]; activeSession: boolean; onClone: (session: SessionHistoryEntry) => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = sessions.find((session) => session.id === selectedId);
  if (selected) return <SessionHistoryDetail session={selected} activeSession={activeSession} onBack={() => setSelectedId(null)} onClone={onClone} />;

  return <div className="admin-page session-history-page">
    <header className="page-header"><div><h1>회차 기록</h1><p>회차를 선택해 판매 결과와 티켓 상세를 확인합니다.</p></div></header>
    {sessions.length === 0 ? <div className="page-empty"><Mascot state="waiting" /><p>저장된 회차가 없습니다.</p></div> : <div className="session-history-list">{sessions.map((session) => <section className="history-session" key={session.id}>
      <div className="history-session-summary">
        <button className="history-open" onClick={() => setSelectedId(session.id)}><span><strong>{session.name}</strong><small>{dateFormatter.format(new Date(session.createdAt))}</small></span><span className={`history-status ${session.status}`}>{session.status === 'active' ? '진행 중' : '종료'}</span><span className="history-count">{session.soldCount} / {session.tickets.length} 판매</span><span className="history-view">상세 보기 <ChevronRightIcon /></span></button>
        <button className="secondary-button history-clone" disabled={activeSession} title={activeSession ? '현재 회차를 종료한 후 불러올 수 있습니다.' : undefined} onClick={() => onClone(session)}><CopyIcon />신규 회차로 불러오기</button>
      </div>
    </section>)}</div>}
    {activeSession && <p className="history-help">현재 회차를 종료하면 이전 구성을 신규 회차로 불러올 수 있습니다.</p>}
  </div>;
}
