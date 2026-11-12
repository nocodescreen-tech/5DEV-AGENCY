// Supprime le compte admin de test créé pour la QA (mot de passe connu → risque).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');
const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const client = new pg.Client({ connectionString: url });
await client.connect();

const del = await client.query(
  "delete from users where email = 'qa-chat@5dev.local' returning id, email",
);
console.log('compte de test supprimé :', del.rowCount === 1 ? 'oui' : 'déjà absent');

const rest = await client.query(
  'select email, role, is_active, coalesce(totp_enabled,false) as totp from users order by created_at',
);
for (const r of rest.rows) {
  console.log(`${r.role.padEnd(6)} ${r.is_active ? 'actif  ' : 'inactif'} 2FA=${r.totp ? 'oui' : 'non'} ${r.email}`);
}
await client.end();
process.exit(0);
