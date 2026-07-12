import { useState, type ReactNode } from 'react';
import type { AdminPage } from '../adminModel';
import { BrandMark } from './BrandMark';
import {
  DashboardIcon,
  BookIcon,
  MoreIcon,
  MonitorIcon,
  SettingsIcon,
  SlidersIcon,
  TicketIcon,
  TrophyIcon,
  SendIcon,
} from './Icons';
import { adminNavigationSections, type AdminIconName } from '../adminFeatures';
import { MoreSheet } from './MoreSheet';

interface AppShellProps {
  page: AdminPage;
  onNavigate: (page: AdminPage) => void;
  status: string;
  children: ReactNode;
  onLogout?: () => void;
}

const iconMap: Record<AdminIconName, typeof DashboardIcon> = {
  dashboard: DashboardIcon,
  monitor: MonitorIcon,
  ticket: TicketIcon,
  trophy: TrophyIcon,
  book: BookIcon,
  settings: SettingsIcon,
  sliders: SlidersIcon,
  send: SendIcon,
};

const statusLabels: Record<string, string> = {
  connected: '연결됨',
  reconnecting: '재연결 중',
  disconnected: '연결 끊김',
  not_configured: '미연결',
  needs_reauth: '재인증 필요',
  unknown: '확인 중',
};

export function AppShell({ page, onNavigate, status, children, onLogout = () => undefined }: AppShellProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const navigate = (nextPage: AdminPage) => {
    setMoreOpen(false);
    onNavigate(nextPage);
  };

  const renderItems = (items: (typeof adminNavigationSections)[number]['items']) =>
    items.map((item) => {
      const Icon = iconMap[item.icon];
      return (
        <button
          key={item.page}
          className={`shell-nav-item ${page === item.page ? 'active' : ''}`}
          aria-current={page === item.page ? 'page' : undefined}
          onClick={() => navigate(item.page)}
        >
          <Icon />
          <span>{item.label}</span>
        </button>
      );
    });

  return (
    <div className="admin-shell">
      <aside className="shell-sidebar">
        <div className="shell-brand"><BrandMark /></div>
        <nav aria-label="관리자 메뉴">
          {adminNavigationSections.map((section) => <div className="shell-nav-section" key={section.label}><p className="shell-nav-group">{section.label}</p>{renderItems(section.items)}</div>)}
        </nav>
        <div className={`shell-connection ${status}`}>
          <span className="dot" />
          {statusLabels[status] ?? status}
        </div>
      </aside>

      <main className="shell-content">{children}</main>

      <nav className="mobile-bottom-nav" aria-label="모바일 관리자 메뉴">
        {[
          { page: 'operations' as const, label: '운영', icon: DashboardIcon },
          { page: 'board' as const, label: '번호판', icon: TicketIcon },
          { page: 'winners' as const, label: '당첨', icon: TrophyIcon },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.page} className={page === item.page ? 'active' : ''} onClick={() => navigate(item.page)}>
              <Icon /><span>{item.label}</span>
            </button>
          );
        })}
        <button className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen(true)}>
          <MoreIcon /><span>더보기</span>
        </button>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} onNavigate={navigate} onLogout={onLogout} />
    </div>
  );
}
