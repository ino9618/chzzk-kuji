import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './overlay.css';

interface OverlayTicket {
  number: number;
  status: 'available' | 'sold';
  ownerNickname: string | null;
  prizeName: string | null;
  prizeGrade: string | null;
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

interface DrawAnnounce {
  key: number;
  number: number;
  grade: string | null;
  prizeName: string | null;
  nickname: string | null;
}

const socket = io();

const ANNOUNCE_MS = 5000;
const HIGHLIGHT_MS = 2600;

/** Maps a grade letter to a fixed color theme class (A gold, B silver, C bronze, rest green). */
function gradeClass(grade: string | null | undefined): string {
  if (!grade) return 'grade-x';
  const g = grade.toUpperCase();
  if (g === 'A') return 'grade-a';
  if (g === 'B') return 'grade-b';
  if (g === 'C') return 'grade-c';
  return 'grade-x';
}

interface ConfettiPiece {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rotate: number;
}

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
  const [announce, setAnnounce] = useState<DrawAnnounce | null>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

          setAnnounce({
            key: Date.now(),
            number: newlySold.number,
            grade: newlySold.prizeGrade,
            prizeName: newlySold.prizeName,
            nickname: newlySold.ownerNickname,
          });
          if (announceTimer.current) clearTimeout(announceTimer.current);
          announceTimer.current = setTimeout(() => setAnnounce(null), ANNOUNCE_MS);
        }
        return next;
      });
    });

    return () => {
      socket.off('board:update');
    };
  }, []);

  const confetti = useMemo(() => {
    if (!announce) return [];
    return makeConfetti(gradeClass(announce.grade) === 'grade-a' ? 70 : 32);
  }, [announce?.key]);

  if (!board.active) {
    return <div className="overlay-empty" />;
  }

  const soldCount = board.tickets?.filter((t) => t.status === 'sold').length ?? 0;
  const totalCount = board.tickets?.length ?? 0;

  return (
    <div className="overlay-root">
      <div className="overlay-header">
        <span className="overlay-header-title">🎫 {board.name || '이치방쿠지'}</span>
        <span className="overlay-header-count">
          {soldCount} / {totalCount}
        </span>
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

      <div className="overlay-grid">
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
      </div>

      {announce && (
        <div className="draw-announce" key={announce.key}>
          <div className="confetti">
            {confetti.map((p, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={{
                  left: `${p.left}%`,
                  width: p.size,
                  height: p.size * 0.5,
                  background: p.color,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                  ['--rot' as string]: `${p.rotate}deg`,
                }}
              />
            ))}
          </div>
          <div className={`draw-card ${gradeClass(announce.grade)}`}>
            <div className="draw-label">당첨!</div>
            <div className="draw-number">{announce.number}번</div>
            {announce.grade && <div className="draw-grade">{announce.grade}상</div>}
            {announce.prizeName && <div className="draw-prize">{announce.prizeName}</div>}
            {announce.nickname && <div className="draw-winner">{announce.nickname}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
