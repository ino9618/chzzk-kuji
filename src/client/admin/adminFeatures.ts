import type { AdminPage } from './adminModel';

export type AdminIconName = 'dashboard' | 'monitor' | 'ticket' | 'trophy' | 'book' | 'settings' | 'sliders' | 'send';

export interface AdminNavigationItem {
  page: AdminPage;
  label: string;
  icon: AdminIconName;
}

export interface AdminNavigationSection {
  label: string;
  items: AdminNavigationItem[];
}

// New broadcast features can register a page in this list without changing
// the shell rendering logic.
export const adminNavigationSections: AdminNavigationSection[] = [
  {
    label: '방송 운영',
    items: [
      { page: 'operations', label: '간편 운영', icon: 'dashboard' },
      { page: 'preflight', label: '방송 전 점검', icon: 'monitor' },
    ],
  },
  {
    label: '이치방쿠지',
    items: [
      { page: 'board', label: '판매 번호판', icon: 'ticket' },
      { page: 'winners', label: '당첨 내역', icon: 'trophy' },
      { page: 'session-history', label: '회차 기록', icon: 'book' },
      { page: 'log', label: '운영 기록', icon: 'book' },
    ],
  },
  {
    label: '테스트 도구',
    items: [
      { page: 'donation-simulator', label: '도네이션 테스트', icon: 'send' },
      { page: 'overlay', label: '오버레이', icon: 'monitor' },
    ],
  },
  {
    label: '설정',
    items: [
      { page: 'connection', label: '치지직 연결', icon: 'sliders' },
      { page: 'settings', label: '기본 설정', icon: 'settings' },
      { page: 'session-setup', label: '회차 설정', icon: 'settings' },
      { page: 'more', label: '기타 설정', icon: 'sliders' },
    ],
  },
];
