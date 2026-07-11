import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from '../../src/client/admin/components/AppShell';
import { ConfirmDialog } from '../../src/client/admin/components/ConfirmDialog';
import { InlineFeedback } from '../../src/client/admin/components/InlineFeedback';

describe('AppShell', () => {
  it('renders grouped desktop navigation and four mobile destinations', () => {
    const html = renderToStaticMarkup(
      <AppShell page="operations" onNavigate={vi.fn()} status="connected">
        <p>내용</p>
      </AppShell>
    );

    expect(html).toContain('방송 운영');
    expect(html).toContain('간편 운영');
    expect(html).toContain('판매 번호판');
    expect(html).toContain('당첨 내역');
    expect(html).toContain('회차 설정');
    expect(html).toContain('오버레이');
    expect(html).toContain('기타 설정');
    expect(html).toContain('>운영<');
    expect(html).toContain('>번호판<');
    expect(html).toContain('>당첨<');
    expect(html).toContain('>더보기<');
    expect(html).toContain('<p>내용</p>');
  });
});

describe('shared feedback and confirmation', () => {
  it('renders semantic feedback', () => {
    const html = renderToStaticMarkup(<InlineFeedback tone="success">저장했습니다.</InlineFeedback>);
    expect(html).toContain('role="status"');
    expect(html).toContain('저장했습니다.');
  });

  it('renders an accessible dialog only when open', () => {
    expect(
      renderToStaticMarkup(
        <ConfirmDialog open={false} title="회차 종료" description="되돌릴 수 없습니다." confirmLabel="종료" onConfirm={vi.fn()} onCancel={vi.fn()} />
      )
    ).toBe('');
    const html = renderToStaticMarkup(
      <ConfirmDialog open title="회차 종료" description="되돌릴 수 없습니다." confirmLabel="종료" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('되돌릴 수 없습니다.');
  });
});
