import { useEffect, useRef, useState } from 'react';
import { InlineFeedback } from '../components/InlineFeedback';
import { SettingRow } from '../components/SettingRow';
import type { SessionState } from '../api';
import examplePrizeImage from '../../assets/mascot-success.png';
import { NumberStepper } from '../components/NumberStepper';

interface OverlayTestPayload {
  number: number;
  grade: string;
  prizeName: string;
  nickname: string;
  sourceTicketNumber?: number;
  prizeImageUrl?: string;
}

interface RouletteOverlayTestPayload {
  label: string;
  nickname: string;
  amount: number;
}

export interface OverlayTestResponse {
  ok: boolean;
  tts: 'sent' | 'not_configured' | 'failed';
}

const OVERLAY_WIDTH = 1920;
const OVERLAY_HEIGHT = 1080;

function OverlayPreviewFrame({ src }: { src: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const resize = () => setScale(frame.clientWidth / OVERLAY_WIDTH);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return <div className="overlay-preview-frame" ref={frameRef}>
    <iframe
      src={src}
      title="OBS 오버레이 실시간 미리보기"
      width={OVERLAY_WIDTH}
      height={OVERLAY_HEIGHT}
      allow="autoplay"
      style={{ transform: `scale(${scale})` }}
    />
  </div>;
}

export function OverlaySettingsPage({ session, nicknameMode, onSetNicknameMode, onTestOverlay, onTestRoulette }: { session: SessionState; nicknameMode: 'masked' | 'full'; onSetNicknameMode: (mode: 'masked' | 'full') => Promise<void>; onTestOverlay: (payload: OverlayTestPayload) => Promise<OverlayTestResponse>; onTestRoulette: (payload: RouletteOverlayTestPayload) => Promise<OverlayTestResponse> }) {
  const [feedback, setFeedback] = useState('');
  const [pending, setPending] = useState(false);
  const [testPending, setTestPending] = useState(false);
  const [testMode, setTestMode] = useState<'kuji-board' | 'kuji-result' | 'roulette'>('kuji-result');
  const [test, setTest] = useState<OverlayTestPayload>({ number: 1, grade: 'A', prizeName: '테스트 상품', nickname: '테스트 후원자', prizeImageUrl: examplePrizeImage });
  const [rouletteTest, setRouletteTest] = useState<RouletteOverlayTestPayload>({ label: '테스트 룰렛 결과', nickname: '테스트 후원자', amount: 5000 });
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const kujiBoardUrl = `${origin}/overlay-kuji-board.html`;
  const kujiResultUrl = `${origin}/overlay-kuji-result.html`;
  const rouletteUrl = `${origin}/overlay-roulette.html`;
  const previewUrl = testMode === 'kuji-board' ? '/overlay-kuji-board.html' : testMode === 'kuji-result' ? '/overlay-kuji-result.html?preview3d=kuji' : '/overlay-roulette.html?preview3d=roulette';
  const registeredTickets = session.active
    ? Array.from(new Map((session.tickets ?? []).map((ticket) => [`${ticket.prizeGrade ?? ''}|${ticket.prizeName}|${ticket.prizeImageUrl ?? ''}`, ticket])).values())
    : [];

  const copy = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback(`${label} 주소를 복사했습니다.`);
    } catch {
      setFeedback('오버레이 주소를 복사하지 못했습니다.');
    }
  };
  const setMode = async (mode: 'masked' | 'full') => {
    setPending(true);
    setFeedback('');
    try {
      await onSetNicknameMode(mode);
      setFeedback('닉네임 표시 설정을 저장했습니다.');
    } catch {
      setFeedback('설정을 저장하지 못했습니다.');
    } finally {
      setPending(false);
    }
  };
  const runOverlayTest = async () => {
    setTestPending(true);
    setFeedback('');
    try {
      const result = await onTestOverlay(test);
      setFeedback(result.tts === 'sent'
        ? '테스트 당첨 화면과 Google TTS를 전송했습니다. 실제 판매 내역은 변경되지 않습니다.'
        : result.tts === 'not_configured'
          ? '당첨 화면은 표시했지만 Google Cloud TTS API 키가 서버에 설정되지 않았습니다.'
          : '당첨 화면은 표시했지만 Google Cloud TTS 음성 생성에 실패했습니다. API 키와 결제 설정을 확인해 주세요.');
    } catch {
      setFeedback('오버레이 테스트를 표시하지 못했습니다. 연결 상태를 확인해 주세요.');
    } finally {
      setTestPending(false);
    }
  };
  const runRouletteTest = async () => {
    setTestPending(true);
    setFeedback('');
    try {
      const result = await onTestRoulette(rouletteTest);
      setFeedback(result.tts === 'sent'
        ? '룰렛 테스트와 Google TTS를 전송했습니다. TTS는 룰렛이 멈춘 뒤 재생됩니다.'
        : result.tts === 'not_configured'
          ? '룰렛은 표시했지만 Google Cloud TTS API 키가 서버에 설정되지 않았습니다.'
          : '룰렛은 표시했지만 Google Cloud TTS 음성 생성에 실패했습니다. API 키와 결제 설정을 확인해 주세요.');
    } catch {
      setFeedback('룰렛 오버레이 테스트를 표시하지 못했습니다. 연결 상태를 확인해 주세요.');
    } finally {
      setTestPending(false);
    }
  };
  const selectRegisteredTicket = (value: string) => {
    const sourceTicketNumber = Number(value);
    const ticket = registeredTickets.find((item) => item.number === sourceTicketNumber);
    if (!ticket) {
      setTest((current) => ({ ...current, sourceTicketNumber: undefined }));
      return;
    }
    setTest((current) => ({
      ...current,
      sourceTicketNumber: ticket.number,
      number: ticket.number,
      grade: ticket.prizeGrade ?? '',
      prizeName: ticket.prizeName,
    }));
  };

  return (
    <div className="admin-page overlay-page">
      <header className="page-header"><div><h1>오버레이</h1><p>OBS 브라우저 소스와 화면 표시 방식을 설정합니다.</p></div></header>
      <section className="overlay-preview-section">
        <div className="workflow-heading"><div><h2>실시간 오버레이 미리보기</h2><p>OBS 브라우저 소스와 동일한 Full HD 화면을 축소해 표시합니다.</p></div><span>1920 × 1080</span></div>
        <OverlayPreviewFrame src={previewUrl} />
        <div className="overlay-test-switch segmented-control" aria-label="오버레이 테스트 종류">
          <button className={testMode === 'kuji-board' ? 'active' : ''} onClick={() => setTestMode('kuji-board')}>쿠지 번호판</button>
          <button className={testMode === 'kuji-result' ? 'active' : ''} onClick={() => setTestMode('kuji-result')}>당첨 애니메이션</button>
          <button className={testMode === 'roulette' ? 'active' : ''} onClick={() => setTestMode('roulette')}>룰렛</button>
        </div>
        {testMode === 'kuji-board' ? <p className="overlay-test-note overlay-board-note">번호판은 현재 진행 중인 회차와 판매 상태를 실시간으로 표시합니다.</p> : testMode === 'kuji-result' ? <div className="overlay-test-form">
          <label className="overlay-prize-source">등록 상품<select value={test.sourceTicketNumber ?? ''} onChange={(event) => selectRegisteredTicket(event.target.value)}><option value="">직접 입력 · 예시 이미지</option>{registeredTickets.map((ticket) => <option value={ticket.number} key={ticket.number}>{ticket.number}번 · {ticket.prizeGrade ? `${ticket.prizeGrade}상 · ` : ''}{ticket.prizeName}{ticket.prizeImageUrl ? ' · 이미지' : ''}</option>)}</select></label>
          <label>번호<NumberStepper aria-label="테스트 번호" min={1} max={9999} disabled={test.sourceTicketNumber != null} value={test.number} onValueChange={(number) => setTest((current) => ({ ...current, sourceTicketNumber: undefined, number }))} /></label>
          <label>등급<input type="text" maxLength={8} disabled={test.sourceTicketNumber != null} value={test.grade} onChange={(event) => setTest((current) => ({ ...current, sourceTicketNumber: undefined, grade: event.target.value }))} /></label>
          <label>상품명<input type="text" maxLength={80} disabled={test.sourceTicketNumber != null} value={test.prizeName} onChange={(event) => setTest((current) => ({ ...current, sourceTicketNumber: undefined, prizeName: event.target.value }))} /></label>
          <label>후원자<input type="text" maxLength={40} value={test.nickname} onChange={(event) => setTest((current) => ({ ...current, nickname: event.target.value }))} /></label>
          <button disabled={testPending} onClick={runOverlayTest}>{testPending ? '표시 중' : '이치방쿠지 테스트'}</button>
        </div> : <div className="overlay-test-form roulette-overlay-test-form">
          <label>후원 금액<NumberStepper aria-label="룰렛 테스트 후원 금액" min={1} max={100000000} step={100} suffix="치즈" value={rouletteTest.amount} onValueChange={(amount) => setRouletteTest((current) => ({ ...current, amount }))} /></label>
          <label>결과 항목<input type="text" maxLength={40} value={rouletteTest.label} onChange={(event) => setRouletteTest((current) => ({ ...current, label: event.target.value }))} /></label>
          <label>후원자<input type="text" maxLength={40} value={rouletteTest.nickname} onChange={(event) => setRouletteTest((current) => ({ ...current, nickname: event.target.value }))} /></label>
          <button disabled={testPending} onClick={runRouletteTest}>{testPending ? '표시 중' : '룰렛 테스트'}</button>
        </div>}
        <p className="overlay-test-note">테스트는 OBS와 위 미리보기에 동시에 표시되며 회차, 번호판, 당첨 내역 및 룰렛 결과 내역에는 저장되지 않습니다.</p>
      </section>
      <section className="workflow-section">
        <SettingRow title="당첨 효과음과 Google Cloud TTS" description="테스트 실행 결과에서 API 키 설정과 음성 생성 상태를 확인할 수 있습니다. 룰렛 TTS는 정지 효과음 다음에 재생됩니다.">
          <span className="overlay-audio-state">테스트로 확인</span>
        </SettingRow>
        <SettingRow title="쿠지 번호판 OBS 소스" description="회차 번호판과 판매 상태만 표시합니다. OBS 크기는 1920 × 1080으로 설정하세요.">
          <div className="overlay-actions"><code>{kujiBoardUrl}</code><button onClick={() => copy(kujiBoardUrl, '쿠지 번호판 오버레이')}>복사</button><button className="secondary-button" onClick={() => window.open(kujiBoardUrl, '_blank', 'noopener,noreferrer')}>새 창 미리보기</button></div>
        </SettingRow>
        <SettingRow title="쿠지 당첨 애니메이션 OBS 소스" description="1920 × 1080 기준 당첨 카드이며, OBS 소스 크기를 바꾸면 전체 애니메이션이 같은 비율로 조절됩니다. 번호판과 별도 소스로 추가하세요.">
          <div className="overlay-actions"><code>{kujiResultUrl}</code><button onClick={() => copy(kujiResultUrl, '쿠지 당첨 애니메이션')}>복사</button><button className="secondary-button" onClick={() => window.open(kujiResultUrl, '_blank', 'noopener,noreferrer')}>새 창 미리보기</button></div>
        </SettingRow>
        <SettingRow title="룰렛 OBS 소스" description="룰렛 회전과 추첨 결과만 표시합니다. OBS 크기는 1920 × 1080으로 설정하세요.">
          <div className="overlay-actions"><code>{rouletteUrl}</code><button onClick={() => copy(rouletteUrl, '룰렛 오버레이')}>복사</button><button className="secondary-button" onClick={() => window.open(rouletteUrl, '_blank', 'noopener,noreferrer')}>새 창 미리보기</button></div>
        </SettingRow>
        <SettingRow title="닉네임 표시" description="전체 노출은 방송 화면에 시청자 닉네임을 그대로 표시합니다.">
          <div className="segmented-control"><button disabled={pending} className={nicknameMode === 'masked' ? 'active' : ''} onClick={() => setMode('masked')}>부분 마스킹</button><button disabled={pending} className={nicknameMode === 'full' ? 'active' : ''} onClick={() => setMode('full')}>전체 노출</button></div>
        </SettingRow>
      </section>
      {feedback && <InlineFeedback tone={feedback.includes('못') ? 'error' : 'success'}>{feedback}</InlineFeedback>}
    </div>
  );
}
