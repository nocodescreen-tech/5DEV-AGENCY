import { Router } from 'express';
import { all, one } from '../db/index.js';
import { requireAdmin } from '../middlewares/auth.js';

export const dashboardRouter: Router = Router();

dashboardRouter.get('/admin/dashboard', requireAdmin, async (_req, res, next) => {
  try {
    const [leads, bookings, catalog, activity, series] = await Promise.all([
      one<Record<string, number>>(
        `select count(*) filter (where status = 'new')::int as nouvelles,
                count(*) filter (where status = 'in_progress')::int as en_cours,
                count(*) filter (where status = 'won')::int as gagnees,
                count(*)::int as total
           from leads`,
      ),
      one<Record<string, number>>(
        `select count(*) filter (where status = 'pending')::int as a_confirmer,
                count(*) filter (where status = 'confirmed')::int as confirmees,
                count(*) filter (where shoot_date >= current_date)::int as a_venir,
                count(*)::int as total
           from bookings`,
      ),
      one<Record<string, number>>(
        `select (select count(*) from services where is_published)::int as services,
                (select count(*) from projects where is_published)::int as projets`,
      ),
      all(
        `(select 'lead' as type, id::text, contact_name as label, status, created_at from leads order by created_at desc limit 5)
         union all
         (select 'booking' as type, id::text, full_name as label, status, created_at from bookings order by created_at desc limit 5)
         order by created_at desc limit 8`,
      ),
      // série réelle des 14 derniers jours (demandes + réservations)
      all(
        `with jours as (
           select generate_series(current_date - interval '13 days', current_date, interval '1 day')::date as jour
         )
         select to_char(j.jour,'YYYY-MM-DD') as jour,
                (select count(*) from leads l where l.created_at::date = j.jour)::int as demandes,
                (select count(*) from bookings b where b.created_at::date = j.jour)::int as reservations
           from jours j order by j.jour`,
      ),
    ]);

    res.json({ ok: true, data: { leads, bookings, catalog, activity, series } });
  } catch (err) {
    next(err);
  }
});
