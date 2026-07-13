import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { io } from 'socket.io-client';
import { DrawAnnouncement, gradeClass, type ConfettiPiece, type OverlayAnnouncement } from './DrawAnnouncement';
import { playGoogleTtsAudio, playRouletteSpinSound, playRouletteStopSound, playWinnerFanfare } from './overlayAudio';
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
  test?: boolean;
}

export type OverlayMode = 'kuji' | 'roulette' | 'combined';

function RouletteAnnouncement({ result }: { result: RouletteResult }) {
  const [revealed, setRevealed] = useState(false);
  const [rowHeight, setRowHeight] = useState(() => Math.round(Math.max(120, Math.min(window.innerHeight * 0.18, 210))));
  const { sequence, winningIndex } = useMemo(() => {
    const source = Array.from(new Set((result.items ?? []).map((item) => item.trim()).filter(Boolean)));
    if (!source.includes(result.label)) source.push(result.label);
    if (source.length < 2) source.push('다시 돌리기', '보너스');
    const nextItem = source[(source.indexOf(result.label) + 1) % source.length];
    const items = [...Array.from({ length: 8 }, () => source).flat(), result.label, nextItem];
    return { sequence: items, winningIndex: items.length - 2 };
  }, [result]);
  useEffect(() => {
    setRevealed(false);
    playRouletteSpinSound();
    const timer = window.setTimeout(() => { setRevealed(true); playRouletteStopSound(); }, 3300);
    return () => window.clearTimeout(timer);
  }, [result]);
  useEffect(() => {
    const resize = () => setRowHeight(Math.round(Math.max(120, Math.min(window.innerHeight * 0.18, 210))));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const reelStyle = {
    '--roulette-row-height': `${rowHeight}px`,
    '--roulette-window-height': `${rowHeight * 3}px`,
    '--roulette-reel-end': `${rowHeight - winningIndex * rowHeight}px`,
  } as CSSProperties;
  return <div className={`roulette-result-overlay ${revealed ? 'revealed' : ''}`}>
    <div className="roulette-reel-shell" style={reelStyle}>
      {result.test && <div className="draw-test-badge roulette-test-badge">미리보기 테스트</div>}
      <div className="roulette-reel-header"><span>후원 룰렛</span><strong>{revealed ? '추첨 완료' : '추첨 중'}</strong></div>
      <div className="roulette-reel-window">
        <div className="roulette-reel-track">
          {sequence.map((item, index) => <div className={`roulette-reel-item ${index === winningIndex ? 'winning' : ''}`} key={`${item}-${index}`}>{item}</div>)}
        </div>
        <div className="roulette-reel-focus" aria-hidden="true" />
      </div>
      <div className="roulette-reel-donor"><span>{result.nickname}</span><strong>{result.amount.toLocaleString('ko-KR')} 치즈</strong></div>
    </div>
  </div>;
}

const socket = io();

const ANNOUNCE_MS = 8000;
const HIGHLIGHT_MS = 2600;

const CONFETTI_COLORS = ['#f5c451', '#00ffa3', '#7fd4ff', '#ff8fb1', '#ffffff'];

function makeConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.2 + Math.random() * 1.6,
    size: 6 + Math.random() * 8,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rotate: (Math.random() - 0.5) * 720,
  }));
}

