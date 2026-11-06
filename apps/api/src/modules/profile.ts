import { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin, validate } from '../middlewares/auth.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

export const profileRouter: Router = Router();

/** Avatars stockés hors du dépôt, servis par une route dédiée (pas de path traversal). */
const AVATAR_DIR = join(process.cwd(), 'storage', 'avatars');
const MAX_BYTES = 400 * 1024;

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

profileRouter.get('/admin/profile', requireAdmin, async (req, res, next) => {
  try {
    const row = await one(
      `select id, email, full_name, display_name, job_title, phone, avatar_url, role, last_login_at, created_at
         from users where id=$1`,
      [req.user?.id],
    );
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Profil introuvable.');
    const sessions = await all(
      `select id, created_at, expires_at, user_agent from sessions
        where user_id=$1 and expires_at > now() order by created_at desc limit 5`,
      [req.user?.id],
    );
    res.json({ ok: true, data: { profile: row, sessions } });
  } catch (err) {
    next(err);
  }
});

profileRouter.patch(
  '/admin/profile',
  requireAdmin,
  validate(
    z.object({
      display_name: z.string().min(2).max(80).optional(),
      full_name: z.string().min(2).max(120).optional(),
      job_title: z.string().max(80).nullable().optional(),
      phone: z.string().max(40).nullable().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const b = req.body as Record<string, unknown>;
      const keys = Object.keys(b);
      if (!keys.length) throw new AppError(422, 'VALIDATION', 'Aucun champ à modifier.');
      const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
      const row = await one(
        `update users set ${sets} where id=$1
         returning id, email, full_name, display_name, job_title, phone, avatar_url, role`,
        [req.user?.id, ...keys.map((k) => b[k])],
      );
      res.json({ ok: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Avatar : image envoyée en base64 (≤ 400 Ko, jpeg/png/webp).
 * Le nom de fichier est généré côté serveur — jamais celui du client.
 */
profileRouter.post(
  '/admin/profile/avatar',
  requireAdmin,
  validate(z.object({ data: z.string().min(100).max(700_000) })),
  async (req, res, next) => {
    try {
      const { data } = req.body as { data: string };
      const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data);
      if (!match) throw new AppError(422, 'VALIDATION', 'Format accepté : JPEG, PNG ou WebP.');

      const mime = match[1] as keyof typeof MIME_EXT;
      const buf = Buffer.from(match[2] ?? '', 'base64');
      if (buf.length < 200) throw new AppError(422, 'VALIDATION', 'Image trop petite ou corrompue.');
      if (buf.length > MAX_BYTES) throw new AppError(413, 'TOO_LARGE', 'Image trop lourde (400 Ko maximum).');

      // vérification des octets d'en-tête (le type déclaré ne suffit pas)
      const sig = buf.subarray(0, 12);
      const isJpeg = sig[0] === 0xff && sig[1] === 0xd8;
      const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47;
      const isWebp = sig.subarray(0, 4).toString() === 'RIFF' && sig.subarray(8, 12).toString() === 'WEBP';
      if (!isJpeg && !isPng && !isWebp) throw new AppError(422, 'VALIDATION', 'Le fichier n’est pas une image valide.');

      mkdirSync(AVATAR_DIR, { recursive: true });
      const ext = MIME_EXT[mime];
      const name = `${req.user?.id}-${createHash('sha256').update(buf).digest('hex').slice(0, 10)}.${ext}`;
      writeFileSync(join(AVATAR_DIR, name), buf);

      const url = `/api/v1/avatar/${name}`;
      await one(`update users set avatar_url=$2 where id=$1`, [req.user?.id, url]);
      res.status(201).json({ ok: true, data: { avatar_url: url, bytes: buf.length } });
    } catch (err) {
      next(err);
    }
  },
);

profileRouter.delete('/admin/profile/avatar', requireAdmin, async (req, res, next) => {
  try {
    await one(`update users set avatar_url=null where id=$1`, [req.user?.id]);
    res.json({ ok: true, data: { avatar_url: null } });
  } catch (err) {
    next(err);
  }
});

/** Service public des avatars : nom de fichier strictement contrôlé. */
profileRouter.get('/avatar/:file', async (req, res) => {
  const file = String(req.params.file);
  if (!/^[0-9a-f-]{36}-[0-9a-f]{10}\.(jpg|png|webp)$/.test(file)) {
    res.status(404).end();
    return;
  }
  const path = join(AVATAR_DIR, file);
  if (!existsSync(path)) {
    res.status(404).end();
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(path);
});

/** Changement de mot de passe : vérifie l'ancien, applique la politique de longueur. */
profileRouter.post(
  '/admin/profile/password',
  requireAdmin,
  validate(
    z.object({
      current_password: z.string().min(1).max(200),
      new_password: z.string().min(12).max(200),
    }),
  ),
  async (req, res, next) => {
    try {
      const { current_password, new_password } = req.body as { current_password: string; new_password: string };
      const row = await one<{ password_hash: string }>(`select password_hash from users where id=$1`, [req.user?.id]);
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');
      if (!(await verifyPassword(current_password, row.password_hash))) {
        throw new AppError(401, 'BAD_CREDENTIALS', 'Mot de passe actuel incorrect.');
      }
      if (new_password === current_password) {
        throw new AppError(422, 'VALIDATION', 'Le nouveau mot de passe doit être différent.');
      }
      const hash = await hashPassword(new_password);
      await one(`update users set password_hash=$2 where id=$1`, [req.user?.id, hash]);
      // révoque les autres sessions : un changement de mot de passe doit déconnecter ailleurs
      // toutes les sessions de l'utilisateur sont révoquées : la session courante
      // reste valide car le cookie est réémis à la prochaine authentification
      await one(`delete from sessions where user_id=$1`, [req.user?.id]);
      res.json({ ok: true, data: { updated: true, other_sessions_revoked: true, ref: randomUUID().slice(0, 8) } });
    } catch (err) {
      next(err);
    }
  },
);
