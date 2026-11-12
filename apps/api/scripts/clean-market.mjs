// Nettoyage du catalogue : on garde, pour chaque plateforme, les offres qui
// portent un prix vérifié ; les lignes vides ne restent que si la plateforme
// n'a AUCUN prix (sinon la carte affiche « — » à côté d'un tarif réel).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');
const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const client = new pg.Client({ connectionString: url });
await client.connect();

const del = await client.query(`
  delete from market_offers o
   where o.price is null
     and exists (select 1 from market_offers p where lower(p.provider)=lower(o.provider) and p.price is not null)
  returning o.id`);

const stats = await client.query(`
  select category,
         count(*)::int as offres,
         count(price)::int as avec_prix,
         count(distinct provider)::int as plateformes
    from market_offers group by category order by category`);

console.log('lignes vides retirées :', del.rowCount);
for (const r of stats.rows) {
  console.log(`${r.category.padEnd(16)} ${String(r.plateformes).padStart(3)} plateformes · ${String(r.offres).padStart(3)} offres · ${String(r.avec_prix).padStart(3)} avec prix`);
}
await client.end();
process.exit(0);
