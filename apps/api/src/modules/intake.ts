import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { rateLimit, requireAdmin, validate } from '../middlewares/auth.js';

/* ---------------------------------------------------------------- demandes */

export const leadsRouter: Router = Router();

const leadSchema = z.object({
  kind: z.enum(['quote', 'contact']).default('quote'),
  contact_name: z.string().min(2).max(140),
  contact_email: z.string().email().max(180),
  contact_phone: z.string().max(40).optional().default(''),
  service_id: z.string().uuid().nullable().optional(),
  budget_amount: z.number().nonnegative().max(1e9).nullable().optional(),
  budget_currency: z.enum(['USD', 'CDF']).default('USD'),
  message: z.string().min(5).max(4000),
  website: z.string().max(0).optional(), // honeypot : doit rester vide
});

leadsRouter.post(
  '/leads',
  rateLimit({ key: 'leads', max: 6, windowMs: 10 * 60_000 }),
  validate(leadSchema),
  async (req, res, next) => {
    try {
      const l = req.body as z.infer<typeof leadSchema>;
      if (l.website) throw new AppError(422, 'SPAM', 'Demande refusée.');

      const row = await one<{ id: string; created_at: string }>(
        `insert into leads(kind,contact_name,contact_email,contact_phone,service_id,
            budget_amount,budget_currency,message)
         values($1,$2,$3,$4,$5,$6,$7,$8) returning id, created_at`,
        [
          l.kind,
          l.contact_name,
          l.contact_email,
          l.contact_phone || null,
          l.service_id ?? null,
          l.budget_amount ?? null,
          l.budget_currency,
          l.message,
        ],
      );
      res.status(201).json({ ok: true, data: { reference: row?.id.slice(0, 8).toUpperCase() } });
    } catch (err) {
      next(err);
    }
  },
);

leadsRouter.get('/admin/leads', requireAdmin, async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const rows = await all(
      `select l.*, s.title as service_title
         from leads l left join services s on s.id = l.service_id
        where ($1::text is null or l.status = $1)
        order by l.created_at desc limit 200`,
      [status],
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

leadsRouter.patch(
  '/admin/leads/:id',
  requireAdmin,
  validate(
    z.object({
      status: z.enum(['new', 'in_progress', 'quoted', 'won', 'lost']).optional(),
      admin_note: z.string().max(2000).nullable().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const b = req.body as { status?: string; admin_note?: string | null };
      const row = await one(
        `update leads set
           status = coalesce($2, status),
           admin_note = coalesce($3, admin_note),
           updated_at = now()
         where id = $1 returning *`,
        [req.params.id, b.status ?? null, b.admin_note ?? null],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Demande introuvable.');
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

/* ------------------------------------------------------------ réservations */

export const bookingsRouter: Router = Router();

const bookingSchema = z.object({
  service_id: z.string().uuid().nullable().optional(),
  full_name: z.string().min(2).max(140),
  email: z.string().email().max(180),
  phone: z.string().max(40).optional().default(''),
  shoot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(['morning', 'afternoon', 'evening']),
  location: z.string().max(240).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
});

/** Créneaux restants pour une date (public : sert à construire le formulaire). */
bookingsRouter.get('/bookings/availability', async (req, res, next) => {
  try {
    const date = String(req.query.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      throw new AppError(422, 'VALIDATION', 'Date attendue au format AAAA-MM-JJ.');
    }
    // rejette les dates calendaires impossibles (2026-13-99)
    const parts = date.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
      throw new AppError(422, 'VALIDATION', 'Cette date n’existe pas.');
    }
    const taken = await all<{ slot: string }>(
      `select slot from bookings where shoot_date = $1 and status in ('pending','confirmed')`,
      [date],
    );
    const busy = new Set(taken.map((t) => t.slot));
    res.json({
      ok: true,
      data: {
        date,
        slots: [
          { slot: 'morning', label: 'Matin (09:00 — 12:00)', available: !busy.has('morning') },
          { slot: 'afternoon', label: 'Après-midi (14:00 — 17:00)', available: !busy.has('afternoon') },
          { slot: 'evening', label: 'Soirée (18:00 — 21:00)', available: !busy.has('evening') },
        ],
      },
    });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.post(
  '/bookings',
  rateLimit({ key: 'bookings', max: 6, windowMs: 10 * 60_000 }),
  validate(bookingSchema),
  async (req, res, next) => {
    try {
      const b = req.body as z.infer<typeof bookingSchema>;
      const exists = await one(
        `select id from bookings
          where shoot_date = $1 and slot = $2 and status in ('pending','confirmed')`,
        [b.shoot_date, b.slot],
      );
      if (exists) throw new AppError(409, 'SLOT_TAKEN', 'Ce créneau vient d’être réservé.');

      const row = await one<{ id: string }>(
        `insert into bookings(service_id,full_name,email,phone,shoot_date,slot,location,notes)
         values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [
          b.service_id ?? null,
          b.full_name,
          b.email,
          b.phone || null,
          b.shoot_date,
          b.slot,
          b.location || null,
          b.notes || null,
        ],
      );
      res.status(201).json({ ok: true, data: { reference: row?.id.slice(0, 8).toUpperCase() } });
    } catch (err) {
      next(err);
    }
  },
);

bookingsRouter.get('/admin/bookings', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all(
      `select b.*, s.title as service_title
         from bookings b left join services s on s.id = b.service_id
        order by b.shoot_date desc limit 200`,
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

bookingsRouter.patch(
  '/admin/bookings/:id',
  requireAdmin,
  validate(z.object({ status: z.enum(['pending', 'confirmed', 'done', 'cancelled']) })),
  async (req, res, next) => {
    try {
      const { status } = req.body as { status: string };
      const row = await one(
        `update bookings set status = $2, updated_at = now() where id = $1 returning *`,
        [req.params.id, status],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Réservation introuvable.');
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);
