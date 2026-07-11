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
  deleteSetting,
  type Db,
} from '../db';
import { requireAdmin } from '../middleware/adminAuth';
import { requireOwner } from '../middleware/adminAuth';

export interface AdminRouterDeps {
  getChzzkStatus: () => 'connected' | 'disconnected' | 'reconnecting' | 'not_configured' | 'needs_reauth';
  disconnectChzzk?: () => Promise<void> | void;
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

  router.get('/chzzk-connection', async (_req, res) => {
    const [channelId, channelName, recentEvents] = await Promise.all([
      getSetting(db, 'owner_channel_id'),
      getSetting(db, 'owner_channel_name'),
      listDonationLog(db, 1),
    ]);
    res.json({
      status: deps.getChzzkStatus(),
      channelId: channelId ?? null,
      channelName: channelName ?? null,
      lastEventAt: recentEvents[0]?.createdAt ?? null,
    });
  });

  router.post('/chzzk-connection/disconnect', requireOwner, async (_req, res) => {
    await deps.disconnectChzzk?.();
    await Promise.all([
      deleteSetting(db, 'chzzk_access_token'),
      deleteSetting(db, 'chzzk_refresh_token'),
      deleteSetting(db, 'owner_channel_id'),
      deleteSetting(db, 'owner_channel_name'),
    ]);
    res.json({ ok: true });
  });

  router.get('/kuji-enabled', async (_req, res) => {
    res.json({ enabled: (await getSetting(db, 'kuji_enabled')) !== 'false' });
  });

  router.post('/kuji-enabled', async (req, res) => {
    const { enabled } = req.body as { enabled: boolean };
    await setSetting(db, 'kuji_enabled', enabled ? 'true' : 'false');
    res.json({ enabled });
  });

  return router;
}
