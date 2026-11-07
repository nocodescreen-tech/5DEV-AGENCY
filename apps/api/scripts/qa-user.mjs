/**
 * Crée un compte admin temporaire pour les scripts de vérification, puis le supprime.
 * usage: node --import tsx apps/api/scripts/qa-user.mjs create|delete
 */
import { hashPassword } from '../src/lib/password.ts';
import { one } from '../src/db/index.ts';

const EMAIL = 'qa-chat@5dev.local';
const PASSWORD = 'Qa-Chat-2026!';

const action = process.argv[2] ?? 'create';

if (action === 'create') {
  const hash = await hashPassword(PASSWORD);
  await one(`delete from users where email = $1`, [EMAIL]);
  const row = await one(
    `insert into users(email, password_hash, full_name, role, is_active)
     values($1,$2,'QA temporaire','admin',true) returning id`,
    [EMAIL, hash],
  );
  console.log(JSON.stringify({ email: EMAIL, password: PASSWORD, id: row?.id }));
} else {
  await one(`delete from ai_conversations where user_id in (select id from users where email=$1)`, [EMAIL]);
  await one(`delete from users where email = $1`, [EMAIL]);
  console.log('compte QA supprimé');
}
