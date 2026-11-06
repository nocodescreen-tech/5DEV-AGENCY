import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateSecret, hotp, otpauthUrl, totp, verifyTotp } from '../src/lib/totp.js';

/**
 * TOTP (RFC 6238) — tests sans base ni réseau.
 * Le vecteur officiel utilise le secret ASCII « 12345678901234567890 ».
 */

const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

describe('base32', () => {
  it('encode puis décode sans perte', () => {
    const raw = Buffer.from('12345678901234567890', 'ascii');
    expect(base32Decode(base32Encode(raw)).toString('ascii')).toBe('12345678901234567890');
  });

  it('produit un secret de 32 caractères exploitables', () => {
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(s).length).toBe(20);
  });
});

describe('RFC 6238 — vecteurs officiels (SHA1, 6 chiffres)', () => {
  // codes à 8 chiffres du RFC ; on vérifie les 6 derniers
  const vectors: [number, string][] = [
    [59, '287082'],
    [1111111109, '081804'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ];

  for (const [t, expected] of vectors) {
    it(`T=${t} → ${expected}`, () => {
      expect(totp(RFC_SECRET, t * 1000)).toBe(expected);
    });
  }

  it('hotp à 8 chiffres reproduit le RFC', () => {
    expect(hotp(RFC_SECRET, Math.floor(59 / 30), 8)).toBe('94287082');
  });
});

describe('verifyTotp', () => {
  it('accepte le code courant', () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, totp(secret))).toBe(true);
  });

  it('accepte le pas précédent (dérive d’horloge)', () => {
    const secret = generateSecret();
    const previous = totp(secret, Date.now() - 30_000);
    expect(verifyTotp(secret, previous)).toBe(true);
  });

  it('refuse un code d’un autre secret', () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(verifyTotp(a, totp(b))).toBe(false);
  });

  it('refuse un code trop éloigné dans le temps', () => {
    const secret = generateSecret();
    const old = totp(secret, Date.now() - 10 * 60_000);
    expect(verifyTotp(secret, old)).toBe(false);
  });

  it('refuse un format invalide', () => {
    const secret = generateSecret();
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
    expect(verifyTotp(secret, '12345')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
  });

  it('tolère les espaces saisis par l’utilisateur', () => {
    const secret = generateSecret();
    const code = totp(secret);
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`)).toBe(true);
  });
});

describe('URI otpauth', () => {
  it('est conforme au format accepté par les applications', () => {
    const secret = generateSecret();
    const url = otpauthUrl(secret, 'admin@5dev.com');
    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toContain(`secret=${secret}`);
    expect(url).toContain('issuer=5DEV');
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
  });
});
