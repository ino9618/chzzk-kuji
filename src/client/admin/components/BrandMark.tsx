import { Mascot } from './Mascot';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? 'compact' : ''}`}>
      <Mascot state="face" className="brand-mascot" />
      <span>호갱 API</span>
    </div>
  );
}
