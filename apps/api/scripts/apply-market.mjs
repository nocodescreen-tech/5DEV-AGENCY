// Applique le schéma de veille tarifaire puis fait un premier relevé.
// Rejouable : le schéma est idempotent, le relevé met à jour sans dupliquer.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');

const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const sql = readFileSync(new URL('../src/db/schema-market.sql', import.meta.url), 'utf8');

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(sql);

const cols = await client.query(
  `select column_name from information_schema.columns where table_name='market_offers' order by ordinal_position`,
);
console.log('market_offers :', cols.rows.map((c) => c.column_name).join(', '));

const n = await client.query('select count(*)::int as n from market_offers');
console.log('lignes :', n.rows[0].n);

await client.end();
process.exit(0);
