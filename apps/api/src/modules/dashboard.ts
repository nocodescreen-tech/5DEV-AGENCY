import { Router } from 'express';
import { all, one } from '../db/index.js';
import { requireAdmin } from '../middlewares/auth.js';

export const dashboardRouter: Router = Router();

/**
 * Tableau de bord : une seule requête, uniquement des agrégats réels.
 * Aucune valeur n'est calculée côté frontend à partir de constantes.
 */
dashboardRouter.get('/admin/dashboard', requireAdmin, async (_req, res, next) => {
  try {
    const [kpis, series, activity, tasksSoon, statuses, catalog] = await Promise.all([
      one<Record<string, number>>(
        `select
           (select count(*) from leads)::int as leads_total,
           (select count(*) from leads where status='new')::int as leads_new,
           (select count(*) from leads where created_at > now() - interval '7 days')::int as leads_week,
           (select count(*) from leads where created_at > now() - interval '14 days'
              and created_at <= now() - interval '7 days')::int as leads_prev_week,
           (select count(*) from bookings where status='pending')::int as bookings_pending,
           (select count(*) from bookings where shoot_date >= current_date)::int as bookings_upcoming,
           (select count(*) from projects_pm where deleted_at is null and status in ('planning','active'))::int as projects_active,
           (select count(*) from tasks where deleted_at is null and status <> 'done')::int as tasks_open,
           (select count(*) from tasks where deleted_at is null and status <> 'done' and due_date < current_date)::int as tasks_late,
           (select coalesce(sum(minutes),0) from time_entries
              where ended_at is not null and started_at > date_trunc('week', now()))::int as time_week,
           (select count(*) from ai_usage where created_at > now() - interval '24 hours')::int as ai_calls_24h,
           (select count(*) from subscribers where status='confirmed')::int as subscribers_confirmed,
           (select count(*) from services where is_published)::int as services_published,
           (select count(*) from projects where is_published)::int as works_published`,
      ),
      all(
        `with jours as (
           select generate_series(current_date - 13, current_date, '1 day')::date as jour
         )
         select to_char(j.jour,'YYYY-MM-DD') as jour,
                (select count(*) from leads l where l.created_at::date = j.jour)::int as demandes,
                (select count(*) from bookings b where b.created_at::date = j.jour)::int as reservations,
                (select coalesce(sum(minutes),0) from time_entries t
                  where t.ended_at is not null and t.started_at::date = j.jour)::int as minutes
           from jours j order by j.jour`,
      ),
      all(
        `select * from (
           select 'lead' as type, id::text, contact_name as label, status, created_at
             from leads
           union all
           select 'booking', id::text, full_name, status, created_at
             from bookings
           union all
           select 'project', id::text, name, status, created_at
             from projects_pm where deleted_at is null
         ) x order by created_at desc limit 10`,
      ),
      all(
        `select t.id, t.title, t.priority, t.due_date, p.name as project_name, p.id as project_id
           from tasks t join projects_pm p on p.id = t.project_id
          where t.deleted_at is null and t.status <> 'done'
          order by t.due_date nulls last, (t.priority='urgent') desc
          limit 6`,
      ),
      all(`select status, count(*)::int as n from leads group by status order by n desc`),
      one<Record<string, number>>(
        `select (select count(*) from services)::int as services,
                (select count(*) from projects)::int as projets,
                (select count(*) from project_templates)::int as modeles`,
      ),
    ]);

    res.json({
      ok: true,
      data: {
        kpis,
        catalog,
        series,
        activity,
        tasksSoon,
        statuses,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Compteurs légers pour les badges de navigation (4 agrégats, indexés).
 * Séparé du tableau de bord complet pour ne pas recalculer les séries à chaque page.
 */
dashboardRouter.get('/admin/counters', requireAdmin, async (_req, res, next) => {
  try {
    const row = await one<Record<string, number>>(
      `select
         (select count(*) from leads where status='new')::int as leads_new,
         (select count(*) from bookings where status='pending')::int as bookings_pending,
         (select count(*) from projects_pm where deleted_at is null and status in ('planning','active'))::int as projects_active,
         (select count(*) from tasks where deleted_at is null and status <> 'done')::int as tasks_open,
         (select count(*) from tasks where deleted_at is null and status <> 'done' and due_date < current_date)::int as tasks_late`,
    );
    res.json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});
