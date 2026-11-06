import { config } from '../config.js';
import { one } from '../db/index.js';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Transport email — deux fournisseurs, dans cet ordre :
 *   1. Brevo (API HTTP)        → si BREVO_API_KEY est posée
 *   2. SMTP (Gmail ou autre)   → si SMTP_HOST/USER/PASS sont posés
 * Le premier qui est configuré et qui répond est utilisé ; l'échec est journalisé
 * avec le fournisseur réellement tenté. Aucune IA ne transporte d'email ici.
 */

type Provider = 'brevo' | 'smtp' | 'none';

const BREVO_KEY = process.env.BREVO_API_KEY ?? '';
const SMTP_HOST = process.env.SMTP_HOST ?? '';
const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = process.env.SMTP_PASS ?? '';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const FROM_EMAIL = process.env.MAIL_FROM_EMAIL ?? process.env.MAIL_FROM ?? SMTP_USER ?? 'no-reply@5dev.com';
const FROM_NAME = process.env.MAIL_FROM_NAME ?? config.APP_NAME;

export const emailReady = (): boolean => Boolean(BREVO_KEY) || Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

export function emailInfo(): {
  ready: boolean;
  provider: Provider;
  from: string;
  alternatives: { brevo: boolean; smtp: boolean };
} {
  const brevo = Boolean(BREVO_KEY);
  const smtp = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
  const provider: Provider = brevo ? 'brevo' : smtp ? 'smtp' : 'none';
  return { ready: provider !== 'none', provider, from: FROM_EMAIL, alternatives: { brevo, smtp } };
}

let transporter: Transporter | null = null;
function smtpTransport(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Gmail exige un mot de passe d'application, pas le mot de passe du compte
      requireTLS: SMTP_PORT === 587,
    });
  }
  return transporter;
}

export type SendResult = {
  ok: boolean;
  provider: Provider;
  providerId: string | null;
  error: string | null;
  outboxId: string | null;
};

/** Gabarit HTML sobre, identité orange/blanc/noir. */
export function emailLayout(opts: { title: string; body: string; ctaLabel?: string; ctaUrl?: string; footer?: string }): string {
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<p style="margin:24px 0"><a href="${opts.ctaUrl}" style="background:#F47721;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${opts.ctaLabel}</a></p>`
    : '';
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f5f5f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#171717">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="font-size:20px;font-weight:800;margin:0 0 4px">5DEV<span style="color:#F47721">.</span></p>
    <p style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#737373;margin:0 0 24px">Build. Innovate. Grow.</p>
    <div style="background:#fff;border:1px solid #e6e2dd;border-radius:12px;padding:24px">
      <h1 style="font-size:18px;margin:0 0 12px">${opts.title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#171717">${opts.body}</div>
      ${cta}
    </div>
    <p style="font-size:11px;color:#737373;margin-top:20px">${opts.footer ?? `© ${new Date().getFullYear()} 5DEV — Matadi, République démocratique du Congo`}</p>
  </div></body></html>`;
}

/**
 * Envoie un email et journalise dans `email_outbox` (état réel, erreur réelle).
 * Le compte de sortie est celui du studio : jamais un destinataire inventé.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** étiquette libre (manuel, automatisation, campagne) — journalisée, pas envoyée */
  context?: string;
}): Promise<SendResult> {
  const info = emailInfo();
  const outbox = await one<{ id: string }>(
    `insert into email_outbox(to_email, subject, html, status, provider)
     values($1,$2,$3,'queued',$4) returning id`,
    [input.to, input.subject, input.html, info.provider],
  ).catch(() => null);

  if (info.provider === 'none') {
    const error = 'Aucun fournisseur email configuré (ni Brevo, ni SMTP).';
    if (outbox?.id) {
      await one(`update email_outbox set status='failed', error=$2 where id=$1`, [outbox.id, error]);
    }
    return { ok: false, provider: 'none', providerId: null, error, outboxId: outbox?.id ?? null };
  }

  try {
    let providerId: string | null = null;

    if (info.provider === 'brevo') {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: FROM_EMAIL, name: FROM_NAME },
          to: [{ email: input.to }],
          subject: input.subject,
          htmlContent: input.html,
          textContent: input.text,
          replyTo: input.replyTo ? { email: input.replyTo } : undefined,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Brevo ${res.status} ${body.slice(0, 160)}`);
      }
      const json = (await res.json().catch(() => ({}))) as { messageId?: string };
      providerId = json.messageId ?? null;
    } else {
      const mail = await smtpTransport().sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
      });
      providerId = mail.messageId ?? null;
    }

    if (outbox?.id) {
      await one(
        `update email_outbox set status='sent', provider_id=$2, sent_at=now(), error=null where id=$1`,
        [outbox.id, providerId],
      );
    }
    return { ok: true, provider: info.provider, providerId, error: null, outboxId: outbox?.id ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Échec d’envoi inconnu';
    if (outbox?.id) {
      await one(`update email_outbox set status='failed', error=$2, attempts=attempts+1 where id=$1`, [
        outbox.id,
        message.slice(0, 400),
      ]);
    }
    return { ok: false, provider: info.provider, providerId: null, error: message, outboxId: outbox?.id ?? null };
  }
}

/** Vérifie la configuration SMTP sans envoyer d'email (poignée de main). */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return { ok: false, error: 'SMTP non configuré.' };
  try {
    await smtpTransport().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Échec de vérification SMTP.' };
  }
}
