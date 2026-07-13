import { useMemo, useState } from 'react';
import type { Winner } from '../api';
import { filterWinners } from '../adminModel';
import { ArrowLeftIcon, ChevronRightIcon } from '../components/Icons';
import { Mascot } from '../components/Mascot';

export function WinnersDetail({ sessionName, winners, onBack }: { sessionName: string; winners: Winner[]; onBack: () => void }) {
  return <div className="admin-page winners-detail-page">
    <header className="page-header history-detail-header"><div><button className="history-back" onClick={onBack}><ArrowLeftIcon />회차 목록으로</button><h1>{sessionName}</h1><p>이 회차에서 당첨된 시청자와 상품을 확인합니다.</p></div><span className="winner-detail-count">{winners.length}명 당첨</span></header>
    <section className="winner-group"><div className="winner-table">{winners.map((winner) => <div className="winner-row" key={`${winner.sessionId}-${winner.number}`}><strong>{winner.number}번</strong><span>{winner.prizeGrade ? `${winner.prizeGrade}상 · ` : ''}{winner.prizeName}</span><span>{winner.ownerNickname}</span><time dateTime={winner.soldAt}>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(winner.soldAt))}</time></div>)}</div></section>
  </div>;
}

export function WinnersPage({ winners, initialQuery = '' }: { winners: Winner[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const filtered = filterWinners(winners, query);
  const groups = useMemo(() => filtered.reduce<Record<string, Winner[]>>((result, winner) => {
    (result[String(winner.sessionId)] ??= []).push(winner);
    return result;
  }, {}), [filtered]);
  const selected = selectedSessionId == null ? undefined : groups[String(selectedSessionId)];

  if (selected) return <WinnersDetail sessionName={selected[0].sessionName} winners={selected} onBack={() => setSelectedSessionId(null)} />;

  return <div className="admin-page winners-page">
    <header className="page-header detail-header"><div><h1>당첨 내역</h1><p>회차를 선택해 해당 회차의 당첨 상세를 확인합니다.</p></div><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="회차명 또는 당첨자 검색" aria-label="당첨 내역 검색" /></header>
    {filtered.length === 0 ? <div className="page-empty"><Mascot state="waiting" /><p>{query ? '검색 결과가 없습니다.' : '아직 당첨 내역이 없습니다.'}</p></div> : <div className="winner-session-list">{Object.entries(groups).map(([sessionId, entries]) => <button className="winner-session-row" key={sessionId} onClick={() => setSelectedSessionId(Number(sessionId))}><span><strong>{entries[0].sessionName}</strong><small>최근 당첨 {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(new Date(entries[0].soldAt))}</small></span><span className="winner-session-count">{entries.length}명</span><span className="history-view">상세 보기 <ChevronRightIcon /></span></button>)}</div>}
  </div>;
}
