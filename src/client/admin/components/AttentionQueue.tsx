import { useState } from 'react';
import type { QueueEntry } from '../api';
import { Mascot } from './Mascot';
import { InlineFeedback } from './InlineFeedback';

const statusLabels: Record<string, string> = {
  duplicate_rejected: '이미 팔린 번호',
  amount_mismatch: '금액 안 맞음',
  number_missing: '번호 미입력',
  out_of_range: '범위 밖 번호',
  session_inactive: '진행 중 회차 없음',
  feature_disabled: '기능 정지 중',
  processed: '일부 배정 실패',
};

export function AttentionQueue({ queue, onResolve }: { queue: QueueEntry[]; onResolve: (id: number) => Promise<void> }) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [errorId, setErrorId] = useState<number | null>(null);

  const resolve = async (id: number) => {
    setPendingId(id);
    setErrorId(null);
    try {
      await onResolve(id);
    } catch {
      setErrorId(id);
    } finally {
      setPendingId(null);
    }
  };

  if (queue.length === 0) {
    return (
      <div className="attention-empty">
        <Mascot state="waiting" />
        <p>처리할 항목이 없습니다.</p>
      </div>
    );
  }

  return (
    <ul className="attention-list">
      {queue.map((entry) => (
        <li key={entry.id}>
          <div>
            <strong>{statusLabels[entry.status] ?? entry.status}</strong>
            <p>{entry.donorNickname} · {entry.amount.toLocaleString('ko-KR')}치즈 · “{entry.rawMessage}”</p>
            {errorId === entry.id && <InlineFeedback tone="error">처리하지 못했습니다. 다시 시도해 주세요.</InlineFeedback>}
          </div>
          <button disabled={pendingId === entry.id} onClick={() => resolve(entry.id)}>
            {pendingId === entry.id ? '처리 중' : '처리 완료'}
          </button>
        </li>
      ))}
    </ul>
  );
}
