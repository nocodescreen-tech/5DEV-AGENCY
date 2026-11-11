import { z } from 'zod';
import { all, one } from '../../db/index.js';
import { AppError } from '../../middlewares/errors.js';
import { sendEmail, emailLayout } from '../../lib/email.js';
import { upsertClient } from '../workspace.js';
import { readSecret } from '../../lib/secrets.js';

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
      // modèle d'étapes à appliquer ('site vitrine', 'e-commerce', 'interne'…) : les étapes
      // viennent de project_templates, jamais codées en dur.
      template: z.string().max(80).optional(),
      // lot initial de tâches : un projet créé par l'assistant doit être utilisable tout de suite,
      // pas une coquille vide qu'il faut remplir à la main.
      tasks: z
        .array(
          z.object({
            title: z.string().min(2).max(200),
            priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
            due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
            stage: z.string().max(80).optional(),
          }),
        )
        .max(24)
        .default([]),
      milestones: z
        .array(
          z.object({
            title: z.string().min(2).max(160),
            due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          }),
        )
        .max(12)
        .default([]),
      // nom du client : sans lui la fiche affiche « projet interne »
      client_name: z.string().max(160).optional(),
      // coordonnées : reprises de la fiche client si elle existe déjà
      client_email: z.string().email().max(180).optional(),
      client_phone: z.string().max(40).optional(),
      client_address: z.string().max(300).optional(),
      // brief rédigé : posé en note de projet pour que l'onglet Notes ne soit pas vide
      note: z.string().max(8000).optional(),
    }),
    describe: (p: Record<string, unknown>) => {
      const nbTasks = Array.isArray(p.tasks) ? p.tasks.length : 0;
      const nbJalons = Array.isArray(p.milestones) ? p.milestones.length : 0;
      const extra = [
        p.template ? `modèle « ${String(p.template)} »` : '',
        nbTasks ? `${nbTasks} tâche${nbTasks > 1 ? 's' : ''}` : '',
        nbJalons ? `${nbJalons} jalon${nbJalons > 1 ? 's' : ''}` : '',
      ].filter(Boolean);
      return `Créer le projet « ${p.name} »${extra.length ? ` avec ${extra.join(', ')}` : ''}`;
    },
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
  automation_create: {
    label: 'Créer une automatisation',
    schema: z.object({
      name: z.string().min(2).max(120),
      // déclencheur : un nouveau message dans « demandes » ou « réservations »
      trigger: z.enum(['lead.created', 'booking.created']),
      reply_subject: z.string().min(2).max(180).optional(),
      reply_body: z.string().min(5).max(4000).optional(),
      notify_admin: z.boolean().default(true),
      is_active: z.boolean().default(true),
    }),
    describe: (p: Record<string, unknown>) => {
      const quoi = p.trigger === 'booking.created' ? 'une nouvelle réservation' : 'une nouvelle demande';
      const parts = [
        p.notify_admin ? 'notification interne' : '',
        p.reply_subject ? `réponse automatique « ${String(p.reply_subject)} »` : '',
      ].filter(Boolean);
      return `Créer l’automatisation « ${p.name} » sur ${quoi}${parts.length ? ` (${parts.join(' + ')})` : ''}`;
    },
  },
  /* ---- CRUD des autres modules. Le PROJET est le seul sans suppression. ---- */
  client_create: {
    label: 'Créer une fiche client',
    schema: z.object({
      name: z.string().min(2).max(160),
      company: z.string().max(160).optional(),
      email: z.string().email().max(180).optional(),
      phone: z.string().max(40).optional(),
      address: z.string().max(300).optional(),
      city: z.string().max(120).optional(),
    }),
    describe: (p: Record<string, unknown>) => `Créer la fiche client « ${p.name} »`,
  },
  client_update: {
    label: 'Modifier une fiche client',
    schema: z.object({
      client_id: z.string().uuid(),
      name: z.string().min(2).max(160).optional(),
      company: z.string().max(160).nullable().optional(),
      email: z.string().email().max(180).nullable().optional(),
      phone: z.string().max(40).nullable().optional(),
      address: z.string().max(300).nullable().optional(),
      city: z.string().max(120).nullable().optional(),
    }),
    describe: (p: Record<string, unknown>) => `Mettre à jour la fiche client ${String(p.client_id).slice(0, 8)}`,
  },
  client_delete: {
    label: 'Supprimer une fiche client',
    schema: z.object({ client_id: z.string().uuid() }),
    describe: () => 'Supprimer la fiche client (refusé si des projets y sont rattachés)',
    sensitive: true,
  },
  service_create: {
    label: 'Créer un service au catalogue',
    schema: z.object({
      title: z.string().min(2).max(120),
      summary: z.string().max(400).default(''),
      description: z.string().max(6000).default(''),
      price_from_usd: z.number().nonnegative().nullable().optional(),
      price_note: z.string().max(200).nullable().optional(),
      duration_label: z.string().max(80).nullable().optional(),
      is_published: z.boolean().default(true),
    }),
    describe: (p: Record<string, unknown>) => `Créer le service « ${p.title} »`,
  },
  service_update: {
    label: 'Modifier un service',
    schema: z.object({
      service_id: z.string().uuid(),
      title: z.string().min(2).max(120).optional(),
      summary: z.string().max(400).optional(),
      description: z.string().max(6000).optional(),
      price_from_usd: z.number().nonnegative().nullable().optional(),
      price_note: z.string().max(200).nullable().optional(),
      duration_label: z.string().max(80).nullable().optional(),
      is_published: z.boolean().optional(),
    }),
    describe: (p: Record<string, unknown>) => `Modifier le service ${String(p.service_id).slice(0, 8)}`,
  },
  service_delete: {
    label: 'Supprimer un service',
    schema: z.object({ service_id: z.string().uuid() }),
    describe: () => 'Retirer le service du catalogue',
    sensitive: true,
  },
  realization_create: {
    label: 'Créer une réalisation',
    schema: z.object({
      title: z.string().min(2).max(140),
      client_name: z.string().max(140).optional(),
      year: z.number().int().min(2000).max(2100).optional(),
      summary: z.string().max(400).default(''),
      body: z.string().max(12000).default(''),
      is_published: z.boolean().default(false),
    }),
    describe: (p: Record<string, unknown>) => `Créer la réalisation « ${p.title} »`,
  },
  realization_update: {
    label: 'Modifier une réalisation',
    schema: z.object({
      realization_id: z.string().uuid(),
      title: z.string().min(2).max(140).optional(),
      client_name: z.string().max(140).nullable().optional(),
      year: z.number().int().min(2000).max(2100).nullable().optional(),
      summary: z.string().max(400).optional(),
      body: z.string().max(12000).optional(),
      is_published: z.boolean().optional(),
    }),
    describe: (p: Record<string, unknown>) => `Modifier la réalisation ${String(p.realization_id).slice(0, 8)}`,
  },
  realization_delete: {
    label: 'Supprimer une réalisation',
    schema: z.object({ realization_id: z.string().uuid() }),
    describe: () => 'Retirer la réalisation du site',
    sensitive: true,
  },
  task_update: {
    label: 'Modifier une tâche',
    schema: z.object({
      task_id: z.string().uuid(),
      title: z.string().min(2).max(200).optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      description: z.string().max(8000).optional(),
    }),
    describe: (p: Record<string, unknown>) => `Modifier la tâche ${String(p.task_id).slice(0, 8)}`,
  },
  milestone_update: {
    label: 'Modifier un jalon',
    schema: z.object({
      milestone_id: z.string().uuid(),
      name: z.string().min(2).max(160).optional(),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    }),
    describe: () => 'Modifier le jalon',
  },
  milestone_delete: {
    label: 'Supprimer un jalon',
    schema: z.object({ milestone_id: z.string().uuid() }),
    describe: () => 'Supprimer le jalon',
    sensitive: true,
  },
  note_delete: {
    label: 'Supprimer une note de projet',
    schema: z.object({ note_id: z.string().uuid() }),
    describe: () => 'Supprimer la note',
    sensitive: true,
  },
  automation_toggle: {
    label: 'Activer ou suspendre une automatisation',
    schema: z.object({ automation_id: z.string().uuid(), is_active: z.boolean() }),
    describe: (p: Record<string, unknown>) =>
      `${p.is_active ? 'Activer' : 'Suspendre'} l’automatisation ${String(p.automation_id).slice(0, 8)}`,
  },
  automation_delete: {
    label: 'Supprimer une automatisation',
    schema: z.object({ automation_id: z.string().uuid() }),
    describe: () => 'Supprimer la règle et son historique',
    sensitive: true,
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
    github_create_issue: {
      label: 'Créer une issue GitHub',
      schema: z.object({
        owner: z.string().min(1).max(100),
        repo: z.string().min(1).max(100),
        title: z.string().min(2).max(200),
        body: z.string().max(10000).optional(),
        labels: z.array(z.string().max(50)).max(10).optional(),
        assignees: z.array(z.string().max(100)).max(5).optional(),
      }),
      describe: (p: Record<string, unknown>) => `Créer l'issue « ${p.title} » dans ${p.owner}/${p.repo}`,
      sensitive: true,
    },
    github_comment_issue: {
      label: 'Commenter une issue GitHub',
      schema: z.object({
        owner: z.string().min(1).max(100),
        repo: z.string().min(1).max(100),
        issue_number: z.number().int().positive(),
        body: z.string().min(1).max(10000),
      }),
      describe: (p: Record<string, unknown>) => `Commenter l'issue #${p.issue_number} dans ${p.owner}/${p.repo}`,
      sensitive: true,
    },
    github_close_issue: {
      label: 'Fermer/rouvrir une issue GitHub',
      schema: z.object({
        owner: z.string().min(1).max(100),
        repo: z.string().min(1).max(100),
        issue_number: z.number().int().positive(),
        state: z.enum(['open', 'closed']),
      }),
      describe: (p: Record<string, unknown>) => `${p.state === 'closed' ? 'Fermer' : 'Rouvrir'} l'issue #${p.issue_number} dans ${p.owner}/${p.repo}`,
      sensitive: true,
    },
    github_trigger_workflow: {
      label: 'Déclencher un workflow GitHub Actions',
      schema: z.object({
        owner: z.string().min(1).max(100),
        repo: z.string().min(1).max(100),
        workflow_id: z.string().min(1).max(100),
        ref: z.string().max(100).default('main'),
        inputs: z.record(z.string()).optional(),
      }),
      describe: (p: Record<string, unknown>) => `Déclencher le workflow ${p.workflow_id} sur ${p.owner}/${p.repo} (${p.ref})`,
      sensitive: true,
    },
    github_create_pr: {
      label: 'Créer une Pull Request GitHub',
      schema: z.object({
        owner: z.string().min(1).max(100),
        repo: z.string().min(1).max(100),
        title: z.string().min(2).max(200),
        head: z.string().min(1).max(100),
        base: z.string().min(1).max(100).default('main'),
        body: z.string().max(10000).optional(),
        draft: z.boolean().default(false),
      }),
      describe: (p: Record<string, unknown>) => `Créer la PR « ${p.title} » (${p.head} → ${p.base}) dans ${p.owner}/${p.repo}`,
      sensitive: true,
    },
    github_merge_pr: {
      label: 'Merger une Pull Request GitHub',
      schema: z.object({
        owner: z.string().min(1).max(100),
        repo: z.string().min(1).max(100),
        pr_number: z.number().int().positive(),
        merge_method: z.enum(['merge', 'squash', 'rebase']).default('squash'),
      }),
      describe: (p: Record<string, unknown>) => `Merger la PR #${p.pr_number} dans ${p.owner}/${p.repo} (${p.merge_method})`,
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
      statut: z.string().default('tous'),
      limite: z.coerce.number().int().min(1).max(30).default(12),
    }),
    run: async (p: Record<string, unknown>) =>
      all(
        `select id, reference, name, status, priority, due_date, budget_amount, budget_currency
           from projects_pm
          where deleted_at is null
            and ($1 = 'tous' or status = $1)
          order by created_at desc
          limit $2`,
        [toStatus(p.statut, PROJECT_STATUS, 'tous'), Number(p.limite ?? 12)],
      ),
  },
  read_tasks: {
    label: 'Lister les tâches',
    schema: z.object({
      statut: z.string().default('ouvertes'),
      projet: z.string().max(80).optional(),
      limite: z.coerce.number().int().min(1).max(40).default(20),
    }),
    run: async (p: Record<string, unknown>) =>
      all(
        `select t.id, t.title, t.status, t.priority, t.due_date, p.reference as projet_ref, p.name as projet
           from tasks t
           left join projects_pm p on p.id = t.project_id
          where t.deleted_at is null
            and ($1 = 'ouvertes' or t.status = $1)
            and ($2::text is null or p.reference ilike $2 or p.name ilike '%' || $2 || '%')
          order by t.due_date nulls last, t.created_at desc
          limit $3`,
        [toStatus(p.statut, TASK_STATUS, 'ouvertes'), p.projet ? String(p.projet) : null, Number(p.limite ?? 20)],
      ),
  },
  read_leads: {
    label: 'Lister les demandes (statut, ancienneté en heures)',
    schema: z.object({
      statut: z.string().default('tous'),
      limite: z.coerce.number().int().min(1).max(30).default(12),
      /** ne garder que les demandes créées il y a plus de N heures */
      plus_vieux_que_heures: z.coerce.number().int().min(0).max(8760).optional(),
    }),
    run: async (p: Record<string, unknown>) => {
      const statut = toStatus(p.statut, LEAD_STATUS, 'tous');
      const limite = toInt(p.limite, 12, 1, 30);
      const ageMin =
        p.plus_vieux_que_heures === undefined || p.plus_vieux_que_heures === null || p.plus_vieux_que_heures === ''
          ? null
          : toInt(p.plus_vieux_que_heures, 0, 0, 8760);

      return all(
        `select id, kind, contact_name, contact_email, status, created_at,
                round(extract(epoch from now() - created_at) / 3600)::int as age_heures,
                left(message, 240) as message
           from leads
          where ($1 = 'tous' or status = $1)
            and ($2::int is null or created_at < now() - ($2::int || ' hours')::interval)
          order by created_at asc
          limit $3`,
        [statut, ageMin, limite],
      );
    },
  },
  read_bookings: {
    label: 'Lister les réservations',
    schema: z.object({
      limite: z.coerce.number().int().min(1).max(30).default(10),
    }),
    run: async (p: Record<string, unknown>) =>
      all(
        `select id, reference, contact_name, contact_email, shoot_date, status, formula
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
          `select s.id, s.slug, s.title, s.is_published, s.price_note, s.duration_label, c.name as categorie
             from services s
             left join service_categories c on c.id = s.category_id
            where s.is_published
            order by c.position nulls last, s.position nulls last`,
        ),
    },
    github_read_repos: {
      label: 'Lister les repos GitHub',
      schema: z.object({
        owner: z.string().min(1).max(100).optional(),
        per_page: z.number().int().min(1).max(50).default(20),
      }),
      run: async (p: Record<string, unknown>) => {
        const token = await readSecret('github_token');
        if (!token) throw new AppError(409, 'NO_TOKEN', 'Token GitHub non configuré.');
        const owner = p.owner ? `/users/${p.owner}` : '/user';
        const res = await fetch(`https://api.github.com${owner}/repos?sort=pushed&per_page=${Number(p.per_page ?? 20)}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        });
        if (!res.ok) throw new AppError(res.status, 'GITHUB_API', 'Impossible de lister les repos');
        return res.json();
      },
    },
    github_read_issues: {
      label: 'Lister les issues GitHub',
      schema: z.object({
        owner: z.string().min(1).max(100),
        repo: z.string().min(1).max(100),
        state: z.enum(['open', 'closed', 'all']).default('open'),
        per_page: z.number().int().min(1).max(50).default(20),
      }),
      run: async (p: Record<string, unknown>) => {
        const token = await readSecret('github_token');
        if (!token) throw new AppError(409, 'NO_TOKEN', 'Token GitHub non configuré.');
        const res = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/issues?state=${p.state}&per_page=${Number(p.per_page ?? 20)}&sort=updated`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        });
        if (!res.ok) throw new AppError(res.status, 'GITHUB_API', 'Impossible de lister les issues');
        return res.json();
      },
    },
    github_read_prs: {
      label: 'Lister les Pull Requests GitHub',
      schema: z.object({
        owner: z.string().min(1).max(100),
        repo: z.string().min(1).max(100),
        state: z.enum(['open', 'closed', 'all']).default('open'),
        per_page: z.number().int().min(1).max(50).default(20),
      }),
      run: async (p: Record<string, unknown>) => {
        const token = await readSecret('github_token');
        if (!token) throw new AppError(409, 'NO_TOKEN', 'Token GitHub non configuré.');
        const res = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/pulls?state=${p.state}&per_page=${Number(p.per_page ?? 20)}&sort=updated`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        });
        if (!res.ok) throw new AppError(res.status, 'GITHUB_API', 'Impossible de lister les PRs');
        return res.json();
      },
    },
    github_read_workflows: {
      label: 'Lister les workflows GitHub Actions',
      schema: z.object({
        owner: z.string().min(1).max(100),
        repo: z.string().min(1).max(100),
      }),
      run: async (p: Record<string, unknown>) => {
        const token = await readSecret('github_token');
        if (!token) throw new AppError(409, 'NO_TOKEN', 'Token GitHub non configuré.');
        const res = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/actions/workflows`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        });
        if (!res.ok) throw new AppError(res.status, 'GITHUB_API', 'Impossible de lister les workflows');
        return res.json();
      },
    },
    github_read_runs: {
      label: 'Lister les runs de workflows',
      schema: z.object({
        owner: z.string().min(1).max(100),
        repo: z.string().min(1).max(100),
        workflow_id: z.string().optional(),
        per_page: z.number().int().min(1).max(50).default(20),
      }),
      run: async (p: Record<string, unknown>) => {
        const token = await readSecret('github_token');
        if (!token) throw new AppError(409, 'NO_TOKEN', 'Token GitHub non configuré.');
        const workflow = p.workflow_id ? `/${p.workflow_id}/runs` : '/runs';
        const res = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/actions${workflow}?per_page=${Number(p.per_page ?? 20)}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        });
        if (!res.ok) throw new AppError(res.status, 'GITHUB_API', 'Impossible de lister les runs');
        return res.json();
      },
    },
  } as const;

export type ReadToolName = keyof typeof READ_TOOLS;

export function isReadToolName(v: string): v is ReadToolName {
  return Object.prototype.hasOwnProperty.call(READ_TOOLS, v);
}

/** Exécute un outil de lecture. Toute erreur de validation est transformée en message clair. */
/* --------------------------------------------------- tolérance des paramètres
 * Le modèle écrit rarement les valeurs exactes attendues : « en attente »,
 * « nouvelle », un nombre en chaîne, ou une clé oubliée. Rejeter la requête
 * entière pour cela rendait les outils de lecture inutilisables (vécu :
 * « read_leads renvoie systématiquement paramètres invalides »). On normalise
 * donc, et une valeur inconnue retombe sur le filtre neutre au lieu d'annuler.
 */

/** Nombre accepté en number ou en chaîne ("12"), avec repli. */
function toInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Traduit un statut écrit en français ou en anglais vers la valeur stockée. */
function toStatus(value: unknown, map: Record<string, string>, fallback: string): string {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (Object.prototype.hasOwnProperty.call(map, raw)) return map[raw] as string;
  // valeur déjà correcte ?
  return Object.values(map).includes(raw) ? raw : fallback;
}

const LEAD_STATUS: Record<string, string> = {
  tous: 'tous',
  all: 'tous',
  nouvelle: 'new',
  nouvelles: 'new',
  new: 'new',
  'en attente': 'new',
  attente: 'new',
  'en cours': 'in_progress',
  in_progress: 'in_progress',
  contacte: 'in_progress',
  contactee: 'in_progress',
  contacted: 'in_progress',
  devis: 'quoted',
  'devis envoye': 'quoted',
  quoted: 'quoted',
  gagnee: 'won',
  gagne: 'won',
  won: 'won',
  perdue: 'lost',
  perdu: 'lost',
  lost: 'lost',
};

const PROJECT_STATUS: Record<string, string> = {
  tous: 'tous',
  all: 'tous',
  planification: 'planning',
  planning: 'planning',
  'en cours': 'active',
  active: 'active',
  'en pause': 'paused',
  paused: 'paused',
  bloque: 'blocked',
  bloquee: 'blocked',
  blocked: 'blocked',
  termine: 'done',
  terminee: 'done',
  done: 'done',
  archive: 'archived',
  archivee: 'archived',
  archived: 'archived',
};

const TASK_STATUS: Record<string, string> = {
  ouvertes: 'ouvertes',
  ouvertes_seulement: 'ouvertes',
  open: 'ouvertes',
  a_faire: 'todo',
  todo: 'todo',
  'en cours': 'doing',
  doing: 'doing',
  revue: 'review',
  review: 'review',
  bloque: 'blocked',
  bloquee: 'blocked',
  blocked: 'blocked',
  terminee: 'done',
  termine: 'done',
  done: 'done',
  toutes: 'ouvertes',
};

export async function runReadTool(name: string, params: unknown): Promise<{ label: string; rows: unknown }> {
  if (!isReadToolName(name)) throw new AppError(422, 'UNKNOWN_TOOL', `Outil inconnu : ${name}`);
  const spec = READ_TOOLS[name];
  const parsed = spec.schema.safeParse(params ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const champ = issue?.path.join('.') || 'paramètres';
    throw new AppError(
      422,
      'INVALID_PARAMS',
      `Paramètre refusé pour ${name} : « ${champ} » — ${issue?.message ?? 'valeur invalide'}.`,
    );
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

/**
 * Catalogue des actions que le modèle peut PROPOSER (jamais exécuter seul).
 * Sans cette liste dans le prompt, le modèle répond « je n'ai pas d'outil pour créer
 * un projet » alors que l'action existe — c'est le bug corrigé ici.
 */
export function actionsForPrompt(): string {
  return Object.entries(ACTION_SPECS)
    .map(([name, spec]) => {
      const shape = Object.keys((spec.schema as unknown as { shape?: Record<string, unknown> }).shape ?? {});
      return `- ${name}${shape.length ? ` (${shape.join(', ')})` : ' (aucun paramètre)'} : ${spec.label}`;
    })
    .join('\n');
}

type EditableTable = 'clients' | 'services' | 'projects' | 'tasks' | 'milestones' | 'automations';

/** Met a jour une ligne en ne gardant que les champs reellement fournis par le modele. */
async function patchRow(table: EditableTable, id: string, fields: Record<string, unknown>) {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (!entries.length) throw new AppError(422, 'VALIDATION', 'Aucun champ a modifier.');
  const touch = table === 'milestones' ? '' : ', updated_at=now()';
  const sets = entries.map(([k], i) => `${k}=$${i + 2}`).join(', ');
  const row = await one(`update ${table} set ${sets}${touch} where id=$1 returning id`, [
    id,
    ...entries.map(([, v]) => v),
  ]);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Element introuvable.');
  return row;
}

/** Slug lisible a partir d'un titre (accents retires sans dependance). */
function slugify(input: string): string {
  // chaque caractere non ASCII est decompose (accents) ; tout ce qui n'est pas
  // alphanumerique devient un tiret, puis les tirets multiples sont compresses
  const plat = input
    .toLowerCase()
    .normalize('NFD')
    .split('')
    .map((c) => (/[a-z0-9]/.test(c) ? c : '-'))
    .join('');
  const slug = plat.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
  return slug || `element-${Date.now()}`;
}

/** Slug unique : services et projects (realisations) ont une contrainte unique. */
async function uniqueSlug(table: 'services' | 'projects', base: string): Promise<string> {
  let slug = base;
  for (let i = 0; i < 30; i++) {
    const hit = await one(`select id from ${table} where slug=$1`, [slug]);
    if (!hit) return slug;
    slug = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now()}`;
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
 * Réparation d'un bloc d'action COUPÉ par la limite de tokens. Le modèle produit
 * parfois un JSON correct mais tronqué en plein milieu : la version stricte le rejette
 * et l'utilisateur voit « je n'ai pas d'outil » alors que l'action était bien proposée.
 * On referme les accolades/crochets manquants, puis on raccourcit au dernier élément
 * complet jusqu'à obtenir un JSON valide.
 */
export function extractActionLoose(text: string): { name: string; params: Record<string, unknown> } | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let body = text.slice(start).replace(/```[\s\S]*$/, '');
  if (!body.includes('"action"')) return null;

  const scan = (s: string) => {
    const stack: string[] = [];
    let inString = false;
    let escaped = false;
    let lastSeparator = -1;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (escaped) { escaped = false; continue; }
      if (c === String.fromCharCode(92)) { escaped = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') stack.push('}');
      else if (c === '[') stack.push(']');
      else if ((c === '}' || c === ']') && stack.length) stack.pop();
      if (c === ',' || c === '}' || c === ']') lastSeparator = i;
    }
    return { closers: stack.reverse().join(''), inString, lastSeparator };
  };

  for (let attempt = 0; attempt < 60 && body.length > 0; attempt++) {
    const { closers, inString, lastSeparator } = scan(body);
    const candidate = body + (inString ? '"' : '') + closers;
    try {
      const parsed = JSON.parse(candidate) as { action?: string; params?: Record<string, unknown> };
      if (parsed.action && isActionName(parsed.action)) {
        return { name: parsed.action, params: parsed.params ?? {} };
      }
      return null;
    } catch {
      /* on raccourcit au dernier séparateur hors chaîne */
    }
    if (lastSeparator <= 0) return null;
    body = body.slice(0, lastSeparator);
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
  normale: 'normal', moyenne: 'normal', moyen: 'normal', normal: 'normal',
  haute: 'high', élevée: 'high', elevee: 'high', high: 'high',
  urgente: 'urgent', urgent: 'urgent', critique: 'urgent',
};
const PRIORITY_VALUES = ['low', 'normal', 'high', 'urgent'];
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
    // synonyme inconnu (« moyenne », « très haute »…) : on ne rejette pas toute l'action,
    // on retombe sur la priorité par défaut du schéma.
    if (!PRIORITY_VALUES.includes(String(out.priority))) out.priority = 'normal';
  }
  if ('status' in out) {
    const mapped = STATUS_MAP[norm(out.status)];
    if (mapped) out.status = mapped;
  }
  if (name === 'automation_create' && 'trigger' in out) {
    const t = norm(out.trigger);
    // « réservation / réservations » arrive accentué : on teste les deux orthographes
    if (t.includes('resa') || t.includes('résa') || t.includes('réserv') || t.includes('booking') || t.includes('rendez')) {
      out.trigger = 'booking.created';
    } else if (t.includes('demande') || t.includes('lead')) out.trigger = 'lead.created';
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
  // lot initial de tâches / jalons : mêmes valeurs françaises, un niveau plus bas
  if (name === 'project_create') {
    const isoDate = (v: unknown): unknown => {
      if (typeof v !== 'string' || !v.includes('/')) return v;
      const parts = v.split('/');
      return parts.length === 3 && (parts[0]?.length ?? 0) === 2
        ? `${parts[2]}-${parts[1]}-${parts[0]}`
        : v;
    };
    if (Array.isArray(out.tasks)) {
      out.tasks = out.tasks.map((t) => {
        if (!t || typeof t !== 'object') return t;
        const task = { ...(t as Record<string, unknown>) };
        const mapped = PRIORITY_MAP[norm(task.priority)];
        if (mapped) task.priority = mapped;
        if (task.priority !== undefined && !PRIORITY_VALUES.includes(String(task.priority))) {
          task.priority = 'normal';
        }
        task.due_date = isoDate(task.due_date);
        return task;
      });
    }
    if (Array.isArray(out.milestones)) {
      out.milestones = out.milestones.map((m) => {
        if (!m || typeof m !== 'object') return m;
        const milestone = { ...(m as Record<string, unknown>) };
        milestone.due_date = isoDate(milestone.due_date);
        return milestone;
      });
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
        template?: string;
        client_name?: string;
        client_email?: string;
        client_phone?: string;
        client_address?: string;
        note?: string;
        tasks?: { title: string; priority: string; due_date?: string | null; stage?: string }[];
        milestones?: { title: string; due_date: string }[];
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

      // modèle d'étapes : recherche par nom, jamais d'étape inventée côté code
      const template = p.template?.trim()
        ? await one<{
            id: string;
            category: string | null;
            stages: { name: string; description?: string; weight?: number }[];
          }>(
            `select id, category, stages from project_templates
              where is_active and name ilike '%' || $1 || '%'
              order by length(name) limit 1`,
            [p.template.trim()],
          )
        : null;

      // client : même fiche que dans le Workspace, pour que le projet suivant d'un client
      // retrouve ses coordonnées sans les ressaisir
      const client = p.client_name
        ? await upsertClient({
            name: p.client_name,
            email: p.client_email,
            phone: p.client_phone,
            address: p.client_address,
          })
        : null;

      const row = await one<{ id: string; reference: string }>(
        `insert into projects_pm(reference, name, description, category, client_name, client_id,
             client_email, client_phone, client_address,
             status, priority, due_date, budget_amount, budget_currency, owner_id, template_id)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,'planning',$10,$11,$12,$13,$14,$15)
         returning id, reference`,
        [
          reference,
          p.name,
          p.description,
          template?.category ?? null,
          p.client_name?.trim() || null,
          client?.id ?? null,
          p.client_email?.trim() || client?.email || null,
          p.client_phone?.trim() || client?.phone || null,
          p.client_address?.trim() || client?.address || null,
          p.priority,
          p.due_date ?? null,
          p.budget_amount ?? null,
          p.budget_currency,
          actorId,
          template?.id ?? null,
        ],
      );
      if (!row) throw new AppError(500, 'INTERNAL', 'Création du projet impossible.');

      // étapes issues du modèle (aucune étape codée en dur)
      const stages: { id: string; name: string }[] = [];
      for (const [i, stage] of (template?.stages ?? []).entries()) {
        const created = await one<{ id: string; name: string }>(
          `insert into project_stages(project_id,name,description,position,weight)
           values($1,$2,$3,$4,$5) returning id, name`,
          [row.id, stage.name, stage.description ?? '', i, Math.min(10, Math.max(1, stage.weight ?? 1))],
        );
        if (created) stages.push(created);
      }

      // tâches initiales : rattachées à l'étape nommée si elle existe, sinon réparties
      // sur les étapes (sinon tout atterrit dans la première et le Kanban est faux)
      let tasksCreated = 0;
      for (const [i, task] of (p.tasks ?? []).entries()) {
        const wanted = task.stage?.trim().toLowerCase();
        const stage =
          (wanted ? stages.find((s) => s.name.toLowerCase().includes(wanted)) : undefined) ??
          (stages.length ? stages[i % stages.length] : undefined);
        await one(
          `insert into tasks(project_id,stage_id,title,priority,due_date,status,position)
           values($1,$2,$3,$4,$5,'todo',$6)`,
          [row.id, stage?.id ?? null, task.title, task.priority, task.due_date ?? null, i],
        );
        tasksCreated += 1;
      }

      let milestonesCreated = 0;
      for (const milestone of p.milestones ?? []) {
        await one(`insert into milestones(project_id,name,due_date) values($1,$2,$3)`, [
          row.id,
          milestone.title,
          milestone.due_date,
        ]);
        milestonesCreated += 1;
      }

      // brief du projet dans l'onglet Notes (jamais une note vide)
      const noteBody = p.note?.trim() || p.description?.trim();
      if (noteBody) {
        await one(
          `insert into project_notes(project_id, kind, title, body, author_id)
           values($1,'note','Brief du projet',$2,$3)`,
          [row.id, noteBody, actorId],
        );
      }

      await one(
        `insert into project_activities(project_id, kind, label, meta, actor_id)
         values($1,'project.created',$2,$3::jsonb,$4)`,
        [
          row.id,
          `Projet « ${p.name} » créé par l’assistant`,
          JSON.stringify({ source: 'ai', stages: stages.length, tasks: tasksCreated, milestones: milestonesCreated }),
          actorId,
        ],
      );

      await auditAction('project_create', { project_id: row.id, name: p.name }, actorId, null);
      const details = [
        stages.length ? `${stages.length} étape${stages.length > 1 ? 's' : ''}` : '',
        tasksCreated ? `${tasksCreated} tâche${tasksCreated > 1 ? 's' : ''}` : '',
        milestonesCreated ? `${milestonesCreated} jalon${milestonesCreated > 1 ? 's' : ''}` : '',
      ].filter(Boolean);
      return {
        summary: `Projet ${row.reference} créé : ${p.name}${details.length ? ` — ${details.join(', ')}` : ''}`,
        link: `/admin/projets/${row.id}`,
      };
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
    case 'automation_create': {
      const p = params as {
        name: string;
        trigger: 'lead.created' | 'booking.created';
        reply_subject?: string;
        reply_body?: string;
        notify_admin: boolean;
        is_active: boolean;
      };
      // même forme que l'écran /admin/automatisations : déclencheur + liste d'actions
      const actions: Record<string, unknown>[] = [];
      if (p.notify_admin) {
        actions.push({
          type: 'notify_admin',
          title: `Nouvelle ${p.trigger === 'booking.created' ? 'réservation' : 'demande'} — ${p.name}`,
          body: 'Un message vient d’arriver. Ouvrez la liste pour répondre.',
        });
      }
      if (p.reply_subject && p.reply_body) {
        actions.push({ type: 'email_client', subject: p.reply_subject, body: p.reply_body });
      }
      if (!actions.length) {
        throw new AppError(422, 'VALIDATION', 'Aucune action : activez la notification ou rédigez une réponse.');
      }
      const row = await one<{ id: string; name: string }>(
        `insert into automations(name, trigger, conditions, actions, is_active)
         values($1,$2,'[]'::jsonb,$3::jsonb,$4) returning id, name`,
        [p.name, p.trigger, JSON.stringify(actions), p.is_active],
      );
      if (!row) throw new AppError(500, 'INTERNAL', 'Création de l’automatisation impossible.');
      await auditAction('automation_create', { automation_id: row.id, trigger: p.trigger }, actorId, null);
      return {
        summary: `Automatisation « ${row.name} » créée sur ${p.trigger === 'booking.created' ? 'réservation' : 'demande'} (${actions.length} action${actions.length > 1 ? 's' : ''}).`,
        link: '/admin/automatisations',
      };
    }

    case 'client_create': {
      const p = params as {
        name: string; company?: string; email?: string; phone?: string; address?: string; city?: string;
      };
      await one(
        `insert into clients(name, company, email, phone, address, city)
         values($1,$2,$3,$4,$5,$6)
         on conflict (lower(name)) do update set
           company = coalesce(excluded.company, clients.company),
           email   = coalesce(excluded.email, clients.email),
           phone   = coalesce(excluded.phone, clients.phone),
           address = coalesce(excluded.address, clients.address),
           city    = coalesce(excluded.city, clients.city),
           updated_at = now()`,
        [
          p.name.trim(),
          p.company?.trim() || null,
          p.email?.trim() || null,
          p.phone?.trim() || null,
          p.address?.trim() || null,
          p.city?.trim() || null,
        ],
      );
      return { summary: `Fiche client « ${p.name} » enregistree.`, link: '/admin/clients' };
    }

    case 'client_update': {
      const champs = params as Record<string, unknown>;
      const { client_id: clientId, ...rest } = champs;
      await patchRow('clients', String(clientId), rest);
      if (typeof rest.name === 'string') {
        await one(
          `update projects_pm set client_name=$2, updated_at=now()
            where client_id=$1 and deleted_at is null`,
          [clientId, rest.name],
        );
      }
      return { summary: 'Fiche client mise a jour.', link: '/admin/clients' };
    }

    case 'client_delete': {
      const { client_id: clientId } = params as { client_id: string };
      const linked = await one<{ n: number }>(
        `select count(*)::int as n from projects_pm where client_id=$1 and deleted_at is null`,
        [clientId],
      );
      if (Number(linked?.n ?? 0) > 0) {
        throw new AppError(409, 'CLIENT_LINKED', `Ce client a ${linked?.n} projet(s) : detachez-les d'abord.`);
      }
      const row = await one(`delete from clients where id=$1 returning id`, [clientId]);
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Client introuvable.');
      return { summary: 'Fiche client supprimee.', link: '/admin/clients' };
    }

    case 'service_create': {
      const p = params as {
        title: string; summary: string; description: string;
        price_from_usd?: number | null; price_note?: string | null;
        duration_label?: string | null; is_published: boolean;
      };
      const slug = await uniqueSlug('services', slugify(p.title));
      await one(
        `insert into services(slug,title,summary,description,price_from_usd,price_note,duration_label,is_published)
         values($1,$2,$3,$4,$5,$6,$7,$8)`,
        [slug, p.title, p.summary, p.description, p.price_from_usd ?? null, p.price_note ?? null, p.duration_label ?? null, p.is_published],
      );
      return { summary: `Service « ${p.title} » cree (${slug}).`, link: '/admin/services' };
    }

    case 'service_update': {
      const { service_id: serviceId, ...rest } = params as Record<string, unknown>;
      await patchRow('services', String(serviceId), rest);
      return { summary: 'Service mis a jour.', link: '/admin/services' };
    }

    case 'service_delete': {
      const { service_id: serviceId } = params as { service_id: string };
      const row = await one(`delete from services where id=$1 returning title`, [serviceId]);
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Service introuvable.');
      return { summary: 'Service retire du catalogue.', link: '/admin/services' };
    }

    case 'realization_create': {
      const p = params as {
        title: string; client_name?: string; year?: number;
        summary: string; body: string; is_published: boolean;
      };
      const slug = await uniqueSlug('projects', slugify(p.title));
      await one(
        `insert into projects(slug,title,client_name,year,summary,body,is_published)
         values($1,$2,$3,$4,$5,$6,$7)`,
        [slug, p.title, p.client_name ?? null, p.year ?? null, p.summary, p.body, p.is_published],
      );
      return {
        summary: `Realisation « ${p.title} » creee${p.is_published ? '' : ' (brouillon)'}.`,
        link: '/admin/realisations',
      };
    }

    case 'realization_update': {
      const { realization_id: realizationId, ...rest } = params as Record<string, unknown>;
      await patchRow('projects', String(realizationId), rest);
      return { summary: 'Realisation mise a jour.', link: '/admin/realisations' };
    }

    case 'realization_delete': {
      const { realization_id: realizationId } = params as { realization_id: string };
      const row = await one(`delete from projects where id=$1 returning title`, [realizationId]);
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Realisation introuvable.');
      return { summary: 'Realisation retiree du site.', link: '/admin/realisations' };
    }

    case 'task_update': {
      const { task_id: taskId, ...rest } = params as Record<string, unknown>;
      await patchRow('tasks', String(taskId), rest);
      return { summary: 'Tache mise a jour.', link: '/admin/taches' };
    }

    case 'milestone_update': {
      const { milestone_id: milestoneId, ...rest } = params as Record<string, unknown>;
      await patchRow('milestones', String(milestoneId), rest);
      return { summary: 'Jalon mis a jour.', link: '/admin/planning' };
    }

    case 'milestone_delete': {
      const { milestone_id: milestoneId } = params as { milestone_id: string };
      const row = await one<{ project_id: string }>(
        `delete from milestones where id=$1 returning project_id`,
        [milestoneId],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Jalon introuvable.');
      return { summary: 'Jalon supprime.', link: `/admin/projets/${row.project_id}` };
    }

    case 'note_delete': {
      const { note_id: noteId } = params as { note_id: string };
      const row = await one(`delete from project_notes where id=$1 returning id`, [noteId]);
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Note introuvable.');
      return { summary: 'Note supprimee.' };
    }

    case 'automation_toggle': {
      const p = params as { automation_id: string; is_active: boolean };
      const row = await one<{ name: string }>(
        `update automations set is_active=$2 where id=$1 returning name`,
        [p.automation_id, p.is_active],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Automatisation introuvable.');
      return {
        summary: `Automatisation « ${row.name} » ${p.is_active ? 'activee' : 'suspendue'}.`,
        link: '/admin/automatisations',
      };
    }

    case 'automation_delete': {
      const { automation_id: automationId } = params as { automation_id: string };
      const row = await one(`delete from automations where id=$1 returning name`, [automationId]);
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Automatisation introuvable.');
      return { summary: 'Automatisation supprimee.', link: '/admin/automatisations' };
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

        case 'github_create_issue': {
          const p = params as { owner: string; repo: string; title: string; body?: string; labels?: string[]; assignees?: string[] };
          const token = await readSecret('github_token');
          if (!token) throw new AppError(409, 'NO_TOKEN', 'Token GitHub non configuré.');
          const res = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/issues`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
            body: JSON.stringify({ title: p.title, body: p.body ?? '', labels: p.labels ?? [], assignees: p.assignees ?? [] }),
          });
          if (!res.ok) { const err = await res.json().catch(() => ({})) as { message?: string }; throw new AppError(res.status, 'GITHUB_API', err.message || 'Échec création issue'); }
                    const issue = await res.json() as { number: number; title: string; html_url: string };
          return { summary: `Issue #${issue.number} créée : ${issue.title}`, link: issue.html_url };
        }

        case 'github_comment_issue': {
          const p = params as { owner: string; repo: string; issue_number: number; body: string };
          const token = await readSecret('github_token');
          if (!token) throw new AppError(409, 'NO_TOKEN', 'Token GitHub non configuré.');
          const res = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/issues/${p.issue_number}/comments`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
            body: JSON.stringify({ body: p.body }),
          });
          if (!res.ok) { const err = await res.json().catch(() => ({})) as { message?: string }; throw new AppError(res.status, 'GITHUB_API', err.message || 'Échec commentaire'); }
                    const comment = await res.json() as { html_url: string };
          return { summary: `Commentaire ajouté à l'issue #${p.issue_number}`, link: comment.html_url };
        }

        case 'github_close_issue': {
          const p = params as { owner: string; repo: string; issue_number: number; state: 'open' | 'closed' };
          const token = await readSecret('github_token');
          if (!token) throw new AppError(409, 'NO_TOKEN', 'Token GitHub non configuré.');
          const res = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/issues/${p.issue_number}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
            body: JSON.stringify({ state: p.state }),
          });
          if (!res.ok) { const err = await res.json().catch(() => ({})) as { message?: string }; throw new AppError(res.status, 'GITHUB_API', err.message || 'Échec mise à jour'); }
                    return { summary: `Issue #${p.issue_number} ${p.state === 'closed' ? 'fermée' : 'rouverte'}`, link: `https://github.com/${p.owner}/${p.repo}/issues/${p.issue_number}` };
        }

        case 'github_trigger_workflow': {
          const p = params as { owner: string; repo: string; workflow_id: string; ref?: string; inputs?: Record<string, string> };
          const token = await readSecret('github_token');
          if (!token) throw new AppError(409, 'NO_TOKEN', 'Token GitHub non configuré.');
          const res = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/actions/workflows/${p.workflow_id}/dispatches`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
            body: JSON.stringify({ ref: p.ref ?? 'main', inputs: p.inputs ?? {} }),
          });
          if (!res.ok && res.status !== 204) { const err = await res.json().catch(() => ({})) as { message?: string }; throw new AppError(res.status, 'GITHUB_API', err.message || 'Échec déclenchement workflow'); }
                    return { summary: `Workflow ${p.workflow_id} déclenché sur ${p.owner}/${p.repo} (${p.ref ?? 'main'})`, link: `https://github.com/${p.owner}/${p.repo}/actions` };
        }

        case 'github_create_pr': {
          const p = params as { owner: string; repo: string; title: string; head: string; base?: string; body?: string; draft?: boolean };
          const token = await readSecret('github_token');
          if (!token) throw new AppError(409, 'NO_TOKEN', 'Token GitHub non configuré.');
          const res = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/pulls`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
            body: JSON.stringify({ title: p.title, head: p.head, base: p.base ?? 'main', body: p.body ?? '', draft: p.draft ?? false }),
          });
          if (!res.ok) { const err = await res.json().catch(() => ({})) as { message?: string }; throw new AppError(res.status, 'GITHUB_API', err.message || 'Échec création PR'); }
                    const pr = await res.json() as { number: number; title: string; html_url: string };
          return { summary: `PR #${pr.number} créée : ${pr.title}`, link: pr.html_url };
        }

        case 'github_merge_pr': {
          const p = params as { owner: string; repo: string; pr_number: number; merge_method: 'merge' | 'squash' | 'rebase' };
          const token = await readSecret('github_token');
          if (!token) throw new AppError(409, 'NO_TOKEN', 'Token GitHub non configuré.');
          const res = await fetch(`https://api.github.com/repos/${p.owner}/${p.repo}/pulls/${p.pr_number}/merge`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
            body: JSON.stringify({ merge_method: p.merge_method }),
          });
          if (!res.ok) { const err = await res.json().catch(() => ({})) as { message?: string }; throw new AppError(res.status, 'GITHUB_API', err.message || 'Échec merge'); }
                    return { summary: `PR #${p.pr_number} mergée (${p.merge_method})`, link: `https://github.com/${p.owner}/${p.repo}/pull/${p.pr_number}` };
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
