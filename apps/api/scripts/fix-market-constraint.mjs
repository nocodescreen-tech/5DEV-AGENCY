import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');
const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(`alter table market_offers drop constraint if exists market_offers_source_kind_check`);
await client.query(`alter table market_offers add constraint market_offers_source_kind_check
  check (source_kind in ('api','page','manuel'))`);
const r = await client.query("select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='market_offers'::regclass and contype='c'");
console.log(r.rows.map(x=>x.def).join('\n'));
await client.end();
process.exit(0);
