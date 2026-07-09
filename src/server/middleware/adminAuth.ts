import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const validTokens = new Set<string>();

export function registerAdminToken(token: string): void {
  validTokens.add(token);
}

/**
 * Creates a fresh admin session token and sets it as the auth cookie.
 * Shared by the password login route and the Naver (CHZZK) OAuth login
 * callback so both paths issue identical sessions. `secure` is enabled in
 * production (Railway and similar hosts are HTTPS-only behind a proxy —
 * the server sets `trust proxy` so Express knows the connection is secure).
 */
export function issueAdminSession(res: Response): void {
  const token = crypto.randomBytes(32).toString('hex');
  validTokens.add(token);
  res.cookie('admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function isValidAdminToken(token: string | undefined): boolean {
  return !!token && validTokens.has(token);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.admin_token;
  if (!isValidAdminToken(token)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}
