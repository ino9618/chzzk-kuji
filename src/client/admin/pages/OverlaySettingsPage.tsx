import { useEffect, useRef, useState } from 'react';
import { InlineFeedback } from '../components/InlineFeedback';
import { SettingRow } from '../components/SettingRow';

interface OverlayTestPayload {
  number: number;
  grade: string;
  prizeName: string;
  nickname: string;
}

const OVERLAY_WIDTH = 1920;
const OVERLAY_HEIGHT = 1080;

function OverlayPreviewFrame() {
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
      src="/overlay.html"
      title="OBS 오버레이 실시간 미리보기"
      width={OVERLAY_WIDTH}
      height={OVERLAY_HEIGHT}
      style={{ transform: `scale(${scale})` }}
    />
  </div>;
}

export function OverlaySettingsPage({ nicknameMode, onSetNicknameMode, onTestOverlay }: { nicknameMode: 'masked' | 'full'; onSetNicknameMode: (mode: 'masked' | 'full') => Promise<void>; onTestOverlay: (payload: OverlayTestPayload) => Promise<void> }) {
  const [feedback, setFeedback] = useState('');
  const [pending, setPending] = useState(false);
  const [testPending, setTestPending] = useState(false);
  const [test, setTest] = useState<OverlayTestPayload>({ number: 1, grade: 'A', prizeName: '테스트 상품', nickname: '테스트 후원자' });
  const url = typeof window === 'undefined' ? '/overlay.html' : `${window.location.origin}/overlay.html`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('오버레이 주소를 복사했습니다.');
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
      await onTestOverlay(test);
      setFeedback('오버레이에 테스트 당첨 화면을 표시했습니다. 실제 판매 내역은 변경되지 않습니다.');
    } catch {
      setFeedback('오버레이 테스트를 표시하지 못했습니다. 연결 상태를 확인해 주세요.');
    } finally {
      setTestPending(false);
    }
  };

  return (
    <div className="admin-page overlay-page">
      <header className="page-header"><div><h1>오버레이</h1><p>OBS 브라우저 소스와 화면 표시 방식을 설정합니다.</p></div></header>
      <section className="overlay-preview-section">
        <div className="workflow-heading"><div><h2>실시간 오버레이 미리보기</h2><p>OBS 브라우저 소스와 동일한 Full HD 화면을 축소해 표시합니다.</p></div><span>1920 × 1080</span></div>
        <OverlayPreviewFrame />
        <div className="overlay-test-form">
          <label>번호<input type="number" min={1} max={9999} value={test.number} onChange={(event) => setTest((current) => ({ ...current, number: Number(event.target.value) }))} /></label>
          <label>등급<input type="text" maxLength={8} value={test.grade} onChange={(event) => setTest((current) => ({ ...current, grade: event.target.value }))} /></label>
          <label>상품명<input type="text" maxLength={80} value={test.prizeName} onChange={(event) => setTest((current) => ({ ...current, prizeName: event.target.value }))} /></label>
          <label>후원자<input type="text" maxLength={40} value={test.nickname} onChange={(event) => setTest((current) => ({ ...current, nickname: event.target.value }))} /></label>
          <button disabled={testPending} onClick={runOverlayTest}>{testPending ? '표시 중' : '테스트 표시'}</button>
        </div>
        <p className="overlay-test-note">테스트 표시는 약 5초간 유지되며 회차, 번호판, 당첨 내역에는 저장되지 않습니다.</p>
      </section>
      <section className="workflow-section">
        <SettingRow title="OBS 브라우저 소스" description="OBS 브라우저 소스의 너비 1920, 높이 1080으로 설정하고 아래 주소를 입력하세요.">
          <div className="overlay-actions"><code>{url}</code><button onClick={copy}>복사</button><button className="secondary-button" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>새 창 미리보기</button></div>
        </SettingRow>
        <SettingRow title="닉네임 표시" description="전체 노출은 방송 화면에 시청자 닉네임을 그대로 표시합니다.">
          <div className="segmented-control"><button disabled={pending} className={nicknameMode === 'masked' ? 'active' : ''} onClick={() => setMode('masked')}>부분 마스킹</button><button disabled={pending} className={nicknameMode === 'full' ? 'active' : ''} onClick={() => setMode('full')}>전체 노출</button></div>
        </SettingRow>
      </section>
      {feedback && <InlineFeedback tone={feedback.includes('못') ? 'error' : 'success'}>{feedback}</InlineFeedback>}
    </div>
  );
}
