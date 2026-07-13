export interface Ticket {
  id?: number;
  number: number;
  prizeName: string;
  prizeGrade?: string | null;
  prizeImageUrl?: string | null;
  status: 'available' | 'sold';
  ownerNickname: string | null;
  ownerChannelId?: string | null;
}

export interface SessionState {
  active: boolean;
  sessionId?: number;
  name?: string;
  ticketPrice?: number;
  numberRangeMin?: number;
  numberRangeMax?: number;
  tickets?: Ticket[];
}

export interface QueueEntry {
  id: number;
  donorNickname: string;
  donorChannelId: string;
  amount: number;
  rawMessage: string;
  status: string;
  createdAt: string;
  outcomes?: string;
  needsAttention?: boolean;
  resolved?: boolean;
}

export interface Winner {
  sessionId: number;
  sessionName: string;
  number: number;
  prizeName: string;
  prizeGrade: string | null;
  ownerNickname: string;
  ownerChannelId: string;
  soldAt: string;
}

export interface ChzzkConnection {
  status: string;
  channelId: string | null;
  channelName: string | null;
  lastEventAt: string | null;
}

export interface BasicSettings {
  kujiEnabled: boolean;
  defaultTicketPrice: number;
  nicknameMode: 'masked' | 'full';
}

export interface SessionHistoryEntry {
  id: number;
  name: string;
  ticketPrice: number;
  numberRangeMin: number;
  numberRangeMax: number;
  status: 'active' | 'closed';
  createdAt: string;
  soldCount: number;
  tickets: Ticket[];
}

export type DonationSimulationResult =
  | { status: 'feature_disabled' }
  | { status: 'session_inactive' }
  | { status: 'amount_mismatch'; ticketPrice: number }
  | { status: 'number_missing'; expectedCount: number; foundNumbers: number[] }
  | { status: 'processed'; sessionId: number; outcomes: Array<{ number: number; result: 'success' | 'duplicate_rejected' | 'out_of_range'; prizeName?: string }> };

export interface RouletteItem { label: string; weight: number; }
export interface RouletteConfig { enabled: boolean; minimumAmount: number; items: RouletteItem[]; }
export interface RouletteLogEntry { id: number; donorNickname: string; donorChannelId: string; amount: number; resultLabel: string; createdAt: string; }
export type RouletteProcessResult = { status: 'ignored' | 'disabled' } | { status: 'below_minimum'; minimumAmount: number } | { status: 'triggered'; result: { label: string; nickname: string; amount: number } };

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
  if (res.status === 401) {
    window.location.href = '/admin.html';
    throw new Error('Admin session expired');
  }
  if (!res.ok) throw new Error(`Request to ${url} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  getSession: () => jsonFetch<SessionState>('/api/admin/session'),
  createSession: (payload: {
    name: string;
    ticketPrice: number;
    numberRangeMin: number;
    numberRangeMax: number;
    tickets: Array<{ number: number; prizeName: string; prizeGrade?: string; prizeImageUrl?: string | null }>;
  }) => jsonFetch('/api/admin/session', { method: 'POST', body: JSON.stringify(payload) }),
  closeSession: () => jsonFetch('/api/admin/session/close', { method: 'POST' }),
  getQueue: () => jsonFetch<QueueEntry[]>('/api/admin/queue'),
  resolveQueueItem: (id: number) => jsonFetch(`/api/admin/queue/${id}/resolve`, { method: 'POST' }),
  getLog: () => jsonFetch<QueueEntry[]>('/api/admin/log'),
  getWinners: () => jsonFetch<Winner[]>('/api/admin/winners'),
  getSessions: () => jsonFetch<SessionHistoryEntry[]>('/api/admin/sessions'),
  simulateDonation: (payload: { nickname: string; amount: number; message: string }) =>
    jsonFetch<DonationSimulationResult>('/api/admin/donation-simulator', { method: 'POST', body: JSON.stringify(payload) }),
  getRoulette: () => jsonFetch<RouletteConfig>('/api/admin/roulette'),
  setRoulette: (config: RouletteConfig) => jsonFetch<RouletteConfig>('/api/admin/roulette', { method: 'POST', body: JSON.stringify(config) }),
  getRouletteLog: () => jsonFetch<RouletteLogEntry[]>('/api/admin/roulette/log'),
  testRoulette: () => jsonFetch<RouletteProcessResult>('/api/admin/roulette/test', { method: 'POST' }),
  getNicknameMode: () => jsonFetch<{ mode: 'masked' | 'full' }>('/api/admin/nickname-mode'),
  setNicknameMode: (mode: 'masked' | 'full') =>
    jsonFetch('/api/admin/nickname-mode', { method: 'POST', body: JSON.stringify({ mode }) }),
  getBasicSettings: () => jsonFetch<BasicSettings>('/api/admin/basic-settings'),
  setBasicSettings: (settings: BasicSettings) => jsonFetch<BasicSettings>('/api/admin/basic-settings', { method: 'POST', body: JSON.stringify(settings) }),
  getChzzkStatus: () => jsonFetch<{ status: string }>('/api/admin/chzzk-status'),
  getChzzkConnection: () => jsonFetch<ChzzkConnection>('/api/admin/chzzk-connection'),
  disconnectChzzk: () => jsonFetch<{ ok: true }>('/api/admin/chzzk-connection/disconnect', { method: 'POST' }),
  getKujiEnabled: () => jsonFetch<{ enabled: boolean }>('/api/admin/kuji-enabled'),
  setKujiEnabled: (enabled: boolean) =>
    jsonFetch('/api/admin/kuji-enabled', { method: 'POST', body: JSON.stringify({ enabled }) }),
  logout: () => jsonFetch('/api/auth/logout', { method: 'POST' }),
};
