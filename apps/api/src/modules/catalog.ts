import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin, validate } from '../middlewares/auth.js';

export const catalogRouter: Router = Router();

/* ------------------------------------------------------------------ public */

catalogRouter.get('/settings', async (_req, res, next) => {
  try {
    const rows = await all<{ key: string; value: unknown }>(`select key, value from settings`);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({ ok: true, data: map });
  } catch (err) {
    next(err);
  }
});

catalogRouter.get('/services', async (_req, res, next) => {
  try {
    const cats = await all(
      `select id, slug, name, tagline, description, position
         from service_categories where is_published order by position, name`,
    );
    const services = await all(
      `select id, category_id, slug, title, summary, description, deliverables,
              price_from_usd, price_from_cdf, price_note, duration_label, position
         from services where is_published order by position, title`,
    );
    res.json({ ok: true, data: { categories: cats, services } });
  } catch (err) {
    next(err);
  }
});

catalogRouter.get('/projects', async (_req, res, next) => {
  try {
    const rows = await all(
      `select p.id, p.slug, p.title, p.client_name, p.year, p.summary, p.cover_url,
              p.live_url, c.name as category
         from projects p left join service_categories c on c.id = p.category_id
        where p.is_published order by p.position, p.created_at desc`,
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

catalogRouter.get('/projects/:slug', async (req, res, next) => {
  try {
    const row = await one(
      `select p.*, c.name as category from projects p
         left join service_categories c on c.id = p.category_id
        where p.slug = $1 and p.is_published`,
      [req.params.slug],
    );
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Réalisation introuvable.');
    res.json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------- admin */

const serviceSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().min(2).max(120),
  summary: z.string().max(400).default(''),
  description: z.string().max(6000).default(''),
  deliverables: z.array(z.string().max(160)).max(20).default([]),
  price_from_usd: z.number().nonnegative().nullable().optional(),
  price_from_cdf: z.number().nonnegative().nullable().optional(),
  price_note: z.string().max(200).nullable().optional(),
  duration_label: z.string().max(80).nullable().optional(),
  position: z.number().int().min(0).max(999).default(0),
  is_published: z.boolean().default(true),
});

catalogRouter.get('/admin/services', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all(`select * from services order by position, title`);
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

catalogRouter.post(
  '/admin/services',
  requireAdmin,
  validate(serviceSchema),
  async (req, res, next) => {
    try {
      const s = req.body as z.infer<typeof serviceSchema>;
      const row = await one(
        `insert into services(category_id,slug,title,summary,description,deliverables,
            price_from_usd,price_from_cdf,price_note,duration_label,position,is_published)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
        [
          s.category_id ?? null,
          s.slug,
          s.title,
          s.summary,
          s.description,
          s.deliverables,
          s.price_from_usd ?? null,
          s.price_from_cdf ?? null,
          s.price_note ?? null,
          s.duration_label ?? null,
          s.position,
          s.is_published,
        ],
      );
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

catalogRouter.patch(
  '/admin/services/:id',
  requireAdmin,
  validate(serviceSchema.partial()),
  async (req, res, next) => {
    try {
      const s = req.body as Partial<z.infer<typeof serviceSchema>>;
      const keys = Object.keys(s);
      if (!keys.length) throw new AppError(422, 'VALIDATION', 'Aucun champ à modifier.');
      const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const row = await one(
        `update services set ${sets}, updated_at = now() where id = $1 returning *`,
        [req.params.id, ...keys.map((k) => (s as Record<string, unknown>)[k])],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Service introuvable.');
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

catalogRouter.delete('/admin/services/:id', requireAdmin, async (req, res, next) => {
  try {
    await one(`delete from services where id = $1 returning id`, [req.params.id]);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

const projectSchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().min(2).max(140),
  client_name: z.string().max(140).nullable().optional(),
  year: z.number().int().min(2000).max(2100).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  summary: z.string().max(400).default(''),
  body: z.string().max(12000).default(''),
  cover_url: z.string().url().max(500).nullable().optional(),
  live_url: z.string().url().max(500).nullable().optional(),
  is_published: z.boolean().default(false),
  position: z.number().int().min(0).max(999).default(0),
});

catalogRouter.get('/admin/projects', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all(`select * from projects order by position, created_at desc`);
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

catalogRouter.post(
  '/admin/projects',
  requireAdmin,
  validate(projectSchema),
  async (req, res, next) => {
    try {
      const p = req.body as z.infer<typeof projectSchema>;
      const row = await one(
        `insert into projects(slug,title,client_name,year,category_id,summary,body,
            cover_url,live_url,is_published,position)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
        [
          p.slug,
          p.title,
          p.client_name ?? null,
          p.year ?? null,
          p.category_id ?? null,
          p.summary,
          p.body,
          p.cover_url ?? null,
          p.live_url ?? null,
          p.is_published,
          p.position,
        ],
      );
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

catalogRouter.patch(
  '/admin/projects/:id',
  requireAdmin,
  validate(projectSchema.partial()),
  async (req, res, next) => {
    try {
      const p = req.body as Partial<z.infer<typeof projectSchema>>;
      const keys = Object.keys(p);
      if (!keys.length) throw new AppError(422, 'VALIDATION', 'Aucun champ à modifier.');
      const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const row = await one(
        `update projects set ${sets}, updated_at = now() where id = $1 returning *`,
        [req.params.id, ...keys.map((k) => (p as Record<string, unknown>)[k])],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Réalisation introuvable.');
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

catalogRouter.delete('/admin/projects/:id', requireAdmin, async (req, res, next) => {
  try {
    await one(`delete from projects where id = $1 returning id`, [req.params.id]);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ réglages */

const settingsSchema = z.object({
  studio: z
    .object({
      name: z.string().max(120),
      tagline: z.string().max(200),
      phone: z.string().max(40),
      whatsapp: z.string().max(40),
      email: z.string().email().max(160),
      address: z.string().max(240),
      hours: z.string().max(240),
    })
    .partial(),
  currencies: z
    .object({
      base: z.enum(['USD', 'CDF']),
      usd_to_cdf: z.number().positive(),
      updated_at: z.string().max(40),
    })
    .partial(),
});

catalogRouter.put('/admin/settings', requireAdmin, validate(settingsSchema), async (req, res, next) => {
  try {
    const payload = req.body as Record<string, unknown>;
    for (const [key, value] of Object.entries(payload)) {
      await one(
        `insert into settings(key, value) values($1, $2::jsonb)
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [key, JSON.stringify(value)],
      );
    }
    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, ip)
       values('user',$1,'settings.update','settings',$2)`,
      [req.user?.id ?? null, req.ip ?? null],
    );
    res.json({ ok: true, data: { updated: Object.keys(payload) } });
  } catch (err) {
    next(err);
  }
});
