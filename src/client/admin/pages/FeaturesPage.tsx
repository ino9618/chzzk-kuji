import { MonitorIcon, RouletteIcon, SettingsIcon, TicketIcon } from '../components/Icons';
import type { AdminPage } from '../adminModel';

interface FeaturesPageProps {
  onNavigate: (page: AdminPage) => void;
}

const features = [
  {
    page: 'operations' as const,
    title: '이치방쿠지',
    description: '후원 번호 배정, 상품 추첨과 회차별 당첨 내역을 관리합니다.',
    icon: TicketIcon,
    action: '관리하기',
  },
  {
    page: 'roulette' as const,
    title: '후원 룰렛',
    description: '후원 메시지로 가중치 룰렛을 실행하고 결과를 오버레이에 표시합니다.',
    icon: RouletteIcon,
    action: '설정하기',
  },
];

const quickActions = [
  { page: 'preflight' as const, label: '방송 전 점검', description: '연결, 회차, 오버레이 상태 확인', icon: MonitorIcon },
  { page: 'overlay' as const, label: '오버레이 설정', description: 'OBS 주소와 표시 설정 관리', icon: SettingsIcon },
  { page: 'board' as const, label: '판매 번호판', description: '현재 회차 번호 판매 상태 확인', icon: TicketIcon },
];

export function FeaturesPage({ onNavigate }: FeaturesPageProps) {
  return (
    <div className="admin-page features-page">
      <header className="page-header">
        <div><h1>방송 기능</h1><p>방송에서 사용할 기능을 선택해 관리하세요.</p></div>
      </header>
      <section className="feature-grid" aria-label="사용 가능한 방송 기능">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article className="feature-item" key={feature.page}>
              <div className="feature-item-icon"><Icon /></div>
              <div className="feature-item-copy"><h2>{feature.title}</h2><p>{feature.description}</p></div>
              <button onClick={() => onNavigate(feature.page)}>{feature.action}</button>
            </article>
          );
        })}
      </section>
      <section className="feature-quick-section" aria-labelledby="quick-actions-title">
        <div className="feature-section-heading">
          <div><h2 id="quick-actions-title">빠른 실행</h2><p>방송 전과 운영 중 자주 쓰는 화면입니다.</p></div>
          <a className="button-link secondary-button icon-text" href="/overlay.html" target="_blank" rel="noreferrer"><MonitorIcon />오버레이 새 창</a>
        </div>
        <div className="feature-quick-actions">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button className="feature-quick-action" key={action.page} onClick={() => onNavigate(action.page)}>
                <Icon />
                <span><strong>{action.label}</strong><small>{action.description}</small></span>
              </button>
            );
          })}
        </div>
      </section>
      <div className="feature-upcoming"><strong>기능 확장 예정</strong><span>새로운 추첨과 방송 상호작용 기능이 이곳에 추가됩니다.</span></div>
    </div>
  );
}
