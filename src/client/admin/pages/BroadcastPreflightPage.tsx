import { useMemo, useState } from 'react';
import type { SessionState } from '../api';
import { validateTestDonation } from '../adminModel';
import { InlineFeedback } from '../components/InlineFeedback';

export function BroadcastPreflightPage({ session, chzzkStatus, kujiEnabled }: { session: SessionState; chzzkStatus: string; kujiEnabled: boolean }) {
  const firstAvailable = session.tickets?.find((ticket) => ticket.status === 'available')?.number;
  const [amount, setAmount] = useState(session.ticketPrice ?? 1000);
  const [message, setMessage] = useState(firstAvailable ? `${firstAvailable}번` : '1번');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const checks = useMemo(() => [
    { label: '치지직 후원 연결', ok: chzzkStatus === 'connected', detail: chzzkStatus === 'connected' ? '정상 연결' : '연결 확인 필요' },
    { label: '이치방쿠지 자동 배정', ok: kujiEnabled, detail: kujiEnabled ? '사용 중' : '일시정지' },
    { label: '진행 회차', ok: session.active, detail: session.active ? session.name || '진행 중' : '회차 없음' },
    { label: '판매 가능 번호', ok: Boolean(firstAvailable), detail: firstAvailable ? `${session.tickets?.filter((ticket) => ticket.status === 'available').length}개 남음` : '남은 번호 없음' },
  ], [chzzkStatus, firstAvailable, kujiEnabled, session]);
  const ready = checks.every((check) => check.ok);

  return (
    <div className="admin-page preflight-page">
      <header className="page-header"><div><h1>방송 전 점검</h1><p>방송 시작 전에 후원 자동 배정 준비 상태를 확인합니다.</p></div><span className={`preflight-badge ${ready ? 'ready' : 'attention'}`}>{ready ? '방송 준비 완료' : '확인 필요'}</span></header>
      <section className="preflight-checks">{checks.map((check) => <div className={check.ok ? 'ready' : 'attention'} key={check.label}><span aria-hidden="true">{check.ok ? '✓' : '!'}</span><div><strong>{check.label}</strong><p>{check.detail}</p></div></div>)}</section>
      <section className="workflow-section">
        <div className="workflow-heading"><div><h2>모의 후원 검사</h2><p>실제 번호를 판매 처리하지 않고 후원 조건만 검사합니다.</p></div></div>
        <div className="test-donation-form"><label>후원 금액<div className="input-suffix"><input type="number" min={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><span>치즈</span></div></label><label>후원 메시지<input type="text" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="예: 1번 3번" /></label><button disabled={!session.active} onClick={() => setResult(validateTestDonation(session, amount, message))}>조건 검사</button></div>
        {result && <InlineFeedback tone={result.ok ? 'success' : 'error'}>{result.message}</InlineFeedback>}
      </section>
      <section className="workflow-section"><div className="workflow-heading"><div><h2>OBS 오버레이</h2><p>OBS 브라우저 소스와 동일한 이치방쿠지 화면을 새 창에서 확인합니다.</p></div><a className="button-link secondary-button" href="/overlay-kuji.html" target="_blank" rel="noreferrer">쿠지 오버레이 미리보기</a></div></section>
    </div>
  );
}
