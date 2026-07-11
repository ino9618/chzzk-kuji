import { useEffect, useRef } from 'react';
import type { AdminPage } from '../adminModel';
import { BookIcon, CloseIcon, LogoutIcon, MonitorIcon, SettingsIcon, SlidersIcon } from './Icons';

export function MoreSheet({ open, onClose, onNavigate, onLogout }: { open: boolean; onClose: () => void; onNavigate: (page: AdminPage) => void; onLogout: () => void }) {
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    firstActionRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="more-sheet" role="dialog" aria-modal="true" aria-label="더보기 메뉴">
        <div className="sheet-handle" />
        <button className="sheet-close" aria-label="더보기 닫기" onClick={onClose}><CloseIcon /></button>
        <button ref={firstActionRef} onClick={() => onNavigate('session-setup')}><SettingsIcon />회차 설정</button>
        <button onClick={() => onNavigate('overlay')}><MonitorIcon />오버레이</button>
        <button onClick={() => onNavigate('more')}><SlidersIcon />기타 설정</button>
        <a href="/manual.html" target="_blank" rel="noreferrer"><BookIcon />사용법</a>
        <button className="sheet-logout" onClick={onLogout}><LogoutIcon />로그아웃</button>
      </section>
    </div>
  );
}
