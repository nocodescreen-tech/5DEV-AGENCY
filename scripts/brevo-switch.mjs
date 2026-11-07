// Bascule l'expéditeur sur une adresse déjà validée chez Brevo, puis vérifie la livraison.
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'C:/Users/rene/5dev/.env';
let env = readFileSync(path, 'utf8');

const setVar = (name, value) => {
  const re = new RegExp(`^${name}=.*$`, 'm');
  if (re.test(env)) env = env.replace(re, `${name}=${value}`);
  else env += `\n${name}=${value}`;
};

// expéditeur : adresse validée côté Brevo. destinataire : la boîte du studio.
setVar('MAIL_FROM_EMAIL', 'no.codescreen@gmail.com');
setVar('MAIL_FROM_NAME', '5DEV');
setVar('CONTACT_EMAIL', 'mio.appservice@gmail.com');
writeFileSync(path, env, 'utf8');

const key = env.match(/^BREVO_API_KEY=(.+)$/m)?.[1]?.trim();
const api = async (p, init = {}) =>
  fetch(`https://api.brevo.com/v3${p}`, {
    ...init,
    headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}) },
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null), text: '' }));

const send = await api('/smtp/email', {
  method: 'POST',
  body: JSON.stringify({
    sender: { email: 'no.codescreen@gmail.com', name: '5DEV' },
    to: [{ email: 'mio.appservice@gmail.com' }],
    subject: '5DEV — livraison vérifiée',
    htmlContent:
      '<div style="font-family:system-ui,sans-serif"><h1 style="font-size:18px">Livraison vérifiée</h1><p>Cet email part d’un expéditeur validé chez Brevo. S’il est dans votre boîte, la chaîne complète fonctionne.</p></div>',
    textContent: 'Livraison vérifiée — 5DEV',
  }),
});
console.log('envoi →', send.status, JSON.stringify(send.json));

for (let i = 0; i < 6; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const ev = await api('/smtp/statistics/events?limit=6&sort=desc');
  const list = ev.json?.events ?? [];
  const mine = list.find((e) => String(e.subject ?? '').includes('livraison vérifiée'));
  console.log(`essai ${i + 1}:`, mine ? `${mine.event} — ${mine.reason ?? 'ok'}` : 'pas encore d’événement');
  if (mine && (mine.event === 'delivered' || mine.event === 'error')) break;
}
