import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin, validate } from '../middlewares/auth.js';

/** Planning, jalons, affectation, modèles gérables et rappels d'échéance. */
export const workspacePlanRouter: Router = Router();

/* ------------------------------------------------------------------ jalons */

const milestoneSchema = z.object({
  name: z.string().min(2).max(140),
  description: z.string().max(2000).default(''),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(['pending', 'reached', 'missed']).default('pending'),
});

workspacePlanRouter.get('/admin/pm/projects/:id/milestones', requireAdmin, async (req, res, next) => {
  try {
    const rows = await all(
      `select * from milestones where project_id=$1 order by due_date nulls last, position`,
      [String(req.params.id)],
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

workspacePlanRouter.post(
  '/admin/pm/projects/:id/milestones',
  requireAdmin,
  validate(milestoneSchema),
  async (req, res, next) => {
    try {
      const b = req.body as z.infer<typeof milestoneSchema>;
      const max = await one<{ m: number | null }>(
        `select max(position) as m from milestones where project_id=$1`,
        [String(req.params.id)],
      );
      const row = await one(
        `insert into milestones(project_id,name,description,due_date,status,position,reached_at)
         values($1,$2,$3,$4,$5,$6, case when $5='reached' then now() else null end)
         returning *`,
        [String(req.params.id), b.name, b.description, b.due_date ?? null, b.status, Number(max?.m ?? -1) + 1],
      );
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

workspacePlanRouter.patch(
  '/admin/pm/milestones/:id',
  requireAdmin,
  validate(milestoneSchema.partial()),
  async (req, res, next) => {
    try {
      const b = req.body as Partial<z.infer<typeof milestoneSchema>>;
      const keys = Object.keys(b);
      if (!keys.length) throw new AppError(422, 'VALIDATION', 'Aucun champ à modifier.');
      const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const reached =
        b.status === 'reached' ? ', reached_at = now()' : b.status ? ', reached_at = null' : '';
      const row = await one(
        `update milestones set ${sets}${reached} where id=$1 and project_id in (
           select id from projects_pm where deleted_at is null) returning *`,
        [String(req.params.id), ...keys.map((k) => (b as Record<string, unknown>)[k])],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Jalon introuvable.');
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

workspacePlanRouter.delete('/admin/pm/milestones/:id', requireAdmin, async (req, res, next) => {
  try {
    await one(`delete from milestones where id=$1`, [String(req.params.id)]);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

/* ----------------------------------------------------------------- planning */

/**
 * Événements du planning sur une plage : tâches datées, jalons, séances photo.
 * Utilisé par la vue calendrier et par le Gantt (mêmes données, deux rendus).
 */
workspacePlanRouter.get('/admin/pm/planning', requireAdmin, async (req, res, next) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from : null;
    const to = typeof req.query.to === 'string' ? req.query.to : null;

    const tasks = await all(
      `select t.id, t.title, t.status, t.priority, t.start_date, t.due_date,
              p.id as project_id, p.name as project_name, p.reference, s.name as stage_name
         from tasks t
         join projects_pm p on p.id = t.project_id
         left join project_stages s on s.id = t.stage_id
        where t.deleted_at is null and p.deleted_at is null
          and ($1::date is null or coalesce(t.due_date, t.start_date) >= $1::date)
          and ($2::date is null or coalesce(t.start_date, t.due_date) <= $2::date)
        order by coalesce(t.start_date, t.due_date) nulls last, t.position
        limit 400`,
      [from, to],
    );

    const milestones = await all(
      `select m.id, m.name, m.due_date, m.status, p.id as project_id, p.name as project_name, p.reference
         from milestones m join projects_pm p on p.id = m.project_id
        where p.deleted_at is null
          and ($1::date is null or m.due_date >= $1::date)
          and ($2::date is null or m.due_date <= $2::date)
        order by m.due_date nulls last limit 200`,
      [from, to],
    );

    const bookings = await all(
      `select id, full_name, shoot_date, slot, status from bookings
        where ($1::date is null or shoot_date >= $1::date)
          and ($2::date is null or shoot_date <= $2::date)
        order by shoot_date limit 200`,
      [from, to],
    );

    const late = tasks.filter((t) => t.status !== 'done' && t.due_date && new Date(String(t.due_date)) < new Date());

    res.json({
      ok: true,
      data: { tasks, milestones, bookings, lateCount: late.length, from, to },
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------- affectation */

workspacePlanRouter.get('/admin/pm/team', requireAdmin, async (_req, res, next) => {
  try {
    // charge réelle : tâches ouvertes et temps estimé restant, par membre actif
    const members = await all(
      `select u.id,
              coalesce(u.display_name, u.full_name) as name,
              u.email, u.job_title, u.avatar_url, u.role,
              count(t.id) filter (where t.id is not null)::int as open_tasks,
              coalesce(sum(t.estimate_minutes), 0)::int as estimate_minutes
         from users u
         left join tasks t on t.assignee_id = u.id and t.deleted_at is null and t.status <> 'done'
        where u.is_active
        group by u.id
        order by open_tasks desc, name`,
    );
    res.json({ ok: true, data: { members } });
  } catch (err) {
    next(err);
  }
});

/** Réaffecter une tâche (le champ assignee_id passe par PATCH /tasks/:id, contrôlé ici). */
workspacePlanRouter.post(
  '/admin/pm/tasks/:id/assign',
  requireAdmin,
  validate(z.object({ assignee_id: z.string().uuid().nullable() })),
  async (req, res, next) => {
    try {
      const { assignee_id } = req.body as { assignee_id: string | null };
      const row = await one<{ id: string; project_id: string; title: string; assignee_id: string | null }>(
        `update tasks set assignee_id=$2, updated_at=now() where id=$1 and deleted_at is null
         returning id, project_id, title, assignee_id`,
        [String(req.params.id), assignee_id],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Tâche introuvable.');
      await one(
        `insert into project_activities(project_id, kind, label, meta, actor_id)
         values($1,'task.assigned',$2,$3::jsonb,$4)`,
        [
          row.project_id,
          `« ${row.title} » réaffectée`,
          JSON.stringify({ task_id: row.id, assignee_id }),
          req.user?.id ?? null,
        ],
      );
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

/* ---------------------------------------------------------------- modèles */

workspacePlanRouter.patch(
  '/admin/pm/templates/:id',
  requireAdmin,
  validate(
    z.object({
      name: z.string().min(2).max(120).optional(),
      description: z.string().max(1000).nullable().optional(),
      category: z.string().max(40).nullable().optional(),
      stages: z
        .array(
          z.object({
            name: z.string().min(2).max(120),
            description: z.string().max(600).optional(),
            weight: z.number().int().min(1).max(10).optional(),
          }),
        )
        .min(1)
        .max(30)
        .optional(),
      is_active: z.boolean().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const b = req.body as Record<string, unknown>;
      const keys = Object.keys(b);
      if (!keys.length) throw new AppError(422, 'VALIDATION', 'Aucun champ à modifier.');
      const sets = keys.map((k, i) => `${k} = $${i + 2}::${k === 'stages' ? 'jsonb' : 'text'}`).join(', ');
      const values = keys.map((k) => (k === 'stages' ? JSON.stringify(b[k]) : b[k]));
      const row = await one(
        `update project_templates set ${sets.replace(/::text/g, '')} where id=$1 returning *`,
        [String(req.params.id), ...values],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Modèle introuvable.');
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

/** Duplication : un modèle sert souvent de base à un autre. */
workspacePlanRouter.post('/admin/pm/templates/:id/duplicate', requireAdmin, async (req, res, next) => {
  try {
    const src = await one<{ name: string; description: string | null; category: string | null; stages: unknown }>(
      `select name, description, category, stages from project_templates where id=$1`,
      [String(req.params.id)],
    );
    if (!src) throw new AppError(404, 'NOT_FOUND', 'Modèle introuvable.');
    const row = await one(
      `insert into project_templates(name, description, category, stages)
       values($1,$2,$3,$4::jsonb) returning *`,
      [`${src.name} (copie)`, src.description, src.category, JSON.stringify(src.stages)],
    );
    res.status(201).json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});

workspacePlanRouter.delete('/admin/pm/templates/:id', requireAdmin, async (req, res, next) => {
  try {
    // les projets déjà créés conservent leurs étapes : on désactive le modèle
    const row = await one(
      `update project_templates set is_active=false where id=$1 returning id`,
      [String(req.params.id)],
    );
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Modèle introuvable.');
    res.json({ ok: true, data: { archived: true } });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------------------------- rappels d'échéance */

/**
 * Scan des échéances : crée une notification par tâche et par jour (clé d'unicité),
 * donc aucun doublon même si le worker repasse. Déclenché manuellement ici, et par
 * le worker une fois par jour.
 */
workspacePlanRouter.post('/admin/pm/scan-due', requireAdmin, async (req, res, next) => {
  try {
    const created = await scanDueTasks();
    res.json({ ok: true, data: created });
  } catch (err) {
    next(err);
  }
});

export async function scanDueTasks(): Promise<{ late: number; soon: number }> {
  const late = await all<{ id: string; title: string; project_id: string; due_date: string }>(
    `select id, title, project_id, due_date from tasks
      where deleted_at is null and status <> 'done' and due_date < current_date`,
  );
  const soon = await all<{ id: string; title: string; project_id: string; due_date: string }>(
    `select id, title, project_id, due_date from tasks
      where deleted_at is null and status <> 'done'
        and due_date between current_date and current_date + 2`,
  );

  const today = new Date().toISOString().slice(0, 10);
  let nLate = 0;
  let nSoon = 0;

  for (const t of late) {
    const key = `task-late:${t.id}:${today}`;
    const inserted = await one(
      `insert into reminder_log(dedupe_key, kind, target_id) values($1,'task_late',$2)
       on conflict (dedupe_key) do nothing returning id`,
      [key, t.id],
    );
    if (!inserted) continue;
    await all(
      `insert into notifications(user_id, kind, title, body, link)
       select u.id, 'task_late', $1, $2, $3 from users u where u.is_active`,
      [
        `Tâche en retard : ${t.title}`,
        `Échéance dépassée (${t.due_date}). Projet à replanifier.`,
        `/admin/projets/${t.project_id}`,
      ],
    ).catch(() => null);
    nLate += 1;
  }

  for (const t of soon) {
    const key = `task-soon:${t.id}:${today}`;
    const inserted = await one(
      `insert into reminder_log(dedupe_key, kind, target_id) values($1,'task_soon',$2)
       on conflict (dedupe_key) do nothing returning id`,
      [key, t.id],
    );
    if (!inserted) continue;
    await all(
      `insert into notifications(user_id, kind, title, body, link)
       select u.id, 'task_soon', $1, $2, $3 from users u where u.is_active`,
      [
        `Échéance proche : ${t.title}`,
        `À terminer avant le ${t.due_date}.`,
        `/admin/projets/${t.project_id}`,
      ],
    ).catch(() => null);
    nSoon += 1;
  }

  return { late: nLate, soon: nSoon };
}
