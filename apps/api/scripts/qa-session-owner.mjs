// Ouvre une session de test pour le compte propriétaire, sans passer par /auth/login
// (le limiteur en mémoire et l'enrôlement TOTP rendraient la QA impossible).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');
const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const client = new pg.Client({ connectionString: url });
await client.connect();
const u = await client.query("select id from users where email='no.codescreen@gmail.com'");
if (!u.rowCount) { console.error('compte introuvable'); process.exit(2); }
const token = randomBytes(32).toString('base64url');
await client.query(
  `insert into sessions(user_id, token_hash, ip, user_agent, expires_at)
   values($1,$2,'127.0.0.1','qa-owner', now() + interval '1 day')`,
  [u.rows[0].id, createHash('sha256').update(token).digest('hex')],
);
console.log(JSON.stringify({ cookie: `dev5_session=${token}` }));
await client.end();
process.exit(0);
