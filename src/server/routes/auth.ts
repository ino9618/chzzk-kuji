import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAdmin, issueAdminSession } from '../middleware/adminAuth';
import { getSetting, setSetting, type Db } from '../db';

const MIN_PASSWORD_LENGTH = 4;

export function createAuthRouter(db: Db): Router {
  const router = Router();

  router.post('/login', async (req, res) => {
    const { password } = req.body as { password?: string };
    const currentHash = await getSetting(db, 'admin_password_hash');
    if (!currentHash || !password || !bcrypt.compareSync(password, currentHash)) {
      res.status(401).json({ error: 'invalid_password' });
      return;
    }
    issueAdminSession(res);
    res.json({ ok: true });
  });

  router.get('/whoami', requireAdmin, (_req, res) => {
    res.json({ authenticated: true });
  });

  router.post('/password', requireAdmin, async (req, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    const currentHash = await getSetting(db, 'admin_password_hash');
    if (!currentHash || !currentPassword || !bcrypt.compareSync(currentPassword, currentHash)) {
      res.status(401).json({ error: 'invalid_current_password' });
      return;
    }
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: 'new_password_too_short', minLength: MIN_PASSWORD_LENGTH });
      return;
    }
    await setSetting(db, 'admin_password_hash', bcrypt.hashSync(newPassword, 10));
    res.json({ ok: true });
  });

  return router;
}
