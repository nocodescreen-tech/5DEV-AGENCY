import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin, validate } from '../middlewares/auth.js';
import { runTask } from './ai/gateway.js';

// Préfixe /admin/pm : « /admin/projects » est déjà pris par les réalisations
// du site vitrine (catalogue). Les deux domaines restent séparés (ADR-011).
export const workspaceRouter: Router = Router();

/* ------------------------------------------------------------- utilitaires */

async function logActivity(
  projectId: string,
  kind: string,
  label: string,
  actorId: string | null,
  meta: Record<string, unknown> = {},
): Promise<void> {
  await one(
    `insert into project_activities(project_id, kind, label, meta, actor_id)
     values($1,$2,$3,$4::jsonb,$5)`,
    [projectId, kind, label, JSON.stringify(meta), actorId],
  ).catch(() => null);
}

/**
 * Progression = moyenne pondérée par étape.
 * Chaque étape pèse son `weight` ; sa réussite = tâches terminées / tâches de l'étape
 * (0 si l'étape n'a aucune tâche). Les tâches sans étape comptent comme une étape de poids 1.
 * Aucune valeur n'est saisissable à la main : tout vient des tâches.
 */
const PROGRESS_LATERAL = `
  left join lateral (
    select coalesce(round(100.0 * sum(z.w * z.ratio) / nullif(sum(z.w), 0)), 0)::int as progress
      from (
        select s.weight as w,
               -- une étape sans tâche compte 100 % si elle est validée, 0 % sinon
               case when count(t.id) = 0 then (case when s.status = 'done' then 1 else 0 end)
                    else count(t.id) filter (where t.status = 'done')::numeric / count(t.id) end as ratio
          from project_stages s
          left join tasks t on t.stage_id = s.id and t.deleted_at is null
         where s.project_id = p.id
         group by s.id, s.weight
        union all
        select 1 as w,
               case when count(*) = 0 then 0
                    else count(*) filter (where status = 'done')::numeric / count(*) end as ratio
          from tasks
         where project_id = p.id and stage_id is null and deleted_at is null
        having count(*) > 0
      ) z
  ) pr on true`;

async function projectProgress(projectId: string): Promise<number> {
  const row = await one<{ progress: number }>(
    `select coalesce(pr.progress, 0) as progress
       from projects_pm p
       ${PROGRESS_LATERAL}
      where p.id = $1`,
    [projectId],
  );
  return Number(row?.progress ?? 0);
}

/**
 * Référence PRJ-AAAA-NNN : calculée sur le **maximum existant**, jamais sur un comptage
 * (supprimer un projet faisait auparavant réutiliser une référence déjà prise → violation
 * d'unicité). La course entre deux créations simultanées est absorbée par un retry.
 */
async function nextReference(): Promise<string> {
  const year = new Date().getFullYear();
  const row = await one<{ n: number }>(
    `select coalesce(max(nullif(regexp_replace(reference, '^PRJ-[0-9]{4}-', ''), '')::int), 0) as n
       from projects_pm
      where reference like $1`,
    [`PRJ-${year}-%`],
  );
  return `PRJ-${year}-${String(Number(row?.n ?? 0) + 1).padStart(3, '0')}`;
}

/* ------------------------------------------------------------- vue générale */

