import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin } from '../middlewares/auth.js';
import { runAutomations } from './automation.js';

export const prefsRouter: Router = Router();

/* ------------------------------------------------------- préférences */

prefsRouter.get('/admin/prefs', requireAdmin, async (req, res, next) => {
  try {
    const row = await one(
      `select theme, density, accent, email_notifications, push_notifications, weekly_digest
         from user_prefs where user_id=$1`,
      [req.user?.id ?? null],
    );
    res.json({
      ok: true,
      data: row ?? {
        theme: 'system',
        density: 'comfortable',
        accent: 'orange',
        email_notifications: true,
        push_notifications: false,
        weekly_digest: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

prefsRouter.patch(
  '/admin/prefs',
  requireAdmin,
  async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const row = await one(
        `insert into user_prefs(user_id, theme, density, accent, email_notifications, push_notifications, weekly_digest)
         values($1,$2,$3,$4,$5,$6,$7)
         on conflict (user_id) do update set
           theme = coalesce(excluded.theme, user_prefs.theme),
           density = coalesce(excluded.density, user_prefs.density),
           accent = coalesce(excluded.accent, user_prefs.accent),
           email_notifications = coalesce(excluded.email_notifications, user_prefs.email_notifications),
           push_notifications = coalesce(excluded.push_notifications, user_prefs.push_notifications),
           weekly_digest = coalesce(excluded.weekly_digest, user_prefs.weekly_digest),
           updated_at = now()
         returning *`,
        [
          req.user?.id ?? null,
          (body.theme as string) ?? null,
          (body.density as string) ?? null,
          (body.accent as string) ?? null,
          typeof body.email_notifications === 'boolean' ? body.email_notifications : null,
          typeof body.push_notifications === 'boolean' ? body.push_notifications : null,
          typeof body.weekly_digest === 'boolean' ? body.weekly_digest : null,
        ],
      );
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

/* ----------------------------------------------------- notifications */

prefsRouter.get('/admin/notifications', requireAdmin, async (req, res, next) => {
  try {
    const rows = await all(
      `select id, kind, title, body, link, read_at, created_at
         from notifications
        where user_id=$1 or user_id is null
        order by created_at desc limit 50`,
      [req.user?.id ?? null],
    );
    const unread = rows.filter((r) => !r.read_at).length;
    res.json({ ok: true, data: { notifications: rows, unread } });
  } catch (err) {
    next(err);
  }
});

prefsRouter.post('/admin/notifications/read', requireAdmin, async (req, res, next) => {
  try {
    await one(
      `update notifications set read_at = now() where read_at is null and (user_id=$1 or user_id is null)`,
      [req.user?.id ?? null],
    );
    res.json({ ok: true, data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

/** Supprimer une notification (l'utilisateur ne veut plus la voir). */
prefsRouter.delete('/admin/notifications/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      throw new AppError(404, 'NOT_FOUND', 'Notification introuvable.');
    }
    const row = await one(
      `delete from notifications where id=$1 and (user_id=$2 or user_id is null) returning id`,
      [String(req.params.id), req.user?.id ?? null],
    );
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Notification introuvable.');
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

/** Vider les notifications lues (jamais les non lues d'un coup). */
prefsRouter.post('/admin/notifications/clear', requireAdmin, async (req, res, next) => {
  try {
    const row = await one<{ n: string }>(
      `with d as (
         delete from notifications where read_at is not null and (user_id=$1 or user_id is null) returning 1
       ) select count(*)::text as n from d`,
      [req.user?.id ?? null],
    );
    res.json({ ok: true, data: { cleared: Number(row?.n ?? 0) } });
  } catch (err) {
    next(err);
  }
});

export { runAutomations };
