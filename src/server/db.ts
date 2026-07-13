import { Pool } from 'pg';

/**
 * Minimal async database interface. Production uses a pg Pool against
 * Supabase Postgres (free tier — survives free-hosting restarts, which wipe
 * local disk and made the previous SQLite storage unusable on Render);
 * tests use an in-memory PGlite behind the same interface.
 */
export interface Db {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number }>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface Session {
  id: number;
  name: string;
  ticketPrice: number;
  numberRangeMin: number;
  numberRangeMax: number;
  status: 'active' | 'closed';
  createdAt: string;
}

export interface Ticket {
  id: number;
  sessionId: number;
  number: number;
  prizeName: string;
  prizeGrade: string | null;
  prizeImageUrl: string | null;
  status: 'available' | 'sold';
  ownerNickname: string | null;
  ownerChannelId: string | null;
  donationLogId: number | null;
  soldAt: string | null;
}

export interface DonationLogEntry {
  id: number;
  sessionId: number | null;
  donorNickname: string;
  donorChannelId: string;
  amount: number;
  rawMessage: string;
  status: string;
  outcomes: string;
  needsAttention: boolean;
  resolved: boolean;
  createdAt: string;
}

export interface NewTicket {
  number: number;
  prizeName: string;
  prizeGrade?: string | null;
  prizeImageUrl?: string | null;
}

export interface AssignOutcome {
  number: number;
  result: 'success' | 'duplicate_rejected' | 'out_of_range';
  prizeName?: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ticket_price INTEGER NOT NULL,
  number_range_min INTEGER NOT NULL,
  number_range_max INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  number INTEGER NOT NULL,
  prize_name TEXT NOT NULL,
  prize_grade TEXT,
  prize_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  owner_nickname TEXT,
  owner_channel_id TEXT,
  donation_log_id INTEGER,
  sold_at TIMESTAMPTZ,
  UNIQUE(session_id, number)
);

