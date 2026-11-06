import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Mots de passe : scrypt (natif Node, pas de dépendance binaire).
 * Format stocké : scrypt$N$r$p$salt$hash (base64url).
 */
const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize('NFKC'), salt, KEYLEN, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, rr, pp, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64 ?? '', 'base64url');
  const expected = Buffer.from(hashB64 ?? '', 'base64url');
  if (!salt.length || !expected.length) return false;
  const actual = scryptSync(password.normalize('NFKC'), salt, expected.length, {
    N: Number(n),
    r: Number(rr),
    p: Number(pp),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
