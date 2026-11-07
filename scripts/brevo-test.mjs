// Enregistre l'expéditeur mio.appservice@gmail.com chez Brevo (déclenche l'email de validation)
// puis envoie un vrai test depuis un expéditeur déjà validé, et vérifie l'événement de livraison.
import { readFileSync } from 'node:fs';

const env = readFileSync('C:/Users/rene/5dev/.env', 'utf8');
const key = env.match(/^BREVO_API_KEY=(.+)$/m)?.[1]?.trim();
const VALID_SENDER = 'no.codescreen@gmail.com';
const TARGET = 'mio.appservice@gmail.com';

const api = async (path, init = {}) => {
  const r = await fetch(`https://api.brevo.com/v3${path}`, {
    ...init,
    headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}) },
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* brut */
  }
  return { status: r.status, json, text };
};

// 1) demander la validation de l'expéditeur souhaité (Brevo envoie un lien à cliquer)
const add = await api('/senders', {
  method: 'POST',
  body: JSON.stringify({ email: TARGET, name: '5DEV' }),
});
console.log('déclaration expéditeur', TARGET, '→', add.status, add.text.slice(0, 160));

// 2) envoi réel depuis un expéditeur validé
const send = await api('/smtp/email', {
  method: 'POST',
  body: JSON.stringify({
    sender: { email: VALID_SENDER, name: '5DEV' },
    to: [{ email: TARGET }],
    replyTo: { email: TARGET },
    subject: '5DEV — test de livraison réel',
    htmlContent:
      '<div style="font-family:system-ui,sans-serif"><h1 style="font-size:18px">Test de livraison</h1><p>Si ce message arrive dans la boîte, l’envoi fonctionne : expéditeur validé, destinataire vérifié.</p><p style="color:#737373;font-size:12px">envoyé depuis 5DEV</p></div>',
    textContent: 'Test de livraison 5DEV — si vous lisez ceci, l’envoi fonctionne.',
  }),
});
console.log('envoi test →', send.status, send.text.slice(0, 160));
const messageId = send.json?.messageId ?? null;

// 3) attendre puis lire les événements de livraison
await new Promise((r) => setTimeout(r, 8000));
const events = await api('/smtp/statistics/events?limit=8&sort=desc');
for (const e of events.json?.events ?? []) {
  console.log(`  ${e.date} | ${e.event} | ${e.email} | ${String(e.subject ?? '').slice(0, 44)} | ${e.reason ?? ''}`);
}
console.log('\nmessageId du test :', messageId);
