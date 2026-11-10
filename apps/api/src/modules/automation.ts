import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin, validate } from '../middlewares/auth.js';
import { runTask } from './ai/gateway.js';
import { sendEmail } from '../lib/email.js';
import { emailLayout } from '../lib/email.js';

/* ================================================================ moteur == */

export type Trigger = 'lead.created' | 'booking.created';

type Condition = { field: string; op: 'equals' | 'contains' | 'exists'; value?: string };

type Action =
  | { type: 'ai_classify' }
  | { type: 'notify_admin'; title: string; body?: string }
  | { type: 'email_client'; subject: string; body: string }
  | { type: 'set_lead_status'; value: string };

type Step = { action: string; status: 'ok' | 'skipped' | 'failed'; detail?: string; ms: number };

function fieldValue(payload: Record<string, unknown>, path: string): unknown {
  return payload[path];
}

function matches(conditions: Condition[], payload: Record<string, unknown>): { ok: boolean; reason?: string } {
  for (const c of conditions) {
    const raw = fieldValue(payload, c.field);
    const value = raw === null || raw === undefined ? '' : String(raw).toLowerCase();
    if (c.op === 'exists' && !value) return { ok: false, reason: `champ ${c.field} absent` };
    if (c.op === 'equals' && value !== (c.value ?? '').toLowerCase()) {
      return { ok: false, reason: `${c.field} ≠ ${c.value ?? ''}` };
    }
    if (c.op === 'contains' && !value.includes((c.value ?? '').toLowerCase())) {
      return { ok: false, reason: `${c.field} ne contient pas « ${c.value ?? ''} »` };
    }
  }
  return { ok: true };
}

async function executeAction(action: Action, payload: Record<string, unknown>): Promise<string> {
  switch (action.type) {
    case 'ai_classify': {
      const message = String(payload.message ?? payload.notes ?? '');
      const res = await runTask('classify_lead', message || JSON.stringify(payload));
      let pole = 'autre';
      let priorite = 'normale';
      try {
        const parsed = JSON.parse(res.text) as { pole?: string; priorite?: string };
        pole = parsed.pole ?? pole;
        priorite = parsed.priorite ?? priorite;
      } catch {
        /* réponse non JSON : on garde les valeurs par défaut */
      }
      await one(
        `update leads set admin_note = concat_ws(E'\n', nullif(admin_note,''), $2) where id=$1`,
        [payload.id, `[IA ${res.model}] pôle=${pole}, priorité=${priorite}`],
      ).catch(() => null);
      return `classé ${pole}/${priorite} (${res.model})`;
    }
    case 'notify_admin': {
      await one(
        `insert into notifications(user_id, kind, title, body, link)
         select id, 'automation', $1, $2, '/admin/demandes' from users where role in ('owner','admin') limit 1`,
        [action.title, action.body ?? null],
      );
      return 'notification créée';
    }
    case 'email_client': {
      const to = String(payload.contact_email ?? payload.email ?? '');
      if (!to) return 'aucune adresse client — ignoré';
      // jetons simples : un accusé de réception qui nomme le client ne s'écrit pas en dur
      const fill = (text: string) =>
        text
          .replaceAll('{{name}}', String(payload.contact_name ?? 'vous'))
          .replaceAll('{{email}}', to)
          .replaceAll('{{message}}', String(payload.message ?? ''))
          .replaceAll('{{reference}}', String(payload.reference ?? payload.id ?? ''));
      const subject = fill(action.subject);
      const body = fill(action.body);
      const res = await sendEmail({
        to,
        subject,
        // separateur de paragraphes : split/join, jamais un antislash-n genere par script
        html: emailLayout({ title: subject, body: `<p>${body.split(String.fromCharCode(10)).join('</p><p>')}</p>` }),
        text: body,
        context: 'automation',
      });
      if (!res.ok) throw new Error(res.error ?? 'envoi impossible');
      return `email envoyé à ${to}`;
    }
    case 'set_lead_status': {
      // un déclencheur de test n'a pas d'uuid : on ne tente pas d'écrire sur une demande
      if (!z.string().uuid().safeParse(payload.id).success) return 'déclencheur de test — écriture ignorée';
      await one(`update leads set status=$2, updated_at=now() where id=$1`, [payload.id, action.value]);
      return `statut → ${action.value}`;
    }
    default:
      return 'action inconnue';
  }
}

/**
 * Exécute les automatisations actives pour un déclencheur.
 * Garde anti-boucle : une même automatisation ne se relance pas deux fois pour
 * le même enregistrement dans la minute (protège des doubles envois).
 */
