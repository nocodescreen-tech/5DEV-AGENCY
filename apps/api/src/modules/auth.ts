import { Router } from 'express';
import { z } from 'zod';
import type { ApiOk } from '@5dev/shared';
import { one } from '../db/index.js';
import { verifyPassword } from '../lib/password.js';
import { createSession, currentUser, destroySession } from '../lib/session.js';
import { AppError } from '../middlewares/errors.js';
import { rateLimit, requireAdmin, validate } from '../middlewares/auth.js';

export const authRouter: Router = Router();

const loginSchema = z.object({
  email: z.string().email().max(180),
  password: z.string().min(8).max(200),
});

authRouter.post(
  '/login',
  rateLimit({ key: 'login', max: 8, windowMs: 15 * 60_000 }),
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body as z.infer<typeof loginSchema>;
      const user = await one<{ id: string; password_hash: string; is_active: boolean }>(
        `select id, password_hash, is_active from users where lower(email) = lower($1)`,
        [email],
      );
      // réponse neutre : on ne révèle pas si l'email existe
      if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
        throw new AppError(401, 'BAD_CREDENTIALS', 'Identifiants invalides.');
      }
      await createSession(user.id, req, res);
      await one(`update users set last_login_at = now() where id = $1`, [user.id]);
      await one(
        `insert into audit_logs(actor_type, actor_id, action, target_type, ip)
         values('user',$1,'auth.login','session',$2)`,
        [user.id, req.ip ?? null],
      );
      const body: ApiOk<{ ok: true }> = { ok: true, data: { ok: true } };
      res.json(body);
    } catch (err) {
      next(err);
    }
  },
);

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
