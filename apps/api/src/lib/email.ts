import { config } from '../config.js';
import { one } from '../db/index.js';

/**
 * Transport email — Brevo (API HTTP) en priorité, sinon échec explicite.
 * L'IA ne transporte jamais d'email : ce module est le seul à envoyer.
 */
const BREVO_KEY = process.env.BREVO_API_KEY ?? '';
const FROM_EMAIL = (process.env.MAIL_FROM_EMAIL ?? process.env.CONTACT_EMAIL ?? 'mio.appservice@gmail.com').trim();
const FROM_NAME = process.env.MAIL_FROM_NAME ?? '5DEV';

export const emailReady = (): boolean => Boolean(BREVO_KEY);

export type SendResult =
  | { ok: true; provider: string; providerId: string | null }
  | { ok: false; error: string };

async function brevoSend(to: string, subject: string, html: string, text?: string): Promise<SendResult> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(text ? { textContent: text } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const raw = await res.text();
  if (!res.ok) return { ok: false, error: `Brevo ${res.status} — ${raw.slice(0, 200)}` };

  let id: string | null = null;
  try {
    id = (JSON.parse(raw) as { messageId?: string }).messageId ?? null;
  } catch {
    /* réponse sans JSON : on garde l'id nul */
  }
  return { ok: true, provider: 'brevo', providerId: id };
}

/** Envoie un email et l'enregistre dans le journal (email_outbox). */
export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  context?: string;
}): Promise<SendResult & { outboxId: string | null }> {
  const row = await one<{ id: string }>(
    `insert into email_outbox(to_email, subject, html, text_body) values($1,$2,$3,$4) returning id`,
    [args.to, args.subject.slice(0, 250), args.html, args.text ?? null],
  );
  const outboxId = row?.id ?? null;

  if (!emailReady()) {
    const error = 'BREVO_API_KEY absente : envoi non effectué';
    await one(
      `update email_outbox set status='failed', error=$2, attempts=attempts+1 where id=$1`,
      [outboxId, error],
    ).catch(() => null);
    return { ok: false, error, outboxId };
  }

  try {
    const res = await brevoSend(args.to, args.subject, args.html, args.text);
    if (res.ok) {
      await one(
        `update email_outbox set status='sent', provider=$2, provider_id=$3, sent_at=now(),
           attempts=attempts+1 where id=$1`,
        [outboxId, res.provider, res.providerId],
      );
      return { ...res, outboxId };
    }
    await one(
      `update email_outbox set status='failed', error=$2, attempts=attempts+1 where id=$1`,
      [outboxId, res.error],
    );
    return { ...res, outboxId };
  } catch (err) {
    const error = err instanceof Error ? err.message.slice(0, 300) : 'erreur réseau';
    await one(
      `update email_outbox set status='failed', error=$2, attempts=attempts+1 where id=$1`,
      [outboxId, error],
    ).catch(() => null);
    return { ok: false, error, outboxId };
  }
}

/** Gabarit HTML sobre, cohérent avec l'identité (orange #F47721). */
export function emailLayout(opts: { title: string; body: string; ctaLabel?: string; ctaUrl?: string; footer?: string }): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<p style="margin:28px 0"><a href="${opts.ctaUrl}" style="background:#F47721;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${opts.ctaLabel}</a></p>`
      : '';
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#FAF8F5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#171717">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="font-size:18px;font-weight:900;margin:0 0 24px">5<span style="color:#F47721">DEV</span></p>
    <div style="background:#fff;border:1px solid #E6E2DD;border-radius:16px;padding:28px">
      <h1 style="font-size:22px;margin:0 0 16px;letter-spacing:-0.02em">${opts.title}</h1>
      <div style="font-size:15px;line-height:1.65;color:#3a3a3a">${opts.body}</div>
      ${cta}
    </div>
    <p style="font-size:11px;color:#8a8a8a;margin:20px 0 0;line-height:1.6">
      ${opts.footer ?? `5DEV — Build. Innovate. Grow. · ${FROM_EMAIL}`}<br>
      Vous recevez ce message parce que vous avez créé une demande ou vous êtes inscrit à la newsletter.
    </p>
  </div>
</body></html>`;
}

export const emailInfo = () => ({
  provider: 'brevo',
  ready: emailReady(),
  from: FROM_EMAIL,
  environment: config.NODE_ENV,
});
