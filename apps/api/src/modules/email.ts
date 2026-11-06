import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin, validate } from '../middlewares/auth.js';
import { emailInfo, emailLayout, sendEmail } from '../lib/email.js';
import { emailStats } from '../lib/worker.js';

export const emailRouter: Router = Router();

emailRouter.get('/admin/emails', requireAdmin, async (_req, res, next) => {
  try {
    const [outbox, stats] = await Promise.all([
      all(
        `select id, to_email, subject, status, provider, error, attempts, sent_at, created_at
           from email_outbox order by created_at desc limit 100`,
      ),
      emailStats(),
    ]);
    res.json({ ok: true, data: { provider: emailInfo(), outbox, stats } });
  } catch (err) {
    next(err);
  }
});

emailRouter.get('/admin/emails/:id', requireAdmin, async (req, res, next) => {
  try {
    const row = await one(`select * from email_outbox where id=$1`, [req.params.id]);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Email introuvable.');
    res.json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});

const sendSchema = z.object({
  to: z.string().email().max(180),
  subject: z.string().min(2).max(180),
  body: z.string().min(5).max(20_000),
  title: z.string().max(160).optional(),
});

/** Envoi réel d'un email (journalisé dans email_outbox). */
emailRouter.post('/admin/emails/send', requireAdmin, validate(sendSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof sendSchema>;
    if (!emailInfo().ready) {
      throw new AppError(503, 'EMAIL_UNAVAILABLE', 'BREVO_API_KEY absente : envoi impossible.');
    }
    const result = await sendEmail({
      to: body.to,
      subject: body.subject,
      html: emailLayout({
        title: body.title ?? body.subject,
        body: body.body
          .split('\n')
          .map((line) => (line.trim() ? `<p>${line}</p>` : ''))
          .join(''),
      }),
      text: body.body,
      context: 'manuel',
    });

    if (!result.ok) throw new AppError(502, 'EMAIL_FAILED', result.error);

    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
       values('user',$1,'email.send','email',$2,$3,$4::jsonb)`,
      [req.user?.id ?? null, result.outboxId, req.ip ?? null, JSON.stringify({ to: body.to })],
    );

    res.status(201).json({ ok: true, data: { outboxId: result.outboxId, providerId: result.providerId } });
  } catch (err) {
    next(err);
  }
});

/** Test de configuration : envoie au studio, jamais à un inconnu. */
emailRouter.post('/admin/emails/test', requireAdmin, async (req, res, next) => {
  try {
    const info = emailInfo();
    if (!info.ready) throw new AppError(503, 'EMAIL_UNAVAILABLE', 'BREVO_API_KEY absente.');

    const result = await sendEmail({
      to: info.from,
      subject: 'Test de configuration — 5DEV',
      html: emailLayout({
        title: 'La configuration email fonctionne',
        body: `<p>Cet email a été envoyé depuis la console 5DEV pour vérifier le transport.</p>
               <p>Date : ${new Date().toLocaleString('fr-FR')}</p>`,
      }),
      text: 'Test de configuration 5DEV',
      context: 'test',
    });

    if (!result.ok) throw new AppError(502, 'EMAIL_FAILED', result.error);
    res.json({ ok: true, data: { to: info.from, providerId: result.providerId } });
  } catch (err) {
    next(err);
  }
});
