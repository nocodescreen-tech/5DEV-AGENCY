import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from './errors.js';
import { currentUser } from '../lib/session.js';
import type { SessionUser } from '../lib/session.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

/** Valide body/query/params avec un schéma zod et remplace par la valeur typée. */
export function validate<T extends z.ZodTypeAny>(schema: T, part: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'valeur';
        if (!fields[key]) fields[key] = issue.message;
      }
      next(new AppError(422, 'VALIDATION', 'Données invalides.', fields));
      return;
    }
    req[part] = result.data as never;
    next();
  };
}

/** Exige une session administrateur valide. */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await currentUser(req);
    if (!user) {
      next(new AppError(401, 'UNAUTHENTICATED', 'Connexion requise.'));
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/* ---------------- limiteur de débit en mémoire (anti-spam) ---------------- */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(opts: { key: string; max: number; windowMs: number }) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const id = `${opts.key}:${req.ip ?? 'anon'}`;
    const now = Date.now();
    const bucket = buckets.get(id);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(id, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > opts.max) {
      next(new AppError(429, 'RATE_LIMITED', 'Trop de tentatives. Réessayez plus tard.'));
      return;
    }
    next();
  };
}

/** Nettoyage périodique des compteurs (évite la croissance mémoire). */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
}, 60_000).unref();
