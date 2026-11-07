import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { requireAdmin, validate } from '../middlewares/auth.js';
import { emailStats } from '../lib/worker.js';

export const prefsRouter: Router = Router();

const prefsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  accent: z.enum(['orange', 'amber', 'cuivre']).optional(),
  density: z.enum(['comfortable', 'compact']).optional(),
  sidebar_collapsed: z.boolean().optional(),
  widgets: z.array(z.string().max(40)).max(20).optional(),
  email_notifications: z.boolean().optional(),
  push_notifications: z.boolean().optional(),
  weekly_digest: z.boolean().optional(),
});

/** Préférences d'affichage persistées par utilisateur (thème, densité, widget). */
prefsRouter.get('/admin/prefs', requireAdmin, async (req, res, next) => {
  try {
    const row = await one(
      `select theme, accent, density, sidebar_collapsed, widgets,
              email_notifications, push_notifications, weekly_digest
         from user_prefs where user_id=$1`,
      [req.user?.id ?? null],
    );
    res.json({
      ok: true,
      data: row ?? {
        theme: 'system',
        accent: 'orange',
        density: 'comfortable',
        sidebar_collapsed: false,
        widgets: [],
        email_notifications: true,
        push_notifications: false,
        weekly_digest: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

prefsRouter.put('/admin/prefs', requireAdmin, validate(prefsSchema), async (req, res, next) => {
  try {
    const p = req.body as z.infer<typeof prefsSchema>;
    const row = await one(
      `insert into user_prefs(user_id, theme, accent, density, sidebar_collapsed, widgets,
             email_notifications, push_notifications, weekly_digest)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (user_id) do update set
         theme = coalesce($2, user_prefs.theme),
         accent = coalesce($3, user_prefs.accent),
         density = coalesce($4, user_prefs.density),
         sidebar_collapsed = coalesce($5, user_prefs.sidebar_collapsed),
         widgets = coalesce($6, user_prefs.widgets),
         email_notifications = coalesce($7, user_prefs.email_notifications),
         push_notifications = coalesce($8, user_prefs.push_notifications),
         weekly_digest = coalesce($9, user_prefs.weekly_digest),
         updated_at = now()
       returning theme, accent, density, sidebar_collapsed, widgets,
                 email_notifications, push_notifications, weekly_digest`,
      [
        req.user?.id ?? null,
        p.theme ?? null,
        p.accent ?? null,
        p.density ?? null,
        p.sidebar_collapsed ?? null,
        p.widgets ?? null,
        p.email_notifications ?? null,
        p.push_notifications ?? null,
        p.weekly_digest ?? null,
      ],
    );
    res.json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});

/** État consolidé des intégrations, affiché dans le Control Center. */
prefsRouter.get('/admin/integrations', requireAdmin, async (_req, res, next) => {
  try {
    const outbox = await emailStats();
    const hasNvidia = Boolean(process.env.NVIDIA_API_KEY);
    const hasBrevo = Boolean(process.env.BREVO_API_KEY);
    res.json({
      ok: true,
      data: [
        { id: 'nvidia-nim', label: 'NVIDIA NIM (IA)', ready: hasNvidia, hint: hasNvidia ? 'clé détectée' : 'NVIDIA_API_KEY absente' },
        { id: 'brevo', label: 'Brevo (emails)', ready: hasBrevo, hint: hasBrevo ? 'clé détectée' : 'BREVO_API_KEY absente' },
        { id: 'postgres', label: 'PostgreSQL', ready: true, hint: 'connectée' },
        { id: 'worker', label: 'File de tâches', ready: true, hint: `${outbox.jobs} tâche(s) en attente` },
      ],
    });
  } catch (err) {
    next(err);
  }
});

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
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Notification introuvable.' } });
      return;
    }
    const row = await one(
      `delete from notifications where id=$1 and (user_id=$2 or user_id is null) returning id`,
      [String(req.params.id), req.user?.id ?? null],
    );
    if (!row) {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Notification introuvable.' } });
      return;
    }
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
