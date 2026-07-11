# Simple and Advanced Admin UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 방송 준비와 운영을 한눈에 처리하는 간편 운영 화면과 목적별 상세 화면을 제공한다.

**Architecture:** 기존 Express API와 Socket.IO 이벤트는 유지한다. React 클라이언트는 최상위 데이터 오케스트레이션, 순수 상태 계산, 앱 셸, 기능별 페이지로 분리하며 모든 페이지가 동일한 설정 행·피드백·확인 대화상자 컴포넌트를 사용한다.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Socket.IO Client, CSS, Playwright

## Global Constraints

- 기존 서버 API와 데이터 모델을 변경하지 않는다.
- 기본 진입 화면은 `간편 운영`이다.
- 데스크톱 메뉴는 방송 운영과 설정 그룹으로 나눈다.
- 모바일 하단 메뉴는 `운영`, `번호판`, `당첨`, `더보기` 네 개다.
- 버튼 최소 높이는 데스크톱 `40px`, 모바일 주요 동작은 `44px`다.
- 상태는 색상뿐 아니라 아이콘과 문구로 함께 표시한다.
- 빵떡이의 색상, 로고, 캐릭터 또는 화면을 그대로 복제하지 않는다.
- 기존 호갱 API 마스코트와 네온 그린·노랑·코랄 팔레트를 유지한다.
- 현재 프로젝트는 상위 저장소에서 미추적 상태이므로 사용자 요청 전에는 Git 커밋을 만들지 않는다.

---

### Task 1: 상태 모델과 탐색 로직

**Files:**
- Create: `src/client/admin/adminModel.ts`
- Test: `tests/client/adminModel.test.ts`

**Interfaces:**
- Produces: `type AdminPage = 'operations' | 'board' | 'winners' | 'session-setup' | 'overlay' | 'more'`
- Produces: `getOperationsStatus(input): { tone: 'ready' | 'warning' | 'idle'; label: string; detail: string }`
- Produces: `filterTickets(tickets, filter): Ticket[]`
- Produces: `filterWinners(winners, query): Winner[]`

- [x] **Step 1: Write failing model tests**

```ts
expect(getOperationsStatus({ connected: true, enabled: true, active: true, issueCount: 0 }).label)
  .toBe('방송 준비 완료');
expect(getOperationsStatus({ connected: true, enabled: true, active: false, issueCount: 0 }).label)
  .toBe('회차 없음');
expect(filterTickets(tickets, 'available').every((ticket) => ticket.status === 'available')).toBe(true);
expect(filterWinners(winners, '홍길동')).toHaveLength(1);
```

- [x] **Step 2: Run the model test and confirm failure**

Run: `npm test -- --run tests/client/adminModel.test.ts`

Expected: FAIL because `adminModel.ts` does not exist.

- [x] **Step 3: Implement pure model functions**

`getOperationsStatus` returns warning for disconnected, disabled, or non-empty issue queue; idle for no active session; ready otherwise. Ticket filtering supports `all`, `available`, `sold`. Winner search is case-insensitive and matches nickname, prize, session name, and number text.

- [x] **Step 4: Run the model tests**

Run: `npm test -- --run tests/client/adminModel.test.ts`

Expected: all model tests pass.

### Task 2: Visual Concept and Shared UI

**Files:**
- Create: `design/simple-advanced-admin-concept.png`
- Create: `src/client/admin/components/AppShell.tsx`
- Create: `src/client/admin/components/SettingRow.tsx`
- Create: `src/client/admin/components/InlineFeedback.tsx`
- Create: `src/client/admin/components/ConfirmDialog.tsx`
- Create: `src/client/admin/components/MoreSheet.tsx`
- Modify: `src/client/admin/components/Icons.tsx`
- Test: `tests/client/adminShell.test.tsx`

**Interfaces:**
- Consumes: `AdminPage` from Task 1.
- Produces: `AppShell({ page, onNavigate, status, children })`
- Produces: `ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel })`
- Produces: reusable setting and feedback primitives.

- [x] **Step 1: Generate the approved full-screen concept**

