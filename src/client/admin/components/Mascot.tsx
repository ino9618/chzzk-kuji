import mascotDefault from '../../assets/mascot-default.png';
import mascotFace from '../../assets/mascot-face.png';
import mascotSuccess from '../../assets/mascot-success.png';
import mascotWaiting from '../../assets/mascot-waiting.png';
import mascotWarning from '../../assets/mascot-warning.png';

export type MascotState = 'default' | 'face' | 'success' | 'waiting' | 'warning';

const sources: Record<MascotState, string> = {
  default: mascotDefault,
  face: mascotFace,
  success: mascotSuccess,
  waiting: mascotWaiting,
  warning: mascotWarning,
};

const labels: Record<MascotState, string> = {
  default: '인사하는 설표 안내원',
  face: '웃고 있는 설표 안내원',
  success: '당첨 티켓을 든 설표 안내원',
  waiting: '기록을 확인하는 설표 안내원',
  warning: '주의 카드를 든 설표 안내원',
};

export function Mascot({ state = 'default', className = '' }: { state?: MascotState; className?: string }) {
  return <img className={`mascot ${className}`.trim()} src={sources[state]} alt={labels[state]} />;
}
