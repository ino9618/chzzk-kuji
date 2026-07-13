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
  listSessionHistory,
  getSetting,
  setSetting,
  deleteSetting,
  listRouletteLog,
  type Db,
} from '../db';
import { requireAdmin } from '../middleware/adminAuth';
import { requireOwner } from '../middleware/adminAuth';
import type { DonationEvent } from '../donationProcessor';
import { getRouletteConfig, type RouletteConfig, type RouletteProcessResult } from '../rouletteProcessor';

export interface AdminRouterDeps {
  getChzzkStatus: () => 'connected' | 'disconnected' | 'reconnecting' | 'not_configured' | 'needs_reauth';
  disconnectChzzk?: () => Promise<void> | void;
  simulateRoulette: (event: DonationEvent) => Promise<RouletteProcessResult>;
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
      tickets: Array<{ number: number; prizeName: string; prizeGrade?: string; prizeImageUrl?: string | null }>;
    };
    const invalidImage = tickets?.some((ticket) => ticket.prizeImageUrl != null && !/^data:image\/(?:webp|png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(ticket.prizeImageUrl));
    const oversizedImage = tickets?.some((ticket) => (ticket.prizeImageUrl?.length ?? 0) > 2_000_000);
    if (!Array.isArray(tickets) || invalidImage || oversizedImage) {
      res.status(400).json({ error: 'invalid_prize_image' });
      return;
    }
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

  router.get('/sessions', async (_req, res) => {
    res.json(await listSessionHistory(db));
  });

  router.get('/roulette', async (_req, res) => {
    res.json(await getRouletteConfig(db));
  });

  router.post('/roulette', async (req, res) => {
    const { enabled, minimumAmount, registrationAmount, items } = req.body as RouletteConfig;
    const validItems = Array.isArray(items) && items.length >= 2 && items.length <= 20 && items.every((item) => typeof item?.label === 'string' && item.label.trim().length > 0 && item.label.trim().length <= 40 && Number.isInteger(item.weight) && item.weight > 0 && item.weight <= 1000);
    if (typeof enabled !== 'boolean' || !Number.isInteger(minimumAmount) || minimumAmount < 1 || !Number.isInteger(registrationAmount) || registrationAmount < 1 || !validItems) {
      res.status(400).json({ error: 'invalid_roulette_config' });
      return;
    }
    const normalized = items.map((item) => ({ label: item.label.trim(), weight: item.weight }));
    await db.transaction(async (tx) => {
      await setSetting(tx, 'roulette_enabled', enabled ? 'true' : 'false');
      await setSetting(tx, 'roulette_minimum_amount', String(minimumAmount));
      await setSetting(tx, 'roulette_registration_amount', String(registrationAmount));
      await setSetting(tx, 'roulette_items', JSON.stringify(normalized));
    });
    res.json({ enabled, minimumAmount, registrationAmount, items: normalized });
  });

  router.get('/roulette/log', async (_req, res) => {
    res.json(await listRouletteLog(db));
  });

  router.post('/roulette/test', async (_req, res) => {
    const config = await getRouletteConfig(db);
    if (!config.enabled) {
      res.status(409).json({ error: 'roulette_disabled' });
      return;
    }
    res.json(await deps.simulateRoulette({ channelId: 'roulette-test', nickname: '테스트 후원자', amount: config.minimumAmount, message: '!룰렛' }));
  });

  router.get('/nickname-mode', async (_req, res) => {
    res.json({ mode: (await getSetting(db, 'nickname_display_mode')) ?? 'masked' });
  });

  router.post('/nickname-mode', async (req, res) => {
    const { mode } = req.body as { mode: 'masked' | 'full' };
    await setSetting(db, 'nickname_display_mode', mode);
    res.json({ mode });
  });

  router.get('/basic-settings', async (_req, res) => {
    const [enabled, price, mode] = await Promise.all([
      getSetting(db, 'kuji_enabled'),
      getSetting(db, 'default_ticket_price'),
      getSetting(db, 'nickname_display_mode'),
    ]);
    res.json({ kujiEnabled: enabled !== 'false', defaultTicketPrice: Number(price) || 1000, nicknameMode: mode ?? 'masked' });
  });

  router.post('/basic-settings', async (req, res) => {
    const { kujiEnabled, defaultTicketPrice, nicknameMode } = req.body as { kujiEnabled?: unknown; defaultTicketPrice?: unknown; nicknameMode?: unknown };
    if (typeof kujiEnabled !== 'boolean' || !Number.isInteger(defaultTicketPrice) || Number(defaultTicketPrice) < 1 || !['masked', 'full'].includes(String(nicknameMode))) {
      res.status(400).json({ error: 'invalid_basic_settings' });
      return;
    }
    await db.transaction(async (tx) => {
      await setSetting(tx, 'kuji_enabled', kujiEnabled ? 'true' : 'false');
      await setSetting(tx, 'default_ticket_price', String(defaultTicketPrice));
      await setSetting(tx, 'nickname_display_mode', String(nicknameMode));
    });
    res.json({ kujiEnabled, defaultTicketPrice, nicknameMode });
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
