import { PGlite } from '@electric-sql/pglite';
import { initSchema, type Db } from '../../src/server/db';

/**
 * In-memory Postgres (PGlite) behind the same Db interface production uses
 * with pg/Supabase, so tests exercise real Postgres SQL without a server.
 *
 * PGlite startup is not free, so share one instance per test file
 * (beforeAll createTestDb) and wipe tables between tests (beforeEach
 * resetDb) instead of creating a fresh database per test.
 */
export async function createTestDb(): Promise<Db> {
  const pg = new PGlite();

  const wrap = (runner: { query: (text: string, params?: any[]) => Promise<any> }): Db => ({
    async query(text, params) {
      const result = await runner.query(text, params as any[]);
      return { rows: result.rows ?? [], rowCount: result.affectedRows ?? result.rows?.length ?? 0 };
    },
    async transaction(fn) {
      // Our code never opens nested transactions; run against the same runner.
      if (runner !== pg) return fn(wrap(runner));
      return pg.transaction(async (tx) => fn(wrap(tx)));
    },
    close: () => pg.close(),
  });

  const db = wrap(pg);
  await initSchema(db);
  return db;
}

export async function resetDb(db: Db): Promise<void> {
  await db.query('TRUNCATE sessions, tickets, donation_log, settings RESTART IDENTITY CASCADE');
}