CREATE TABLE IF NOT EXISTS donation_log (
  id SERIAL PRIMARY KEY,
  session_id INTEGER,
  donor_nickname TEXT NOT NULL,
  donor_channel_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  raw_message TEXT NOT NULL,
  status TEXT NOT NULL,
  outcomes TEXT NOT NULL DEFAULT '[]',
  needs_attention BOOLEAN NOT NULL DEFAULT false,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roulette_log (
  id SERIAL PRIMARY KEY,
  donor_nickname TEXT NOT NULL,
  donor_channel_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  result_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS prize_image_url TEXT;
`;

export async function initSchema(db: Db): Promise<void> {
  // Statement-by-statement so it works on drivers whose parameterized query
  // path rejects multi-statement strings (PGlite in tests).
  for (const statement of SCHEMA.split(';')) {
    if (statement.trim().length > 0) {
      await db.query(statement);
    }
  }
}

/**
 * Connects to a real Postgres (e.g. the Supabase pooler URL in
 * DATABASE_URL) and ensures the schema exists.
 */
export async function createPgDb(connectionString: string): Promise<Db> {
  const pool = new Pool({
    connectionString,
    // Supabase requires TLS; its pooler certificate chain isn't in Node's
    // default store, so verification is disabled the same way Supabase's
    // own connection-string docs recommend for pg.
    ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
  });

  const db: Db = {
    async query(text, params) {
      const result = await pool.query(text, params as any[]);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx: Db = {
          async query(text, params) {
            const result = await client.query(text, params as any[]);
            return { rows: result.rows, rowCount: result.rowCount ?? 0 };
          },
          transaction: (nested) => nested(tx),
          close: async () => {},
        };
        const value = await fn(tx);
        await client.query('COMMIT');
        return value;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };

  await initSchema(db);
  return db;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function rowToSession(row: any): Session {
  return {
    id: row.id,
    name: row.name,
    ticketPrice: row.ticket_price,
    numberRangeMin: row.number_range_min,
    numberRangeMax: row.number_range_max,
    status: row.status,
    createdAt: toIso(row.created_at),
  };
}

function rowToTicket(row: any): Ticket {
  return {
    id: row.id,
    sessionId: row.session_id,
    number: row.number,
    prizeName: row.prize_name,
    prizeGrade: row.prize_grade,
    prizeImageUrl: row.prize_image_url,
    status: row.status,
    ownerNickname: row.owner_nickname,
    ownerChannelId: row.owner_channel_id,
    donationLogId: row.donation_log_id,
    soldAt: row.sold_at == null ? null : toIso(row.sold_at),
  };
}

function rowToLogEntry(row: any): DonationLogEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    donorNickname: row.donor_nickname,
    donorChannelId: row.donor_channel_id,
    amount: row.amount,
    rawMessage: row.raw_message,
    status: row.status,
    outcomes: row.outcomes,
    needsAttention: row.needs_attention,
    resolved: row.resolved,
    createdAt: toIso(row.created_at),
  };
}

export async function getActiveSession(db: Db): Promise<Session | undefined> {
  const { rows } = await db.query(`SELECT * FROM sessions WHERE status = 'active' ORDER BY id DESC LIMIT 1`);
  return rows[0] ? rowToSession(rows[0]) : undefined;
}

export async function createSession(
  db: Db,
  params: { name: string; ticketPrice: number; numberRangeMin: number; numberRangeMax: number; tickets: NewTicket[] }
): Promise<Session> {
  return db.transaction(async (tx) => {
    const { rows } = await tx.query(
      `INSERT INTO sessions (name, ticket_price, number_range_min, number_range_max, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING *`,
      [params.name, params.ticketPrice, params.numberRangeMin, params.numberRangeMax]
    );
    const session = rowToSession(rows[0]);
    for (const t of params.tickets) {
      await tx.query(`INSERT INTO tickets (session_id, number, prize_name, prize_grade, prize_image_url) VALUES ($1, $2, $3, $4, $5)`, [
        session.id,
        t.number,
        t.prizeName,
        t.prizeGrade ?? null,
        t.prizeImageUrl ?? null,
      ]);
    }
    return session;
  });
}

export async function closeSession(db: Db, sessionId: number): Promise<void> {
  await db.query(`UPDATE sessions SET status = 'closed' WHERE id = $1`, [sessionId]);
}

export async function getTicketsForSession(db: Db, sessionId: number): Promise<Ticket[]> {
  const { rows } = await db.query(`SELECT * FROM tickets WHERE session_id = $1 ORDER BY number ASC`, [sessionId]);
  return rows.map(rowToTicket);
}

export interface SessionHistoryEntry extends Session {
  tickets: Ticket[];
  soldCount: number;
}

export async function listSessionHistory(db: Db): Promise<SessionHistoryEntry[]> {
  const { rows: sessionRows } = await db.query(`SELECT * FROM sessions ORDER BY id DESC`);
  if (sessionRows.length === 0) return [];
  const sessions = sessionRows.map(rowToSession);
  const { rows: ticketRows } = await db.query(`SELECT * FROM tickets ORDER BY session_id DESC, number ASC`);
  const ticketsBySession = new Map<number, Ticket[]>();
  for (const row of ticketRows) {
    const ticket = rowToTicket(row);
    const entries = ticketsBySession.get(ticket.sessionId) ?? [];
    entries.push(ticket);
    ticketsBySession.set(ticket.sessionId, entries);
  }
  return sessions.map((session) => {
    const tickets = ticketsBySession.get(session.id) ?? [];
    return { ...session, tickets, soldCount: tickets.filter((ticket) => ticket.status === 'sold').length };
  });
}

export async function tryAssignTicket(
  db: Db,
  sessionId: number,
  number: number,
  nickname: string,
  channelId: string,
  donationLogId: number
): Promise<AssignOutcome> {
  const { rows: sessionRows } = await db.query(
    `SELECT number_range_min, number_range_max FROM sessions WHERE id = $1`,
    [sessionId]
  );
  const session = sessionRows[0] as { number_range_min: number; number_range_max: number };

  if (number < session.number_range_min || number > session.number_range_max) {
    return { number, result: 'out_of_range' };
  }

  // Single conditional UPDATE is the atomicity guarantee: whichever request
  // Postgres applies first flips status to 'sold'; the loser matches zero
  // rows. RETURNING avoids a separate read of the prize name.
  const { rows: updated } = await db.query(
    `UPDATE tickets SET status = 'sold', owner_nickname = $1, owner_channel_id = $2, donation_log_id = $3, sold_at = now()
     WHERE session_id = $4 AND number = $5 AND status = 'available'
     RETURNING prize_name`,
    [nickname, channelId, donationLogId, sessionId, number]
  );

  if (updated.length === 0) {
    return { number, result: 'duplicate_rejected' };
  }

  return { number, result: 'success', prizeName: updated[0].prize_name };
}

export async function insertDonationLog(
  db: Db,
  entry: {
    sessionId: number | null;
    donorNickname: string;
    donorChannelId: string;
    amount: number;
    rawMessage: string;
    status: string;
    needsAttention: boolean;
  }
): Promise<number> {
  const { rows } = await db.query(
    `INSERT INTO donation_log (session_id, donor_nickname, donor_channel_id, amount, raw_message, status, needs_attention)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      entry.sessionId,
      entry.donorNickname,
      entry.donorChannelId,
      entry.amount,
      entry.rawMessage,
      entry.status,
      entry.needsAttention,
    ]
  );
  return rows[0].id;
}

