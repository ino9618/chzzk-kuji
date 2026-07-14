import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginScreen } from '../../src/client/admin/components/LoginScreen';
import { NumberStepper } from '../../src/client/admin/components/NumberStepper';

describe('LoginScreen', () => {
  it('renders the Naver OAuth link and an accessible mascot', () => {
    const html = renderToStaticMarkup(<LoginScreen oauthAvailable loginError="" />);

    expect(html).toContain('href="/api/chzzk/oauth/login"');
    expect(html).toContain('네이버 계정으로 로그인');
    expect(html).toContain('후원을 받는 스트리머의 네이버 계정으로 로그인하세요.');
    expect(html).toContain('머리 위 호갱이를 쓰다듬는 설냥갱');
  });

  it('shows a useful setup message when OAuth is unavailable', () => {
    const html = renderToStaticMarkup(<LoginScreen oauthAvailable={false} loginError="" />);

    expect(html).not.toContain('href="/api/chzzk/oauth/login"');
    expect(html).toContain('서버의 치지직 연동 설정을 확인해 주세요.');
  });
});

describe('NumberStepper', () => {
  it('renders clear controls, its unit, and disables decrementing at the minimum', () => {
    const html = renderToStaticMarkup(<NumberStepper aria-label="후원 금액" value={1} min={1} step={100} suffix="치즈" onValueChange={() => undefined} />);

    expect(html).toContain('aria-label="후원 금액 감소" disabled=""');
    expect(html).toContain('aria-label="후원 금액 증가"');
    expect(html).toContain('step="100"');
    expect(html).toContain('치즈');
  });
});
