/**
 * Ouvre une session de test SANS passer par /auth/login (aucun quota, aucun TOTP).
 * Insère directement un jeton haché dans `sessions` pour le compte QA et imprime
 * le cookie à injecter dans le navigateur.
 * usage: node --import tsx apps/api/scripts/qa-session.mjs
 */
import { createHash, randomBytes } from 'node:crypto';
import { one } from '../src/db/index.ts';

const EMAIL = process.env.QA_EMAIL ?? 'qa-chat@5dev.local';
const jours = 1;

const user = await one(`select id from users where email=$1 and is_active`, [EMAIL]);
if (!user) {
  console.error(`compte introuvable : ${EMAIL}`);
  process.exit(2);
}

const token = randomBytes(32).toString('base64url');
await one(
  `insert into sessions(user_id, token_hash, ip, user_agent, expires_at)
   values($1,$2,'127.0.0.1','qa-session', now() + ($3 || ' days')::interval) returning id`,
  [user.id, createHash('sha256').update(token).digest('hex'), String(jours)],
);

console.log(JSON.stringify({ cookie: `dev5_session=${token}` }));
