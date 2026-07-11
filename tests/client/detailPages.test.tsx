import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WinnersPage } from '../../src/client/admin/pages/WinnersPage';
import { OverlaySettingsPage } from '../../src/client/admin/pages/OverlaySettingsPage';
import { MorePage } from '../../src/client/admin/pages/MorePage';
import { ConnectionPage } from '../../src/client/admin/pages/ConnectionPage';
import { BasicSettingsPage } from '../../src/client/admin/pages/BasicSettingsPage';
import { OperationsLogPage } from '../../src/client/admin/pages/OperationsLogPage';
import type { Winner } from '../../src/client/admin/api';

const winners: Winner[] = [{ sessionId: 1, sessionName: '여름 회차', number: 2, prizeName: '아메리카노', prizeGrade: 'A', ownerNickname: '홍길동', ownerChannelId: 'channel-1', soldAt: '2026-07-11T00:00:00.000Z' }];

describe('WinnersPage', () => {
  it('filters and groups winners', () => {
    expect(renderToStaticMarkup(<WinnersPage winners={winners} initialQuery="홍길동" />)).toContain('홍길동');
    expect(renderToStaticMarkup(<WinnersPage winners={winners} initialQuery="없는사람" />)).toContain('검색 결과가 없습니다.');
  });
});

describe('detail settings pages', () => {
  it('renders shared basic settings and donation guidance', () => {
    const html = renderToStaticMarkup(<BasicSettingsPage settings={{ kujiEnabled: true, defaultTicketPrice: 2500, nicknameMode: 'masked' }} onSave={vi.fn(async () => undefined)} />);
    expect(html).toContain('기본 장당 가격');
    expect(html).toContain('2500');
    expect(html).toContain('2장 구매');
  });

  it('renders the linked CHZZK channel and connection guidance', () => {
    const html = renderToStaticMarkup(<ConnectionPage connection={{ status: 'connected', channelId: 'channel-1', channelName: '테스트 채널', lastEventAt: null }} onRefresh={vi.fn(async () => undefined)} onDisconnect={vi.fn(async () => undefined)} />);
    expect(html).toContain('테스트 채널');
    expect(html).toContain('스트림키 불필요');
    expect(html).toContain('정상 연결');
    expect(html).toContain('연결 해제');
  });

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

describe('OperationsLogPage', () => {
  it('renders donation details, filters, and export action', () => {
    const html = renderToStaticMarkup(<OperationsLogPage entries={[{ id: 1, donorNickname: '후원자', donorChannelId: 'channel-1', amount: 2000, rawMessage: '1번 3번', status: 'processed', createdAt: '2026-07-11T00:00:00.000Z', needsAttention: false }]} />);
    expect(html).toContain('후원자');
    expect(html).toContain('1번 3번');
    expect(html).toContain('CSV 내보내기');
    expect(html).toContain('정상 처리');
  });
});
