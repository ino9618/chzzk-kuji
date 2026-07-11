import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WinnersPage } from '../../src/client/admin/pages/WinnersPage';
import { OverlaySettingsPage } from '../../src/client/admin/pages/OverlaySettingsPage';
import { MorePage } from '../../src/client/admin/pages/MorePage';
import type { Winner } from '../../src/client/admin/api';

const winners: Winner[] = [{ sessionId: 1, sessionName: '여름 회차', number: 2, prizeName: '아메리카노', prizeGrade: 'A', ownerNickname: '홍길동', ownerChannelId: 'channel-1', soldAt: '2026-07-11T00:00:00.000Z' }];

describe('WinnersPage', () => {
  it('filters and groups winners', () => {
    expect(renderToStaticMarkup(<WinnersPage winners={winners} initialQuery="홍길동" />)).toContain('홍길동');
    expect(renderToStaticMarkup(<WinnersPage winners={winners} initialQuery="없는사람" />)).toContain('검색 결과가 없습니다.');
  });
});

describe('detail settings pages', () => {
  it('renders overlay controls', () => {
    const html = renderToStaticMarkup(<OverlaySettingsPage nicknameMode="masked" onSetNicknameMode={vi.fn(async () => undefined)} />);
    expect(html).toContain('OBS 브라우저 소스');
    expect(html).toContain('새 창 미리보기');
    expect(html).toContain('부분 마스킹');
  });

  it('renders low-frequency actions', () => {
    const html = renderToStaticMarkup(<MorePage onLogout={vi.fn()} />);
    expect(html).toContain('사용법');
    expect(html).toContain('로그아웃');
    expect(html).not.toContain('치지직 연결');
  });
});
