// Révoque les comptes de test dont le mot de passe a pu fuiter dans l'historique Git.
// On ne supprime pas la ligne (traces d'audit) : on la désactive et on invalide le hash.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../src/lib/password.ts';

const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');

const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();

const client = new pg.Client({ connectionString: url });
await client.connect();

const res = await client.query(
  `update users
      set is_active = false, totp_enabled = false, totp_secret = null, password_hash = $1
    where email in ('qa-chat@5dev.local', 'admin@5dev.com')
    returning id, email, is_active`,
  [hashPassword(randomBytes(32).toString('hex'))],
);

console.log('comptes révoqués :', JSON.stringify(res.rows));

const remaining = await client.query(`select email, role, is_active from users order by created_at`);
console.log('état des comptes :', JSON.stringify(remaining.rows));

await client.end();