Generate coordinated desktop `1280x800` screens for 간편 운영 and 회차 설정 plus mobile `390x844` screens for 간편 운영 and 더보기. Preserve exact information architecture from the spec, existing mascot, charcoal surfaces, neon green with yellow/coral support, flat panels, and code-native Korean text.

- [x] **Step 2: Inspect concept details**

Verify menu grouping, status hierarchy, setting-row anatomy, button labels, mobile navigation, no nested cards, no decorative gradients, and no copied 빵떡이 branding.

- [x] **Step 3: Write failing shell tests**

```tsx
const html = renderToStaticMarkup(<AppShell page="operations" onNavigate={vi.fn()} status="connected"><p>내용</p></AppShell>);
expect(html).toContain('방송 운영');
expect(html).toContain('간편 운영');
expect(html).toContain('더보기');
```

- [x] **Step 4: Implement the app shell and shared primitives**

Desktop renders grouped sidebar navigation. Mobile renders four stable bottom-navigation buttons and `MoreSheet`. `ConfirmDialog` uses `role="dialog"`, labelled title/description, initial confirm-button focus, Escape cancellation, and focus restoration.

- [x] **Step 5: Run shell tests**

Run: `npm test -- --run tests/client/adminShell.test.tsx`

Expected: all shell tests pass.

### Task 3: 간편 운영과 판매 번호판

**Files:**
- Create: `src/client/admin/pages/OperationsPage.tsx`
- Create: `src/client/admin/pages/TicketBoardPage.tsx`
- Create: `src/client/admin/components/AttentionQueue.tsx`
- Create: `src/client/admin/components/CurrentSessionSummary.tsx`
- Test: `tests/client/operationsPage.test.tsx`
- Modify: `src/client/admin/App.tsx`

**Interfaces:**
- Consumes: session, queue, connection status, feature toggle, model functions, API callbacks.
- Produces: sequential operations workflow and filtered ticket board.

- [ ] **Step 1: Write failing operations tests**

```tsx
expect(renderOperations({ session: { active: false } })).toContain('새 회차 만들기');
expect(renderOperations({ session: activeSession, queue: issueQueue })).toContain('확인 필요');
expect(renderBoard(activeSession, 'sold')).not.toContain('판매 가능');
```

- [ ] **Step 2: Confirm the tests fail**

Run: `npm test -- --run tests/client/operationsPage.test.tsx`

Expected: FAIL because the page components do not exist.

- [ ] **Step 3: Implement 간편 운영**

Render summary status followed by connection, feature, current session, attention queue, and finish sections. A missing session navigates to `session-setup`. Queue actions expose pending/success/error feedback and preserve rows on failure.

- [ ] **Step 4: Implement the ticket board**

Render session summary and segmented filters `전체`, `판매 가능`, `판매 완료`. Sold tickets show owner nickname with `title`; no active session shows a setup action.

- [ ] **Step 5: Integrate pages into App**

Keep authentication, fetches, and Socket.IO subscriptions in `App.tsx`. Replace old dashboard and kuji branches with `OperationsPage` and `TicketBoardPage`.

- [ ] **Step 6: Run operations tests**

Run: `npm test -- --run tests/client/operationsPage.test.tsx`

Expected: all operations tests pass.

### Task 4: 회차 설정과 위험 동작

**Files:**
- Create: `src/client/admin/pages/SessionSetupPage.tsx`
- Create: `src/client/admin/sessionForm.ts`
- Test: `tests/client/sessionForm.test.ts`
- Modify: `src/client/admin/App.tsx`

**Interfaces:**
- Produces: `validateSessionDraft(draft): SessionErrors`
- Produces: `buildTickets(groups): TicketDraft[]`
- Consumes: existing `api.createSession` and `api.closeSession`.

- [ ] **Step 1: Write failing form tests**

```ts
expect(validateSessionDraft(emptyDraft).name).toBe('회차 이름을 입력해 주세요.');
expect(buildTickets([{ grade: 'A', prizeName: '상품', count: 2 }])).toHaveLength(2);
```

- [ ] **Step 2: Confirm the form tests fail**

Run: `npm test -- --run tests/client/sessionForm.test.ts`

Expected: FAIL because form helpers do not exist.

