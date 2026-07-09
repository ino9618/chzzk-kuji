import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import type { Db } from '../../src/server/db';
import { createApp } from '../../src/server/index';
import { createTestDb, resetDb } from '../helpers/testDb';

let db: Db;
let app: Express;
const PASSWORD = 'test-password-123';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 10);

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await resetDb(db);
  ({ app } = await createApp(db, { adminPasswordHash: PASSWORD_HASH }));
});

describe('admin auth', () => {
  it('rejects login with the wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('logs in with the correct password and sets a cookie that unlocks protected routes', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ password: PASSWORD });
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers['set-cookie'];
    expect(cookie).toBeDefined();

    const protectedRes = await request(app).get('/api/auth/whoami').set('Cookie', cookie);
    expect(protectedRes.status).toBe(200);
    expect(protectedRes.body).toEqual({ authenticated: true });
  });

  it('rejects protected routes without a valid cookie', async () => {
    const res = await request(app).get('/api/auth/whoami');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/password', () => {
  async function loginAgent(target: Express) {
    const agent = request.agent(target);
    await agent.post('/api/auth/login').send({ password: PASSWORD });
    return agent;
  }

  it('rejects the change when the current password is wrong', async () => {
    const agent = await loginAgent(app);

    const res = await agent.post('/api/auth/password').send({ currentPassword: 'nope', newPassword: 'new-password-456' });
    expect(res.status).toBe(401);

    // Old password still works; nothing was changed.
    const loginRes = await request(app).post('/api/auth/login').send({ password: PASSWORD });
    expect(loginRes.status).toBe(200);
  });

  it('rejects a new password shorter than 4 characters', async () => {
    const agent = await loginAgent(app);

    const res = await agent.post('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: 'abc' });
    expect(res.status).toBe(400);

    const loginRes = await request(app).post('/api/auth/login').send({ password: PASSWORD });
    expect(loginRes.status).toBe(200);
  });

  it('changes the password so the old one stops working and the new one works immediately, with no restart', async () => {
    const agent = await loginAgent(app);

    const res = await agent.post('/api/auth/password').send({ currentPassword: PASSWORD, newPassword: 'brand-new-pw-789' });
    expect(res.status).toBe(200);

    const oldLoginRes = await request(app).post('/api/auth/login').send({ password: PASSWORD });
    expect(oldLoginRes.status).toBe(401);

    // Same running app instance, no restart: the login route must read the
    // updated hash from the DB rather than a value captured at startup.
    const newLoginRes = await request(app).post('/api/auth/login').send({ password: 'brand-new-pw-789' });
    expect(newLoginRes.status).toBe(200);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/auth/password')
      .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pw-789' });
    expect(res.status).toBe(401);
  });
});
