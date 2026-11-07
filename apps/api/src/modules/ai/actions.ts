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
    sensitive: true,
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
  project_create: {
    label: 'Créer un projet',
    schema: z.object({
      name: z.string().min(2).max(160),
      description: z.string().max(4000).default(''),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      budget_amount: z.number().min(0).max(100_000_000).nullable().optional(),
      budget_currency: z.enum(['USD', 'CDF']).default('USD'),
    }),
    describe: (p: Record<string, unknown>) => `Créer le projet « ${p.name} »`,
  },
  milestone_create: {
    label: 'Créer un jalon',
    schema: z.object({
      project_id: z.string().uuid(),
      title: z.string().min(2).max(160),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    describe: (p: Record<string, unknown>) => `Créer le jalon « ${p.title} »`,
  },
  lead_reply_email: {
    label: 'Répondre à une demande par email',
    schema: z.object({
      lead_id: z.string().uuid(),
      subject: z.string().min(2).max(180),
      body: z.string().min(10).max(6000),
    }),
    describe: (p: Record<string, unknown>) => `Répondre à la demande ${String(p.lead_id).slice(0, 8).toUpperCase()}`,
    sensitive: true,
  },
  lead_set_status: {
    label: 'Changer le statut d’une demande',
    schema: z.object({
      lead_id: z.string().uuid(),
      status: z.enum(['new', 'contacted', 'quoted', 'won', 'lost']),
    }),
    describe: (p: Record<string, unknown>) => `Passer la demande en « ${p.status} »`,
  },
  lead_note: {
    label: 'Ajouter une note interne à une demande',
    schema: z.object({
      lead_id: z.string().uuid(),
      note: z.string().min(2).max(2000),
    }),
    describe: () => 'Ajouter une note interne à la demande',
  },
  booking_set_status: {
    label: 'Changer le statut d’une réservation',
    schema: z.object({
      booking_id: z.string().uuid(),
      status: z.enum(['pending', 'confirmed', 'cancelled', 'done']),
    }),
    describe: (p: Record<string, unknown>) => `Passer la réservation en « ${p.status} »`,
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

/** ---------------------------------------------------------------- outils de lecture
 * Requêtes SELECT figées, paramétrées, bornées. Le modèle choisit un nom et des
 * paramètres validés ; il n'écrit jamais de SQL. Aucune de ces lectures ne modifie
 * la base et elles n'exigent pas de confirmation.
 */
export const READ_TOOLS = {
  read_stats: {
    label: 'Compteurs du studio',
    schema: z.object({}),
    run: async () =>
      one(
        `select
           (select count(*) from leads where status='new')::int as nouvelles_demandes,
           (select count(*) from bookings where status='pending')::int as reservations_en_attente,
           (select count(*) from projects_pm where deleted_at is null and status in ('planning','active'))::int as projets_actifs,
           (select count(*) from tasks where deleted_at is null and status <> 'done')::int as taches_ouvertes,
           (select count(*) from tasks where deleted_at is null and status <> 'done' and due_date < current_date)::int as taches_en_retard,
           (select count(*) from subscribers where status='confirmed')::int as abonnes_confirmes`,
      ),
  },
  read_projects: {
    label: 'Lister les projets',
    schema: z.object({
      statut: z.enum(['planning', 'active', 'paused', 'blocked', 'done', 'archived', 'tous']).default('tous'),
      limite: z.number().int().min(1).max(30).default(12),
    }),
    run: async (p: Record<string, unknown>) =>
      all(
        `select code, name, status, priority, due_date, budget_amount, budget_currency
           from projects_pm
          where deleted_at is null
            and ($1 = 'tous' or status = $1)
          order by created_at desc
          limit $2`,
        [String(p.statut ?? 'tous'), Number(p.limite ?? 12)],
      ),
  },
  read_tasks: {
    label: 'Lister les tâches',
    schema: z.object({
      statut: z.enum(['todo', 'doing', 'review', 'blocked', 'done', 'ouvertes']).default('ouvertes'),
      projet: z.string().max(40).optional(),
      limite: z.number().int().min(1).max(40).default(20),
    }),
    run: async (p: Record<string, unknown>) =>
      all(
        `select t.title, t.status, t.priority, t.due_date, p.name as projet
           from tasks t
           left join projects_pm p on p.id = t.project_id
          where t.deleted_at is null
            and ($1 = 'ouvertes' or t.status = $1)
            and ($2::text is null or p.code ilike $2 or p.name ilike '%' || $2 || '%')
          order by t.due_date nulls last, t.created_at desc
          limit $3`,
        [String(p.statut ?? 'ouvertes'), p.projet ? String(p.projet) : null, Number(p.limite ?? 20)],
      ),
  },
  read_leads: {
    label: 'Lister les demandes',
    schema: z.object({
      statut: z.enum(['new', 'contacted', 'quoted', 'won', 'lost', 'tous']).default('tous'),
      limite: z.number().int().min(1).max(30).default(12),
    }),
    run: async (p: Record<string, unknown>) =>
      all(
        `select id, kind, contact_name, contact_email, status, created_at,
                left(message, 240) as message
           from leads
          where ($1 = 'tous' or status = $1)
          order by created_at desc
          limit $2`,
        [String(p.statut ?? 'tous'), Number(p.limite ?? 12)],
      ),
  },
  read_bookings: {
    label: 'Lister les réservations',
    schema: z.object({
      limite: z.number().int().min(1).max(30).default(10),
    }),
    run: async (p: Record<string, unknown>) =>
      all(
        `select reference, contact_name, contact_email, shoot_date, status, formula
           from bookings
          order by shoot_date desc
          limit $1`,
        [Number(p.limite ?? 10)],
      ),
  },
  read_services: {
    label: 'Lister le catalogue',
    schema: z.object({}),
    run: async () =>
      all(
        `select s.title, s.price_note, s.duration_label, c.name as categorie
           from services s
           left join service_categories c on c.id = s.category_id
          where s.is_published
          order by c.position nulls last, s.position nulls last`,
      ),
  },
} as const;

export type ReadToolName = keyof typeof READ_TOOLS;

export function isReadToolName(v: string): v is ReadToolName {
  return Object.prototype.hasOwnProperty.call(READ_TOOLS, v);
}

/** Exécute un outil de lecture. Toute erreur de validation est transformée en message clair. */
export async function runReadTool(name: string, params: unknown): Promise<{ label: string; rows: unknown }> {
  if (!isReadToolName(name)) throw new AppError(422, 'UNKNOWN_TOOL', `Outil inconnu : ${name}`);
  const spec = READ_TOOLS[name];
  const parsed = spec.schema.safeParse(params ?? {});
  if (!parsed.success) {
    throw new AppError(422, 'INVALID_PARAMS', `Paramètres invalides pour ${name}.`);
  }
  const rows = await spec.run(parsed.data as Record<string, unknown>);
  return { label: spec.label, rows };
}

/** Catalogue lisible pour le prompt système : noms, paramètres, usage. */
export function readToolsForPrompt(): string {
  return Object.entries(READ_TOOLS)
    .map(([name, spec]) => {
      const shape = Object.keys((spec.schema as unknown as { shape?: Record<string, unknown> }).shape ?? {});
      return `- ${name}${shape.length ? ` (${shape.join(', ')})` : ' (aucun paramètre)'} : ${spec.label}`;
    })
    .join('\n');
}

export type ActionName = keyof typeof ACTION_SPECS;

export function isActionName(v: string): v is ActionName {
  return Object.prototype.hasOwnProperty.call(ACTION_SPECS, v);
}

/**
 * Extrait une proposition d'action de la réponse du modèle.
 * Balayage à accolades équilibrées plutôt qu'une expression régulière : les objets
 * imbriqués (params) cassaient la version regex, et le modèle écrit tantôt
 * ```action, tantôt ```json, tantôt sans bloc de code.
 */
export function extractAction(text: string): { name: string; params: Record<string, unknown> } | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;

    // recherche de la fin de l'objet par équilibrage des accolades
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (escaped) { escaped = false; continue; }
      if (c === String.fromCharCode(92)) { escaped = true; continue; }
      if (c === String.fromCharCode(34)) { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') depth += 1;
      if (c === '}') {
        depth -= 1;
        if (depth === 0) { end = j; break; }
      }
    }
    if (end === -1) return null;

    const candidate = text.slice(i, end + 1);
    if (!candidate.includes('"action"')) { i = end; continue; }

    try {
      const parsed = JSON.parse(candidate) as { action?: string; params?: Record<string, unknown> };
      if (parsed.action && isActionName(parsed.action)) {
        return { name: parsed.action, params: parsed.params ?? {} };
      }
    } catch {
      /* pas un JSON valide : on continue le balayage */
    }
    i = end;
  }
  return null;
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

    case 'project_create': {
      const p = params as {
        name: string;
        description: string;
        priority: string;
        due_date?: string | null;
        budget_amount?: number | null;
        budget_currency: string;
      };
      // référence PRJ-AAAA-NNN : on repart du plus grand numéro de l'année (jamais un comptage,
      // qui collide après une suppression)
      const year = new Date().getFullYear();
      const last = await one<{ max: string | null }>(
        `select max(reference) as max from projects_pm where reference like 'PRJ-' || $1 || '-%'`,
        [String(year)],
      );
      const nextNum = Number(String(last?.max ?? '').split('-')[2] ?? 0) + 1;
      const reference = `PRJ-${year}-${String(nextNum).padStart(3, '0')}`;

      const row = await one<{ id: string; reference: string }>(
        `insert into projects_pm(reference, name, description, status, priority, due_date,
             budget_amount, budget_currency, owner_id)
         values($1,$2,$3,'planning',$4,$5,$6,$7,$8)
         returning id, reference`,
        [
          reference,
          p.name,
          p.description,
          p.priority,
          p.due_date ?? null,
          p.budget_amount ?? null,
          p.budget_currency,
          actorId,
        ],
      );
      if (!row) throw new AppError(500, 'INTERNAL', 'Création du projet impossible.');
      await auditAction('project_create', { project_id: row.id, name: p.name }, actorId, null);
      return { summary: `Projet ${row.reference} créé : ${p.name}`, link: '/admin/projets' };
    }
    case 'milestone_create': {
      const p = params as { project_id: string; title: string; due_date: string };
      const row = await one<{ id: string }>(
        `insert into milestones(project_id, name, due_date) values($1,$2,$3) returning id`,
        [p.project_id, p.title, p.due_date],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Projet introuvable.');
      await auditAction('milestone_create', { project_id: p.project_id, title: p.title }, actorId, null);
      return { summary: `Jalon « ${p.title} » créé`, link: `/admin/projets/${p.project_id}` };
    }
    case 'lead_reply_email': {
      const p = params as { lead_id: string; subject: string; body: string };
      const lead = await one<{ id: string; contact_email: string; contact_name: string; status: string }>(
        `select id, contact_email, contact_name, status from leads where id=$1`,
        [p.lead_id],
      );
      if (!lead) throw new AppError(404, 'NOT_FOUND', 'Demande introuvable.');
      const reference = lead.id.slice(0, 8).toUpperCase();
      const sent = await sendEmail({
        to: lead.contact_email,
        subject: p.subject,
        html: emailLayout({
          title: p.subject,
          body: p.body.split('\n').map((l) => (l.trim() ? `<p>${l}</p>` : '<br/>')).join(''),
          ctaLabel: 'Répondre à 5DEV',
          ctaUrl: 'mailto:mio.appservice@gmail.com',
        }),
        text: p.body,
        context: 'lead_reply',
      });
      await one(
        `update leads set status = case when status='new' then 'contacted' else status end,
                          admin_note = coalesce(admin_note,'') ||
                          case when coalesce(admin_note,'')='' then '' else E'\n' end ||
                          'Réponse envoyée le ' || to_char(now(),'DD/MM/YYYY HH24:MI')
          where id=$1`,
        [lead.id],
      );
      await auditAction('lead_reply_email', { lead_id: lead.id, email: lead.contact_email }, actorId, null);
      return {
        summary: `Réponse envoyée à ${lead.contact_name} (${lead.contact_email}) — réf. ${reference}${
          sent?.providerId ? '' : ' (à vérifier dans /admin/emails)'
        }`,
        link: '/admin/demandes',
      };
    }
    case 'lead_set_status': {
      const p = params as { lead_id: string; status: string };
      const row = await one<{ id: string }>(`update leads set status=$2 where id=$1 returning id`, [p.lead_id, p.status]);
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Demande introuvable.');
      await auditAction('lead_set_status', { lead_id: p.lead_id, status: p.status }, actorId, null);
      return { summary: `Demande passée en « ${p.status} »`, link: '/admin/demandes' };
    }
    case 'lead_note': {
      const p = params as { lead_id: string; note: string };
      const row = await one<{ id: string }>(
        `update leads set admin_note = trim(both E'\n' from
            coalesce(admin_note || E'\n', '') || $2)
          where id=$1 returning id`,
        [p.lead_id, p.note],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Demande introuvable.');
      await auditAction('lead_note', { lead_id: p.lead_id }, actorId, null);
      return { summary: 'Note interne ajoutée à la demande', link: '/admin/demandes' };
    }
    case 'booking_set_status': {
      const p = params as { booking_id: string; status: string };
      const row = await one<{ id: string; reference: string }>(
        `update bookings set status=$2 where id=$1 returning id, reference`,
        [p.booking_id, p.status],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Réservation introuvable.');
      await auditAction('booking_set_status', { booking_id: p.booking_id, status: p.status }, actorId, null);
      return { summary: `Réservation ${row.reference} passée en « ${p.status} »`, link: '/admin/reservations' };
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
