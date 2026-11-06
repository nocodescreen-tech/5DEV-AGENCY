import { z } from 'zod';
import { all, one } from '../../db/index.js';
import { AppError } from '../../middlewares/errors.js';
import { sendEmail, emailLayout } from '../../lib/email.js';

/**
 * Actions que l'assistant peut PROPOSER. Aucune n'est exécutée par le modèle :
 * le serveur renvoie une proposition, l'utilisateur confirme, puis /execute applique.
 * Liste blanche stricte, validation zod, journalisation dans audit_logs.
 */

export const ACTION_SPECS = {
  task_create: {
    label: 'Créer une tâche',
    schema: z.object({
      project_id: z.string().uuid(),
      title: z.string().min(2).max(200),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    }),
    describe: (p: Record<string, unknown>) => `Créer la tâche « ${p.title} »`,
  },
  task_set_status: {
    label: 'Changer le statut d’une tâche',
    schema: z.object({
      task_id: z.string().uuid(),
      status: z.enum(['todo', 'doing', 'review', 'blocked', 'done']),
    }),
    describe: (p: Record<string, unknown>) => `Passer la tâche en « ${p.status} »`,
  },
  task_delete: {
    label: 'Supprimer une tâche',
    schema: z.object({ task_id: z.string().uuid() }),
    describe: () => 'Supprimer définitivement la tâche',
  },
  project_set_status: {
    label: 'Changer le statut d’un projet',
    schema: z.object({
      project_id: z.string().uuid(),
      status: z.enum(['planning', 'active', 'paused', 'blocked', 'done', 'archived']),
    }),
    describe: (p: Record<string, unknown>) => `Passer le projet en « ${p.status} »`,
  },
  note_add: {
    label: 'Ajouter une note à un projet',
    schema: z.object({
      project_id: z.string().uuid(),
      title: z.string().min(2).max(200),
      body: z.string().max(8000).default(''),
      kind: z.enum(['note', 'journal', 'decision', 'meeting', 'issue']).default('note'),
    }),
    describe: (p: Record<string, unknown>) => `Ajouter la note « ${p.title} » au projet`,
  },
  email_send: {
    label: 'Envoyer un email',
    schema: z.object({
      to: z.string().email(),
      subject: z.string().min(2).max(180),
      body: z.string().min(2).max(6000),
    }),
    describe: (p: Record<string, unknown>) => `Envoyer « ${p.subject} » à ${p.to}`,
    sensitive: true,
  },
} as const;

export type ActionName = keyof typeof ACTION_SPECS;

export function isActionName(v: string): v is ActionName {
  return Object.prototype.hasOwnProperty.call(ACTION_SPECS, v);
}

/** Extrait un bloc ```action {…} ``` de la réponse du modèle (sans l'exécuter). */
export function extractAction(text: string): { name: string; params: Record<string, unknown> } | null {
  const fenced = /```(?:json)?\s*(\{[\s\S]*?"action"[\s\S]*?\})\s*```/.exec(text);
  const inline = /\{"action"\s*:\s*"[a-z_]+"[\s\S]*?\}/.exec(text);
  const raw = fenced?.[1] ?? inline?.[0];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { action?: string; params?: Record<string, unknown> };
    if (!parsed.action || !isActionName(parsed.action)) return null;
    return { name: parsed.action, params: parsed.params ?? {} };
  } catch {
    return null;
  }
}

/**
 * Normalise les valeurs que le modèle écrit parfois en français
 * (priorité « haute », statut « terminé »…). Sans cela, une proposition
 * parfaitement compréhensible était rejetée par la validation.
 */
const PRIORITY_MAP: Record<string, string> = {
  basse: 'low', faible: 'low', low: 'low',
  normale: 'normal', moyen: 'normal', normal: 'normal',
  haute: 'high', élevée: 'high', high: 'high',
  urgente: 'urgent', urgent: 'urgent', critique: 'urgent',
};
const STATUS_MAP: Record<string, string> = {
  'à faire': 'todo', todo: 'todo', 'a faire': 'todo',
  'en cours': 'doing', en_cours: 'doing', doing: 'doing',
  'en revue': 'review', revue: 'review', review: 'review',
  bloqué: 'blocked', bloquee: 'blocked', bloquée: 'blocked', blocked: 'blocked',
  terminé: 'done', terminee: 'done', terminée: 'done', fait: 'done', done: 'done',
  planification: 'planning', planning: 'planning',
  actif: 'active', active: 'active', 'en pause': 'paused', pause: 'paused',
  archivé: 'archived', archive: 'archived', archived: 'archived',
};
const NOTE_KIND_MAP: Record<string, string> = {
  note: 'note', journal: 'journal', décision: 'decision', decision: 'decision',
  réunion: 'meeting', reunion: 'meeting', meeting: 'meeting',
  incident: 'issue', problème: 'issue', probleme: 'issue', issue: 'issue',
};