export async function updateDonationLogOutcomes(
  db: Db,
  logId: number,
  outcomes: AssignOutcome[],
  needsAttention: boolean
): Promise<void> {
  await db.query(`UPDATE donation_log SET outcomes = $1, needs_attention = $2 WHERE id = $3`, [
    JSON.stringify(outcomes),
    needsAttention,
    logId,
  ]);
}

export async function listPendingIssues(db: Db): Promise<DonationLogEntry[]> {
  const { rows } = await db.query(
    `SELECT * FROM donation_log WHERE needs_attention = true AND resolved = false ORDER BY id ASC`
  );
  return rows.map(rowToLogEntry);
}

export async function resolveDonationLog(db: Db, logId: number): Promise<void> {
  await db.query(`UPDATE donation_log SET resolved = true WHERE id = $1`, [logId]);
}

export async function resolveAllDonationLogs(db: Db): Promise<number> {
  const { rows } = await db.query(
    `UPDATE donation_log SET resolved = true WHERE needs_attention = true AND resolved = false RETURNING id`
  );
  return rows.length;
}

export async function listDonationLog(db: Db, limit: number): Promise<DonationLogEntry[]> {
  const { rows } = await db.query(`SELECT * FROM donation_log ORDER BY id DESC LIMIT $1`, [limit]);
  return rows.map(rowToLogEntry);
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

export async function listAllWinners(db: Db): Promise<Winner[]> {
  const { rows } = await db.query(
    `SELECT t.session_id, s.name AS session_name, t.number, t.prize_name, t.prize_grade,
            t.owner_nickname, t.owner_channel_id, t.sold_at
     FROM tickets t
     JOIN sessions s ON s.id = t.session_id
     WHERE t.status = 'sold'
     ORDER BY t.sold_at DESC, t.id DESC`
  );
  return rows.map((row) => ({
    sessionId: row.session_id,
    sessionName: row.session_name,
    number: row.number,
    prizeName: row.prize_name,
    prizeGrade: row.prize_grade,
    ownerNickname: row.owner_nickname,
    ownerChannelId: row.owner_channel_id,
    soldAt: toIso(row.sold_at),
  }));
}

export async function getSetting(db: Db, key: string): Promise<string | undefined> {
  const { rows } = await db.query(`SELECT value FROM settings WHERE key = $1`, [key]);
  return rows[0]?.value;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [
    key,
    value,
  ]);
}

export async function deleteSetting(db: Db, key: string): Promise<void> {
  await db.query(`DELETE FROM settings WHERE key = $1`, [key]);
}

export interface RouletteLogEntry {
  id: number;
  donorNickname: string;
  donorChannelId: string;
  amount: number;
  resultLabel: string;
  createdAt: string;
}

export async function insertRouletteLog(db: Db, entry: Omit<RouletteLogEntry, 'id' | 'createdAt'>): Promise<RouletteLogEntry> {
  const { rows } = await db.query(`INSERT INTO roulette_log (donor_nickname, donor_channel_id, amount, result_label) VALUES ($1, $2, $3, $4) RETURNING *`, [entry.donorNickname, entry.donorChannelId, entry.amount, entry.resultLabel]);
  const row = rows[0];
  return { id: row.id, donorNickname: row.donor_nickname, donorChannelId: row.donor_channel_id, amount: row.amount, resultLabel: row.result_label, createdAt: toIso(row.created_at) };
}

export async function listRouletteLog(db: Db, limit = 100): Promise<RouletteLogEntry[]> {
  const { rows } = await db.query(`SELECT * FROM roulette_log ORDER BY id DESC LIMIT $1`, [limit]);
  return rows.map((row) => ({ id: row.id, donorNickname: row.donor_nickname, donorChannelId: row.donor_channel_id, amount: row.amount, resultLabel: row.result_label, createdAt: toIso(row.created_at) }));
}
