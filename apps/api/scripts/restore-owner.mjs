// Reconstitue le compte propriétaire supprimé par erreur (2026-11-11).
// Crée la ligne par email si elle manque, propriétaire + actif, second facteur à ré-enrôler.
// Aucun secret en dur : tout vient de l'environnement.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { hashPassword } from '../src/lib/password.ts';

const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');

const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('ADMIN_EMAIL et ADMIN_PASSWORD requis.');
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const existing = await client.query('select id from users where lower(email)=lower($1)', [EMAIL]);

if (existing.rowCount > 0) {
  const r = await client.query(
    `update users set password_hash=$2, role='owner', is_active=true,
            totp_enabled=false, totp_secret=null, updated_at=now()
      where id=$1 returning id, email, role, is_active`,
    [existing.rows[0].id, hashPassword(PASSWORD)],
  );
  console.log('compte existant restauré :', JSON.stringify(r.rows));
} else {
  const r = await client.query(
    `insert into users(email, password_hash, full_name, role, is_active, totp_enabled)
     values($1,$2,'Administrateur 5DEV','owner',true,false)
     returning id, email, role, is_active`,
    [EMAIL, hashPassword(PASSWORD)],
  );
  console.log('compte recréé :', JSON.stringify(r.rows));
}

const all = await client.query("select email, role, is_active from users order by created_at");
console.log('comptes :', JSON.stringify(all.rows));

await client.end();
process.exit(0);
