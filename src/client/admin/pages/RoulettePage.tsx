import { useEffect, useState } from 'react';
import { api, type RouletteConfig, type RouletteLogEntry } from '../api';
import { InlineFeedback } from '../components/InlineFeedback';
import { PlusIcon, RouletteIcon, TrashIcon } from '../components/Icons';
import { NumberStepper } from '../components/NumberStepper';

const initialConfig: RouletteConfig = { enabled: false, minimumAmount: 1000, registrationAmount: 5000, items: [{ label: '노래 한 곡', weight: 3 }, { label: '랜덤 미션', weight: 2 }, { label: '다시 돌리기', weight: 1 }] };

export function RoulettePage() {
  const [config, setConfig] = useState(initialConfig);
  const [log, setLog] = useState<RouletteLogEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { Promise.all([api.getRoulette(), api.getRouletteLog()]).then(([next, entries]) => { setConfig(next); setLog(entries); }).catch(() => setFeedback({ ok: false, text: '룰렛 설정을 불러오지 못했습니다.' })); }, []);
  const updateItem = (index: number, key: 'label' | 'weight', value: string | number) => setConfig((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }));
  const save = async () => {
    setPending(true); setFeedback(null);
    try { setConfig(await api.setRoulette(config)); setFeedback({ ok: true, text: '룰렛 설정을 저장했습니다.' }); }
    catch { setFeedback({ ok: false, text: '항목은 2개 이상이며 가중치는 1 이상이어야 합니다.' }); }
    finally { setPending(false); }
  };
  const test = async () => {
    setPending(true); setFeedback(null);
    try {
      const result = await api.testRoulette();
      if (result.status === 'triggered') { setFeedback({ ok: true, text: `테스트 결과: ${result.result.label}` }); setLog(await api.getRouletteLog()); }
    } catch { setFeedback({ ok: false, text: '룰렛을 사용으로 저장한 후 테스트해 주세요.' }); }
    finally { setPending(false); }
  };

  const totalWeight = config.items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  return <div className="admin-page roulette-page">
    <header className="page-header"><div><h1>후원 룰렛</h1><p>시청자가 최소 금액 이상 후원하며 <code>!룰렛</code>을 입력하면 가중치에 따라 결과를 추첨합니다.</p></div><label className="switch compact"><input type="checkbox" checked={config.enabled} onChange={(event) => setConfig((current) => ({ ...current, enabled: event.target.checked }))} /><span className="switch-track"><span className="switch-thumb" /></span><span>{config.enabled ? '사용 중' : '사용 안 함'}</span></label></header>
    <section className="roulette-config-panel">
      <div className="roulette-config-head"><div className="roulette-icon"><RouletteIcon /></div><div><strong>룰렛 조건</strong><p>한 번의 후원당 룰렛을 한 번 돌립니다.</p></div><label>최소 후원 금액<NumberStepper aria-label="최소 후원 금액" min={1} step={100} suffix="치즈" value={config.minimumAmount} onValueChange={(minimumAmount) => setConfig((current) => ({ ...current, minimumAmount }))} /></label></div>
      <div className="roulette-registration"><div><strong>시청자 항목 등록</strong><p>설정 금액 이상 후원하며 <code>!등록 항목명</code>을 입력하면 가중치 1의 항목으로 추가됩니다.</p></div><label>등록 후원 금액<NumberStepper aria-label="등록 후원 금액" min={1} step={100} suffix="치즈" value={config.registrationAmount} onValueChange={(registrationAmount) => setConfig((current) => ({ ...current, registrationAmount }))} /></label></div>
      <div className="roulette-item-table"><div className="roulette-item-head"><span>결과 항목</span><span>가중치</span><span>확률</span><span /></div>{config.items.map((item, index) => <div className="roulette-item-row" key={index}><input aria-label={`${index + 1}번 룰렛 항목`} value={item.label} maxLength={40} onChange={(event) => updateItem(index, 'label', event.target.value)} /><NumberStepper aria-label={`${index + 1}번 룰렛 가중치`} min={1} max={1000} value={item.weight} onValueChange={(weight) => updateItem(index, 'weight', weight)} /><span>{totalWeight > 0 ? `${Math.round(item.weight / totalWeight * 100)}%` : '0%'}</span><button className="icon-button" aria-label={`${index + 1}번 룰렛 항목 삭제`} disabled={config.items.length <= 2} onClick={() => setConfig((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><TrashIcon /></button></div>)}</div>
      <button className="secondary-button add-prize-button" disabled={config.items.length >= 20} onClick={() => setConfig((current) => ({ ...current, items: [...current.items, { label: '', weight: 1 }] }))}><PlusIcon />항목 추가</button>
      <div className="roulette-actions"><button className="secondary-button" disabled={pending || !config.enabled} onClick={test}>룰렛 테스트</button><button disabled={pending} onClick={save}>{pending ? '처리 중' : '설정 저장'}</button></div>
    </section>
    {feedback && <InlineFeedback tone={feedback.ok ? 'success' : 'error'}>{feedback.text}</InlineFeedback>}
    <section className="roulette-log-panel"><div className="workflow-heading"><h2>최근 룰렛 결과</h2><span>{log.length}건</span></div>{log.length === 0 ? <p className="roulette-log-empty">아직 룰렛 결과가 없습니다.</p> : log.slice(0, 20).map((entry) => <div className="roulette-log-row" key={entry.id}><strong>{entry.resultLabel}</strong><span>{entry.donorNickname}</span><span>{entry.amount.toLocaleString('ko-KR')} 치즈</span><time>{new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.createdAt))}</time></div>)}</section>
  </div>;
}
