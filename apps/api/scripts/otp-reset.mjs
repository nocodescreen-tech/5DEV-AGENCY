// Réinitialise la double authentification d'un compte (secours si l'application
// d'authentification est perdue). À lancer en local, avec un accès à la base.
//   node scripts/otp-reset.mjs admin@5dev.com
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const here = dirname(fileURLToPath(import.meta.url));
const email = process.argv[2];

if (!email) {
  console.error('Usage : node scripts/otp-reset.mjs <email>');
  process.exit(1);
}

const url =
  process.env.DATABASE_URL ??
  (() => {
    const env = readFileSync(join(here, '../../../.env'), 'utf8');
    return env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  })();

const client = new Client({ connectionString: url });
await client.connect();

const res = await client.query(
  `update users set totp_secret=null, totp_enabled=false, totp_confirmed_at=null
     where lower(email)=lower($1) returning id, email`,
  [email],
);

if (!res.rowCount) {
  console.error(`Compte introuvable : ${email}`);
  await client.end();
  process.exit(1);
}

// les défis en cours deviennent inutiles
await client.query(
  `delete from login_challenges where user_id = $1 and consumed_at is null`,
  [res.rows[0].id],
);

console.log(`Double authentification réinitialisée pour ${res.rows[0].email}.`);
console.log('La prochaine connexion proposera un nouvel enrôlement avec un nouveau secret.');
await client.end();
