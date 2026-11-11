import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin, validate } from '../middlewares/auth.js';
import { decryptSecret, encryptSecret } from '../lib/secrets.js';

/**
 * Gestionnaire de comptes des autres applications.
 *
 * Un compte = application + identifiant + mot de passe chiffré + où se connecter.
 * Le mot de passe n'est renvoyé que par `POST /:id/reveal`, route journalisée ;
 * la liste ne transporte qu'un indice masqué. Un doublon (même application +
 * même identifiant) est refusé : au moment de se connecter il faut UNE entrée.
 */

export const CREDENTIAL_CATEGORIES = [
  'hebergement',
  'base-de-donnees',
  'email',
  'paiement',
  'cms',
  'reseaux-sociaux',
  'registrar',
  'outil-interne',
  'autre',
] as const;

export const credentialsRouter: Router = Router();

/** Indice lisible sans révéler le secret : longueur + extrémités. */
function hintOf(password: string): string {
  if (password.length <= 8) return `${password.length} caractères`;
  return `${password.slice(0, 2)}…${password.slice(-2)} · ${password.length} caractères`;
}

const body = z.object({
  app_name: z.string().min(2).max(80),
  category: z.enum(CREDENTIAL_CATEGORIES).default('autre'),
  username: z.string().max(200).nullish(),
  password: z.string().min(1).max(400),
  url: z.string().max(300).nullish(),
  notes: z.string().max(1000).nullish(),
});

credentialsRouter.get('/admin/credentials', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all<{
      id: string;
      app_name: string;
      category: string;
      username: string | null;
      url: string | null;
      notes: string;
      password_enc: string;
      updated_at: string;
      last_revealed_at: string | null;
    }>(
      `select id, app_name, category, username, url, notes, password_enc, updated_at, last_revealed_at
         from app_credentials
        order by lower(app_name), lower(coalesce(username, ''))`,
    );

    const credentials = rows.map((r) => {
      const plain = decryptSecret(r.password_enc);
      return {
        id: r.id,
        app_name: r.app_name,
        category: r.category,
        username: r.username,
        url: r.url,
        notes: r.notes,
        updated_at: r.updated_at,
        last_revealed_at: r.last_revealed_at,
        hint: plain ? hintOf(plain) : 'illisible (secret serveur modifié ?)',
      };
    });

    res.json({ ok: true, data: { credentials, categories: CREDENTIAL_CATEGORIES } });
  } catch (err) {
    next(err);
  }
});

credentialsRouter.post('/admin/credentials', requireAdmin, async (req, res, next) => {
  try {
    const parsed = body.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(422, 'VALIDATION', parsed.error.issues[0]?.message ?? 'Champs invalides.');
    }
    const c = parsed.data;

    const dup = await one<{ id: string }>(
      `select id from app_credentials
        where lower(app_name)=lower($1) and lower(coalesce(username,''))=lower(coalesce($2,''))`,
      [c.app_name, c.username ?? null],
    );
    if (dup) {
      throw new AppError(409, 'DUPLICATE', 'Ce compte existe déjà pour cette application. Modifiez-le plutôt.');
    }

    const row = await one<{ id: string }>(
      `insert into app_credentials(app_name, category, username, password_enc, url, notes)
       values($1,$2,$3,$4,$5,$6) returning id`,
      [c.app_name, c.category, c.username ?? null, encryptSecret(c.password), c.url ?? null, c.notes ?? ''],
    );

    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
       values('user',$1,'credential.create','credential',$2,$3,$4::jsonb)`,
      [req.user?.id ?? null, row?.id ?? null, req.ip ?? null, JSON.stringify({ app_name: c.app_name })],
    ).catch(() => null);

    res.status(201).json({ ok: true, data: { id: row?.id } });
  } catch (err) {
    next(err);
  }
});

credentialsRouter.patch('/admin/credentials/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!z.string().uuid().safeParse(id).success) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');

    const parsed = body.partial().safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(422, 'VALIDATION', parsed.error.issues[0]?.message ?? 'Champs invalides.');
    }
    const c = parsed.data;

    const row = await one<{ id: string }>(
      `update app_credentials set
         app_name = coalesce($2, app_name),
         category = coalesce($3, category),
         username = coalesce($4, username),
         password_enc = coalesce($5, password_enc),
         url = coalesce($6, url),
         notes = coalesce($7, notes),
         updated_at = now()
       where id=$1 returning id`,
      [
        id,
        c.app_name ?? null,
        c.category ?? null,
        c.username ?? null,
        c.password ? encryptSecret(c.password) : null,
        c.url ?? null,
        c.notes ?? null,
      ],
    );
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');

    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
       values('user',$1,'credential.update','credential',$2,$3,'{}'::jsonb)`,
      [req.user?.id ?? null, id, req.ip ?? null],
    ).catch(() => null);

    res.json({ ok: true, data: { updated: true } });
  } catch (err) {
    next(err);
  }
});

