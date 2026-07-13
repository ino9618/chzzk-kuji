import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { DrawAnnouncement, gradeClass, type ConfettiPiece, type OverlayAnnouncement } from './DrawAnnouncement';
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

export function App() {
  const [board, setBoard] = useState<BoardPayload>({ active: false });
  const [justSold, setJustSold] = useState<number | null>(null);
  const [announce, setAnnounce] = useState<OverlayAnnouncement | null>(null);
  const [rouletteResult, setRouletteResult] = useState<RouletteResult | null>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rouletteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showAnnouncement = (next: Omit<OverlayAnnouncement, 'key'>) => {
    setAnnounce({ ...next, key: Date.now() });
    if (announceTimer.current) clearTimeout(announceTimer.current);
    announceTimer.current = setTimeout(() => setAnnounce(null), ANNOUNCE_MS);
  };

  useEffect(() => {
    fetch('/api/overlay/board')
      .then((r) => r.json())
      .then(setBoard);

    socket.on('board:update', (next: BoardPayload) => {
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
      showAnnouncement({ ...event, test: true });
    });
    socket.on('roulette:result', (result: RouletteResult) => {
      setRouletteResult(result);
      if (rouletteTimer.current) clearTimeout(rouletteTimer.current);
      rouletteTimer.current = setTimeout(() => setRouletteResult(null), 8000);
    });

    return () => {
      socket.off('board:update');
      socket.off('overlay:test');
      socket.off('roulette:result');
      if (announceTimer.current) clearTimeout(announceTimer.current);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      if (rouletteTimer.current) clearTimeout(rouletteTimer.current);
    };
  }, []);

  const confetti = useMemo(() => {
    if (!announce) return [];
    return makeConfetti(gradeClass(announce.grade) === 'grade-a' ? 70 : 32);
  }, [announce?.key]);

  if (!board.active && !announce && !rouletteResult) {
    return <div className="overlay-empty" />;
  }

  const soldCount = board.tickets?.filter((t) => t.status === 'sold').length ?? 0;
  const totalCount = board.tickets?.length ?? 0;
  // Keep cells a readable size: up to 10 across for small boards, then wrap
  // into balanced rows for larger ones (a 50-ticket board becomes ~12 cols).
  const columns = Math.min(Math.max(totalCount, 1), totalCount > 30 ? 12 : 10);

  return (
    <div className="overlay-root">
      {board.active && <><div className="overlay-header">
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
      {rouletteResult && <div className="roulette-result-overlay">
        <div className="roulette-result-card">
          <div className="roulette-result-wheel"><span>R</span></div>
          <span className="roulette-result-label">후원 룰렛 결과</span>
          <strong>{rouletteResult.label}</strong>
          <p>{rouletteResult.nickname} · {rouletteResult.amount.toLocaleString('ko-KR')} 치즈</p>
        </div>
      </div>}
    </div>
  );
}
