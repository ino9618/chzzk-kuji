import { useState } from 'react';
import type { QueueEntry, SessionState } from '../api';
import { getOperationsStatus } from '../adminModel';
import { AttentionQueue } from '../components/AttentionQueue';
import { CurrentSessionSummary } from '../components/CurrentSessionSummary';
import { SettingRow } from '../components/SettingRow';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InlineFeedback } from '../components/InlineFeedback';

interface OperationsPageProps {
  session: SessionState;
  queue: QueueEntry[];
  chzzkStatus: string;
  kujiEnabled: boolean;
  kujiPending?: boolean;
  onToggleKuji: (enabled: boolean) => Promise<void> | void;
  onNavigateSetup: () => void;
  onNavigateBoard: () => void;
  onResolveQueue: (id: number) => Promise<void>;
  onResolveAllQueue: () => Promise<void>;
  onRequestClose: () => void;
}

export function OperationsPage(props: OperationsPageProps) {
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState(false);
  const status = getOperationsStatus({
    connected: props.chzzkStatus === 'connected',
    enabled: props.kujiEnabled,
    active: props.session.active,
    issueCount: props.queue.length,
  });
  const resolveAll = async () => {
    setBulkPending(true);
    setBulkError(false);
    try {
      await props.onResolveAllQueue();
      setBulkDialogOpen(false);
    } catch { setBulkError(true); }
    finally { setBulkPending(false); }
  };

  return (
    <div className="admin-page operations-page">
      <header className="page-header"><h1>간편 운영</h1></header>
      <section className={`operations-summary ${status.tone}`} aria-live="polite">
        <span className="summary-symbol" aria-hidden="true">{status.tone === 'ready' ? '✓' : status.tone === 'warning' ? '!' : '○'}</span>
        <div><strong>{status.label}</strong><p>{status.detail}</p></div>
      </section>

      <section className="workflow-section" aria-label="방송 운영 상태">
        <SettingRow title="방송 연결" description="치지직 후원 이벤트를 실시간으로 받고 있습니다.">
          <span className={`row-status ${props.chzzkStatus}`}><span className="dot" />{props.chzzkStatus === 'connected' ? '연결됨' : '확인 필요'}</span>
        </SettingRow>
        <SettingRow title="이치방쿠지 상태" description="후원 메시지의 번호를 자동으로 배정합니다.">
          <label className="switch compact"><input type="checkbox" checked={props.kujiEnabled} disabled={props.kujiPending} onChange={(event) => props.onToggleKuji(event.target.checked)} /><span className="switch-track"><span className="switch-thumb" /></span><span>{props.kujiPending ? '저장 중' : props.kujiEnabled ? '사용 중' : '일시정지'}</span></label>
        </SettingRow>
        <SettingRow title="현재 회차"><CurrentSessionSummary session={props.session} onNavigateSetup={props.onNavigateSetup} onNavigateBoard={props.onNavigateBoard} /></SettingRow>
      </section>

      <section className="workflow-panel">
        <div className="workflow-heading attention-heading"><div><h2>처리 필요</h2><span>{props.queue.length}건</span></div>{props.queue.length > 0 && <button className="secondary-button" onClick={() => setBulkDialogOpen(true)}>전체 처리 완료</button>}</div>
        {bulkError && <InlineFeedback tone="error">일괄 처리하지 못했습니다. 다시 시도해 주세요.</InlineFeedback>}
        <AttentionQueue queue={props.queue} onResolve={props.onResolveQueue} />
      </section>

      {props.session.active && (
        <section className="workflow-section finish-section">
          <SettingRow title="방송 마무리" description="현재 회차를 닫고 판매를 종료합니다." danger>
            <button className="danger-solid-button" onClick={props.onRequestClose}>회차 종료</button>
          </SettingRow>
        </section>
      )}
      <ConfirmDialog open={bulkDialogOpen} title={`${props.queue.length}건을 모두 처리 완료할까요?`} description="실제 후원과 번호 배정 결과는 변경되지 않으며, 현재 항목을 처리 필요 목록에서 확인 완료 상태로 정리합니다." confirmLabel="전체 처리 완료" pending={bulkPending} onConfirm={resolveAll} onCancel={() => setBulkDialogOpen(false)} />
    </div>
  );
}
