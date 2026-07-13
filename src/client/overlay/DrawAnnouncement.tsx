import { LotteryModel3D } from './LotteryModel3D';

export interface OverlayAnnouncement {
  key: number;
  number: number;
  grade: string | null;
  prizeName: string | null;
  prizeImageUrl?: string | null;
  nickname: string | null;
  test?: boolean;
}

export interface ConfettiPiece {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rotate: number;
}

export function gradeClass(grade: string | null | undefined): string {
  if (!grade) return 'grade-x';
  const normalized = grade.toUpperCase();
  if (normalized === 'A') return 'grade-a';
  if (normalized === 'B') return 'grade-b';
  if (normalized === 'C') return 'grade-c';
  return 'grade-x';
}

export function DrawAnnouncement({ announce, confetti }: { announce: OverlayAnnouncement; confetti: ConfettiPiece[] }) {
  return <div className="draw-announce" key={announce.key}>
    <LotteryModel3D mode="kuji" />
    <div className="confetti">
      {confetti.map((piece, index) => <span key={index} className="confetti-piece" style={{
        left: `${piece.left}%`, width: piece.size, height: piece.size * 0.5, background: piece.color,
        animationDelay: `${piece.delay}s`, animationDuration: `${piece.duration}s`, ['--rot' as string]: `${piece.rotate}deg`,
      }} />)}
    </div>
    <div className={`draw-card ${gradeClass(announce.grade)} ${announce.prizeImageUrl ? 'has-image' : ''}`}>
      {announce.test && <div className="draw-test-badge">미리보기 테스트</div>}
      <div className="draw-label">당첨!</div>
      <div className="draw-number">{announce.number}번</div>
      {announce.grade && <div className="draw-grade">{announce.grade}상</div>}
      {announce.prizeImageUrl && <div className="draw-image-frame"><img src={announce.prizeImageUrl} alt={announce.prizeName ? `${announce.prizeName} 상품` : '당첨 상품'} /></div>}
      {announce.prizeName && <div className="draw-prize">{announce.prizeName}</div>}
      {announce.nickname && <div className="draw-winner">{announce.nickname}</div>}
    </div>
  </div>;
}
