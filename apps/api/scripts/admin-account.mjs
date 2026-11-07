// Change le compte administrateur : email + mot de passe, et remet le second facteur à zéro.
//
// AUCUN secret dans ce fichier : les valeurs viennent de l'environnement ou des arguments.
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/admin-account.mjs
// ou
//   node scripts/admin-account.mjs <email> <mot-de-passe>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { hashPassword } from '../src/lib/password.ts';

const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');

const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();

const NEW_EMAIL = process.argv[2] ?? process.env.ADMIN_EMAIL;
const NEW_PASSWORD = process.argv[3] ?? process.env.ADMIN_PASSWORD;

if (!NEW_EMAIL || !NEW_PASSWORD) {
  console.error('Usage : node scripts/admin-account.mjs <email> <mot-de-passe>');
  console.error('   ou : ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/admin-account.mjs');
  process.exit(2);
}
if (NEW_PASSWORD.length < 10) {
  console.error('Mot de passe trop court : 10 caractères minimum.');
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const hash = hashPassword(NEW_PASSWORD);
const updated = await client.query(
  `update users
      set email = $1, password_hash = $2, is_active = true,
          totp_enabled = false, totp_secret = null
    where role = 'admin' or email = $1
    returning id, email, is_active, totp_enabled`,
  [NEW_EMAIL, hash],
);

if (updated.rowCount === 0) {
  const inserted = await client.query(
    `insert into users(email, password_hash, full_name, role, is_active, totp_enabled)
     values($1,$2,'Administrateur 5DEV','admin',true,false)
     returning id, email, is_active, totp_enabled`,
    [NEW_EMAIL, hash],
  );
  console.log('compte créé :', JSON.stringify(inserted.rows));
} else {
  console.log('compte mis à jour :', JSON.stringify(updated.rows));
}

await client.end();
