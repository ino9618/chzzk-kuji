import { useState } from 'react';
import type { ChzzkConnection } from '../api';
import { InlineFeedback } from '../components/InlineFeedback';
import { SettingRow } from '../components/SettingRow';

const labels: Record<string, string> = {
  connected: '정상 연결',
  reconnecting: '재연결 중',
  disconnected: '연결 끊김',
  not_configured: '연결되지 않음',
  needs_reauth: '재인증 필요',
  unknown: '확인 중',
};

export function ConnectionPage({ connection, onRefresh }: { connection: ChzzkConnection; onRefresh: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(false);
    try { await onRefresh(); } catch { setRefreshError(true); } finally { setRefreshing(false); }
  };
  const eventTime = connection.lastEventAt
    ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(connection.lastEventAt))
    : '아직 수신된 후원이 없습니다.';

  return (
    <div className="admin-page connection-page">
      <header className="page-header"><div><h1>치지직 연결</h1><p>후원 이벤트를 받는 채널과 실시간 연결 상태를 확인합니다.</p></div><button className="secondary-button" disabled={refreshing} onClick={refresh}>{refreshing ? '확인 중' : '상태 새로고침'}</button></header>
      <section className={`connection-overview ${connection.status}`} aria-live="polite">
        <span className="dot" /><div><strong>{labels[connection.status] ?? connection.status}</strong><p>{connection.status === 'connected' ? '후원 이벤트를 정상적으로 기다리고 있습니다.' : '아래 버튼으로 네이버 인증을 다시 진행해 주세요.'}</p></div>
      </section>
      <section className="workflow-section">
        <SettingRow title="연결 채널" description="이 채널의 후원 이벤트만 수신합니다."><div className="connection-value"><strong>{connection.channelName || '채널 정보 없음'}</strong>{connection.channelId && <code>{connection.channelId}</code>}</div></SettingRow>
        <SettingRow title="최근 후원 수신" description="서버가 마지막으로 후원 이벤트를 처리한 시각입니다."><span>{eventTime}</span></SettingRow>
        <SettingRow title="연결 방식" description="방송 송출과 분리된 치지직 API 연결입니다."><span>스트림키 불필요</span></SettingRow>
        <SettingRow title="계정 재연결" description="인증 만료 또는 채널 변경이 필요할 때 사용합니다."><a className="button-link" href="/api/chzzk/oauth/start">네이버로 다시 연결</a></SettingRow>
      </section>
      {refreshError && <InlineFeedback tone="error">연결 상태를 새로고침하지 못했습니다.</InlineFeedback>}
    </div>
  );
}
