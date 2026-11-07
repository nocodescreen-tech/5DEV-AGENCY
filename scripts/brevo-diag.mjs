// Diagnostic Brevo : expéditeurs vérifiés + derniers événements de livraison.
// La clé reste dans .env, jamais affichée.
import { readFileSync } from 'node:fs';

const env = readFileSync('C:/Users/rene/5dev/.env', 'utf8');
const key = env.match(/^BREVO_API_KEY=(.+)$/m)?.[1]?.trim();
const from = env.match(/^MAIL_FROM_EMAIL=(.+)$/m)?.[1]?.trim();
if (!key) {
  console.log('BREVO_API_KEY absente de .env');
  process.exit(1);
}

const api = async (path) => {
  const r = await fetch(`https://api.brevo.com/v3${path}`, {
    headers: { 'api-key': key, Accept: 'application/json' },
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

console.log('expéditeur configuré :', from);

const senders = await api('/senders');
if (senders.status !== 200) {
  console.log('GET /senders →', senders.status, senders.text.slice(0, 200));
} else {
  const list = senders.json?.senders ?? [];
  console.log(`expéditeurs déclarés : ${list.length}`);
  for (const s of list) console.log(`  - ${s.email} | actif=${s.active} | vérifié=${s.emailVerified ?? '?'}`);
  const match = list.find((s) => String(s.email).toLowerCase() === String(from).toLowerCase());
  console.log(
    match
      ? `=> ${from} est déclaré (actif=${match.active}, vérifié=${match.emailVerified ?? '?'})`
      : `=> ATTENTION : ${from} n'est pas dans la liste des expéditeurs Brevo`,
  );
}

const events = await api('/smtp/statistics/events?limit=12&sort=desc');
if (events.status !== 200) {
  console.log('GET events →', events.status, events.text.slice(0, 200));
} else {
  const list = events.json?.events ?? [];
  console.log(`\nderniers événements (${list.length}) :`);
  for (const e of list) {
    console.log(`  ${e.date} | ${e.event} | ${e.email} | ${String(e.subject ?? '').slice(0, 48)} | ${e.reason ?? ''}`);
  }
}

const account = await api('/account');
if (account.status === 200) {
  console.log('\ncompte:', account.json?.companyName, '| plan:', JSON.stringify(account.json?.plan?.filter((p) => p.creditsType === 'sendLimit')?.[0] ?? {}));
}
