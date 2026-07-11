import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { api, type SessionState, type QueueEntry, type Winner } from './api';
import type { AdminPage } from './adminModel';
import { AppShell } from './components/AppShell';
import { ConfirmDialog } from './components/ConfirmDialog';
import { LoginScreen } from './components/LoginScreen';
import { OperationsPage } from './pages/OperationsPage';
import { TicketBoardPage } from './pages/TicketBoardPage';
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
  const [kujiEnabled, setKujiEnabled] = useState(true);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingSession, setClosingSession] = useState(false);

  // Restore an existing session (e.g. right after the Naver OAuth callback
  // set the cookie, or on a page refresh), surface OAuth error messages
  // passed back via ?login= query params, and detect whether the OAuth
  // routes are mounted at all (they 404 when server env vars are missing).
  useEffect(() => {
    fetch('/api/auth/whoami', { credentials: 'include' }).then((r) => {
      if (r.ok) setLoggedIn(true);
    });
    fetch('/api/chzzk/oauth/login', { method: 'GET', redirect: 'manual' }).then((r) => {
      // An opaque redirect (type ~ 'opaqueredirect', status 0) means the route
      // exists and tried to redirect to Naver; a plain 404 means it's disabled.
      if (r.status === 404) setOauthAvailable(false);
    });
    const params = new URLSearchParams(window.location.search);
    const login = params.get('login');
    if (login === 'error') setLoginError('네이버 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
    if (params.size > 0) window.history.replaceState(null, '', '/admin.html');
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    api.getSession().then(setSession);
    api.getQueue().then(setQueue);
    api.getWinners().then(setWinners);
    api.getNicknameMode().then((r) => setNicknameMode(r.mode));
    api.getChzzkStatus().then((r) => setChzzkStatus(r.status));
    api.getKujiEnabled().then((r) => setKujiEnabled(r.enabled));

    socket.connect();
    socket.on('board:update', () => {
      api.getSession().then(setSession);
      api.getWinners().then(setWinners);
    });
    socket.on('queue:update', () => api.getQueue().then(setQueue));
    socket.on('connection:status', (status: string) => setChzzkStatus(status));
    return () => {
      socket.off('board:update');
      socket.off('queue:update');
      socket.off('connection:status');
      socket.disconnect();
    };
  }, [loggedIn]);

  if (!loggedIn) {
    return <LoginScreen oauthAvailable={oauthAvailable} loginError={loginError} />;
  }

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
    try {
      await api.closeSession();
      setSession(await api.getSession());
      setCloseDialogOpen(false);
    } finally {
      setClosingSession(false);
    }
  };

  return (
    <AppShell page={page} onNavigate={setPage} status={chzzkStatus} onLogout={logout}>
        {chzzkStatus === 'needs_reauth' && (
          <div className="reauth-banner">
            치지직 인증이 만료되어 후원 수신이 중단되었습니다.{' '}
            <a href="/api/chzzk/oauth/login">네이버로 다시 로그인</a>하면 즉시 복구됩니다.
          </div>
        )}

        {page === 'operations' && <OperationsPage session={session} queue={queue} chzzkStatus={chzzkStatus} kujiEnabled={kujiEnabled} onToggleKuji={(enabled) => { setKujiEnabled(enabled); api.setKujiEnabled(enabled); }} onNavigateSetup={() => setPage('session-setup')} onNavigateBoard={() => setPage('board')} onResolveQueue={resolveQueue} onRequestClose={() => setCloseDialogOpen(true)} />}

        {page === 'board' && <TicketBoardPage session={session} onNavigateSetup={() => setPage('session-setup')} />}

        {page === 'winners' && (
          <>
            <h1 className="page-title">당첨자</h1>
            <section className="panel">
              {winners.length === 0 ? (
                <p className="empty-hint">아직 당첨자가 없습니다.</p>
              ) : (
                <ul className="queue-list">
                  {winners.map((w) => (
                    <li key={`${w.sessionId}-${w.number}`} className="winner-item">
                      <span className="winner-session">{w.sessionName}</span>
                      <span className="winner-number">{w.number}번</span>
                      <span className="winner-prize">{w.prizeName}</span>
                      <span className="winner-nickname">{w.ownerNickname}</span>
                      <span className="winner-time">{w.soldAt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {page === 'session-setup' && (
          <div className="admin-page"><header className="page-header"><h1>회차 설정</h1></header><section className="panel">{session.active ? <p className="empty-hint">현재 회차가 진행 중입니다. 간편 운영에서 회차를 종료한 뒤 새 회차를 만들 수 있습니다.</p> : <NewSessionForm onCreated={() => api.getSession().then((next) => { setSession(next); setPage('board'); })} />}</section></div>
        )}

        {page === 'overlay' && (
          <>
            <h1 className="page-title">오버레이</h1>
            <section className="panel">
              <h2>오버레이 닉네임 표시</h2>
              <div className="radio-row">
                <label>
                  <input
                    type="radio"
                    checked={nicknameMode === 'masked'}
                    onChange={() => {
                      setNicknameMode('masked');
                      api.setNicknameMode('masked');
                    }}
                  />
                  부분 마스킹
                </label>
                <label>
                  <input
                    type="radio"
                    checked={nicknameMode === 'full'}
                    onChange={() => {
                      setNicknameMode('full');
                      api.setNicknameMode('full');
                    }}
                  />
                  전체 노출
                </label>
              </div>
            </section>

            <section className="panel">
              <h2>OBS 오버레이 주소</h2>
              <p className="empty-hint">OBS의 브라우저 소스에 아래 주소를 등록하세요.</p>
              <OverlayUrlCopy />
            </section>

          </>
        )}

        {page === 'more' && <div className="admin-page"><header className="page-header"><h1>기타 설정</h1></header><section className="panel"><a className="manual-link" href="/manual.html" target="_blank" rel="noreferrer">사용법 열기</a><button className="logout-button" onClick={logout}>로그아웃</button></section></div>}

        <ConfirmDialog open={closeDialogOpen} title="회차를 종료할까요?" description={`${session.name || '현재 회차'}를 종료하면 되돌릴 수 없습니다.`} confirmLabel="회차 종료" pending={closingSession} onConfirm={closeSession} onCancel={() => setCloseDialogOpen(false)} />
    </AppShell>
  );
}

function OverlayUrlCopy() {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/overlay.html`;

  return (
    <div className="overlay-url-row">
      <code className="overlay-url">{url}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? '복사됨!' : '복사'}
      </button>
    </div>
  );
}

interface TicketRow {
  number: number;
  prizeName: string;
  prizeGrade: string;
}

interface GradeGroup {
  grade: string;
  prizeName: string;
  count: number;
}

function makeTicketRows(count: number, previous: TicketRow[]): TicketRow[] {
  return Array.from({ length: count }, (_, i) => {
    const number = i + 1;
    const existing = previous.find((t) => t.number === number);
    return existing ?? { number, prizeName: '', prizeGrade: '' };
  });
}

/** Fisher-Yates shuffle -- returns a new array, does not mutate the input. */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function GradeGroupBuilder({ onApply }: { onApply: (tickets: TicketRow[]) => void }) {
  const [groups, setGroups] = useState<GradeGroup[]>([
    { grade: 'A', prizeName: '', count: 1 },
    { grade: 'B', prizeName: '', count: 2 },
  ]);

  const total = groups.reduce((sum, g) => sum + (Number.isFinite(g.count) ? g.count : 0), 0);

  function updateGroup(index: number, field: keyof GradeGroup, value: string | number) {
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)));
  }

  function addGroup() {
    setGroups((prev) => [...prev, { grade: '', prizeName: '', count: 1 }]);
  }

  function removeGroup(index: number) {
    setGroups((prev) => prev.filter((_, i) => i !== index));
  }

  function applyShuffled() {
    const pool = groups.flatMap((g) =>
      Array.from({ length: Math.max(0, Math.floor(g.count) || 0) }, () => ({
        prizeName: g.prizeName.trim() || `${g.grade}상`,
        prizeGrade: g.grade.trim(),
      }))
    );
    const shuffled = shuffle(pool);
    onApply(shuffled.map((p, i) => ({ number: i + 1, prizeName: p.prizeName, prizeGrade: p.prizeGrade })));
  }

  return (
    <div className="grade-builder">
      <div className="grade-builder-header">
        <span>등급</span>
        <span>상품명</span>
        <span>인원수</span>
        <span />
      </div>
      {groups.map((g, i) => (
        <div className="grade-builder-row" key={i}>
          <input placeholder="A" value={g.grade} onChange={(e) => updateGroup(i, 'grade', e.target.value)} />
          <input
            placeholder="상품명 (예: 스타벅스 기프티콘)"
            value={g.prizeName}
            onChange={(e) => updateGroup(i, 'prizeName', e.target.value)}
          />
          <input
            type="number"
            min={1}
            value={g.count}
            onChange={(e) => updateGroup(i, 'count', Number(e.target.value))}
          />
          <button type="button" className="grade-remove-button" onClick={() => removeGroup(i)}>
            ✕
          </button>
        </div>
      ))}
      <div className="grade-builder-footer">
        <button type="button" onClick={addGroup}>
          + 등급 추가
        </button>
        <span className="grade-total">총 {total}장</span>
        <button type="button" onClick={applyShuffled} disabled={total === 0}>
          무작위로 배치 적용
        </button>
      </div>
    </div>
  );
}

function NewSessionForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [ticketPrice, setTicketPrice] = useState(1000);
  const [rangeMax, setRangeMax] = useState(10);
  const [tickets, setTickets] = useState<TicketRow[]>(() => makeTicketRows(10, []));
  const [bulkPrize, setBulkPrize] = useState('');

  function handleRangeMaxChange(next: number) {
    setRangeMax(next);
    setTickets((prev) => makeTicketRows(next, prev));
  }

  function updateTicket(number: number, field: 'prizeName' | 'prizeGrade', value: string) {
    setTickets((prev) => prev.map((t) => (t.number === number ? { ...t, [field]: value } : t)));
  }

  function applyBulkPrize() {
    if (!bulkPrize.trim()) return;
    setTickets((prev) => prev.map((t) => ({ ...t, prizeName: bulkPrize })));
  }

  function applyGradeGroups(shuffledTickets: TicketRow[]) {
    setRangeMax(shuffledTickets.length);
    setTickets(shuffledTickets);
  }

  async function handleCreate() {
    const payloadTickets = tickets.map((t) => ({
      number: t.number,
      prizeName: t.prizeName.trim() || `${t.number}번 상품`,
      prizeGrade: t.prizeGrade.trim() || undefined,
    }));
    await api.createSession({ name, ticketPrice, numberRangeMin: 1, numberRangeMax: rangeMax, tickets: payloadTickets });
    onCreated();
  }

  return (
    <div className="new-session-form">
      <p className="empty-hint">진행 중인 회차가 없습니다. 새 회차를 시작하세요.</p>
      <input placeholder="회차 이름" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="field-row">
        <input
          type="number"
          placeholder="장당 가격"
          value={ticketPrice}
          onChange={(e) => setTicketPrice(Number(e.target.value))}
        />
        <input
          type="number"
          placeholder="최대 번호"
          value={rangeMax}
          onChange={(e) => handleRangeMaxChange(Number(e.target.value))}
        />
      </div>

      <p className="section-label">등급별 구성 (선택) — 등급마다 인원수를 입력하면 번호에 무작위로 배치됩니다</p>
      <GradeGroupBuilder onApply={applyGradeGroups} />

      <div className="bulk-fill-row">
        <input
          placeholder="전체 번호에 한번에 적용할 상품명 (예: 꽝)"
          value={bulkPrize}
          onChange={(e) => setBulkPrize(e.target.value)}
        />
        <button type="button" onClick={applyBulkPrize}>
          전체 적용
        </button>
      </div>

      <div className="ticket-table">
        <div className="ticket-table-header">
          <span>번호</span>
          <span>상품명</span>
          <span>등급(선택)</span>
        </div>
        <div className="ticket-table-body">
          {tickets.map((t) => (
            <div className="ticket-table-row" key={t.number}>
              <span className="ticket-table-number">{t.number}</span>
              <input
                value={t.prizeName}
                onChange={(e) => updateTicket(t.number, 'prizeName', e.target.value)}
                placeholder={`${t.number}번 상품명`}
              />
              <input
                value={t.prizeGrade}
                onChange={(e) => updateTicket(t.number, 'prizeGrade', e.target.value)}
                placeholder="등급"
              />
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleCreate}>회차 시작</button>
    </div>
  );
}
