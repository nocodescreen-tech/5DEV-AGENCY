import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { requireAdmin, validate } from '../middlewares/auth.js';
import { emailStats } from '../lib/worker.js';

export const prefsRouter: Router = Router();

const prefsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  accent: z.enum(['orange', 'amber', 'rose']).optional(),
  density: z.enum(['comfortable', 'compact']).optional(),
  sidebar_collapsed: z.boolean().optional(),
  widgets: z.array(z.string().max(40)).max(20).optional(),
});

/** Préférences d'affichage persistées par utilisateur (thème, densité, widget). */
prefsRouter.get('/admin/prefs', requireAdmin, async (req, res, next) => {
  try {
    const row = await one(
      `select theme, accent, density, sidebar_collapsed, widgets from user_prefs where user_id=$1`,
      [req.user?.id],
    );
    res.json({
      ok: true,
      data: row ?? { theme: 'system', accent: 'orange', density: 'comfortable', sidebar_collapsed: false, widgets: [] },
    });
  } catch (err) {
    next(err);
  }
});

prefsRouter.put('/admin/prefs', requireAdmin, validate(prefsSchema), async (req, res, next) => {
  try {
    const p = req.body as z.infer<typeof prefsSchema>;
    const row = await one(
      `insert into user_prefs(user_id, theme, accent, density, sidebar_collapsed, widgets)
       values($1, coalesce($2,'system'), coalesce($3,'orange'), coalesce($4,'comfortable'),
              coalesce($5,false), coalesce($6::jsonb,'[]'::jsonb))
       on conflict (user_id) do update set
         theme = coalesce($2, user_prefs.theme),
         accent = coalesce($3, user_prefs.accent),
         density = coalesce($4, user_prefs.density),
         sidebar_collapsed = coalesce($5, user_prefs.sidebar_collapsed),
         widgets = coalesce($6::jsonb, user_prefs.widgets),
         updated_at = now()
       returning theme, accent, density, sidebar_collapsed, widgets`,
      [
        req.user?.id,
        p.theme ?? null,
        p.accent ?? null,
        p.density ?? null,
        p.sidebar_collapsed ?? null,
        p.widgets ? JSON.stringify(p.widgets) : null,
      ],
    );
    res.json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});

/** Centre de notifications (réel : alimenté par les automatisations et les demandes). */
prefsRouter.get('/admin/notifications', requireAdmin, async (req, res, next) => {
  try {
    const rows = await all(
      `select id, kind, title, body, link, read_at, created_at
         from notifications where user_id=$1 order by created_at desc limit 50`,
      [req.user?.id],
    );
    const unread = rows.filter((r) => !r.read_at).length;
    res.json({ ok: true, data: { notifications: rows, unread } });
  } catch (err) {
    next(err);
  }
});

prefsRouter.post('/admin/notifications/read', requireAdmin, async (req, res, next) => {
  try {
    const id = typeof req.body?.id === 'string' ? req.body.id : null;
    await one(
      id
        ? `update notifications set read_at=now() where id=$1 and user_id=$2`
        : `update notifications set read_at=now() where user_id=$1 and read_at is null`,
      id ? [id, req.user?.id] : [req.user?.id],
    );
    res.json({ ok: true, data: { ok: true } });
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
