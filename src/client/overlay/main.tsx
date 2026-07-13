import { createRoot } from 'react-dom/client';
import { App, type OverlayMode } from './App';

const path = window.location.pathname;
const mode: OverlayMode = path.endsWith('/overlay-kuji.html')
  ? 'kuji'
  : path.endsWith('/overlay-roulette.html')
    ? 'roulette'
    : 'combined';

const root = createRoot(document.getElementById('root')!);
root.render(<App mode={mode} />);
