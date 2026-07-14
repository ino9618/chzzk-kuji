import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { io } from 'socket.io-client';
import { DrawAnnouncement, Snowfall, gradeClass, type ConfettiPiece, type OverlayAnnouncement } from './DrawAnnouncement';
import { playGoogleTtsAudio, playRouletteSpinSound, playRouletteStopSound, playWinnerFanfare } from './overlayAudio';
import mascotSuccessUrl from '../assets/mascot-success.png';
import loginMascotDuoUrl from '../assets/login-mascot-duo.png';
import rouletteMascotGroupUrl from '../assets/roulette-mascot-group.png';
import { SequentialEventQueue } from './eventQueue';
import './overlay.css';

interface OverlayTicket {
  number: number;
  status: 'available' | 'sold';
  ownerNickname: string | null;
  prizeName: string | null;
  prizeGrade: string | null;
  prizeImageUrl: string | null;
}

interface GradeSummary {
  grade: string;
  prizeName: string;
  total: number;
  claimed: number;
}

interface BoardPayload {
  active: boolean;
  name?: string;
  numberRangeMin?: number;
  numberRangeMax?: number;
  tickets?: OverlayTicket[];
  grades?: GradeSummary[];
}

interface RouletteResult {
  label: string;
  nickname: string;
  amount: number;
  items?: string[];
  probability?: number;
  audioDataUrl?: string;
  test?: boolean;
}

interface RouletteListItem {
  label: string;
  weight: number;
  probability: number;
}

interface RouletteListPayload {
  enabled: boolean;
  minimumAmount: number;
  items: RouletteListItem[];
}

interface OverlayAudioSettings {
  soundEnabled: boolean;
  ttsEnabled: boolean;
}

export type OverlayMode = 'kuji' | 'kuji-board' | 'kuji-result' | 'roulette' | 'roulette-list' | 'combined';

const ROULETTE_SPIN_MS = 2500;
const ROULETTE_RESULT_HOLD_MS = 2500;

function formatProbability(probability: number): string {
  const digits = probability < 1 ? 2 : 1;
  return `${Number(probability.toFixed(digits))}%`;
}

function RouletteListOverlay({ config }: { config: RouletteListPayload }) {
  const manyItems = config.items.length > 8;
  return <div className="roulette-list-stage">
    <section className={`roulette-list-card ${manyItems ? 'many-items' : ''} ${config.enabled ? '' : 'disabled'}`}>
      <img className="roulette-list-mascots" src={rouletteMascotGroupUrl} alt="" aria-hidden="true" />
      <header className="roulette-list-header">
        <div><span className="roulette-list-eyebrow">오늘의 룰렛</span><h1>룰렛 목록</h1></div>
        <span className={`roulette-list-state ${config.enabled ? 'active' : ''}`}>{config.enabled ? '진행 중' : '사용 중지'}</span>
      </header>
      <div className="roulette-list-summary">
        <span><strong>!룰렛</strong> 후원 명령어</span>
        <span><strong>{config.minimumAmount.toLocaleString('ko-KR')}</strong> 치즈부터</span>
        <span><strong>{config.items.length}</strong>개 항목</span>
      </div>
      <ol className="roulette-list-items">
        {config.items.map((item, index) => <li className="roulette-list-item" key={`${item.label}-${index}`}>
          <span className="roulette-list-number">{index + 1}</span>
          <span className="roulette-list-label" title={item.label}>{item.label}</span>
          <span className="roulette-list-meter" aria-hidden="true"><i style={{ width: `${Math.max(2, item.probability)}%` }} /></span>
          <strong className="roulette-list-probability">{formatProbability(item.probability)}</strong>
        </li>)}
      </ol>
      {!config.enabled && <p className="roulette-list-disabled-note">현재 룰렛이 잠시 쉬고 있어요</p>}
    </section>
  </div>;
}