export async function runAutomations(trigger: Trigger, payload: Record<string, unknown>): Promise<void> {
  const rules = await all<{
    id: string;
    name: string;
    conditions: Condition[];
    actions: Action[];
  }>(`select id, name, conditions, actions from automations where is_active and trigger=$1`, [trigger]);

  for (const rule of rules) {
    const targetId = String(payload.id ?? '');
    if (targetId) {
      const recent = await one(
        `select id from automation_runs
          where automation_id=$1 and payload->>'id'=$2
            and created_at > now() - interval '60 seconds' limit 1`,
        [rule.id, targetId],
      );
      if (recent) continue;
    }

    const started = Date.now();
    const verdict = matches((rule.conditions ?? []) as Condition[], payload);

    if (!verdict.ok) {
      await one(
        `insert into automation_runs(automation_id, trigger, payload, status, steps, error, duration_ms)
         values($1,$2,$3::jsonb,'skipped','[]'::jsonb,$4,$5)`,
        [rule.id, trigger, JSON.stringify(payload), verdict.reason ?? 'conditions non remplies', Date.now() - started],
      );
      continue;
    }

    const steps: Step[] = [];
    let failure: string | null = null;

    for (const action of (rule.actions ?? []) as Action[]) {
      const t0 = Date.now();
      try {
        const detail = await executeAction(action, payload);
        steps.push({ action: action.type, status: detail.includes('ignoré') ? 'skipped' : 'ok', detail, ms: Date.now() - t0 });
      } catch (err) {
        const message = err instanceof Error ? err.message.slice(0, 200) : 'erreur';
        steps.push({ action: action.type, status: 'failed', detail: message, ms: Date.now() - t0 });
        failure = `${action.type}: ${message}`;
        break;
      }
    }

    await one(
      `insert into automation_runs(automation_id, trigger, payload, status, steps, error, duration_ms)
       values($1,$2,$3::jsonb,$4,$5::jsonb,$6,$7)`,
      [rule.id, trigger, JSON.stringify(payload), failure ? 'failed' : 'done', JSON.stringify(steps), failure, Date.now() - started],
    );
  }
}

/* ================================================================ routes == */

export const automationRouter: Router = Router();

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ai_classify') }),
  z.object({ type: z.literal('notify_admin'), title: z.string().min(2).max(160), body: z.string().max(500).optional() }),
  z.object({
    type: z.literal('email_client'),
    subject: z.string().min(2).max(180),
    body: z.string().min(5).max(4000),
  }),
  z.object({ type: z.literal('set_lead_status'), value: z.enum(['new', 'in_progress', 'quoted', 'won', 'lost']) }),
]);

const automationSchema = z.object({
  name: z.string().min(2).max(120),
  trigger: z.enum(['lead.created', 'booking.created']),
  conditions: z
    .array(
      z.object({
        field: z.string().min(1).max(60),
        op: z.enum(['equals', 'contains', 'exists']),
        value: z.string().max(200).optional(),
      }),
    )
    .max(10)
    .default([]),
  actions: z.array(actionSchema).min(1).max(10),
  is_active: z.boolean().default(true),
});

automationRouter.get('/admin/automations', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all(
      `select a.*,
              (select count(*) from automation_runs r where r.automation_id=a.id)::int as runs,
              (select count(*) from automation_runs r where r.automation_id=a.id and r.status='failed')::int as failures
         from automations a order by a.created_at desc`,
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

automationRouter.post(
  '/admin/automations',
  requireAdmin,
  validate(automationSchema),
  async (req, res, next) => {
    try {
      const a = req.body as z.infer<typeof automationSchema>;
      const row = await one(
        `insert into automations(name, trigger, conditions, actions, is_active)
         values($1,$2,$3::jsonb,$4::jsonb,$5) returning *`,
        [a.name, a.trigger, JSON.stringify(a.conditions), JSON.stringify(a.actions), a.is_active],
      );
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

automationRouter.patch(
  '/admin/automations/:id',
  requireAdmin,
  validate(z.object({ is_active: z.boolean().optional(), name: z.string().min(2).max(120).optional() })),
  async (req, res, next) => {
    try {
      const b = req.body as { is_active?: boolean; name?: string };
      const row = await one(
        `update automations set is_active = coalesce($2, is_active), name = coalesce($3, name),
           updated_at=now() where id=$1 returning *`,
        [req.params.id, b.is_active ?? null, b.name ?? null],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Automatisation introuvable.');
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

automationRouter.delete('/admin/automations/:id', requireAdmin, async (req, res, next) => {
  try {
    // id non-uuid = 404 propre, jamais 500 (Postgres rejetterait le cast)
    if (!z.string().uuid().safeParse(req.params.id).success) {
      throw new AppError(404, 'NOT_FOUND', 'Automatisation introuvable.');
    }
    const row = await one(`delete from automations where id=$1 returning id`, [String(req.params.id)]);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Automatisation introuvable.');
    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

automationRouter.get('/admin/automation-runs', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all(
      `select r.*, a.name as automation_name
         from automation_runs r join automations a on a.id = r.automation_id
        order by r.created_at desc limit 100`,
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/** Exécution manuelle d'un déclencheur (test réel, journalisé). */
automationRouter.post('/admin/automations/test', requireAdmin, async (req, res, next) => {
  try {
    const trigger = String(req.body?.trigger ?? 'lead.created') as Trigger;
    if (!['lead.created', 'booking.created'].includes(trigger)) {
      throw new AppError(422, 'VALIDATION', 'Déclencheur inconnu.');
    }
    const payload = {
      id: `test-${Date.now()}`,
      contact_name: 'Test Automatisation',
      contact_email: req.user?.email ?? 'admin@5dev.com',
      message: 'Bonjour, je voudrais un site web pour mon commerce, c’est urgent cette semaine.',
      ...(req.body?.payload ?? {}),
    };
    await runAutomations(trigger, payload);
    const runs = await all(
      `select r.status, r.error, r.steps, a.name from automation_runs r
         join automations a on a.id=r.automation_id
        where r.payload->>'id' = $1 order by r.created_at desc`,
      [payload.id],
    );
    res.json({ ok: true, data: { trigger, runs } });
  } catch (err) {
    next(err);
  }
});
