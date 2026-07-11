import { useMemo, useRef, useState } from 'react';
import { buildTickets, validateSessionDraft, type PrizeGroup, type TicketDraft } from '../sessionForm';
import { InlineFeedback } from '../components/InlineFeedback';
import { PlusIcon, TrashIcon } from '../components/Icons';

interface SessionSetupPageProps {
  onCreate: (payload: { name: string; ticketPrice: number; numberRangeMin: number; numberRangeMax: number; tickets: TicketDraft[] }) => Promise<void>;
  onCreated: () => Promise<void>;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function SessionSetupPage({ onCreate, onCreated }: SessionSetupPageProps) {
  const [name, setName] = useState('');
  const [ticketPrice, setTicketPrice] = useState(1000);
  const [groups, setGroups] = useState<PrizeGroup[]>([
    { grade: 'A', prizeName: '', count: 1 },
    { grade: 'B', prizeName: '', count: 2 },
  ]);
  const [manualText, setManualText] = useState('');
  const [errors, setErrors] = useState<ReturnType<typeof validateSessionDraft>>({});
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLInputElement>(null);

  const generatedTickets = useMemo(() => buildTickets(groups), [groups]);
  const manualTickets = manualText.trim()
    ? manualText.split('\n').filter((line) => line.trim()).map((line) => {
        const [number, prizeName, prizeGrade] = line.split(',').map((value) => value.trim());
        return { number: Number(number), prizeName, prizeGrade: prizeGrade || undefined };
      })
    : null;
  const tickets = manualTickets ?? generatedTickets;

  const updateGroup = (index: number, key: keyof PrizeGroup, value: string | number) => {
    setGroups((current) => current.map((group, groupIndex) => (groupIndex === index ? { ...group, [key]: value } : group)));
  };

  const submit = async () => {
    const nextErrors = validateSessionDraft({ name, ticketPrice, groups: manualTickets ? [{ grade: '', prizeName: manualTickets[0]?.prizeName || '', count: manualTickets.length }] : groups });
    if (manualTickets && (manualTickets.some((ticket) => !Number.isInteger(ticket.number) || ticket.number < 1 || !ticket.prizeName) || new Set(manualTickets.map((ticket) => ticket.number)).size !== manualTickets.length)) {
      nextErrors.groups = '직접 편집에는 1 이상의 중복되지 않는 번호와 상품명이 필요합니다.';
    }
    setErrors(nextErrors);
    if (nextErrors.name) nameRef.current?.focus();
    else if (nextErrors.ticketPrice) priceRef.current?.focus();
    else if (nextErrors.groups) groupRef.current?.focus();
    if (Object.keys(nextErrors).length > 0) return;

    const finalized = manualTickets ?? shuffle(generatedTickets).map((ticket, index) => ({ ...ticket, number: index + 1 }));
    setPending(true);
    setSubmitError('');
    try {
      await onCreate({ name: name.trim(), ticketPrice, numberRangeMin: Math.min(...finalized.map((ticket) => ticket.number)), numberRangeMax: Math.max(...finalized.map((ticket) => ticket.number)), tickets: finalized });
      await onCreated();
    } catch {
      setSubmitError('회차를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="admin-page session-setup-page">
      <header className="page-header"><div><h1>회차 설정</h1><p>상품을 입력하면 번호를 자동으로 만들고 섞어 드립니다.</p></div></header>
      <section className="setup-section">
        <h2><span>1</span> 기본 정보</h2>
        <div className="form-grid">
          <label>회차 이름<input ref={nameRef} type="text" value={name} aria-invalid={Boolean(errors.name)} onChange={(event) => setName(event.target.value)} placeholder="예: 7월 이치방쿠지" />{errors.name && <small className="field-error">{errors.name}</small>}</label>
          <label>장당 가격<div className="input-suffix"><input ref={priceRef} type="number" min={1} value={ticketPrice} aria-invalid={Boolean(errors.ticketPrice)} onChange={(event) => setTicketPrice(Number(event.target.value))} /><span>치즈</span></div>{errors.ticketPrice && <small className="field-error">{errors.ticketPrice}</small>}</label>
        </div>
      </section>
      <section className="setup-section">
        <h2><span>2</span> 상품 구성</h2>
        <div className="prize-table">
          <div className="prize-table-head"><span>등급</span><span>상품명</span><span>수량</span><span /></div>
          {groups.map((group, index) => <div className="prize-row" key={index}><input ref={index === 0 ? groupRef : undefined} type="text" aria-label={`${index + 1}번 상품 등급`} value={group.grade} onChange={(event) => updateGroup(index, 'grade', event.target.value)} placeholder="A" /><input type="text" aria-label={`${index + 1}번 상품명`} value={group.prizeName} onChange={(event) => updateGroup(index, 'prizeName', event.target.value)} placeholder="상품명" /><input aria-label={`${index + 1}번 수량`} type="number" min={1} value={group.count} onChange={(event) => updateGroup(index, 'count', Number(event.target.value))} /><button className="icon-button" aria-label={`${index + 1}번 상품 삭제`} onClick={() => setGroups((current) => current.filter((_, groupIndex) => groupIndex !== index))}><TrashIcon /></button></div>)}
          {errors.groups && <small className="field-error">{errors.groups}</small>}
        </div>
        <button className="secondary-button add-prize-button" onClick={() => setGroups((current) => [...current, { grade: '', prizeName: '', count: 1 }])}><PlusIcon />상품 추가</button>
        <details className="manual-editor"><summary>직접 편집</summary><p>번호, 상품명, 등급 순서로 한 줄에 하나씩 입력하세요.</p><textarea value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder={'1, 아메리카노, A\n2, 케이크, B'} rows={6} /></details>
      </section>
      <section className="setup-section">
        <h2><span>3</span> 번호 확인</h2>
        <div className="number-preview">{tickets.map((ticket) => <span key={ticket.number} title={ticket.prizeName}>{ticket.number}</span>)}</div>
        <div className="setup-submit"><p>총 {tickets.length}장의 번호가 생성됩니다.</p><button disabled={pending || tickets.length === 0} onClick={submit}>{pending ? '시작 중' : '회차 시작'}</button></div>
        {submitError && <InlineFeedback tone="error">{submitError}</InlineFeedback>}
      </section>
    </div>
  );
}
