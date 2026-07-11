import type { SessionState } from '../api';

export function CurrentSessionSummary({ session, onNavigateSetup, onNavigateBoard }: { session: SessionState; onNavigateSetup: () => void; onNavigateBoard: () => void }) {
  if (!session.active) {
    return (
      <div className="session-idle">
        <div>
          <strong>진행 중인 회차가 없습니다.</strong>
          <p>상품과 가격을 설정해 새 회차를 시작하세요.</p>
        </div>
        <button onClick={onNavigateSetup}>새 회차 만들기</button>
      </div>
    );
  }

  const total = session.tickets?.length ?? 0;
  const sold = session.tickets?.filter((ticket) => ticket.status === 'sold').length ?? 0;
  return (
    <button className="session-summary-button" onClick={onNavigateBoard}>
      <span><strong>{session.name || '이름 없는 회차'}</strong><small>{(session.ticketPrice ?? 0).toLocaleString('ko-KR')} 치즈</small></span>
      <span><strong>{sold} / {total} 판매</strong><small>{Math.max(0, total - sold)}개 남음</small></span>
      <span aria-hidden="true">›</span>
    </button>
  );
}
