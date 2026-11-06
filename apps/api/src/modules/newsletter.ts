import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { rateLimit, requireAdmin, validate } from '../middlewares/auth.js';
import { emailLayout, emailReady, sendEmail } from '../lib/email.js';
import { config } from '../config.js';

export const newsletterRouter: Router = Router();

const baseUrl = (): string => (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, '');

function page(title: string, message: string, ok = true): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — 5DEV</title></head>
<body style="margin:0;background:#FAF8F5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#171717">
<div style="max-width:520px;margin:0 auto;padding:64px 20px;text-align:center">
<p style="font-size:18px;font-weight:900;margin:0 0 28px">5<span style="color:#F47721">DEV</span></p>
<div style="background:#fff;border:1px solid #E6E2DD;border-radius:16px;padding:32px">
<h1 style="font-size:22px;margin:0 0 12px">${title}</h1>
<p style="font-size:15px;line-height:1.65;color:#3a3a3a;margin:0">${message}</p>
<p style="margin:28px 0 0"><a href="${baseUrl()}/" style="background:#${ok ? 'F47721' : '171717'};color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">Retour au site</a></p>
</div></div></body></html>`;
}

/* --------------------------------------------------------------- public --- */

const subscribeSchema = z.object({
  email: z.string().email().max(180),
  name: z.string().max(120).optional().default(''),
  segment: z.string().max(60).optional(),
});

newsletterRouter.post(
  '/newsletter/subscribe',
  rateLimit({ key: 'newsletter', max: 5, windowMs: 10 * 60_000 }),
  validate(subscribeSchema),
  async (req, res, next) => {
    try {
      const { email, name, segment } = req.body as z.infer<typeof subscribeSchema>;
      const token = randomBytes(24).toString('base64url');

      const existing = await one<{ id: string; status: string; token: string }>(
        `select id, status, token from subscribers where lower(email) = lower($1)`,
        [email],
      );

      if (existing?.status === 'confirmed') {
        res.status(200).json({ ok: true, data: { status: 'already_confirmed' } });
        return;
      }

      const row = existing
        ? await one<{ id: string; token: string }>(
            `update subscribers set status='pending', name=coalesce(nullif($2,''), name),
               token=$3, source=coalesce($4, source), segments = case when $5::text is null then segments
               else array_append(segments, $5::text) end
             where id=$1 returning id, token`,
            [existing.id, name ?? '', token, 'site', segment ?? null],
          )
        : await one<{ id: string; token: string }>(
            `insert into subscribers(email, name, token, source, segments, status)
             values($1,$2,$3,'site',case when $4::text is null then '{}'::text[] else array[$4::text] end,'pending')
             returning id, token`,
            [email, name ?? null, token, segment ?? null],
          );

      const confirmUrl = `${baseUrl()}/api/v1/newsletter/confirm?token=${row?.token}`;
      const mailed = await sendEmail({
        to: email,
        subject: 'Confirmez votre inscription à la newsletter 5DEV',
        html: emailLayout({
          title: 'Une dernière étape',
          body: `<p>Vous (ou quelqu’un utilisant cette adresse) souhaitez recevoir les nouvelles de 5DEV.</p>
                 <p>Cliquez sur le bouton pour confirmer. Sans confirmation, aucun message ne sera envoyé.</p>`,
          ctaLabel: 'Confirmer mon inscription',
          ctaUrl: confirmUrl,
        }),
      });

      if (!mailed.ok && config.NODE_ENV === 'production') {
        throw new AppError(502, 'EMAIL_FAILED', 'Envoi de la confirmation impossible.');
      }

      res.status(201).json({
        ok: true,
        data: {
          status: 'pending_confirmation',
          emailSent: mailed.ok,
          // en développement seulement : le lien est renvoyé pour pouvoir tester
          ...(config.NODE_ENV !== 'production' ? { confirmUrl } : {}),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

newsletterRouter.get('/newsletter/confirm', async (req, res, next) => {
  try {
    const token = String(req.query.token ?? '');
    if (!token) throw new AppError(422, 'VALIDATION', 'Jeton manquant.');
    const row = await one<{ id: string }>(
      `update subscribers set status='confirmed', confirmed_at=now(), consented_at=coalesce(consented_at, now())
       where token=$1 and status in ('pending','unsubscribed') returning id`,
      [token],
    );
    res.type('html').send(
      row
        ? page('Inscription confirmée', 'Vous recevrez désormais les nouvelles de 5DEV. Vous pouvez vous désinscrire à tout moment.')
        : page('Lien déjà utilisé', 'Ce lien de confirmation n’est plus valable.', false),
    );
  } catch (err) {
    next(err);
  }
});

newsletterRouter.get('/newsletter/unsubscribe', async (req, res, next) => {
  try {
    const token = String(req.query.token ?? '');
    const row = await one<{ id: string }>(
      `update subscribers set status='unsubscribed', unsubscribed_at=now() where token=$1 returning id`,
      [token],
    );
    res.type('html').send(
      page('Désinscription effectuée', row ? 'Votre adresse a été retirée de la liste. Aucun autre message ne sera envoyé.' : 'Ce lien n’est pas valable.', Boolean(row)),
    );
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------------------------------------- admin --- */

newsletterRouter.get('/admin/subscribers', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all(
      `select id, email, name, status, segments, created_at, confirmed_at, unsubscribed_at
         from subscribers order by created_at desc limit 500`,
    );
    const counts = await one<Record<string, number>>(
      `select count(*)::int as total,
              count(*) filter (where status='confirmed')::int as confirmed,
              count(*) filter (where status='pending')::int as pending,
              count(*) filter (where status='unsubscribed')::int as unsubscribed
         from subscribers`,
    );
    res.json({ ok: true, data: { subscribers: rows, counts } });
  } catch (err) {
    next(err);
  }
});

newsletterRouter.get('/admin/campaigns', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all(
      `select c.*,
              (select count(*) from campaign_sends s where s.campaign_id=c.id and s.status='sent')::int as sent,
              (select count(*) from campaign_sends s where s.campaign_id=c.id and s.status='failed')::int as failed
         from campaigns c order by c.created_at desc limit 100`,
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

const campaignSchema = z.object({
  name: z.string().min(2).max(120),
  subject: z.string().min(2).max(180),
  html: z.string().min(20).max(60_000),
  segment: z.string().max(60).nullable().optional(),
});

newsletterRouter.post(
  '/admin/campaigns',
  requireAdmin,
  validate(campaignSchema),
  async (req, res, next) => {
    try {
      const c = req.body as z.infer<typeof campaignSchema>;
      const row = await one(
        `insert into campaigns(name, subject, html, segment) values($1,$2,$3,$4) returning *`,
        [c.name, c.subject, c.html, c.segment ?? null],
      );
      res.status(201).json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

/** Envoi réel : uniquement aux abonnés confirmés (consentement explicite). */
newsletterRouter.post('/admin/campaigns/:id/send', requireAdmin, async (req, res, next) => {
  try {
    if (!emailReady()) throw new AppError(503, 'EMAIL_UNAVAILABLE', 'Aucun fournisseur email configuré.');

    const campaign = await one<{ id: string; subject: string; html: string; status: string; segment: string | null }>(
      `select id, subject, html, status, segment from campaigns where id=$1`,
      [req.params.id],
    );
    if (!campaign) throw new AppError(404, 'NOT_FOUND', 'Campagne introuvable.');
    if (campaign.status === 'sent') throw new AppError(409, 'ALREADY_SENT', 'Campagne déjà envoyée.');

    const targets = await all<{ id: string; email: string; token: string }>(
      `select id, email, token from subscribers
        where status='confirmed' and ($1::text is null or $1 = any(segments))
        order by created_at limit 500`,
      [campaign.segment],
    );
    if (targets.length === 0) throw new AppError(409, 'NO_RECIPIENT', 'Aucun abonné confirmé à qui envoyer.');

    await one(`update campaigns set status='sending' where id=$1`, [campaign.id]);

    let sent = 0;
    const failures: string[] = [];
    for (const sub of targets) {
      const unsubscribe = `${baseUrl()}/api/v1/newsletter/unsubscribe?token=${sub.token}`;
      const html = campaign.html.replaceAll('{{unsubscribe_url}}', unsubscribe);
      const result = await sendEmail({ to: sub.email, subject: campaign.subject, html });
      await one(
        `insert into campaign_sends(campaign_id, subscriber_id, status, provider_id, error, sent_at)
         values($1,$2,$3,$4,$5, case when $3='sent' then now() else null end)
         on conflict (campaign_id, subscriber_id) do update
           set status=excluded.status, provider_id=excluded.provider_id, error=excluded.error, sent_at=excluded.sent_at`,
        [campaign.id, sub.id, result.ok ? 'sent' : 'failed', result.ok ? result.providerId : null, result.ok ? null : result.error],
      );
      if (result.ok) sent += 1;
      else failures.push(`${sub.email}: ${result.error ?? 'échec'}`);
    }

    await one(
      `update campaigns set status=$2, sent_at=now() where id=$1`,
      [campaign.id, sent > 0 ? 'sent' : 'failed'],
    );
    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
       values('user',$1,'campaign.send','campaign',$2,$3,$4::jsonb)`,
      [req.user?.id ?? null, campaign.id, req.ip ?? null, JSON.stringify({ sent, failed: failures.length })],
    );

    res.json({ ok: true, data: { recipients: targets.length, sent, failed: failures.length, failures: failures.slice(0, 10) } });
  } catch (err) {
    next(err);
  }
});
