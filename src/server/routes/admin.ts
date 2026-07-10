import { Router } from 'express';
import {
  createSession,
  closeSession,
  getActiveSession,
  getTicketsForSession,
  listPendingIssues,
  resolveDonationLog,
  listDonationLog,
  listAllWinners,
  getSetting,
  setSetting,
  type Db,
} from '../db';
import { requireAdmin } from '../middleware/adminAuth';

export interface AdminRouterDeps {
  getChzzkStatus: () => 'connected' | 'disconnected' | 'reconnecting' | 'not_configured' | 'needs_reauth';
}

export function createAdminRouter(db: Db, deps: AdminRouterDeps): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get('/session', async (_req, res) => {
    const session = await getActiveSession(db);
    if (!session) {
      res.json({ active: false });
      return;
    }
    const tickets = await getTicketsForSession(db, session.id);
    res.json({
      active: true,
      sessionId: session.id,
      name: session.name,
      ticketPrice: session.ticketPrice,
      numberRangeMin: session.numberRangeMin,
      numberRangeMax: session.numberRangeMax,
      tickets,
    });
  });

  router.post('/session', async (req, res) => {
    const { name, ticketPrice, numberRangeMin, numberRangeMax, tickets } = req.body as {
      name: string;
      ticketPrice: number;
      numberRangeMin: number;
      numberRangeMax: number;
      tickets: Array<{ number: number; prizeName: string; prizeGrade?: string }>;
    };
    const existing = await getActiveSession(db);
    if (existing) await closeSession(db, existing.id);
    const session = await createSession(db, { name, ticketPrice, numberRangeMin, numberRangeMax, tickets });
    res.json(session);
  });

  router.post('/session/close', async (_req, res) => {
    const session = await getActiveSession(db);
    if (session) await closeSession(db, session.id);
    res.json({ ok: true });
  });

  router.get('/queue', async (_req, res) => {
    res.json(await listPendingIssues(db));
  });

  router.post('/queue/:id/resolve', async (req, res) => {
    await resolveDonationLog(db, Number(req.params.id));
    res.json({ ok: true });
  });

  router.get('/log', async (_req, res) => {
    res.json(await listDonationLog(db, 200));
  });

  router.get('/winners', async (_req, res) => {
    res.json(await listAllWinners(db));
  });

  router.get('/nickname-mode', async (_req, res) => {
    res.json({ mode: (await getSetting(db, 'nickname_display_mode')) ?? 'masked' });
  });

  router.post('/nickname-mode', async (req, res) => {
    const { mode } = req.body as { mode: 'masked' | 'full' };
    await setSetting(db, 'nickname_display_mode', mode);
    res.json({ mode });
  });

  router.get('/chzzk-status', (_req, res) => {
    res.json({ status: deps.getChzzkStatus() });
  });

  router.get('/kuji-enabled', async (_req, res) => {
    res.json({ enabled: (await getSetting(db, 'kuji_enabled')) !== 'false' });
  });

  router.post('/kuji-enabled', async (req, res) => {
    const { enabled } = req.body as { enabled: boolean };
    await setSetting(db, 'kuji_enabled', enabled ? 'true' : 'false');
    res.json({ enabled });
  });

  // Admin-account allowlist: the owner (first channel to log in) plus any
  // members added via a one-shot invite. See the login callback for how a
  // channel actually gets onto the list.
  router.get('/members', async (_req, res) => {
    const ownerChannelId = await getSetting(db, 'owner_channel_id');
    const ownerChannelName = await getSetting(db, 'owner_channel_name');
    const members = JSON.parse((await getSetting(db, 'allowed_members')) ?? '[]');
    const pendingInvite = (await getSetting(db, 'pending_member_invite')) === 'true';
    res.json({
      owner: ownerChannelId ? { channelId: ownerChannelId, channelName: ownerChannelName ?? '' } : null,
      members,
      pendingInvite,
    });
  });

  router.post('/members/invite', async (_req, res) => {
    await setSetting(db, 'pending_member_invite', 'true');
    res.json({ pendingInvite: true });
  });

  router.post('/members/invite/cancel', async (_req, res) => {
    await setSetting(db, 'pending_member_invite', 'false');
    res.json({ pendingInvite: false });
  });

  router.delete('/members/:channelId', async (req, res) => {
    const members: Array<{ channelId: string; channelName: string }> = JSON.parse(
      (await getSetting(db, 'allowed_members')) ?? '[]'
    );
    const next = members.filter((m) => m.channelId !== req.params.channelId);
    await setSetting(db, 'allowed_members', JSON.stringify(next));
    res.json({ members: next });
  });

  return router;
}
