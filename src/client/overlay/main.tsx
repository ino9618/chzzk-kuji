import { createRoot } from 'react-dom/client';
import { App, type OverlayMode } from './App';

const path = window.location.pathname;
const mode: OverlayMode = path.endsWith('/overlay-kuji-board.html')
  ? 'kuji-board'
  : path.endsWith('/overlay-kuji-result.html')
    ? 'kuji-result'
    : path.endsWith('/overlay-kuji.html')
      ? 'kuji'
      : path.endsWith('/overlay-roulette-list.html')
        ? 'roulette-list'
      : path.endsWith('/overlay-roulette.html')
        ? 'roulette'
        : 'combined';

const root = createRoot(document.getElementById('root')!);
root.render(<App mode={mode} />);