- [ ] **Step 3: Implement form helpers and setup page**

Render sections for basic info, prize groups, and number review. Keep direct ticket editing in a native disclosure element. On invalid submit, render inline errors and focus the first invalid field. On success, create the session then navigate to `board`.

- [ ] **Step 4: Add close-session confirmation**

Open `ConfirmDialog` from the operations finish section. Confirm calls `api.closeSession`; cancel performs no request. Pending state disables both actions.

- [ ] **Step 5: Run form and operations tests**

Run: `npm test -- --run tests/client/sessionForm.test.ts tests/client/operationsPage.test.tsx`

Expected: all selected tests pass.

### Task 5: 당첨 내역·오버레이·기타 설정

**Files:**
- Create: `src/client/admin/pages/WinnersPage.tsx`
- Create: `src/client/admin/pages/OverlaySettingsPage.tsx`
- Create: `src/client/admin/pages/MorePage.tsx`
- Test: `tests/client/detailPages.test.tsx`
- Modify: `src/client/admin/App.tsx`

**Interfaces:**
- Consumes: winners, nickname mode, overlay URL, logout callback.
- Produces: searchable grouped winners, two-row overlay settings, low-frequency actions.

- [ ] **Step 1: Write failing detail-page tests**

```tsx
expect(renderWinners('홍길동')).toContain('홍길동');
expect(renderWinners('없는사람')).toContain('검색 결과가 없습니다.');
expect(renderOverlay()).toContain('OBS 브라우저 소스');
expect(renderMore()).toContain('사용법');
```

- [ ] **Step 2: Confirm the tests fail**

Run: `npm test -- --run tests/client/detailPages.test.tsx`

Expected: FAIL because detail page components do not exist.

- [ ] **Step 3: Implement detail pages**

Group winners by session and format `soldAt` with `ko-KR` in `Asia/Seoul`. Overlay page provides copy and preview commands plus nickname setting feedback. More page provides manual and logout actions without duplicating connection controls.

- [ ] **Step 4: Integrate all routes**

Wire `winners`, `overlay`, and `more` page branches. Ensure mobile MoreSheet and desktop sidebar point to the same page keys.

- [ ] **Step 5: Run detail tests**

Run: `npm test -- --run tests/client/detailPages.test.tsx`

Expected: all detail-page tests pass.

### Task 6: Responsive Styling and Browser Verification

**Files:**
- Modify: `src/client/admin/admin.css`
- Modify: `src/client/manual.html`
- Modify: `README.md`

**Interfaces:**
- Produces faithful desktop and mobile layouts matching Task 2 concept.

- [ ] **Step 1: Implement the final design tokens and layout**

Define app shell tracks, page width, section spacing, setting rows, segmented controls, summary status, dialog, mobile sheet, and stable navigation dimensions. Use maximum `8px` panel radius and avoid nested cards.

- [ ] **Step 2: Implement responsive and accessibility states**

At `720px` and below, switch to bottom navigation and sheet. Ensure 44px primary controls, wrapped overlay URLs, visible focus, non-color status labels, and reduced-motion rules.

- [ ] **Step 3: Update documentation**

Document 간편 운영 as the default, the six detailed destinations, mobile More menu, and the session-creation sequence. Remove instructions tied to the old four-menu layout.

- [ ] **Step 4: Run full verification**

Run: `npm test -- --run && npm run build`

Expected: all tests pass and both Vite and server TypeScript builds exit 0.

- [ ] **Step 5: Start the local client and server**

Run: `npm run dev`

Expected: server on `3000` and Vite client on `5173` with no fatal startup error.

- [ ] **Step 6: Capture desktop and mobile states**

Use Playwright at `1280x800` and `390x844` for operations ready/warning/idle states, ticket filters, session setup errors, winners search, overlay settings, confirmation dialog, and mobile MoreSheet.

- [ ] **Step 7: Compare against the accepted concept**

Inspect concept and implementation screenshots with `view_image`. Check exact copy, menu grouping, workflow order, typography, palette, setting rows, control dimensions, overflow, overlap, focus, and mascot restraint. Fix every material mismatch.
