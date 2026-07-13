import { useMemo, useRef, useState } from 'react';
import { buildTickets, validateSessionDraft, type PrizeGroup, type TicketDraft } from '../sessionForm';
import { InlineFeedback } from '../components/InlineFeedback';
import { ImageIcon, PlusIcon, TrashIcon } from '../components/Icons';

interface SessionSetupPageProps {
  onCreate: (payload: { name: string; ticketPrice: number; numberRangeMin: number; numberRangeMax: number; tickets: TicketDraft[] }) => Promise<void>;
  onCreated: () => Promise<void>;
  defaultTicketPrice?: number;
  template?: { id: number; name: string; ticketPrice: number; tickets: TicketDraft[] } | null;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

async function resizePrizeImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 선택할 수 있습니다.');
  if (file.size > 5 * 1024 * 1024) throw new Error('이미지는 5MB 이하만 등록할 수 있습니다.');
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
      element.src = source;
    });
    const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.82);
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function SessionSetupPage({ onCreate, onCreated, defaultTicketPrice = 1000, template = null }: SessionSetupPageProps) {
  const [name, setName] = useState(template ? `${template.name} 새 회차` : '');
  const [ticketPrice, setTicketPrice] = useState(template?.ticketPrice ?? defaultTicketPrice);
  const [groups, setGroups] = useState<PrizeGroup[]>(template ? [] : [
    { grade: 'A', prizeName: '', count: 1 },
    { grade: 'B', prizeName: '', count: 2 },
  ]);
  const [manualText, setManualText] = useState(template ? template.tickets.map((ticket) => `${ticket.number}, ${ticket.prizeName}, ${ticket.prizeGrade ?? ''}`).join('\n') : '');
  const [errors, setErrors] = useState<ReturnType<typeof validateSessionDraft>>({});
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [imageError, setImageError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLInputElement>(null);

  const generatedTickets = useMemo(() => buildTickets(groups), [groups]);
  const manualTickets = manualText.trim()
    ? manualText.split('\n').filter((line) => line.trim()).map((line) => {
        const [number, prizeName, prizeGrade] = line.split(',').map((value) => value.trim());
        return { number: Number(number), prizeName, prizeGrade: prizeGrade || undefined, prizeImageUrl: template?.tickets.find((ticket) => ticket.number === Number(number))?.prizeImageUrl };
      })
    : null;
  const tickets = manualTickets ?? generatedTickets;

  const updateGroup = (index: number, key: keyof PrizeGroup, value: string | number) => {
    setGroups((current) => current.map((group, groupIndex) => (groupIndex === index ? { ...group, [key]: value } : group)));
  };

  const selectImage = async (index: number, file?: File) => {
    if (!file) return;
    setImageError('');
    try {
      updateGroup(index, 'prizeImageUrl', await resizePrizeImage(file));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : '이미지를 처리하지 못했습니다.');
    }
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
      <header className="page-header"><div><h1>회차 설정</h1><p>{template ? `${template.name} 구성을 불러왔습니다. 확인 후 새 회차를 시작하세요.` : '상품을 입력하면 번호를 자동으로 만들고 섞어 드립니다.'}</p></div></header>
      {template && <div className="template-loaded"><strong>이전 회차 불러오기 완료</strong><span>가격, 번호, 상품, 등급 구성을 그대로 적용했습니다.</span></div>}
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
          <div className="prize-table-head"><span>등급</span><span>상품명</span><span>사진</span><span>수량</span><span /></div>
          {groups.map((group, index) => <div className="prize-row" key={index}><input ref={index === 0 ? groupRef : undefined} type="text" aria-label={`${index + 1}번 상품 등급`} value={group.grade} onChange={(event) => updateGroup(index, 'grade', event.target.value)} placeholder="A" /><input type="text" aria-label={`${index + 1}번 상품명`} value={group.prizeName} onChange={(event) => updateGroup(index, 'prizeName', event.target.value)} placeholder="상품명" /><div className="prize-image-control">{group.prizeImageUrl ? <img src={group.prizeImageUrl} alt="" /> : <ImageIcon />}<label title="상품 사진 선택"><span className="sr-only">{index + 1}번 상품 사진 선택</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void selectImage(index, event.target.files?.[0]); event.target.value = ''; }} /></label>{group.prizeImageUrl && <button className="prize-image-remove" aria-label={`${index + 1}번 상품 사진 삭제`} onClick={() => updateGroup(index, 'prizeImageUrl', '')}>×</button>}</div><input aria-label={`${index + 1}번 수량`} type="number" min={1} value={group.count} onChange={(event) => updateGroup(index, 'count', Number(event.target.value))} /><button className="icon-button" aria-label={`${index + 1}번 상품 삭제`} onClick={() => setGroups((current) => current.filter((_, groupIndex) => groupIndex !== index))}><TrashIcon /></button></div>)}
          {errors.groups && <small className="field-error">{errors.groups}</small>}
        </div>
        {imageError && <InlineFeedback tone="error">{imageError}</InlineFeedback>}
        <button className="secondary-button add-prize-button" onClick={() => setGroups((current) => [...current, { grade: '', prizeName: '', count: 1 }])}><PlusIcon />상품 추가</button>
        <details className="manual-editor" open={Boolean(template)}><summary>직접 편집</summary><p>번호, 상품명, 등급 순서로 한 줄에 하나씩 입력하세요.</p><textarea value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder={'1, 아메리카노, A\n2, 케이크, B'} rows={6} /></details>
        {template && template.tickets.some((ticket) => ticket.prizeImageUrl) && <p className="template-image-note">이전 회차의 상품 사진 {new Set(template.tickets.filter((ticket) => ticket.prizeImageUrl).map((ticket) => ticket.prizeImageUrl)).size}개도 함께 불러왔습니다.</p>}
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