workspaceRouter.get('/admin/pm/overview', requireAdmin, async (_req, res, next) => {
  try {
    const [counts, urgent, activity, timeWeek] = await Promise.all([
      one<Record<string, number>>(
        `select
           (select count(*) from projects_pm where deleted_at is null and status in ('planning','active'))::int as actifs,
           (select count(*) from projects_pm where deleted_at is null and status='done')::int as termines,
           (select count(*) from projects_pm where deleted_at is null and status='blocked')::int as bloques,
           (select count(*) from tasks where deleted_at is null and status in ('todo','doing','review','blocked'))::int as taches_ouvertes,
           (select count(*) from tasks where deleted_at is null and status<>'done' and due_date < current_date)::int as taches_retard,
           (select count(*) from tasks where deleted_at is null and status='blocked')::int as taches_bloquees,
           (select count(*) from tasks where deleted_at is null and status<>'done' and due_date between current_date and current_date + 7)::int as echeances_7j`,
      ),
      all(
        `select t.id, t.title, t.status, t.priority, t.due_date,
                p.id as project_id, p.name as project_name, p.reference
           from tasks t join projects_pm p on p.id = t.project_id
          where t.deleted_at is null and t.status <> 'done'
            and (t.due_date is not null and t.due_date <= current_date + 7 or t.priority in ('high','urgent'))
          order by (t.priority = 'urgent') desc, t.due_date nulls last
          limit 12`,
      ),
      all(
        `select a.id, a.kind, a.label, a.created_at, p.name as project_name, p.reference
           from project_activities a join projects_pm p on p.id = a.project_id
          order by a.created_at desc limit 15`,
      ),
      one<{ minutes: number }>(
        `select coalesce(sum(minutes),0)::int as minutes from time_entries
          where started_at > now() - interval '7 days'`,
      ),
    ]);

    res.json({ ok: true, data: { counts, urgent, activity, timeWeekMinutes: Number(timeWeek?.minutes ?? 0) } });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------ projets */

const projectSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(8000).default(''),
  category: z
    .enum(['dev-web', 'app-web', 'photo', 'marketing', 'infra', 'interne', 'recherche'])
    .default('dev-web'),
  client_name: z.string().max(160).nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  status: z.enum(['planning', 'active', 'paused', 'blocked', 'done', 'archived']).default('planning'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  budget_amount: z.number().nonnegative().nullable().optional(),
  budget_currency: z.enum(['USD', 'CDF']).default('USD'),
  technologies: z.array(z.string().max(40)).max(20).default([]),
  objectives: z.string().max(4000).default(''),
  deliverables: z.array(z.string().max(160)).max(30).default([]),
});

workspaceRouter.get('/admin/pm/projects', requireAdmin, async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const rows = await all(
      `select p.*,
              coalesce(pr.progress, 0) as progress,
              (select count(*) from tasks t where t.project_id=p.id and t.deleted_at is null)::int as tasks_total,
              (select count(*) from tasks t where t.project_id=p.id and t.status='done' and t.deleted_at is null)::int as tasks_done,
              (select count(*) from tasks t where t.project_id=p.id and t.status<>'done' and t.deleted_at is null and t.due_date < current_date)::int as tasks_late
         from projects_pm p
         ${PROGRESS_LATERAL}
        where p.deleted_at is null and ($1::text is null or p.status = $1)
        order by (p.priority = 'urgent') desc, (p.priority = 'high') desc, p.due_date nulls last, p.created_at desc`,
      [status],
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post('/admin/pm/projects', requireAdmin, validate(projectSchema), async (req, res, next) => {
  try {
    const p = req.body as z.infer<typeof projectSchema>;

    // 3 tentatives maximum : la référence peut être prise par une création concurrente
    let project: { id: string; reference: string } | null = null;
    for (let attempt = 0; attempt < 3 && !project; attempt++) {
      const reference = attempt === 0 ? await nextReference() : `PRJ-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      project = await one<{ id: string; reference: string }>(
      `insert into projects_pm(reference,name,description,category,client_name,owner_id,template_id,
          status,priority,start_date,due_date,budget_amount,budget_currency,technologies,objectives,deliverables)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       returning id, reference`,
      [
        reference,
        p.name,
        p.description,
        p.category,
        p.client_name ?? null,
        req.user?.id ?? null,
        p.template_id ?? null,
        p.status,
        p.priority,
        p.start_date ?? null,
        p.due_date ?? null,
        p.budget_amount ?? null,
        p.budget_currency,
        p.technologies,
        p.objectives,
        p.deliverables,
      ],
      ).catch((err: unknown) => {
        if (attempt < 2) return null;
        throw err;
      });
    }
    if (!project) throw new AppError(500, 'INTERNAL', 'Création du projet impossible.');

    // étapes générées depuis le modèle choisi (aucune étape codée en dur)
    let stagesCreated = 0;
    if (p.template_id) {
      const tpl = await one<{ stages: { name: string; description?: string; weight?: number }[] }>(
        `select stages from project_templates where id=$1 and is_active`,
        [p.template_id],
      );
      for (const [i, stage] of (tpl?.stages ?? []).entries()) {
        await one(
          `insert into project_stages(project_id,name,description,position,weight)
           values($1,$2,$3,$4,$5)`,
          [project.id, stage.name, stage.description ?? '', i, Math.min(10, Math.max(1, stage.weight ?? 1))],
        );
        stagesCreated += 1;
      }
    }

    await logActivity(project.id, 'project.created', `Projet « ${p.name} » créé`, req.user?.id ?? null, {
      stages: stagesCreated,
      template: p.template_id ?? null,
    });

    res.status(201).json({ ok: true, data: { ...project, stages_created: stagesCreated } });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.get('/admin/pm/projects/:id', requireAdmin, async (req, res, next) => {
  try {
    const project = await one(`select * from projects_pm where id=$1 and deleted_at is null`, [String(req.params.id)]);
    if (!project) throw new AppError(404, 'NOT_FOUND', 'Projet introuvable.');

    const [stages, tasks, documents, notes, activity, time, deps] = await Promise.all([
      all(`select * from project_stages where project_id=$1 order by position, created_at`, [String(req.params.id)]),
      all(
        `select t.*, s.name as stage_name,
                (select count(*) from task_comments c where c.task_id=t.id)::int as comments
           from tasks t left join project_stages s on s.id=t.stage_id
          where t.project_id=$1 and t.deleted_at is null
          order by t.position, t.created_at`,
        [String(req.params.id)],
      ),
      all(`select * from project_documents where project_id=$1 order by created_at desc`, [String(req.params.id)]),
      all(`select * from project_notes where project_id=$1 order by created_at desc`, [String(req.params.id)]),
      all(`select * from project_activities where project_id=$1 order by created_at desc limit 40`, [String(req.params.id)]),
      one<Record<string, number>>(
        `select coalesce(sum(minutes),0)::int as minutes_total,
                coalesce(sum(minutes) filter (where started_at > now() - interval '7 days'),0)::int as minutes_week
           from time_entries where project_id=$1 and ended_at is not null`,
        [String(req.params.id)],
      ),
      all(
        `select d.task_id, d.depends_on_id from task_dependencies d
           join tasks t on t.id = d.task_id where t.project_id = $1`,
        [String(req.params.id)],
      ),
    ]);

    res.json({
      ok: true,
      data: {
        project: { ...project, progress: await projectProgress(String(req.params.id)) },
        stages,
        tasks,
        documents,
        notes,
        activity,
        dependencies: deps,
        time: { totalMinutes: Number(time?.minutes_total ?? 0), weekMinutes: Number(time?.minutes_week ?? 0) },
      },
    });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.patch(
  '/admin/pm/projects/:id',
  requireAdmin,
  validate(projectSchema.partial()),
  async (req, res, next) => {
    try {
      const p = req.body as Partial<z.infer<typeof projectSchema>>;
      const keys = Object.keys(p);
      if (!keys.length) throw new AppError(422, 'VALIDATION', 'Aucun champ à modifier.');
      const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const row = await one(
        `update projects_pm set ${sets}, updated_at=now() where id=$1 and deleted_at is null returning *`,
        [String(req.params.id), ...keys.map((k) => (p as Record<string, unknown>)[k])],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Projet introuvable.');
      await logActivity(String(req.params.id), 'project.updated', 'Fiche projet modifiée', req.user?.id ?? null, { champs: keys });
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.delete('/admin/pm/projects/:id', requireAdmin, async (req, res, next) => {
  try {
    const row = await one(
      `update projects_pm set deleted_at=now(), status='archived' where id=$1 and deleted_at is null returning id`,
      [String(req.params.id)],
    );
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Projet introuvable.');
    res.json({ ok: true, data: { archived: true } });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------- étapes */

const stageSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).default(''),
  weight: z.number().int().min(1).max(10).default(1),
  validation_criteria: z.string().max(1000).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(['todo', 'doing', 'done']).default('todo'),
  position: z.number().int().min(0).max(999).optional(),
});

workspaceRouter.post('/admin/pm/projects/:id/stages', requireAdmin, validate(stageSchema), async (req, res, next) => {
  try {
    const s = req.body as z.infer<typeof stageSchema>;
    const max = await one<{ m: number | null }>(
      `select max(position) as m from project_stages where project_id=$1`,
      [String(req.params.id)],
    );
    const row = await one(
      `insert into project_stages(project_id,name,description,weight,validation_criteria,due_date,status,position)
       values($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [
        String(req.params.id),
        s.name,
        s.description,
        s.weight,
        s.validation_criteria ?? null,
        s.due_date ?? null,
        s.status,
        s.position ?? (Number(max?.m ?? -1) + 1),
      ],
    );
    await logActivity(String(req.params.id), 'stage.created', `Étape « ${s.name} » ajoutée`, req.user?.id ?? null);
    res.status(201).json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.patch(
  '/admin/pm/stages/:id',
  requireAdmin,
  validate(stageSchema.partial()),
  async (req, res, next) => {
    try {
      const s = req.body as Partial<z.infer<typeof stageSchema>>;
      const keys = Object.keys(s);
      if (!keys.length) throw new AppError(422, 'VALIDATION', 'Aucun champ à modifier.');
      const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const completed = s.status === 'done' ? ', completed_at = now()' : s.status ? ', completed_at = null' : '';
      const row = await one<{ id: string; project_id: string; name: string; status: string }>(
        `update project_stages set ${sets}${completed} where id=$1 returning id, project_id, name, status`,
        [String(req.params.id), ...keys.map((k) => (s as Record<string, unknown>)[k])],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Étape introuvable.');
      await logActivity(row.project_id, 'stage.updated', `Étape « ${row.name} » : ${row.status}`, req.user?.id ?? null);
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.delete('/admin/pm/stages/:id', requireAdmin, async (req, res, next) => {
  try {
    await one(`delete from project_stages where id=$1`, [String(req.params.id)]);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------------- tâches */

const taskSchema = z.object({
  project_id: z.string().uuid(),
  stage_id: z.string().uuid().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  title: z.string().min(2).max(200),
  description: z.string().max(8000).default(''),
  status: z.enum(['todo', 'doing', 'review', 'blocked', 'done']).default('todo'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assignee_id: z.string().uuid().nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  estimate_minutes: z.number().int().min(0).max(100000).nullable().optional(),
  position: z.number().int().min(0).max(99999).optional(),
  checklist: z.array(z.object({ label: z.string().max(200), done: z.boolean() })).max(50).default([]),
});

workspaceRouter.get('/admin/pm/tasks', requireAdmin, async (req, res, next) => {
  try {
    const projectId = typeof req.query.project === 'string' ? req.query.project : null;
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const rows = await all(
      `select t.*, p.name as project_name, p.reference, s.name as stage_name,
              (select count(*) from task_comments c where c.task_id=t.id)::int as comments,
              (select count(*) from task_dependencies d where d.task_id=t.id)::int as deps
         from tasks t
         join projects_pm p on p.id = t.project_id
         left join project_stages s on s.id = t.stage_id
        where t.deleted_at is null
          and ($1::uuid is null or t.project_id = $1)
          and ($2::text is null or t.status = $2)
        order by t.position, t.due_date nulls last, t.created_at
        limit 400`,
      [projectId, status],
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post('/admin/pm/tasks', requireAdmin, validate(taskSchema), async (req, res, next) => {
  try {
    const t = req.body as z.infer<typeof taskSchema>;
    const row = await one<{ id: string; title: string; status: string }>(
      `insert into tasks(project_id,stage_id,parent_id,title,description,status,priority,assignee_id,
          start_date,due_date,estimate_minutes,position,checklist,completed_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
              coalesce($12, (select coalesce(max(position),0)+1 from tasks where project_id=$1)),
              $13::jsonb, case when $6='done' then now() else null end)
       returning id, title, status`,
      [
        t.project_id,
        t.stage_id ?? null,
        t.parent_id ?? null,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.assignee_id ?? null,
        t.start_date ?? null,
        t.due_date ?? null,
        t.estimate_minutes ?? null,
        t.position ?? null,
        JSON.stringify(t.checklist),
      ],
    );
    await logActivity(t.project_id, 'task.created', `Tâche « ${t.title} » créée`, req.user?.id ?? null);
    res.status(201).json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.patch(
  '/admin/pm/tasks/:id',
  requireAdmin,
  validate(taskSchema.partial().omit({ project_id: true })),
  async (req, res, next) => {
    try {
      const t = req.body as Partial<z.infer<typeof taskSchema>>;
      const keys = Object.keys(t);
      if (!keys.length) throw new AppError(422, 'VALIDATION', 'Aucun champ à modifier.');
      const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const completed =
        t.status === 'done' ? ', completed_at = now()' : t.status ? ', completed_at = null' : '';
      const row = await one<{ id: string; project_id: string; title: string; status: string }>(
        `update tasks set ${sets}${completed}, updated_at=now() where id=$1 and deleted_at is null
         returning id, project_id, title, status`,
        [String(req.params.id), ...keys.map((k) => (t as Record<string, unknown>)[k])],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Tâche introuvable.');

      if (t.status) {
        await logActivity(row.project_id, 'task.status', `« ${row.title} » → ${row.status}`, req.user?.id ?? null, {
          task_id: row.id,
        });
      }
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.delete('/admin/pm/tasks/:id', requireAdmin, async (req, res, next) => {
  try {
    const row = await one<{ project_id: string; title: string }>(
      `update tasks set deleted_at=now() where id=$1 and deleted_at is null returning project_id, title`,
      [String(req.params.id)],
    );
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Tâche introuvable.');
    await logActivity(row.project_id, 'task.deleted', `Tâche « ${row.title} » supprimée`, req.user?.id ?? null);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

/** Dépendances : refuse les cycles simples (A→B→A). */
workspaceRouter.post(
  '/admin/pm/tasks/:id/dependencies',
  requireAdmin,
  validate(z.object({ depends_on_id: z.string().uuid() })),
  async (req, res, next) => {
    try {
      const { depends_on_id } = req.body as { depends_on_id: string };
      if (depends_on_id === String(req.params.id)) throw new AppError(422, 'VALIDATION', 'Une tâche ne peut pas dépendre d’elle-même.');
      const back = await one(
        `select 1 from task_dependencies where task_id=$1 and depends_on_id=$2`,
        [depends_on_id, String(req.params.id)],
      );
      if (back) throw new AppError(409, 'CYCLE', 'Dépendance circulaire refusée.');
      await one(
        `insert into task_dependencies(task_id, depends_on_id) values($1,$2)
         on conflict do nothing`,
        [String(req.params.id), depends_on_id],
      );
      res.status(201).json({ ok: true, data: { task_id: String(req.params.id), depends_on_id } });
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.delete('/admin/pm/tasks/:id/dependencies/:dep', requireAdmin, async (req, res, next) => {
  try {
    await one(`delete from task_dependencies where task_id=$1 and depends_on_id=$2`, [
      String(req.params.id),
      String(req.params.dep),
    ]);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.get('/admin/pm/tasks/:id/comments', requireAdmin, async (req, res, next) => {
  try {
    const rows = await all(
      `select c.*, u.full_name as author from task_comments c
         left join users u on u.id = c.author_id
        where c.task_id=$1 order by c.created_at`,
      [String(req.params.id)],
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post(
  '/admin/pm/tasks/:id/comments',
  requireAdmin,
  validate(z.object({ body: z.string().min(1).max(4000) })),
  async (req, res, next) => {
    try {
      const { body } = req.body as { body: string };
      const row = await one(
        `insert into task_comments(task_id, author_id, body) values($1,$2,$3) returning *`,
        [String(req.params.id), req.user?.id ?? null, body],
      );
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

/* ------------------------------------------------- documents / notes / temps */

workspaceRouter.post(
  '/admin/pm/projects/:id/documents',
  requireAdmin,
  validate(
    z.object({
      name: z.string().min(1).max(200),
      url: z.string().url().max(1000),
      kind: z.enum(['link', 'file', 'spec', 'design', 'delivery']).default('link'),
      is_shared: z.boolean().default(false),
      notes: z.string().max(1000).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const d = req.body as { name: string; url: string; kind: string; is_shared: boolean; notes?: string };
      const row = await one(
        `insert into project_documents(project_id,name,url,kind,is_shared,notes)
         values($1,$2,$3,$4,$5,$6) returning *`,
        [String(req.params.id), d.name, d.url, d.kind, d.is_shared, d.notes ?? null],
      );
      await logActivity(String(req.params.id), 'document.added', `Document « ${d.name} » ajouté`, req.user?.id ?? null);
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.delete('/admin/pm/documents/:id', requireAdmin, async (req, res, next) => {
  try {
    await one(`delete from project_documents where id=$1`, [String(req.params.id)]);
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post(
  '/admin/pm/projects/:id/notes',
  requireAdmin,
  validate(
    z.object({
      kind: z.enum(['note', 'journal', 'decision', 'meeting', 'issue']).default('note'),
      title: z.string().min(2).max(200),
      body: z.string().max(12000).default(''),
    }),
  ),
  async (req, res, next) => {
    try {
      const n = req.body as { kind: string; title: string; body: string };
      const row = await one(
        `insert into project_notes(project_id,kind,title,body,author_id) values($1,$2,$3,$4,$5) returning *`,
        [String(req.params.id), n.kind, n.title, n.body, req.user?.id ?? null],
      );
      await logActivity(String(req.params.id), 'note.added', `${n.kind} : « ${n.title} »`, req.user?.id ?? null);
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

/* Chronomètre : une seule session ouverte par utilisateur (index unique partiel). */
workspaceRouter.get('/admin/pm/time/running', requireAdmin, async (req, res, next) => {
  try {
    const row = await one(
      `select e.*, p.name as project_name, t.title as task_title
         from time_entries e
         join projects_pm p on p.id = e.project_id
         left join tasks t on t.id = e.task_id
        where e.actor_id=$1 and e.ended_at is null`,
      [req.user?.id],
    );
    res.json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post(
  '/admin/pm/time/start',
  requireAdmin,
  validate(z.object({ project_id: z.string().uuid(), task_id: z.string().uuid().nullable().optional(), note: z.string().max(500).optional() })),
  async (req, res, next) => {
    try {
      const b = req.body as { project_id: string; task_id?: string | null; note?: string };
      const running = await one(`select id from time_entries where actor_id=$1 and ended_at is null`, [req.user?.id]);
      if (running) throw new AppError(409, 'ALREADY_RUNNING', 'Un chronomètre est déjà en cours.');
      const row = await one(
        `insert into time_entries(project_id,task_id,actor_id,note) values($1,$2,$3,$4) returning *`,
        [b.project_id, b.task_id ?? null, req.user?.id ?? null, b.note ?? null],
      );
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.post('/admin/pm/time/stop', requireAdmin, async (req, res, next) => {
  try {
    const row = await one<{ id: string; project_id: string; minutes: number }>(
      `update time_entries
          set ended_at = now(),
              minutes = greatest(1, round(extract(epoch from (now() - started_at)) / 60)::int)
        where actor_id=$1 and ended_at is null
        returning id, project_id, minutes`,
      [req.user?.id],
    );
    if (!row) throw new AppError(409, 'NOT_RUNNING', 'Aucun chronomètre en cours.');
    await logActivity(row.project_id, 'time.logged', `${row.minutes} min enregistrées`, req.user?.id ?? null);
    res.json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post(
  '/admin/pm/time/manual',
  requireAdmin,
  validate(
    z.object({
      project_id: z.string().uuid(),
      task_id: z.string().uuid().nullable().optional(),
      minutes: z.number().int().min(1).max(1440),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      note: z.string().max(500).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const b = req.body as { project_id: string; task_id?: string | null; minutes: number; date?: string; note?: string };
      const row = await one(
        `insert into time_entries(project_id,task_id,actor_id,started_at,ended_at,minutes,note)
         values($1,$2,$3, coalesce($4::date, current_date)::timestamptz - ($5 || ' minutes')::interval,
                coalesce($4::date, current_date)::timestamptz, $5::int, $6)
         returning *`,
        [b.project_id, b.task_id ?? null, req.user?.id ?? null, b.date ?? null, String(b.minutes), b.note ?? null],
      );
      await logActivity(b.project_id, 'time.logged', `${b.minutes} min saisies manuellement`, req.user?.id ?? null);
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

workspaceRouter.get('/admin/pm/time/report', requireAdmin, async (req, res, next) => {
  try {
    const [byProject, byTask, byDay] = await Promise.all([
      all(
        `select p.id, p.name, p.reference, coalesce(sum(e.minutes),0)::int as minutes
           from time_entries e join projects_pm p on p.id=e.project_id
          where e.ended_at is not null
            and e.started_at > now() - interval '30 days'
          group by p.id, p.name, p.reference order by minutes desc`,
      ),
      all(
        `select t.id, t.title, p.name as project_name, coalesce(sum(e.minutes),0)::int as minutes
           from time_entries e join tasks t on t.id=e.task_id join projects_pm p on p.id=e.project_id
          where e.ended_at is not null and e.started_at > now() - interval '30 days'
          group by t.id, t.title, p.name order by minutes desc limit 15`,
      ),
      all(
        `select to_char(started_at,'YYYY-MM-DD') as jour, sum(minutes)::int as minutes
           from time_entries where ended_at is not null and started_at > now() - interval '14 days'
          group by 1 order by 1`,
      ),
    ]);
    res.json({ ok: true, data: { byProject, byTask, byDay } });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------------- modèles (IA) */

workspaceRouter.get('/admin/pm/templates', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all(`select * from project_templates order by created_at`);
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post(
  '/admin/pm/templates',
  requireAdmin,
  validate(
    z.object({
      name: z.string().min(2).max(120),
      description: z.string().max(1000).optional(),
      category: z.string().max(40).optional(),
      stages: z
        .array(z.object({ name: z.string().min(2).max(120), description: z.string().max(600).optional(), weight: z.number().int().min(1).max(10).optional() }))
        .min(1)
        .max(30),
    }),
  ),
  async (req, res, next) => {
    try {
      const t = req.body as { name: string; description?: string; category?: string; stages: unknown[] };
      const row = await one(
        `insert into project_templates(name,description,category,stages) values($1,$2,$3,$4::jsonb)
         on conflict (name) do update set description=excluded.description, stages=excluded.stages
         returning *`,
        [t.name, t.description ?? null, t.category ?? null, JSON.stringify(t.stages)],
      );
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

/* ------------------------------------------------- assistant IA (projet) */

workspaceRouter.post('/admin/pm/projects/:id/ai/summary', requireAdmin, async (req, res, next) => {
  try {
    const p = await one<{ name: string; reference: string; description: string; status: string; due_date: string | null }>(
      `select name, reference, description, status, due_date from projects_pm where id=$1 and deleted_at is null`,
      [String(req.params.id)],
    );
    if (!p) throw new AppError(404, 'NOT_FOUND', 'Projet introuvable.');

    const tasks = await all<{ title: string; status: string; due_date: string | null }>(
      `select title, status, due_date from tasks where project_id=$1 and deleted_at is null`,
      [String(req.params.id)],
    );
    const late = tasks.filter((t) => t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date());

    const input = [
      `Projet ${p.reference} — ${p.name} (statut ${p.status}, échéance ${p.due_date ?? 'non définie'}).`,
      p.description ? `Description : ${p.description}` : '',
      `Tâches : ${tasks.length} au total, ${tasks.filter((t) => t.status === 'done').length} terminées, ${late.length} en retard.`,
      tasks.length ? `Détail : ${tasks.slice(0, 40).map((t) => `${t.title} [${t.status}]`).join('; ')}` : 'Aucune tâche enregistrée.',
    ]
      .filter(Boolean)
      .join('\n');

    const result = await runTask('summarize', input, { actorId: req.user?.id ?? null });
    res.json({ ok: true, data: { text: result.text, model: result.model, stubbed: result.stubbed, late: late.length } });
  } catch (err) {
    next(err);
  }
});

workspaceRouter.post(
  '/admin/pm/projects/:id/ai/plan',
  requireAdmin,
  validate(z.object({ brief: z.string().min(20).max(8000) })),
  async (req, res, next) => {
    try {
      const { brief } = req.body as { brief: string };
      const result = await runTask('project_plan', brief, { actorId: req.user?.id ?? null });
      res.json({ ok: true, data: { text: result.text, model: result.model, stubbed: result.stubbed } });
    } catch (err) {
      next(err);
    }
  },
);
