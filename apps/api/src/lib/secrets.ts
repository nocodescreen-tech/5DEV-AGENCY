import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { one } from '../db/index.js';

/**
 * Secrets chiffrés au repos (AES-256-GCM).
 * La clé de chiffrement dérive de SESSION_SECRET (jamais envoyée au client).
 * Aucune fonction de ce module ne renvoie un secret en clair vers une réponse HTTP :
 * `readSecret` n'est appelé que côté serveur, au moment de l'appel fournisseur.
 */

const ALGO = 'aes-256-gcm';

function key(): Buffer {
  return createHash('sha256').update(`5dev:secrets:${config.SESSION_SECRET}`).digest();
}

/** Chiffre une valeur courte (secret TOTP, jeton) — synchrone, utilisable en base. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${enc.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
}

/** Déchiffre une valeur produite par encryptSecret. Renvoie null si le format ne correspond pas. */
export function decryptSecret(value: string): string | null {
  try {
    const [version, ivB64, dataB64, tagB64] = value.split('.');
    if (version !== 'v1' || !ivB64 || !dataB64 || !tagB64) return null;
    const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export async function writeSecret(name: string, value: string): Promise<{ hint: string }> {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const hint = value.length > 8 ? `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} car.)` : `${value.length} car.`;

  await one(
    `insert into secrets(name, ciphertext, iv, tag, hint, updated_at)
     values($1,$2,$3,$4,$5, now())
     on conflict (name) do update set ciphertext=excluded.ciphertext, iv=excluded.iv,
       tag=excluded.tag, hint=excluded.hint, updated_at=now()`,
    [name, enc.toString('base64'), iv.toString('base64'), tag.toString('base64'), hint],
  );
  return { hint };
}

export async function readSecret(name: string): Promise<string | null> {
  const row = await one<{ ciphertext: string; iv: string; tag: string }>(
    `select ciphertext, iv, tag from secrets where name=$1`,
    [name],
  );
  if (!row) return null;
  try {
    const decipher = createDecipheriv(ALGO, key(), Buffer.from(row.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(row.tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export async function secretInfo(name: string): Promise<{ configured: boolean; hint: string | null; updated_at: string | null }> {
  const row = await one<{ hint: string; updated_at: string }>(
    `select hint, updated_at from secrets where name=$1`,
    [name],
  );
  return { configured: Boolean(row), hint: row?.hint ?? null, updated_at: row?.updated_at ?? null };
}

export async function deleteSecret(name: string): Promise<void> {
  await one(`delete from secrets where name=$1`, [name]);
}
