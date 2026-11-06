import { Router } from 'express';
import { z } from 'zod';
import type { ApiOk } from '@5dev/shared';
import { one } from '../db/index.js';
import { verifyPassword } from '../lib/password.js';
import { createSession, currentUser, destroySession } from '../lib/session.js';
import { decryptSecret, encryptSecret } from '../lib/secrets.js';
import { generateSecret, otpauthUrl, verifyTotp } from '../lib/totp.js';
import { AppError } from '../middlewares/errors.js';
import { rateLimit, requireAdmin, validate } from '../middlewares/auth.js';

export const authRouter: Router = Router();

const loginSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(8).max(200),
});

const otpSchema = z.object({
  challenge: z.string().uuid(),
  code: z.string().min(6).max(8),
});

const CHALLENGE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

/**
 * Connexion en deux temps.
 * 1. POST /login         → mot de passe vérifié, aucun cookie posé.
 *                          Renvoie un défi : vérification TOTP, ou enrôlement au premier login.
 * 2. POST /login/otp     → code à 6 chiffres validé, session créée.
 * Le second facteur n'est donc pas contournable : sans code valide, pas de session.
 */

authRouter.post(
  '/login',
  rateLimit({ key: 'login', max: 8, windowMs: 15 * 60_000 }),
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body as z.infer<typeof loginSchema>;
      const user = await one<{ id: string; email: string; password_hash: string; is_active: boolean; totp_secret: string | null; totp_enabled: boolean }>(
        `select id, email, password_hash, is_active, totp_secret, totp_enabled
           from users where lower(email) = lower($1)`,
        [email],
      );

      // réponse neutre : on ne révèle pas si l'email existe
      if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
        throw new AppError(401, 'BAD_CREDENTIALS', 'Identifiants invalides.');
      }

      const enroll = !user.totp_enabled || !user.totp_secret;
      const secret = enroll ? generateSecret() : decryptSecret(user.totp_secret!) ?? '';

      if (!enroll && !secret) {
        // secret illisible (clé de chiffrement changée) : on impose un ré-enrôlement
        throw new AppError(409, 'OTP_RESET_REQUIRED', 'Double authentification à réinitialiser.');
      }

      const challenge = await one<{ id: string }>(
        `insert into login_challenges(user_id, kind, secret_enc, ip, expires_at)
         values($1,$2,$3,$4, now() + ($5 || ' milliseconds')::interval)
         returning id`,
        [user.id, enroll ? 'enroll' : 'verify', enroll ? encryptSecret(secret) : null, req.ip ?? null, String(CHALLENGE_TTL_MS)],
      );

      await one(`insert into otp_events(user_id, kind, ok, ip) values($1,'challenge',$2,$3)`, [
        user.id,
        true,
        req.ip ?? null,
      ]);

      res.json({
        ok: true,
        data: {
          otp_required: true,
          enroll,
          challenge: challenge?.id,
          expires_in: Math.round(CHALLENGE_TTL_MS / 1000),
          // le secret n'est montré qu'une fois, à l'enrôlement, pour être ajouté à l'application
          ...(enroll
            ? {
                secret,
                otpauth_url: otpauthUrl(secret, user.email),
                instructions:
                  'Ouvrez votre application d’authentification (Google Authenticator, Authy…) et ajoutez ce compte, puis saisissez le code à 6 chiffres.',
              }
            : {}),
        },
      } satisfies ApiOk<unknown>);
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  '/login/otp',
  rateLimit({ key: 'login-otp', max: 10, windowMs: 15 * 60_000 }),
  validate(otpSchema),
  async (req, res, next) => {
    try {
      const { challenge, code } = req.body as z.infer<typeof otpSchema>;

      const row = await one<{
        id: string;
        user_id: string;
        kind: 'enroll' | 'verify';
        secret_enc: string | null;
        attempts: number;
        expired: boolean;
        consumed: boolean;
        totp_secret: string | null;
        email: string;
      }>(
        `select c.id, c.user_id, c.kind, c.secret_enc, c.attempts,
                (c.expires_at < now()) as expired, (c.consumed_at is not null) as consumed,
                u.totp_secret, u.email
           from login_challenges c join users u on u.id = c.user_id
          where c.id = $1`,
        [challenge],
      );

      if (!row || row.consumed) throw new AppError(401, 'CHALLENGE_INVALID', 'Demande de connexion expirée. Recommencez.');
      if (row.expired) throw new AppError(401, 'CHALLENGE_EXPIRED', 'Code expiré. Recommencez la connexion.');
      if (row.attempts >= MAX_ATTEMPTS) {
        throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives. Reconnectez-vous.');
      }

      const secret = row.kind === 'enroll' ? decryptSecret(row.secret_enc ?? '') : decryptSecret(row.totp_secret ?? '');

      if (!secret || !verifyTotp(secret, code)) {
        await one(`update login_challenges set attempts = attempts + 1 where id=$1`, [row.id]);
        await one(`insert into otp_events(user_id, kind, ok, ip) values($1,'verify',$2,$3)`, [
          row.user_id,
          false,
          req.ip ?? null,
        ]);
        const left = MAX_ATTEMPTS - (row.attempts + 1);
        throw new AppError(401, 'OTP_INVALID', `Code incorrect. ${Math.max(0, left)} tentative(s) restante(s).`);
      }

      // succès : à l'enrôlement on enregistre le secret, dans tous les cas on consomme le défi
      if (row.kind === 'enroll') {
        await one(
          `update users set totp_secret=$2, totp_enabled=true, totp_confirmed_at=now() where id=$1`,
          [row.user_id, encryptSecret(secret)],
        );
      }

      await one(`update login_challenges set consumed_at = now() where id=$1`, [row.id]);
      await one(`update users set last_login_at = now() where id=$1`, [row.user_id]);
      await one(`insert into otp_events(user_id, kind, ok, ip) values($1,'verify',$2,$3)`, [
        row.user_id,
        true,
        req.ip ?? null,
      ]);
      await one(
        `insert into audit_logs(actor_type, actor_id, action, target_type, ip)
         values('user',$1,'auth.login.otp','session',$2)`,
        [row.user_id, req.ip ?? null],
      );

      await createSession(row.user_id, req, res);

      const body: ApiOk<{ ok: true; enrolled: boolean }> = {
        ok: true,
        data: { ok: true, enrolled: row.kind === 'enroll' },
      };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

/** État de la double authentification pour l'utilisateur connecté. */
authRouter.get('/otp/status', requireAdmin, async (req, res, next) => {
  try {
    const row = await one<{ totp_enabled: boolean; totp_confirmed_at: string | null }>(
      `select totp_enabled, totp_confirmed_at from users where id=$1`,
      [req.user?.id ?? null],
    );
    res.json({ ok: true, data: { enabled: Boolean(row?.totp_enabled), since: row?.totp_confirmed_at ?? null } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    await destroySession(req, res);
    res.json({ ok: true, data: { ok: true } } satisfies ApiOk<{ ok: true }>);
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAdmin, (req, res) => {
  const body: ApiOk<{ user: typeof req.user }> = { ok: true, data: { user: req.user } };
  res.json(body);
});

export { currentUser };