function normalize(name: string, params: Record<string, unknown>): Record<string, unknown> {
  const out = { ...params };
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

  if ('priority' in out) {
    const mapped = PRIORITY_MAP[norm(out.priority)];
    if (mapped) out.priority = mapped;
  }
  if ('status' in out) {
    const mapped = STATUS_MAP[norm(out.status)];
    if (mapped) out.status = mapped;
  }
  if (name === 'note_add' && 'kind' in out) {
    const mapped = NOTE_KIND_MAP[norm(out.kind)];
    if (mapped) out.kind = mapped;
  }
  // dates au format français jj/mm/aaaa → ISO (sans regex, pour éviter tout problème d'échappement)
  if (typeof out.due_date === 'string' && out.due_date.includes('/')) {
    const parts = out.due_date.split('/');
    if (parts.length === 3 && (parts[0]?.length ?? 0) === 2) {
      out.due_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return out;
}

/** Valide la proposition et produit un libellé lisible pour la confirmation. */
export function describeAction(name: string, params: unknown): { name: ActionName; params: Record<string, unknown>; label: string; sensitive: boolean } {
  if (!isActionName(name)) throw new AppError(422, 'UNKNOWN_ACTION', 'Action inconnue.');
  const spec = ACTION_SPECS[name];
  const parsed = spec.schema.safeParse(normalize(name, (params ?? {}) as Record<string, unknown>));
  if (!parsed.success) {
    throw new AppError(422, 'VALIDATION', `Paramètres invalides : ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  }
  return {
    name,
    params: parsed.data as Record<string, unknown>,
    label: spec.describe(parsed.data as Record<string, unknown>),
    sensitive: Boolean((spec as { sensitive?: boolean }).sensitive),
  };
}

/** Exécution réelle, après confirmation humaine. */
export async function executeAction(
  name: ActionName,
  params: Record<string, unknown>,
  actorId: string | null,
): Promise<{ summary: string; link?: string }> {
  switch (name) {
    case 'task_create': {
      const p = params as { project_id: string; title: string; due_date?: string | null; priority: string };
      const row = await one<{ id: string; project_id: string }>(
        `insert into tasks(project_id,title,priority,due_date,status)
         values($1,$2,$3,$4,'todo') returning id, project_id`,
        [p.project_id, p.title, p.priority, p.due_date ?? null],
      );
      if (!row) throw new AppError(500, 'INTERNAL', 'Création impossible.');
      await one(
        `insert into project_activities(project_id, kind, label, meta, actor_id)
         values($1,'task.created',$2,$3::jsonb,$4)`,
        [row.project_id, `Tâche « ${p.title} » créée par l’assistant`, JSON.stringify({ source: 'ai' }), actorId],
      );
      return { summary: `Tâche « ${p.title} » créée.`, link: `/admin/projets/${row.project_id}` };
    }

    case 'task_set_status': {
      const p = params as { task_id: string; status: string };
      const row = await one<{ project_id: string; title: string }>(
        `update tasks set status=$2, completed_at = case when $2='done' then now() else null end,
                updated_at=now()
          where id=$1 and deleted_at is null returning project_id, title`,
        [p.task_id, p.status],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Tâche introuvable.');
      return { summary: `« ${row.title} » → ${p.status}.`, link: `/admin/projets/${row.project_id}` };
    }

    case 'task_delete': {
      const p = params as { task_id: string };
      const row = await one<{ project_id: string; title: string }>(
        `update tasks set deleted_at=now() where id=$1 and deleted_at is null returning project_id, title`,
        [p.task_id],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Tâche introuvable.');
      await one(
        `insert into project_activities(project_id, kind, label, meta, actor_id)
         values($1,'task.deleted',$2,$3::jsonb,$4)`,
        [row.project_id, `Tâche « ${row.title} » supprimée par l’assistant`, JSON.stringify({ source: 'ai' }), actorId],
      );
      return { summary: `Tâche « ${row.title} » supprimée.` };
    }

    case 'project_set_status': {
      const p = params as { project_id: string; status: string };
      const row = await one<{ name: string }>(
        `update projects_pm set status=$2, updated_at=now() where id=$1 and deleted_at is null returning name`,
        [p.project_id, p.status],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Projet introuvable.');
      return { summary: `Projet « ${row.name} » → ${p.status}.`, link: `/admin/projets/${p.project_id}` };
    }

    case 'note_add': {
      const p = params as { project_id: string; title: string; body: string; kind: string };
      await one(
        `insert into project_notes(project_id, kind, title, body, author_id)
         values($1,$2,$3,$4,$5)`,
        [p.project_id, p.kind, p.title, p.body, actorId],
      );
      return { summary: `Note « ${p.title} » ajoutée.`, link: `/admin/projets/${p.project_id}` };
    }

    case 'email_send': {
      const p = params as { to: string; subject: string; body: string };
      const res = await sendEmail({
        to: p.to,
        subject: p.subject,
        html: emailLayout({ title: p.subject, body: `<p>${p.body.replace(/\n/g, '</p><p>')}</p>` }),
        text: p.body,
        context: 'assistant',
      });
      if (!res.ok) throw new AppError(502, 'EMAIL_FAILED', res.error ?? 'Envoi impossible.');
      return { summary: `Email envoyé à ${p.to} (${res.provider}).` };
    }

    default:
      throw new AppError(422, 'UNKNOWN_ACTION', 'Action non prise en charge.');
  }
}

/** Journal d'audit de l'action confirmée (qui, quoi, quand). */
export async function auditAction(name: string, params: Record<string, unknown>, actorId: string | null, ip: string | null) {
  await all(
    `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
     values('user',$1,$2,'ai_action',$3,$4,$5::jsonb)`,
    [actorId, `ai.${name}`, (params.task_id ?? params.project_id ?? null) as string | null, ip, JSON.stringify(params)],
  ).catch(() => null);
}
