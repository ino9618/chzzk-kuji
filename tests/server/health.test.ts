import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import type { Db } from '../../src/server/db';
import { createApp } from '../../src/server/index';
import { createTestDb, resetDb } from '../helpers/testDb';

let db: Db;
let app: Express;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await resetDb(db);
  ({ app } = await createApp(db, { adminPasswordHash: bcrypt.hashSync('irrelevant', 10) }));
});

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /', () => {
  it('redirects the bare root to the admin page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin.html');
  });
});
