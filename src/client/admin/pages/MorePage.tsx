import { BookIcon, LogoutIcon } from '../components/Icons';
import { SettingRow } from '../components/SettingRow';

export function MorePage({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="admin-page more-page">
      <header className="page-header"><div><h1>기타 설정</h1><p>자주 사용하지 않는 도움말과 계정 동작을 모았습니다.</p></div></header>
      <section className="workflow-section">
        <SettingRow title="사용법" description="회차 만들기부터 OBS 설정까지 전체 안내를 확인합니다."><a className="button-link secondary-button" href="/manual.html" target="_blank" rel="noreferrer"><BookIcon />사용법 열기</a></SettingRow>
        <SettingRow title="로그아웃" description="이 브라우저의 관리자 세션을 종료합니다."><button className="secondary-button icon-text" onClick={onLogout}><LogoutIcon />로그아웃</button></SettingRow>
      </section>
    </div>
  );
}
