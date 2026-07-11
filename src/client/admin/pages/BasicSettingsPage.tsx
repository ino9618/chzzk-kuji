import { useState } from 'react';
import type { BasicSettings } from '../api';
import { InlineFeedback } from '../components/InlineFeedback';
import { SettingRow } from '../components/SettingRow';

export function BasicSettingsPage({ settings, onSave }: { settings: BasicSettings; onSave: (settings: BasicSettings) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'error' | ''>('');
  const save = async () => {
    if (!Number.isInteger(draft.defaultTicketPrice) || draft.defaultTicketPrice < 1) { setFeedback('error'); return; }
    setPending(true);
    setFeedback('');
    try { await onSave(draft); setFeedback('success'); } catch { setFeedback('error'); } finally { setPending(false); }
  };
  return (
    <div className="admin-page basic-settings-page">
      <header className="page-header"><div><h1>기본 설정</h1><p>새 회차와 방송 화면에 공통으로 적용할 기본값입니다.</p></div><button disabled={pending} onClick={save}>{pending ? '저장 중' : '변경사항 저장'}</button></header>
      <section className="workflow-section">
        <SettingRow title="이치방쿠지 사용" description="후원 메시지의 번호를 자동으로 배정합니다."><label className="switch compact"><input type="checkbox" checked={draft.kujiEnabled} onChange={(event) => setDraft({ ...draft, kujiEnabled: event.target.checked })} /><span className="switch-track"><span className="switch-thumb" /></span><span>{draft.kujiEnabled ? '사용' : '일시정지'}</span></label></SettingRow>
        <SettingRow title="기본 장당 가격" description="새 회차를 만들 때 처음 표시되는 치즈 금액입니다."><div className="input-suffix settings-price"><input aria-label="기본 장당 가격" type="number" min={1} value={draft.defaultTicketPrice} onChange={(event) => setDraft({ ...draft, defaultTicketPrice: Number(event.target.value) })} /><span>치즈</span></div></SettingRow>
        <SettingRow title="닉네임 표시" description="OBS 오버레이에서 당첨자 닉네임을 표시하는 방식입니다."><div className="segmented-control"><button className={draft.nicknameMode === 'masked' ? 'active' : ''} onClick={() => setDraft({ ...draft, nicknameMode: 'masked' })}>부분 마스킹</button><button className={draft.nicknameMode === 'full' ? 'active' : ''} onClick={() => setDraft({ ...draft, nicknameMode: 'full' })}>전체 노출</button></div></SettingRow>
        <SettingRow title="번호 인식 규칙" description="후원 금액을 장당 가격으로 나눈 수만큼 번호가 필요합니다."><code>예: 2장 구매 → 1번 3번</code></SettingRow>
      </section>
      {feedback === 'success' && <InlineFeedback tone="success">기본 설정을 저장했습니다.</InlineFeedback>}
      {feedback === 'error' && <InlineFeedback tone="error">설정을 확인하거나 잠시 후 다시 시도해 주세요.</InlineFeedback>}
    </div>
  );
}
