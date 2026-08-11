import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type DrawTicketState } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DrawTicketIcon, PlusIcon, TrashIcon } from '../components/Icons';
import { InlineFeedback } from '../components/InlineFeedback';
import { NumberStepper } from '../components/NumberStepper';

interface DraftItem { label: string; weight: number; quantity: number; }
const initialItems: DraftItem[] = [
  { label: '스페셜 상품', weight: 1, quantity: 1 },
  { label: '일반 상품', weight: 3, quantity: 3 },
];

export function DrawTicketPage({ refreshKey = 0 }: { refreshKey?: number }) {
  const [state, setState] = useState<DrawTicketState>({ active: false, results: [] });
  const [name, setName] = useState('오늘의 뽑기');
  const [command, setCommand] = useState('!뽑기');
  const [ticketPrice, setTicketPrice] = useState(3000);
  const [items, setItems] = useState<DraftItem[]>(initialItems);
  const [pending, setPending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try { setState(await api.getDrawTicket()); }
    catch { setFeedback({ ok: false, text: '뽑기권 정보를 불러오지 못했습니다.' }); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (refreshKey > 0) void refresh(); }, [refreshKey, refresh]);

  const create = async () => {
    setPending(true); setFeedback(null);
    try {
      await api.createDrawTicket({ name, command, ticketPrice, items });
      await refresh();
      setFeedback({ ok: true, text: '새 뽑기권을 시작했습니다.' });
    } catch {
      setFeedback({ ok: false, text: '명령어는 !로 시작해야 하며 모든 항목의 이름, 수량, 가중치가 필요합니다.' });
    } finally { setPending(false); }
  };
  const close = async () => {
    setPending(true);
    try { await api.closeDrawTicket(); await refresh(); setConfirmClose(false); setFeedback({ ok: true, text: '뽑기권을 종료했습니다.' }); }
    catch { setFeedback({ ok: false, text: '뽑기권을 종료하지 못했습니다.' }); }
    finally { setPending(false); }
  };
  const test = async () => {
    setPending(true); setFeedback(null);
    try {
      const result = await api.testDrawTicket();
      if (result.status === 'triggered') setFeedback({ ok: true, text: `미리보기 결과: ${result.result.label} (실제 수량은 차감되지 않음)` });
    } catch { setFeedback({ ok: false, text: '진행 중인 뽑기권이 필요합니다.' }); }
    finally { setPending(false); }
  };

  const activeItems = state.session?.items ?? [];
  const activeWeight = activeItems.filter((item) => item.remainingQuantity > 0).reduce((sum, item) => sum + item.weight, 0);
  const remainingTotal = activeItems.reduce((sum, item) => sum + item.remainingQuantity, 0);
  const totalQuantity = activeItems.reduce((sum, item) => sum + item.totalQuantity, 0);
  const draftWeight = useMemo(() => items.reduce((sum, item) => sum + item.weight, 0), [items]);
  const updateItem = (index: number, patch: Partial<DraftItem>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  return <div className="admin-page draw-ticket-page">
    <header className="page-header"><div><h1>뽑기권</h1><p>설정 금액과 명령어가 일치하면 남은 항목 중 하나를 뽑고 수량을 1개 차감합니다.</p></div>{state.active && <span className="draw-ticket-live"><i />진행 중</span>}</header>
    {state.active && state.session ? <section className="draw-ticket-active roulette-config-panel">
      <div className="roulette-config-head"><div className="roulette-icon"><DrawTicketIcon /></div><div><strong>{state.session.name}</strong><p><code>{state.session.command}</code> · {state.session.ticketPrice.toLocaleString('ko-KR')} 치즈 정확히 후원</p></div><div className="draw-ticket-stock"><span>남은 뽑기권</span><strong>{remainingTotal}<small>/ {totalQuantity}</small></strong></div></div>
      <div className="draw-ticket-item-table">
        <div className="draw-ticket-item-head"><span>항목</span><span>현재 확률</span><span>남은 수량</span></div>
        {activeItems.map((item) => <div className={`draw-ticket-item-row ${item.remainingQuantity === 0 ? 'sold-out' : ''}`} key={item.id}><strong>{item.label}</strong><span>{item.remainingQuantity > 0 && activeWeight > 0 ? `${Number((item.weight / activeWeight * 100).toFixed(1))}%` : '-'}</span><span><b>{item.remainingQuantity}</b> / {item.totalQuantity}</span></div>)}
      </div>
      <p className="draw-ticket-rule-note">수량이 0이 된 항목은 이 회차에서 다시 나오지 않습니다. 마지막 항목이 소진되면 자동 종료됩니다.</p>
      <div className="roulette-actions"><button className="secondary-button" disabled={pending} onClick={test}>오버레이 테스트</button><button className="danger-button" disabled={pending} onClick={() => setConfirmClose(true)}>뽑기 종료</button></div>
    </section> : <section className="draw-ticket-setup roulette-config-panel">
      <div className="roulette-config-head"><div className="roulette-icon"><DrawTicketIcon /></div><div><strong>새 뽑기권 설정</strong><p>가중치는 확률을, 수량은 해당 항목이 나올 수 있는 횟수를 결정합니다.</p></div></div>
      <div className="draw-ticket-fields"><label>뽑기 이름<input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} /></label><label>후원 명령어<input value={command} maxLength={21} onChange={(event) => setCommand(event.target.value.replace(/\s/g, ''))} /></label><label>후원 금액<NumberStepper aria-label="뽑기권 후원 금액" min={1} step={100} suffix="치즈" value={ticketPrice} onValueChange={setTicketPrice} /></label></div>
      <div className="draw-ticket-item-table editable"><div className="draw-ticket-item-head"><span>항목</span><span>가중치</span><span>예상 확률</span><span>수량</span><span /></div>{items.map((item, index) => <div className="draw-ticket-item-row" key={index}><input aria-label={`${index + 1}번 뽑기 항목`} value={item.label} maxLength={60} onChange={(event) => updateItem(index, { label: event.target.value })} /><NumberStepper aria-label={`${index + 1}번 가중치`} min={1} max={1000} value={item.weight} onValueChange={(weight) => updateItem(index, { weight })} /><span>{draftWeight > 0 ? `${Number((item.weight / draftWeight * 100).toFixed(1))}%` : '-'}</span><NumberStepper aria-label={`${index + 1}번 수량`} min={1} max={1000} value={item.quantity} onValueChange={(quantity) => updateItem(index, { quantity })} /><button className="icon-button" aria-label={`${index + 1}번 항목 삭제`} disabled={items.length <= 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><TrashIcon /></button></div>)}</div>
      <button className="secondary-button add-prize-button" disabled={items.length >= 50} onClick={() => setItems((current) => [...current, { label: '', weight: 1, quantity: 1 }])}><PlusIcon />항목 추가</button>
      <div className="roulette-actions"><button disabled={pending} onClick={create}>{pending ? '시작 중' : '뽑기 시작'}</button></div>
    </section>}
    {feedback && <InlineFeedback tone={feedback.ok ? 'success' : 'error'}>{feedback.text}</InlineFeedback>}
    <section className="roulette-log-panel"><div className="workflow-heading"><h2>최근 뽑기 결과</h2><span>{state.results.length}건</span></div>{state.results.length === 0 ? <p className="roulette-log-empty">아직 뽑기 결과가 없습니다.</p> : state.results.map((entry) => <div className="roulette-log-row" key={entry.id}><strong>{entry.resultLabel}</strong><span>{entry.donorNickname}</span><span>{entry.amount.toLocaleString('ko-KR')} 치즈</span><time>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.createdAt))}</time></div>)}</section>
    <ConfirmDialog open={confirmClose} title="뽑기권을 종료할까요?" description="남은 수량은 더 이상 추첨되지 않습니다. 결과 기록은 유지됩니다." confirmLabel="종료" pending={pending} onConfirm={close} onCancel={() => setConfirmClose(false)} />
  </div>;
}
