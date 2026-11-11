// Applique le schéma du gestionnaire de comptes SANS passer par `npm run setup`
// (le seed recrée un compte propriétaire fantôme). Additif et rejouable.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');

const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const sql = readFileSync(new URL('../src/db/schema-credentials.sql', import.meta.url), 'utf8');

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(sql);

const cols = await client.query(
  `select column_name, data_type from information_schema.columns
    where table_name='app_credentials' order by ordinal_position`,
);
const n = await client.query('select count(*)::int as n from app_credentials');
console.log('table app_credentials :', n.rows[0].n, 'ligne(s)');
console.log('colonnes :', cols.rows.map((c) => `${c.column_name}:${c.data_type}`).join(', '));

await client.end();
process.exit(0);