function RouletteAnnouncement({ result, audioSettings, onComplete }: { result: RouletteResult; audioSettings: OverlayAudioSettings; onComplete: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [rowHeight, setRowHeight] = useState(() => Math.round(Math.max(108, Math.min(window.innerHeight * 0.14, 150))));
  const revealDone = useRef(false);
  const speechTimer = useRef<number>();
  const dismissTimer = useRef<number>();
  const snowflakes = useMemo(() => makeConfetti(36), [result]);
  const { sequence, winningIndex } = useMemo(() => {
    const source = Array.from(new Set((result.items ?? []).map((item) => item.trim()).filter(Boolean)));
    if (!source.includes(result.label)) source.push(result.label);
    if (source.length < 2) source.push('다시 돌리기', '보너스');
    const nextItem = source[(source.indexOf(result.label) + 1) % source.length];
    const items = [...Array.from({ length: 10 }, () => source).flat(), result.label, nextItem];
    return { sequence: items, winningIndex: items.length - 2 };
  }, [result]);
  useEffect(() => {
    revealDone.current = false;
    setRevealed(false);
    if (audioSettings.soundEnabled) playRouletteSpinSound(ROULETTE_SPIN_MS);
    const timer = window.setTimeout(() => finishSpin(), ROULETTE_SPIN_MS + 300);
    return () => {
      window.clearTimeout(timer);
      if (speechTimer.current) window.clearTimeout(speechTimer.current);
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    };
  }, [result]);
  useEffect(() => {
    const resize = () => setRowHeight(Math.round(Math.max(108, Math.min(window.innerHeight * 0.14, 150))));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const reelStyle = {
    '--roulette-row-height': `${rowHeight}px`,
    '--roulette-window-height': `${rowHeight}px`,
    '--roulette-reel-end': `${-winningIndex * rowHeight}px`,
    '--roulette-spin-duration': `${ROULETTE_SPIN_MS}ms`,
  } as CSSProperties;
  const probability = Math.max(0, Math.min(100, result.probability ?? 0));
  const starCount = Math.max(1, Math.min(5, Math.ceil(probability / 20)));
  const finishSpin = () => {
    if (revealDone.current) return;
    revealDone.current = true;
    setRevealed(true);
    if (audioSettings.soundEnabled) playRouletteStopSound();
    if (audioSettings.ttsEnabled && result.audioDataUrl) {
      speechTimer.current = window.setTimeout(() => playGoogleTtsAudio(result.audioDataUrl!), 800);
    }
    dismissTimer.current = window.setTimeout(onComplete, ROULETTE_RESULT_HOLD_MS);
  };
  return <div className={`roulette-result-overlay ${revealed ? 'revealed' : ''}`}>
    {revealed && <Snowfall pieces={snowflakes} />}
    <div className="roulette-reel-shell" style={reelStyle}>
      {result.test && <div className="draw-test-badge roulette-test-badge">미리보기 테스트</div>}
      <div className="roulette-mascot-scene" aria-hidden="true"><img src={rouletteMascotGroupUrl} alt="" /></div>
      <div className="roulette-stars" aria-label={`당첨 확률 ${probability.toFixed(1)}%, 별 ${starCount}개`}>
        {Array.from({ length: starCount }, (_, index) => <span className="roulette-star" key={index}>★</span>)}
      </div>
      <div className="roulette-result-bar">
        <div className="roulette-brand"><span>{revealed ? '당첨' : '추첨 중'}</span></div>
        <div className="roulette-reel-window">
          <div className="roulette-reel-track" onAnimationEnd={finishSpin}>
            {sequence.map((item, index) => <div className={`roulette-reel-item ${revealed && index === winningIndex ? 'winning' : ''}`} key={`${item}-${index}`}>{item}</div>)}
          </div>
        </div>
        <strong className="roulette-status">{revealed ? '결과' : '회전'}</strong>
      </div>
      <div className="roulette-reel-donor"><span>{result.nickname} · {result.amount.toLocaleString('ko-KR')} 치즈</span><strong>당첨 확률 {probability.toFixed(1)}%</strong></div>
    </div>
  </div>;
}

const socket = io();

const ANNOUNCE_MS = 8000;
const HIGHLIGHT_MS = 2600;

type QueuedOverlayEvent =
  | { id: number; kind: 'kuji'; payload: Omit<OverlayAnnouncement, 'key'> }
  | { id: number; kind: 'roulette'; payload: RouletteResult };

const CONFETTI_COLORS = ['#ffffff', '#dff4ff', '#b9e5fb', '#eadffc', '#fbdde7'];

function makeConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 3.6 + Math.random() * 2.4,
    size: 18 + Math.random() * 22,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rotate: (Math.random() - 0.5) * 720,
    drift: (Math.random() - 0.5) * 240,
  }));
}

