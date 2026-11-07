import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin, validate } from '../middlewares/auth.js';
import { emailInfo, emailLayout, sendEmail, verifySmtp } from '../lib/email.js';
import { emailStats } from '../lib/worker.js';

export const emailRouter: Router = Router();

/**
 * Console email : journal des envois réels, diagnostic du transport, test, envoi manuel.
 * Ordre des routes important : `/admin/emails/:id` est déclaré en dernier, sinon il
 * capte « transport » et « test » (bug rencontré et corrigé).
 */

emailRouter.get('/admin/emails', requireAdmin, async (_req, res, next) => {
  try {
    const [outbox, stats] = await Promise.all([
      all(
        `select id, to_email, subject, status, provider, provider_id, error, attempts, sent_at, created_at
           from email_outbox order by created_at desc limit 100`,
      ),
      emailStats(),
    ]);
    res.json({ ok: true, data: { provider: emailInfo(), outbox, stats } });
  } catch (err) {
    next(err);
  }
});

/** Diagnostic : quel transport est configuré, lequel répond réellement. */
emailRouter.get('/admin/email-transport', requireAdmin, async (_req, res, next) => {
  try {
    const info = emailInfo();
    const smtp = info.alternatives.smtp ? await verifySmtp() : { ok: false, error: 'SMTP non configuré.' };
    res.json({ ok: true, data: { ...info, smtp } });
  } catch (err) {
    next(err);
  }
});

/** Envoi de test vers l'adresse du studio (jamais vers un tiers). */
emailRouter.post('/admin/email-test', requireAdmin, async (req, res, next) => {
  try {
    const to =
      (req.body?.to as string | undefined) ??
      process.env.CONTACT_EMAIL ??
      process.env.ADMIN_EMAIL ??
      process.env.MAIL_FROM_EMAIL ??
      '';
    if (!to) throw new AppError(422, 'VALIDATION', 'Aucune adresse de test configurée.');

    const provider = emailInfo().provider;
    const result = await sendEmail({
      to,
      subject: '5DEV — test de transport email',
      html: emailLayout({
        title: 'Test de transport',
        body: `<p>Si vous lisez ce message, l’envoi fonctionne depuis 5DEV.</p><p>Fournisseur utilisé : <strong>${provider}</strong>.</p>`,
      }),
      text: `Test de transport 5DEV — fournisseur ${provider}`,
      context: 'test',
    });

    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
       values('user',$1,'email.test','email',$2,$3,$4::jsonb)`,
      [req.user?.id ?? null, result.outboxId, req.ip ?? null, JSON.stringify({ to, ok: result.ok, provider })],
    );

    res.json({
      ok: result.ok,
      data: { to, provider, providerId: result.providerId, outboxId: result.outboxId },
      error: result.ok ? undefined : { code: 'EMAIL_FAILED', message: result.error },
    });
  } catch (err) {
    next(err);
  }
});

emailRouter.post(
  '/admin/emails/send',
  requireAdmin,
  validate(z.object({ to: z.string().email(), subject: z.string().min(2).max(180), body: z.string().min(2).max(8000) })),
  async (req, res, next) => {
    try {
      const body = req.body as { to: string; subject: string; body: string };
      const result = await sendEmail({
        to: body.to,
        subject: body.subject,
        html: emailLayout({
          title: body.subject,
          body: body.body
            .split('\n')
            .map((line) => (line.trim() ? `<p>${line}</p>` : ''))
            .join(''),
        }),
        text: body.body,
        context: 'manuel',
      });

      if (!result.ok) throw new AppError(502, 'EMAIL_FAILED', result.error ?? 'Envoi impossible.');

      await one(
        `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
         values('user',$1,'email.send','email',$2,$3,$4::jsonb)`,
        [req.user?.id ?? null, result.outboxId, req.ip ?? null, JSON.stringify({ to: body.to })],
      );

      res.status(201).json({ ok: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Événements de livraison réels (Brevo) : demandé, livré, ouvert, erreur.
 * C'est la seule façon de savoir si un email est arrivé — un 201 à l'envoi ne
 * garantit rien quand l'expéditeur n'est pas validé.
 */
emailRouter.get('/admin/email-events', requireAdmin, async (_req, res, next) => {
  try {
    const key = process.env.BREVO_API_KEY ?? '';
    if (!key) {
      res.json({ ok: true, data: { events: [], note: 'Brevo non configuré.' } });
      return;
    }
    const r = await fetch('https://api.brevo.com/v3/smtp/statistics/events?limit=25&sort=desc', {
      headers: { 'api-key': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) {
      res.json({ ok: true, data: { events: [], note: `Brevo ${r.status}` } });
      return;
    }
    const json = (await r.json()) as { events?: unknown[] };
    res.json({ ok: true, data: { events: json.events ?? [] } });
  } catch (err) {
    next(err);
  }
});

emailRouter.get('/admin/emails/:id', requireAdmin, async (req, res, next) => {
  try {
    const row = await one(`select * from email_outbox where id=$1`, [String(req.params.id)]);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Email introuvable.');
    res.json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});
