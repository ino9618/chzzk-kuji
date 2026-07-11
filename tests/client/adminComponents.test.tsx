import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginScreen } from '../../src/client/admin/components/LoginScreen';

describe('LoginScreen', () => {
  it('renders the Naver OAuth link and an accessible mascot', () => {
    const html = renderToStaticMarkup(<LoginScreen oauthAvailable loginError="" />);

    expect(html).toContain('href="/api/chzzk/oauth/login"');
    expect(html).toContain('네이버 계정으로 로그인');
    expect(html).toContain('후원을 받는 스트리머의 네이버 계정으로 로그인하세요.');
    expect(html).toContain('인사하는 추첨 티켓 안내원');
  });

  it('shows a useful setup message when OAuth is unavailable', () => {
    const html = renderToStaticMarkup(<LoginScreen oauthAvailable={false} loginError="" />);

    expect(html).not.toContain('href="/api/chzzk/oauth/login"');
    expect(html).toContain('서버의 치지직 연동 설정을 확인해 주세요.');
  });
});
