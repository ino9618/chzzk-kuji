import type { AdminPage } from './adminModel';

export type AdminIconName = 'dashboard' | 'monitor' | 'ticket' | 'trophy' | 'book' | 'settings' | 'sliders' | 'roulette';

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
    label: '홈',
    items: [
      { page: 'features', label: '방송 기능', icon: 'dashboard' },
      { page: 'preflight', label: '방송 전 점검', icon: 'monitor' },
    ],
  },
  {
    label: '방송 기능',
    items: [
      { page: 'operations', label: '이치방쿠지', icon: 'ticket' },
      { page: 'roulette', label: '후원 룰렛', icon: 'roulette' },
    ],
  },
  {
    label: '이치방쿠지 관리',
    items: [
      { page: 'board', label: '판매 번호판', icon: 'ticket' },
      { page: 'winners', label: '당첨 내역', icon: 'trophy' },
      { page: 'session-history', label: '회차 기록', icon: 'book' },
      { page: 'log', label: '운영 기록', icon: 'book' },
    ],
  },
  {
    label: '방송 화면',
    items: [
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
