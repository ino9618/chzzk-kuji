import { useState } from 'react';
import { InlineFeedback } from '../components/InlineFeedback';
import { SettingRow } from '../components/SettingRow';

export function OverlaySettingsPage({ nicknameMode, onSetNicknameMode }: { nicknameMode: 'masked' | 'full'; onSetNicknameMode: (mode: 'masked' | 'full') => Promise<void> }) {
  const [feedback, setFeedback] = useState('');
  const [pending, setPending] = useState(false);
  const url = typeof window === 'undefined' ? '/overlay.html' : `${window.location.origin}/overlay.html`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setFeedback('오버레이 주소를 복사했습니다.');
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

  return (
    <div className="admin-page overlay-page">
      <header className="page-header"><div><h1>오버레이</h1><p>OBS 브라우저 소스와 화면 표시 방식을 설정합니다.</p></div></header>
      <section className="workflow-section">
        <SettingRow title="OBS 브라우저 소스" description="OBS의 브라우저 소스 URL에 아래 주소를 입력하세요.">
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
