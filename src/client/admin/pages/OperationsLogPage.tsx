import { useMemo, useState } from 'react';
import type { QueueEntry } from '../api';
import { Mascot } from '../components/Mascot';

const labels: Record<string, string> = {
  processed: '배정 완료',
  duplicate_rejected: '이미 팔린 번호',
  amount_mismatch: '금액 안 맞음',
  number_missing: '번호 개수 불일치',
  out_of_range: '범위 밖 번호',
  session_inactive: '진행 중 회차 없음',
  feature_disabled: '기능 정지 중',
};

function escapeCsv(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function OperationsLogPage({ entries }: { entries: QueueEntry[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'success' | 'attention'>('all');
  const filtered = useMemo(() => entries.filter((entry) => {
    const matchesQuery = `${entry.donorNickname} ${entry.rawMessage} ${labels[entry.status] ?? entry.status}`.toLocaleLowerCase('ko-KR').includes(query.trim().toLocaleLowerCase('ko-KR'));
    const matchesFilter = filter === 'all' || (filter === 'success' ? !entry.needsAttention : entry.needsAttention);
    return matchesQuery && matchesFilter;
  }), [entries, filter, query]);

  const downloadCsv = () => {
    const rows = [['수신 시각', '닉네임', '금액', '메시지', '처리 결과'], ...filtered.map((entry) => [entry.createdAt, entry.donorNickname, entry.amount, entry.rawMessage, labels[entry.status] ?? entry.status])];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chzzk-kuji-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-page operations-log-page">
      <header className="page-header detail-header"><div><h1>운영 기록</h1><p>최근 후원 200건의 수신 내용과 번호 배정 결과입니다.</p></div><div className="log-header-actions"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="닉네임 또는 메시지 검색" aria-label="운영 기록 검색" /><button className="secondary-button" disabled={filtered.length === 0} onClick={downloadCsv}>CSV 내보내기</button></div></header>
      <div className="board-toolbar log-toolbar" role="group" aria-label="운영 기록 필터">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>전체 <span>{entries.length}</span></button>
        <button className={filter === 'success' ? 'active' : ''} onClick={() => setFilter('success')}>정상 처리</button>
        <button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>확인 필요</button>
      </div>
      {filtered.length === 0 ? <div className="page-empty"><Mascot state="waiting" /><p>{query || filter !== 'all' ? '조건에 맞는 기록이 없습니다.' : '아직 수신된 후원이 없습니다.'}</p></div> : <div className="log-table"><div className="log-row log-head"><span>수신 시각</span><span>후원자</span><span>금액</span><span>메시지</span><span>처리 결과</span></div>{filtered.map((entry) => <div className="log-row" key={entry.id}><time dateTime={entry.createdAt}>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.createdAt))}</time><strong>{entry.donorNickname}</strong><span>{entry.amount.toLocaleString('ko-KR')}치즈</span><span className="log-message">{entry.rawMessage || '(메시지 없음)'}</span><span className={`log-result ${entry.needsAttention ? 'attention' : 'success'}`}>{labels[entry.status] ?? entry.status}{entry.resolved ? ' · 확인 완료' : ''}</span></div>)}</div>}
    </div>
  );
}
