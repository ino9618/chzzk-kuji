import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export interface AdminPrincipal {
  role: 'owner' | 'member';
  channelId?: string;
  channelName?: string;
}

const validTokens = new Map<string, AdminPrincipal>();

const emergencyOwner: AdminPrincipal = { role: 'owner' };

export function registerAdminToken(token: string, principal: AdminPrincipal = emergencyOwner): void {
  validTokens.set(token, principal);
}

/**
 * Creates a fresh admin session token and sets it as the auth cookie.
 * Shared by the password login route and the Naver (CHZZK) OAuth login
 * callback so both paths issue identical sessions. `secure` is enabled in
 * production (Railway and similar hosts are HTTPS-only behind a proxy —
 * the server sets `trust proxy` so Express knows the connection is secure).
 */
export function issueAdminSession(res: Response, principal: AdminPrincipal = emergencyOwner): void {
  const token = crypto.randomBytes(32).toString('hex');
  validTokens.set(token, principal);
  res.cookie('admin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function isValidAdminToken(token: string | undefined): boolean {
  return !!token && validTokens.has(token);
}

/** Invalidates a session token (logout). No-op if the token is unknown. */
export function revokeAdminToken(token: string | undefined): void {
  if (token) validTokens.delete(token);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.admin_token;
  if (!isValidAdminToken(token)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  res.locals.admin = validTokens.get(token)!;
  next();
}

export function requireOwner(_req: Request, res: Response, next: NextFunction): void {
  if ((res.locals.admin as AdminPrincipal | undefined)?.role !== 'owner') {
    res.status(403).json({ error: 'owner_required' });
    return;
  }
  next();
}