credentialsRouter.post('/admin/credentials/:id/reveal', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!z.string().uuid().safeParse(id).success) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');

    const row = await one<{ app_name: string; password_enc: string }>(
      'select app_name, password_enc from app_credentials where id=$1',
      [id],
    );
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');

    const password = decryptSecret(row.password_enc);
    if (password === null) {
      throw new AppError(
        409,
        'UNDECRYPTABLE',
        'Mot de passe illisible : SESSION_SECRET a changé. Ressaisissez-le.',
      );
    }

    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
       values('user',$1,'credential.reveal','credential',$2,$3,$4::jsonb)`,
      [req.user?.id ?? null, id, req.ip ?? null, JSON.stringify({ app_name: row.app_name })],
    ).catch(() => null);
    await one('update app_credentials set last_revealed_at = now() where id=$1', [id]).catch(() => null);

    res.json({ ok: true, data: { password } });
  } catch (err) {
    next(err);
  }
});

credentialsRouter.delete('/admin/credentials/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!z.string().uuid().safeParse(id).success) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');

    const row = await one<{ id: string }>('delete from app_credentials where id=$1 returning id', [id]);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');

    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
       values('user',$1,'credential.delete','credential',$2,$3,'{}'::jsonb)`,
      [req.user?.id ?? null, id, req.ip ?? null],
    ).catch(() => null);

    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

/**
 * Générateur cryptographique. `crypto.randomInt` est un générateur d'octets
 * aléatoires du système : jamais `Math.random`, qui est prédictible.
 * Chaque catégorie demandée est représentée au moins une fois, puis le résultat
 * est mélangé (Fisher-Yates) pour ne pas laisser les caractères imposés en tête.
 */
credentialsRouter.post(
  '/admin/credentials/generate',
  requireAdmin,
  validate(
    z.object({
      length: z.number().int().min(12).max(128).default(20),
      symbols: z.boolean().default(true),
      digits: z.boolean().default(true),
      uppercase: z.boolean().default(true),
      avoid_ambiguous: z.boolean().default(true),
    }),
  ),
  async (req, res, next) => {
    try {
      const o = req.body as {
        length: number;
        symbols: boolean;
        digits: boolean;
        uppercase: boolean;
        avoid_ambiguous: boolean;
      };

      const LOWER = 'abcdefghijkmnopqrstuvwxyz';
      const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const DIGITS = '23456789';
      const SYMBOLS = '!@#$%&*+-=?';
      const strip = (s: string) => (o.avoid_ambiguous ? s.replace(/[Il1O0o]/g, '') : s);

      const sets: string[] = [LOWER];
      if (o.uppercase) sets.push(UPPER);
      if (o.digits) sets.push(DIGITS);
      if (o.symbols) sets.push(SYMBOLS);

      const pool = sets.map(strip).join('');
      const pick = (alphabet: string) => alphabet[crypto.randomInt(alphabet.length)] ?? '';

      const chars: string[] = sets.map((s) => pick(strip(s)));
      while (chars.length < o.length) chars.push(pick(pool));

      for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = crypto.randomInt(i + 1);
        const a = chars[i];
        const b = chars[j];
        if (a !== undefined && b !== undefined) {
          chars[i] = b;
          chars[j] = a;
        }
      }

      res.json({ ok: true, data: { password: chars.join('') } });
    } catch (err) {
      next(err);
    }
  },
);
