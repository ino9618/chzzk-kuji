import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { api, type ChzzkConnection, type SessionState, type QueueEntry, type Winner } from './api';
import type { AdminPage } from './adminModel';
import { AppShell } from './components/AppShell';
import { ConfirmDialog } from './components/ConfirmDialog';
import { InlineFeedback } from './components/InlineFeedback';
import { LoginScreen } from './components/LoginScreen';
import { MorePage } from './pages/MorePage';
import { OperationsPage } from './pages/OperationsPage';
import { OverlaySettingsPage } from './pages/OverlaySettingsPage';
import { SessionSetupPage } from './pages/SessionSetupPage';
import { TicketBoardPage } from './pages/TicketBoardPage';
import { WinnersPage } from './pages/WinnersPage';
import { ConnectionPage } from './pages/ConnectionPage';
import './admin.css';

const socket = io({ autoConnect: false });

export function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [oauthAvailable, setOauthAvailable] = useState(true);
  const [page, setPage] = useState<AdminPage>('operations');
  const [session, setSession] = useState<SessionState>({ active: false });
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [nicknameMode, setNicknameMode] = useState<'masked' | 'full'>('masked');
  const [chzzkStatus, setChzzkStatus] = useState('unknown');
  const [connection, setConnection] = useState<ChzzkConnection>({ status: 'unknown', channelId: null, channelName: null, lastEventAt: null });
  const [kujiEnabled, setKujiEnabled] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingSession, setClosingSession] = useState(false);
  const [mutationError, setMutationError] = useState('');
  const [savingKuji, setSavingKuji] = useState(false);

  useEffect(() => {
    fetch('/api/auth/whoami', { credentials: 'include' }).then((response) => {
      if (response.ok) setLoggedIn(true);
    });
    fetch('/api/chzzk/oauth/login', { method: 'GET', redirect: 'manual' }).then((response) => {
      if (response.status === 404) setOauthAvailable(false);
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === 'error') setLoginError('네이버 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
    if (params.size > 0) window.history.replaceState(null, '', '/admin.html');
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [nextSession, nextQueue, nextWinners, nickname, status, connectionInfo, enabled] = await Promise.all([
        api.getSession(),
        api.getQueue(),
        api.getWinners(),
        api.getNicknameMode(),
        api.getChzzkStatus(),
        api.getChzzkConnection(),
        api.getKujiEnabled(),
      ]);
      setSession(nextSession);
      setQueue(nextQueue);
      setWinners(nextWinners);
      setNicknameMode(nickname.mode);
      setChzzkStatus(status.status);
      setConnection(connectionInfo);
      setKujiEnabled(enabled.enabled);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    loadData();
    socket.connect();
    socket.on('board:update', () => {
      api.getSession().then(setSession);
      api.getWinners().then(setWinners);
    });
    socket.on('queue:update', () => api.getQueue().then(setQueue));
    socket.on('connection:status', (status) => {
      setChzzkStatus(status);
      setConnection((current) => ({ ...current, status }));
    });
    return () => {
      socket.off('board:update');
      socket.off('queue:update');
      socket.off('connection:status');
      socket.disconnect();
    };
  }, [loggedIn, loadData]);

  if (!loggedIn) return <LoginScreen oauthAvailable={oauthAvailable} loginError={loginError} />;

  const logout = async () => {
    await api.logout();
    window.location.href = '/admin.html';
  };
  const resolveQueue = async (id: number) => {
    await api.resolveQueueItem(id);
    setQueue(await api.getQueue());
  };
  const closeSession = async () => {
    setClosingSession(true);
    setMutationError('');
    try {
      await api.closeSession();
      setSession({ active: false });
      setCloseDialogOpen(false);
      try { setSession(await api.getSession()); } catch { setLoadError(true); }
    } catch {
      setMutationError('회차를 종료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setClosingSession(false);
    }
  };
  const toggleKuji = async (enabled: boolean) => {
    setSavingKuji(true);
    setMutationError('');
    try {
      await api.setKujiEnabled(enabled);
      setKujiEnabled(enabled);
    } catch {
      setMutationError('이치방쿠지 상태를 저장하지 못했습니다.');
    } finally {
      setSavingKuji(false);
    }
  };
  const refreshCreatedSession = async () => {
    try {
      setSession(await api.getSession());
    } catch {
      setLoadError(true);
    }
    setPage('board');
  };

  return (
    <AppShell page={page} onNavigate={setPage} status={chzzkStatus} onLogout={logout}>
      {loadError && <div className="load-error"><InlineFeedback tone="error">일부 정보를 불러오지 못했습니다.</InlineFeedback><button onClick={loadData}>다시 시도</button></div>}
      {mutationError && <InlineFeedback tone="error">{mutationError}</InlineFeedback>}
      {chzzkStatus === 'needs_reauth' && <div className="reauth-banner">치지직 인증이 만료되어 후원 수신이 중단되었습니다. <a href="/api/chzzk/oauth/login">네이버로 다시 로그인</a>하면 즉시 복구됩니다.</div>}
      {page === 'operations' && <OperationsPage session={session} queue={queue} chzzkStatus={chzzkStatus} kujiEnabled={kujiEnabled} kujiPending={savingKuji} onToggleKuji={toggleKuji} onNavigateSetup={() => setPage('session-setup')} onNavigateBoard={() => setPage('board')} onResolveQueue={resolveQueue} onRequestClose={() => setCloseDialogOpen(true)} />}
      {page === 'board' && <TicketBoardPage session={session} onNavigateSetup={() => setPage('session-setup')} />}
      {page === 'winners' && <WinnersPage winners={winners} />}
      {page === 'connection' && <ConnectionPage connection={connection} onRefresh={async () => { const next = await api.getChzzkConnection(); setConnection(next); setChzzkStatus(next.status); }} onDisconnect={async () => { await api.disconnectChzzk(); const next = { status: 'not_configured', channelId: null, channelName: null, lastEventAt: connection.lastEventAt }; setConnection(next); setChzzkStatus(next.status); }} />}
      {page === 'session-setup' && (session.active ? <div className="admin-page"><header className="page-header"><h1>회차 설정</h1></header><div className="page-empty"><p>현재 회차가 진행 중입니다.</p><button onClick={() => setPage('operations')}>간편 운영으로 이동</button></div></div> : <SessionSetupPage onCreate={api.createSession} onCreated={refreshCreatedSession} />)}
      {page === 'overlay' && <OverlaySettingsPage nicknameMode={nicknameMode} onSetNicknameMode={async (mode) => { await api.setNicknameMode(mode); setNicknameMode(mode); }} />}
      {page === 'more' && <MorePage onLogout={logout} />}
      <ConfirmDialog open={closeDialogOpen} title="회차를 종료할까요?" description={`${session.name || '현재 회차'}를 종료하면 되돌릴 수 없습니다.`} confirmLabel="회차 종료" pending={closingSession} onConfirm={closeSession} onCancel={() => setCloseDialogOpen(false)} />
    </AppShell>
  );
}
