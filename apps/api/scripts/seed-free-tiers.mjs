// Paliers gratuits : plateformes réellement utilisables sans payer.
//
// Ces offres sont marquées `manuel` : c'est un relevé daté, pas un flux temps
// réel. Les quotas changent souvent chez les fournisseurs — la page affiche donc
// « indicatif » et le lien officiel, jamais une promesse de disponibilité.
// Rejouable : `on conflict` met à jour sans dupliquer.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');

const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();

/** Prix 0 = palier gratuit. Le quota est la vraie information. */
const OFFERS = [
  ['gratuit', 'Cloudflare Pages', 'Pages — sites statiques', 'Bande passante illimitée, 500 builds/mois, domaine custom', 0, 'USD', '/mois', 'https://developers.cloudflare.com/pages/platform/limits/'],
  ['gratuit', 'Cloudflare Workers', 'Workers free', '100 000 requêtes/jour, 10 ms CPU par requête', 0, 'USD', '/mois', 'https://developers.cloudflare.com/workers/platform/limits/'],
  ['gratuit', 'Cloudflare R2', 'R2 free tier', '10 Go stockage, classe A 1 M/mois, sortie gratuite', 0, 'USD', '/mois', 'https://developers.cloudflare.com/r2/pricing/'],
  ['gratuit', 'Netlify', 'Starter', '100 Go bande passante, 300 min build, formulaires 100/mois', 0, 'USD', '/mois', 'https://www.netlify.com/pricing/'],
  ['gratuit', 'Vercel', 'Hobby', '100 Go bande passante, fonctions serverless incluses', 0, 'USD', '/mois', 'https://vercel.com/pricing'],
  ['gratuit', 'GitHub Pages', 'Pages public', '1 Go de site, 100 Go bande passante, domaine custom', 0, 'USD', '/mois', 'https://docs.github.com/pages/getting-started-with-github-pages/about-github-pages'],
  ['gratuit', 'Render', 'Free web service', '750 h/mois, mise en veille après 15 min d’inactivité', 0, 'USD', '/mois', 'https://render.com/pricing'],
  ['gratuit', 'Fly.io', 'Pay as you go (crédit)', 'Petites machines partagées, facturation à la seconde', 0, 'USD', '/mois', 'https://fly.io/docs/about/pricing/'],
  ['gratuit', 'Supabase', 'Free', '500 Mo Postgres, 1 Go stockage, 50 000 utilisateurs actifs', 0, 'USD', '/mois', 'https://supabase.com/pricing'],
  ['gratuit', 'Neon', 'Free', '0,5 Go Postgres, autosuspend, branches illimitées', 0, 'USD', '/mois', 'https://neon.tech/pricing'],
  ['gratuit', 'Turso', 'Free', '500 bases, 9 Go stockage, 1 Md lectures/mois', 0, 'USD', '/mois', 'https://turso.tech/pricing'],
  ['gratuit', 'Backblaze B2', 'Free tier', '10 Go stockage, 1 Go/jour de téléchargement', 0, 'USD', '/mois', 'https://www.backblaze.com/cloud-storage/pricing'],
  ['gratuit', 'Oracle Cloud', 'Always Free', '2 VM ARM 4 cœurs, 200 Go stockage bloc, 10 To sortie/mois', 0, 'USD', '/mois', 'https://www.oracle.com/cloud/free/'],
  ['gratuit', 'Brevo', 'Free', '300 emails/jour, expéditeur validé requis', 0, 'USD', '/mois', 'https://www.brevo.com/pricing/'],
  ['gratuit', 'Resend', 'Free', '3 000 emails/mois, 100/jour', 0, 'USD', '/mois', 'https://resend.com/pricing'],
  ['gratuit', 'Cloudflare DNS', 'DNS gratuit', 'Zones illimitées, résolution anycast, DNSSEC', 0, 'USD', '/mois', 'https://www.cloudflare.com/dns/'],
];

const client = new pg.Client({ connectionString: url });
await client.connect();

let n = 0;
for (const [category, provider, plan, specs, price, currency, unit, link] of OFFERS) {
  await client.query(
    `insert into market_offers(category, provider, plan, specs, price, currency, unit, url, source_kind, checked_at)
     values($1,$2,$3,$4,$5,$6,$7,$8,'manuel', now())
     on conflict (category, provider, plan) do update
       set specs=excluded.specs, price=excluded.price, currency=excluded.currency,
           unit=excluded.unit, url=excluded.url, checked_at=now(), updated_at=now()`,
    [category, provider, plan, specs, price, currency, unit, link],
  );
  n += 1;
}

const total = await client.query('select category, count(*)::int as n from market_offers group by category order by category');
console.log(`paliers gratuits enregistrés : ${n}`);
console.log(total.rows.map((r) => `${r.category}: ${r.n}`).join(' · '));

await client.end();
process.exit(0);
