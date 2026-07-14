import loginMascotDuoUrl from '../../assets/login-mascot-duo.png';

export function LoginScreen({ oauthAvailable, loginError }: { oauthAvailable: boolean; loginError: string }) {
  return (
    <main className="login-screen">
      <div className="login-composition">
        <div className="login-mascot-duo" aria-label="설냥갱과 머리 위에 올라간 호갱이">
          <img className="login-mascot-art" src={loginMascotDuoUrl} alt="머리 위 호갱이를 쓰다듬는 설냥갱" />
        </div>
        <section className="login-panel" aria-labelledby="login-title">
          <h1 id="login-title">호갱 API</h1>
          <p className="login-subtitle">치지직 후원 연동 뽑기 보드</p>
          {oauthAvailable ? (
            <a className="naver-login-button" href="/api/chzzk/oauth/login">
              <span className="naver-logo" aria-hidden="true">N</span>
              네이버 계정으로 로그인
            </a>
          ) : (
            <p className="login-error">서버의 치지직 연동 설정을 확인해 주세요.</p>
          )}
          {oauthAvailable && <p className="login-access-note">후원을 받는 스트리머의 네이버 계정으로 로그인하세요.</p>}
          {loginError && <p className="login-error">{loginError}</p>}
        </section>
      </div>
    </main>
  );
}
