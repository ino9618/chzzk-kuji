import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OperationsPage } from '../../src/client/admin/pages/OperationsPage';
import { TicketBoardPage } from '../../src/client/admin/pages/TicketBoardPage';
import type { QueueEntry, SessionState } from '../../src/client/admin/api';

const activeSession: SessionState = {
  active: true,
  sessionId: 1,
  name: '7월 이치방쿠지',
  ticketPrice: 1000,
  tickets: [
    { number: 1, prizeName: 'A상', status: 'available', ownerNickname: null },
    { number: 2, prizeName: 'B상', status: 'sold', ownerNickname: '긴닉네임참여자' },
  ],
};

const issueQueue: QueueEntry[] = [
  {
    id: 1,
    donorNickname: '후원자',
    donorChannelId: 'channel-1',
    amount: 1000,
    rawMessage: '2번',
    status: 'duplicate_rejected',
    createdAt: '2026-07-11T00:00:00.000Z',
  },
];

const baseProps = {
  queue: [] as QueueEntry[],
  chzzkStatus: 'connected',
  kujiEnabled: true,
  onToggleKuji: vi.fn(),
  onNavigateSetup: vi.fn(),
  onNavigateBoard: vi.fn(),
  onResolveQueue: vi.fn(async () => undefined),
  onRequestClose: vi.fn(),
};

describe('OperationsPage', () => {
  it('guides an idle user to create a session', () => {
    const html = renderToStaticMarkup(<OperationsPage {...baseProps} session={{ active: false }} />);
    expect(html).toContain('회차 없음');
    expect(html).toContain('새 회차 만들기');
  });

  it('shows the active workflow and issues that require attention', () => {
    const html = renderToStaticMarkup(
      <OperationsPage {...baseProps} session={activeSession} queue={issueQueue} />
    );
    expect(html).toContain('확인 필요');
    expect(html).toContain('7월 이치방쿠지');
    expect(html).toContain('이미 팔린 번호');
    expect(html).toContain('회차 종료');
  });
});

describe('TicketBoardPage', () => {
  it('renders board filters and owner tooltips', () => {
    const html = renderToStaticMarkup(<TicketBoardPage session={activeSession} onNavigateSetup={vi.fn()} />);
    expect(html).toContain('전체');
    expect(html).toContain('판매 가능');
    expect(html).toContain('판매 완료');
    expect(html).toContain('title="긴닉네임참여자"');
    expect(html).toContain('1 / 2 판매');
  });
});
