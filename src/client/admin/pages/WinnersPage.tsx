import { useMemo, useState } from 'react';
import type { Winner } from '../api';
import { filterWinners } from '../adminModel';
import { Mascot } from '../components/Mascot';

export function WinnersPage({ winners, initialQuery = '' }: { winners: Winner[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const filtered = filterWinners(winners, query);
  const groups = useMemo(() => filtered.reduce<Record<string, Winner[]>>((result, winner) => {
    (result[String(winner.sessionId)] ??= []).push(winner);
    return result;
  }, {}), [filtered]);

  return (
    <div className="admin-page winners-page">
      <header className="page-header detail-header"><div><h1>당첨 내역</h1><p>닉네임, 상품명, 회차명 또는 번호로 찾을 수 있습니다.</p></div><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="당첨 내역 검색" aria-label="당첨 내역 검색" /></header>
      {filtered.length === 0 ? <div className="page-empty"><Mascot state="waiting" /><p>{query ? '검색 결과가 없습니다.' : '아직 당첨 내역이 없습니다.'}</p></div> : Object.entries(groups).map(([sessionId, entries]) => <section className="winner-group" key={sessionId}><h2>{entries[0].sessionName}<span>{entries.length}명</span></h2><div className="winner-table">{entries.map((winner) => <div className="winner-row" key={`${winner.sessionId}-${winner.number}`}><strong>{winner.number}번</strong><span>{winner.prizeName}</span><span>{winner.ownerNickname}</span><time dateTime={winner.soldAt}>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(winner.soldAt))}</time></div>)}</div></section>)}
    </div>
  );
}
