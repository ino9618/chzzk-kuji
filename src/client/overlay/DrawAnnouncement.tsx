import { useEffect, useState, type CSSProperties } from 'react';
import kujiMascotPeekUrl from '../assets/kuji-mascot-peek.png';
import kujiMascotCheerUrl from '../assets/kuji-mascot-cheer.png';
import kujiMascotLoungeUrl from '../assets/kuji-mascot-lounge.png';

const DRAW_STAGE_WIDTH = 1920;
const DRAW_STAGE_HEIGHT = 1080;

export function drawStageScale(width: number, height: number): number {
  return Math.min(width / DRAW_STAGE_WIDTH, height / DRAW_STAGE_HEIGHT);
}

export interface OverlayAnnouncement {
  key: number;
  number: number;
  grade: string | null;
  prizeName: string | null;
  prizeImageUrl?: string | null;
  nickname: string | null;
  test?: boolean;
  audioDataUrl?: string;
}

export interface ConfettiPiece {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rotate: number;
  drift: number;
}

export function Snowfall({ pieces }: { pieces: ConfettiPiece[] }) {
  return <div className="snowfall" aria-hidden="true">
    {pieces.map((piece, index) => <span key={index} className="snowflake-piece" style={{
      left: `${piece.left}%`, fontSize: piece.size, color: piece.color,
      animationDelay: `${piece.delay}s`, animationDuration: `${piece.duration}s`,
      ['--rot' as string]: `${piece.rotate}deg`, ['--drift' as string]: `${piece.drift}px`,
    }}>❄</span>)}
  </div>;
}

export function gradeClass(grade: string | null | undefined): string {
  if (!grade) return 'grade-x';
  const normalized = grade.toUpperCase();
  if (normalized === 'A') return 'grade-a';
  if (normalized === 'B') return 'grade-b';
  if (normalized === 'C') return 'grade-c';
  return 'grade-x';
}

export function DrawResultCard({ announce }: { announce: OverlayAnnouncement }) {
  return <div className={`draw-card ${gradeClass(announce.grade)} ${announce.prizeImageUrl ? 'has-image' : ''}`}>
    {announce.test && <div className="draw-test-badge">미리보기 테스트</div>}
    <div className="draw-ticket-head">
      <div className="draw-title-lockup"><div><span className="draw-kicker">ICHIBAN KUJI</span><strong className="draw-label">당첨 결과</strong></div></div>
      <div className="draw-number"><span>선택 번호</span><strong>{announce.number}번</strong></div>
    </div>
    {announce.prizeImageUrl && <div className="draw-image-frame"><img src={announce.prizeImageUrl} alt={announce.prizeName ? `${announce.prizeName} 상품` : '당첨 상품'} /></div>}
    <div className="draw-result-body">
      <div className="draw-grade"><span>당첨 등급</span><strong>{announce.grade ? `${announce.grade}상` : '당첨'}</strong></div>
      <div className="draw-result-copy">
        {announce.prizeName && <div className="draw-prize"><span>당첨 상품</span><strong>{announce.prizeName}</strong></div>}
        {announce.nickname && <div className="draw-winner"><span>당첨자</span><strong>{announce.nickname}</strong></div>}
      </div>
    </div>
  </div>;
}

export function DrawAnnouncement({ announce, confetti }: { announce: OverlayAnnouncement; confetti: ConfettiPiece[] }) {
  const [scale, setScale] = useState(() => typeof window === 'undefined' ? 1 : drawStageScale(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const resize = () => setScale(drawStageScale(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const stageStyle = { '--draw-stage-scale': scale } as CSSProperties;

  return <div className="draw-announce" key={announce.key}>
    <div className="draw-stage" style={stageStyle}>
      <Snowfall pieces={confetti} />
      <div className={`draw-mascot-scene ${announce.prizeImageUrl ? 'has-image' : ''}`} aria-hidden="true">
        <img className="draw-mascot-peek" src={kujiMascotPeekUrl} alt="" />
        <img className="draw-mascot-cheer" src={kujiMascotCheerUrl} alt="" />
        <img className="draw-mascot-lounge" src={kujiMascotLoungeUrl} alt="" />
      </div>
      <DrawResultCard announce={announce} />
    </div>
  </div>;
}
