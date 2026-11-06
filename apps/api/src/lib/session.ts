import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { config } from '../config.js';
import { all, one } from '../db/index.js';

const COOKIE = 'dev5_session';

const sha = (token: string): string => createHash('sha256').update(token).digest('hex');

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  role: 'owner' | 'admin' | 'editor';
};

export async function createSession(
  userId: string,
  req: Request,
  res: Response,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const days = Number(process.env.SESSION_DAYS ?? 7);
  await one(
    `insert into sessions(user_id, token_hash, ip, user_agent, expires_at)
     values($1,$2,$3,$4, now() + ($5 || ' days')::interval) returning id`,
    [userId, sha(token), req.ip ?? null, (req.headers['user-agent'] ?? '').slice(0, 200), String(days)],
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    maxAge: days * 86_400_000,
    path: '/',
  });
  return token;
}

export async function currentUser(req: Request): Promise<SessionUser | null> {
  const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE];
  if (!token) return null;
  const row = await one<SessionUser & { expires_at: string }>(
    `select u.id, u.email, u.full_name, u.display_name, u.avatar_url, u.job_title, u.role, s.expires_at
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and u.is_active`,
    [sha(token)],
  );
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    job_title: row.job_title,
    role: row.role,
  };
}

export async function destroySession(req: Request, res: Response): Promise<void> {
  const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE];
  if (token) await all(`delete from sessions where token_hash = $1`, [sha(token)]);
  res.clearCookie(COOKIE, { path: '/' });
}

export async function purgeExpiredSessions(): Promise<void> {
  await all(`delete from sessions where expires_at < now()`);
}
