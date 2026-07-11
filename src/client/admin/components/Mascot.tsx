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
  default: '손을 흔드는 캡슐 뽑기통 마스코트',
  face: '캡슐 뽑기통 마스코트 얼굴',
  success: '기뻐하는 캡슐 뽑기통 마스코트',
  waiting: '기다리는 캡슐 뽑기통 마스코트',
  warning: '걱정하는 캡슐 뽑기통 마스코트',
};

export function Mascot({ state = 'default', className = '' }: { state?: MascotState; className?: string }) {
  return <img className={`mascot ${className}`.trim()} src={sources[state]} alt={labels[state]} />;
}