export function App({ mode = 'combined' }: { mode?: OverlayMode }) {
  const [board, setBoard] = useState<BoardPayload>({ active: false });
  const [justSold, setJustSold] = useState<number | null>(null);
  const [activeEvent, setActiveEvent] = useState<QueuedOverlayEvent | null>(null);
  const [rouletteList, setRouletteList] = useState<RouletteListPayload | null>(null);
  const [audioSettings, setAudioSettings] = useState<OverlayAudioSettings>({ soundEnabled: true, ttsEnabled: true });
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventQueue = useRef(new SequentialEventQueue<QueuedOverlayEvent>());
  const eventId = useRef(0);
  const showBoard = mode === 'combined' || mode === 'kuji' || mode === 'kuji-board';
  const showKujiResult = mode === 'combined' || mode === 'kuji' || mode === 'kuji-result';
  const receiveKuji = showBoard || showKujiResult;
  const showRoulette = mode === 'combined' || mode === 'roulette';
  const showRouletteList = mode === 'roulette-list';

  const enqueueKuji = (payload: Omit<OverlayAnnouncement, 'key'>) => {
    const activated = eventQueue.current.enqueue({ id: ++eventId.current, kind: 'kuji', payload });
    if (activated) setActiveEvent(activated);
  };
  const enqueueRoulette = (payload: RouletteResult) => {
    const activated = eventQueue.current.enqueue({ id: ++eventId.current, kind: 'roulette', payload });
    if (activated) setActiveEvent(activated);
  };
  const completeActiveEvent = () => setActiveEvent(eventQueue.current.complete());
  const announce: OverlayAnnouncement | null = activeEvent?.kind === 'kuji'
    ? { ...activeEvent.payload, key: activeEvent.id }
    : null;
  const rouletteResult = activeEvent?.kind === 'roulette' ? activeEvent.payload : null;

  useEffect(() => {
    if (activeEvent?.kind !== 'kuji') return;
    if (audioSettings.soundEnabled) playWinnerFanfare();
    const speechTimer = audioSettings.ttsEnabled && activeEvent.payload.audioDataUrl
      ? window.setTimeout(() => playGoogleTtsAudio(activeEvent.payload.audioDataUrl!), 600)
      : undefined;
    const dismissTimer = window.setTimeout(completeActiveEvent, ANNOUNCE_MS);
    return () => {
      if (speechTimer) window.clearTimeout(speechTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [activeEvent?.id]);

  useEffect(() => {
    const refreshAudioSettings = () => fetch('/api/overlay/audio-settings', { cache: 'no-store' })
      .then((response) => response.json())
      .then(setAudioSettings)
      .catch(() => undefined);
    void refreshAudioSettings();
    const interval = window.setInterval(refreshAudioSettings, 10_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let isDevPreview = false;
    let boardPoll: number | undefined;
    let rouletteListPoll: number | undefined;
    if (import.meta.env.DEV) {
      const preview = new URLSearchParams(window.location.search).get('preview3d');
      isDevPreview = preview === 'kuji' || preview === 'kuji-no-image' || preview === 'roulette' || preview === 'queue' || preview === 'roulette-list' || preview === 'roulette-list-many' || preview === 'board';
      if (preview === 'kuji') enqueueKuji({ number: 7, grade: 'A', prizeName: '한정판 피규어', prizeImageUrl: mascotSuccessUrl, nickname: '테스트 후원자', test: true });
      if (preview === 'kuji-no-image') enqueueKuji({ number: 12, grade: 'B', prizeName: '설냥갱 스페셜 굿즈', nickname: '테스트 후원자', test: true });
      if (preview === 'roulette') enqueueRoulette({ label: '랜덤 미션', nickname: '테스트 후원자', amount: 5000, items: ['노래 한 곡', '랜덤 미션', '다시 돌리기', '간식 타임'], probability: 40, test: true });
      if (preview === 'queue') {
        enqueueKuji({ number: 3, grade: 'A', prizeName: '첫 번째 쿠지 결과', nickname: '첫 후원자', test: true });
        enqueueRoulette({ label: '두 번째 룰렛 결과', nickname: '두 번째 후원자', amount: 5000, items: ['첫 항목', '두 번째 룰렛 결과', '세 번째 항목'], probability: 33.3, test: true });
        enqueueKuji({ number: 9, grade: 'B', prizeName: '세 번째 쿠지 결과', nickname: '세 번째 후원자', test: true });
      }
      if (preview === 'roulette-list') setRouletteList({
        enabled: true,
        minimumAmount: 5000,
        items: [
          { label: '노래 한 곡', weight: 3, probability: 30 },
          { label: '랜덤 미션', weight: 2, probability: 20 },
          { label: '간식 타임', weight: 2, probability: 20 },
          { label: '다시 돌리기', weight: 1, probability: 10 },
          { label: '애교 한 번', weight: 1, probability: 10 },
          { label: '시청자 추천곡', weight: 1, probability: 10 },
        ],
      });
      if (preview === 'roulette-list-many') setRouletteList({
        enabled: true,
        minimumAmount: 5000,
        items: Array.from({ length: 20 }, (_, index) => ({
          label: `${index + 1}번 방송 미션 항목`,
          weight: 1,
          probability: 5,
        })),
      });
      if (preview === 'board') setBoard({
        active: true,
        name: '설냥갱 이치방쿠지',
        tickets: Array.from({ length: 12 }, (_, index) => ({ number: index + 1, status: index < 4 ? 'sold' as const : 'available' as const, ownerNickname: index < 4 ? `참여자 ${index + 1}` : null, prizeName: index < 4 ? `${String.fromCharCode(65 + index)}상 상품` : null, prizeGrade: index < 4 ? String.fromCharCode(65 + index) : null, prizeImageUrl: null })),
        grades: [{ grade: 'A', prizeName: '한정판 피규어', total: 1, claimed: 1 }, { grade: 'B', prizeName: '굿즈 세트', total: 3, claimed: 1 }, { grade: 'C', prizeName: '랜덤 상품', total: 8, claimed: 2 }],
      });
    }
    if (!isDevPreview && receiveKuji) {
      const refreshBoard = () => fetch('/api/overlay/board', { cache: 'no-store' })
        .then((response) => response.json())
        .then(setBoard)
        .catch(() => undefined);
      void refreshBoard();
      boardPoll = window.setInterval(refreshBoard, 15_000);
    }
    if (!isDevPreview && showRouletteList) {
      const refreshRouletteList = () => fetch('/api/overlay/roulette', { cache: 'no-store' })
        .then((response) => response.json())
        .then(setRouletteList)
        .catch(() => undefined);
      void refreshRouletteList();
      rouletteListPoll = window.setInterval(refreshRouletteList, 10_000);
    }

    socket.on('board:update', (next: BoardPayload) => {
      if (!receiveKuji) return;
      setBoard((prev) => {
        const prevSoldNumbers = new Set(prev.tickets?.filter((t) => t.status === 'sold').map((t) => t.number));
        const newlySold = next.tickets?.find((t) => t.status === 'sold' && !prevSoldNumbers.has(t.number));
        if (newlySold) {
          if (showBoard) {
            setJustSold(newlySold.number);
            if (highlightTimer.current) clearTimeout(highlightTimer.current);
            highlightTimer.current = setTimeout(() => setJustSold(null), HIGHLIGHT_MS);
          }
        }
        return next;
      });
    });

    socket.on('overlay:test', (event: Omit<OverlayAnnouncement, 'key'>) => {
      if (showKujiResult) enqueueKuji({ ...event, test: true });
    });
    socket.on('kuji:result', (event: Omit<OverlayAnnouncement, 'key'>) => {
      if (showKujiResult) enqueueKuji(event);
    });
    socket.on('roulette:result', (result: RouletteResult) => {
      if (showRoulette) enqueueRoulette(result);
    });

    return () => {
      socket.off('board:update');
      socket.off('overlay:test');
      socket.off('kuji:result');
      socket.off('roulette:result');
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      eventQueue.current.clear();
      if (boardPoll) window.clearInterval(boardPoll);
      if (rouletteListPoll) window.clearInterval(rouletteListPoll);
    };
  }, [mode]);

  useEffect(() => {
    let currentVersion = '';
    const checkVersion = async () => {
      try {
        const response = await fetch('/api/overlay/version', { cache: 'no-store' });
        const { version } = await response.json() as { version: string };
        if (currentVersion && currentVersion !== version) window.location.reload();
        currentVersion = version;
      } catch {
        // A temporary network failure is handled by the next interval.
      }
    };
    const handleVisibility = () => { if (document.visibilityState === 'visible') void checkVersion(); };
    void checkVersion();
    const interval = window.setInterval(checkVersion, 60_000);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const confetti = useMemo(() => {
    if (!announce) return [];
    return makeConfetti(gradeClass(announce.grade) === 'grade-a' ? 42 : 26);
  }, [announce?.key]);

  if (!(showBoard && board.active) && !announce && !rouletteResult && !(showRouletteList && rouletteList)) {
    return <div className="overlay-empty" />;
  }

  const soldCount = board.tickets?.filter((t) => t.status === 'sold').length ?? 0;
  const totalCount = board.tickets?.length ?? 0;
  // Keep cells a readable size: up to 10 across for small boards, then wrap
  // into balanced rows for larger ones (a 50-ticket board becomes ~12 cols).
  const columns = Math.min(Math.max(totalCount, 1), totalCount > 30 ? 12 : 10);

  return (
    <div className="overlay-root">
      {showBoard && board.active && <><div className="overlay-header">
        <div className="overlay-brand-lockup"><img className="overlay-duo-mascot" src={loginMascotDuoUrl} alt="" /><div className="overlay-title-block">
          <span className="overlay-eyebrow">이치방쿠지</span>
          <span className="overlay-header-title">{board.name || '호갱 API'}</span>
        </div></div>
        <div className="overlay-progress-block">
          <span>판매 현황</span>
          <strong className="overlay-header-count">{soldCount}<small>/ {totalCount}</small></strong>
        </div>
      </div>

      {board.grades && board.grades.length > 0 && (
        <div className="grade-legend">
          {[...board.grades]
            .sort((a, b) => a.grade.localeCompare(b.grade))
            .map((g) => (
              <div
                key={g.grade}
                className={`grade-legend-item ${gradeClass(g.grade)} ${g.claimed >= g.total ? 'sold-out' : ''}`}
              >
                <span className="grade-legend-badge">{g.grade}상</span>
                <span className="grade-legend-name">{g.prizeName}</span>
                {g.claimed >= g.total ? (
                  <span className="grade-legend-done">종료</span>
                ) : (
                  <span className="grade-legend-count">
                    {g.claimed}/{g.total}
                  </span>
                )}
              </div>
            ))}
        </div>
      )}

      <div className="overlay-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 92px))` }}>
        {board.tickets?.map((t) => (
          <div
            key={t.number}
            className={`overlay-cell ${t.status} ${gradeClass(t.prizeGrade)} ${
              justSold === t.number ? 'highlight' : ''
            }`}
          >
            <div className="overlay-number">{t.number}</div>
            {t.status === 'sold' && (
              <>
                {t.prizeGrade && <div className="overlay-grade">{t.prizeGrade}상</div>}
                {t.prizeName && <div className="overlay-prize">{t.prizeName}</div>}
                <div className="overlay-owner">{t.ownerNickname}</div>
              </>
            )}
          </div>
        ))}
      </div></>}

      {announce && <DrawAnnouncement announce={announce} confetti={confetti} />}
      {rouletteResult && <RouletteAnnouncement result={rouletteResult} audioSettings={audioSettings} onComplete={completeActiveEvent} />}
      {showRouletteList && rouletteList && <RouletteListOverlay config={rouletteList} />}
    </div>
  );
}