export function App({ mode = 'combined' }: { mode?: OverlayMode }) {
  const [board, setBoard] = useState<BoardPayload>({ active: false });
  const [justSold, setJustSold] = useState<number | null>(null);
  const [announce, setAnnounce] = useState<OverlayAnnouncement | null>(null);
  const [rouletteResult, setRouletteResult] = useState<RouletteResult | null>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rouletteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showKuji = mode !== 'roulette';
  const showRoulette = mode !== 'kuji';

  const showAnnouncement = (next: Omit<OverlayAnnouncement, 'key'>) => {
    setAnnounce({ ...next, key: Date.now() });
    playWinnerFanfare();
    if (announceTimer.current) clearTimeout(announceTimer.current);
    announceTimer.current = setTimeout(() => setAnnounce(null), ANNOUNCE_MS);
  };

  useEffect(() => {
    let isDevPreview = false;
    let boardPoll: number | undefined;
    if (import.meta.env.DEV) {
      const preview = new URLSearchParams(window.location.search).get('preview3d');
      isDevPreview = preview === 'kuji' || preview === 'roulette';
      if (preview === 'kuji') showAnnouncement({ number: 7, grade: 'A', prizeName: '한정판 피규어', prizeImageUrl: '/assets/mascot-success.png', nickname: '테스트 후원자', test: true });
      if (preview === 'roulette') setRouletteResult({ label: '랜덤 미션', nickname: '테스트 후원자', amount: 5000, items: ['노래 한 곡', '랜덤 미션', '다시 돌리기', '간식 타임'], test: true });
    }
    if (!isDevPreview && showKuji) {
      const refreshBoard = () => fetch('/api/overlay/board', { cache: 'no-store' })
        .then((response) => response.json())
        .then(setBoard)
        .catch(() => undefined);
      void refreshBoard();
      boardPoll = window.setInterval(refreshBoard, 15_000);
    }

    socket.on('board:update', (next: BoardPayload) => {
      if (!showKuji) return;
      setBoard((prev) => {
        const prevSoldNumbers = new Set(prev.tickets?.filter((t) => t.status === 'sold').map((t) => t.number));
        const newlySold = next.tickets?.find((t) => t.status === 'sold' && !prevSoldNumbers.has(t.number));
        if (newlySold) {
          setJustSold(newlySold.number);
          if (highlightTimer.current) clearTimeout(highlightTimer.current);
          highlightTimer.current = setTimeout(() => setJustSold(null), HIGHLIGHT_MS);

          showAnnouncement({
            number: newlySold.number,
            grade: newlySold.prizeGrade,
            prizeName: newlySold.prizeName,
            prizeImageUrl: newlySold.prizeImageUrl,
            nickname: newlySold.ownerNickname,
          });
        }
        return next;
      });
    });

    socket.on('overlay:test', (event: Omit<OverlayAnnouncement, 'key'>) => {
      if (showKuji) showAnnouncement({ ...event, test: true });
    });
    socket.on('roulette:result', (result: RouletteResult) => {
      if (!showRoulette) return;
      setRouletteResult(result);
      if (rouletteTimer.current) clearTimeout(rouletteTimer.current);
      rouletteTimer.current = setTimeout(() => setRouletteResult(null), 8000);
    });
    socket.on('winner:audio', ({ audioDataUrl }: { audioDataUrl: string }) => playGoogleTtsAudio(audioDataUrl));

    return () => {
      socket.off('board:update');
      socket.off('overlay:test');
      socket.off('roulette:result');
      socket.off('winner:audio');
      if (announceTimer.current) clearTimeout(announceTimer.current);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      if (rouletteTimer.current) clearTimeout(rouletteTimer.current);
      if (boardPoll) window.clearInterval(boardPoll);
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
    return makeConfetti(gradeClass(announce.grade) === 'grade-a' ? 70 : 32);
  }, [announce?.key]);

  if (!(showKuji && board.active) && !announce && !rouletteResult) {
    return <div className="overlay-empty" />;
  }

  const soldCount = board.tickets?.filter((t) => t.status === 'sold').length ?? 0;
  const totalCount = board.tickets?.length ?? 0;
  // Keep cells a readable size: up to 10 across for small boards, then wrap
  // into balanced rows for larger ones (a 50-ticket board becomes ~12 cols).
  const columns = Math.min(Math.max(totalCount, 1), totalCount > 30 ? 12 : 10);

  return (
    <div className="overlay-root">
      {showKuji && board.active && <><div className="overlay-header">
        <div className="overlay-title-block">
          <span className="overlay-eyebrow">이치방쿠지</span>
          <span className="overlay-header-title">{board.name || '호갱 API'}</span>
        </div>
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

      <div className="overlay-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 118px))` }}>
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
      {rouletteResult && <RouletteAnnouncement result={rouletteResult} />}
    </div>
  );
}
