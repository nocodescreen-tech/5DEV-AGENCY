import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');
const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const client = new pg.Client({ connectionString: url });
await client.connect();
const del = await client.query(
  `delete from market_offers
    where price is null and source_kind = 'page' and specs = ''
    returning id`,
);
const left = await client.query('select count(*)::int as n, count(price)::int as avec_prix from market_offers');
console.log('offres vides supprimées :', del.rowCount);
console.log('restant :', left.rows[0].n, '· avec un prix :', left.rows[0].avec_prix);
await client.end();
process.exit(0);
