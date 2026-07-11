export interface Ticket {
  id?: number;
  number: number;
  prizeName: string;
  prizeGrade?: string | null;
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
    tickets: Array<{ number: number; prizeName: string; prizeGrade?: string }>;
  }) => jsonFetch('/api/admin/session', { method: 'POST', body: JSON.stringify(payload) }),
  closeSession: () => jsonFetch('/api/admin/session/close', { method: 'POST' }),
  getQueue: () => jsonFetch<QueueEntry[]>('/api/admin/queue'),
  resolveQueueItem: (id: number) => jsonFetch(`/api/admin/queue/${id}/resolve`, { method: 'POST' }),
  getLog: () => jsonFetch<QueueEntry[]>('/api/admin/log'),
  getWinners: () => jsonFetch<Winner[]>('/api/admin/winners'),
  getNicknameMode: () => jsonFetch<{ mode: 'masked' | 'full' }>('/api/admin/nickname-mode'),
  setNicknameMode: (mode: 'masked' | 'full') =>
    jsonFetch('/api/admin/nickname-mode', { method: 'POST', body: JSON.stringify({ mode }) }),
  getChzzkStatus: () => jsonFetch<{ status: string }>('/api/admin/chzzk-status'),
  getKujiEnabled: () => jsonFetch<{ enabled: boolean }>('/api/admin/kuji-enabled'),
  setKujiEnabled: (enabled: boolean) =>
    jsonFetch('/api/admin/kuji-enabled', { method: 'POST', body: JSON.stringify({ enabled }) }),
  logout: () => jsonFetch('/api/auth/logout', { method: 'POST' }),
};
