import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WinnersDetail, WinnersPage } from '../../src/client/admin/pages/WinnersPage';
import { OverlaySettingsPage } from '../../src/client/admin/pages/OverlaySettingsPage';
import { MorePage } from '../../src/client/admin/pages/MorePage';
import { ConnectionPage } from '../../src/client/admin/pages/ConnectionPage';
import { BasicSettingsPage } from '../../src/client/admin/pages/BasicSettingsPage';
import { OperationsLogPage } from '../../src/client/admin/pages/OperationsLogPage';
import { BroadcastPreflightPage } from '../../src/client/admin/pages/BroadcastPreflightPage';
import { DonationSimulatorPage } from '../../src/client/admin/pages/DonationSimulatorPage';
import { SessionHistoryDetail, SessionHistoryPage } from '../../src/client/admin/pages/SessionHistoryPage';
import { SessionSetupPage } from '../../src/client/admin/pages/SessionSetupPage';
import { DrawAnnouncement } from '../../src/client/overlay/DrawAnnouncement';
import { RoulettePage } from '../../src/client/admin/pages/RoulettePage';
import { FeaturesPage } from '../../src/client/admin/pages/FeaturesPage';
import type { Winner } from '../../src/client/admin/api';

const winners: Winner[] = [{ sessionId: 1, sessionName: '여름 회차', number: 2, prizeName: '아메리카노', prizeGrade: 'A', ownerNickname: '홍길동', ownerChannelId: 'channel-1', soldAt: '2026-07-11T00:00:00.000Z' }];

describe('FeaturesPage', () => {
  it('presents kuji and roulette as equal broadcast features', () => {
    const html = renderToStaticMarkup(<FeaturesPage onNavigate={vi.fn()} />);
    expect(html).toContain('방송 기능');
    expect(html).toContain('이치방쿠지');
    expect(html).toContain('후원 룰렛');
    expect(html).toContain('기능 확장 예정');
  });
});

describe('WinnersPage', () => {
  it('filters and groups winners into session rows', () => {
    expect(renderToStaticMarkup(<WinnersPage winners={winners} initialQuery="홍길동" />)).toContain('홍길동');
    expect(renderToStaticMarkup(<WinnersPage winners={winners} initialQuery="없는사람" />)).toContain('검색 결과가 없습니다.');
    expect(renderToStaticMarkup(<WinnersPage winners={winners} />)).toContain('상세 보기');
    expect(renderToStaticMarkup(<WinnersPage winners={winners} />)).not.toContain('winner-table');
  });

  it('renders winners only inside the selected session detail', () => {
    const html = renderToStaticMarkup(<WinnersDetail sessionName="여름 회차" winners={winners} onBack={vi.fn()} />);
    expect(html).toContain('회차 목록으로');
    expect(html).toContain('홍길동');
    expect(html).toContain('A상 · 아메리카노');
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
    const html = renderToStaticMarkup(<OverlaySettingsPage nicknameMode="masked" onSetNicknameMode={vi.fn(async () => undefined)} onTestOverlay={vi.fn(async () => undefined)} />);
    expect(html).toContain('OBS 브라우저 소스');
    expect(html).toContain('새 창 미리보기');
    expect(html).toContain('부분 마스킹');
    expect(html).toContain('실시간 오버레이 미리보기');
    expect(html).toContain('1920 × 1080');
    expect(html).toContain('width="1920"');
    expect(html).toContain('height="1080"');
    expect(html).toContain('테스트 표시');
    expect(html).toContain('당첨 내역에는 저장되지 않습니다');
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

describe('BroadcastPreflightPage', () => {
  it('shows readiness checks and a safe donation test', () => {
    const html = renderToStaticMarkup(<BroadcastPreflightPage chzzkStatus="connected" kujiEnabled session={{ active: true, name: '테스트 회차', ticketPrice: 1000, tickets: [{ number: 1, prizeName: 'A상', status: 'available', ownerNickname: null }] }} />);
    expect(html).toContain('방송 준비 완료');
    expect(html).toContain('모의 후원 검사');
    expect(html).toContain('실제 번호를 판매 처리하지 않고');
    expect(html).toContain('오버레이 미리보기');
  });
});

describe('new operation tools', () => {
  const previousSession = {
    id: 3, name: '지난 회차', ticketPrice: 1500, numberRangeMin: 1, numberRangeMax: 1,
    status: 'closed' as const, createdAt: '2026-07-01T00:00:00.000Z', soldCount: 0,
    tickets: [{ number: 1, prizeName: '커피', prizeGrade: 'A', status: 'available' as const, ownerNickname: null }],
  };

  it('renders a real donation simulator warning and send control', () => {
    const html = renderToStaticMarkup(<DonationSimulatorPage session={{ active: true, name: '현재 회차', ticketPrice: 1000, tickets: previousSession.tickets }} onSend={vi.fn(async () => ({ status: 'processed', sessionId: 1, outcomes: [] }))} />);
    expect(html).toContain('도네이션 테스트');
    expect(html).toContain('실제로 판매 처리');
    expect(html).toContain('테스트 도네이션 보내기');
  });

  it('renders previous sessions and clone action', () => {
    const html = renderToStaticMarkup(<SessionHistoryPage sessions={[previousSession]} activeSession={false} onClone={vi.fn()} />);
    expect(html).toContain('지난 회차');
    expect(html).toContain('상세 보기');
    expect(html).toContain('신규 회차로 불러오기');
    expect(html).not.toContain('history-detail-panel');
  });

  it('renders a separate session detail view with ticket information', () => {
    const html = renderToStaticMarkup(<SessionHistoryDetail session={previousSession} activeSession={false} onBack={vi.fn()} onClone={vi.fn()} />);
    expect(html).toContain('목록으로');
    expect(html).toContain('티켓 상세');
    expect(html).toContain('1,500 치즈');
    expect(html).toContain('A상 · 커피');
  });

  it('prefills session setup from a previous session template', () => {
    const html = renderToStaticMarkup(<SessionSetupPage onCreate={vi.fn(async () => undefined)} onCreated={vi.fn(async () => undefined)} template={{ id: 3, name: '지난 회차', ticketPrice: 1500, tickets: previousSession.tickets }} />);
    expect(html).toContain('이전 회차 불러오기 완료');
    expect(html).toContain('지난 회차 새 회차');
    expect(html).toContain('1500');
    expect(html).toContain('1, 커피, A');
  });
});

describe('DrawAnnouncement', () => {
  const base = { key: 1, number: 7, grade: 'A', prizeName: '사진 상품', nickname: '당첨자' };

  it('renders a prize image only when one is registered', () => {
    const withImage = renderToStaticMarkup(<DrawAnnouncement announce={{ ...base, prizeImageUrl: 'data:image/webp;base64,UklGRg==' }} confetti={[]} />);
    expect(withImage).toContain('draw-image-frame');
    expect(withImage).toContain('사진 상품 상품');

    const withoutImage = renderToStaticMarkup(<DrawAnnouncement announce={base} confetti={[]} />);
    expect(withoutImage).not.toContain('draw-image-frame');
    expect(withoutImage).not.toContain('has-image');
  });
});

describe('RoulettePage', () => {
  it('renders weighted roulette controls and the donation command', () => {
    const html = renderToStaticMarkup(<RoulettePage />);
    expect(html).toContain('후원 룰렛');
    expect(html).toContain('!룰렛');
    expect(html).toContain('가중치');
    expect(html).toContain('룰렛 테스트');
  });
});
