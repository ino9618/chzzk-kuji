import { useState } from 'react';
import type { DonationSimulationResult, SessionState } from '../api';
import { InlineFeedback } from '../components/InlineFeedback';
import { SendIcon } from '../components/Icons';

function describeResult(result: DonationSimulationResult): { ok: boolean; message: string } {
  if (result.status === 'feature_disabled') return { ok: false, message: '이치방쿠지 자동 배정이 일시정지 상태입니다.' };
  if (result.status === 'session_inactive') return { ok: false, message: '진행 중인 회차가 없습니다.' };
  if (result.status === 'amount_mismatch') return { ok: false, message: `후원 금액은 ${result.ticketPrice.toLocaleString('ko-KR')}치즈의 배수여야 합니다.` };
  if (result.status === 'number_missing') return { ok: false, message: `${result.expectedCount}개 번호가 필요하지만 ${result.foundNumbers.length}개가 인식됐습니다.` };
  const successes = result.outcomes.filter((outcome) => outcome.result === 'success');
  const failures = result.outcomes.filter((outcome) => outcome.result !== 'success');
  return {
    ok: failures.length === 0,
    message: failures.length === 0
      ? `${successes.map((outcome) => `${outcome.number}번`).join(', ')} 도네이션이 처리됐습니다. 오버레이와 번호판을 확인하세요.`
      : `처리 완료 ${successes.length}건, 중복 또는 범위 오류 ${failures.length}건입니다.`,
  };
}

export function DonationSimulatorPage({ session, onSend }: { session: SessionState; onSend: (payload: { nickname: string; amount: number; message: string }) => Promise<DonationSimulationResult> }) {
  const firstAvailable = session.tickets?.find((ticket) => ticket.status === 'available')?.number ?? 1;
  const [nickname, setNickname] = useState('테스트 후원자');
  const [amount, setAmount] = useState(session.ticketPrice ?? 1000);
  const [message, setMessage] = useState(`${firstAvailable}번`);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const send = async () => {
    setPending(true);
    setFeedback(null);
    try {
      setFeedback(describeResult(await onSend({ nickname, amount, message })));
    } catch {
      setFeedback({ ok: false, message: '테스트 도네이션을 처리하지 못했습니다.' });
    } finally {
      setPending(false);
    }
  };

  return <div className="admin-page donation-simulator-page">
    <header className="page-header"><div><h1>도네이션 테스트</h1><p>치지직 후원과 동일한 처리 경로로 번호 배정과 오버레이를 확인합니다.</p></div></header>
    <div className="simulator-warning"><strong>실제 회차 테스트</strong><p>전송하면 입력한 번호가 실제로 판매 처리되고 당첨 및 운영 기록에 저장됩니다.</p></div>
    <section className="simulator-console">
      <div className="simulator-console-head"><span className="simulator-live-dot" />도네이션 입력</div>
      <div className="simulator-fields">
        <label>후원자 닉네임<input value={nickname} maxLength={40} onChange={(event) => setNickname(event.target.value)} /></label>
        <label>후원 금액<div className="input-suffix"><input type="number" min={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /><span>치즈</span></div></label>
        <label className="simulator-message">후원 메시지<input value={message} maxLength={200} onChange={(event) => setMessage(event.target.value)} placeholder="예: 1번 또는 1번 3번" /></label>
      </div>
      <div className="simulator-send-row"><div><strong>{session.active ? session.name : '진행 회차 없음'}</strong><span>{session.active ? `장당 ${(session.ticketPrice ?? 0).toLocaleString('ko-KR')} 치즈` : '회차를 먼저 시작하세요.'}</span></div><button disabled={pending || !session.active || !nickname.trim() || !message.trim()} onClick={send}><SendIcon />{pending ? '전송 중' : '테스트 도네이션 보내기'}</button></div>
    </section>
    {feedback && <InlineFeedback tone={feedback.ok ? 'success' : 'error'}>{feedback.message}</InlineFeedback>}
  </div>;
}
