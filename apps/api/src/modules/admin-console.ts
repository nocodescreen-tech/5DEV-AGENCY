import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin, validate } from '../middlewares/auth.js';
import { hashPassword } from '../lib/password.js';
import { deleteSecret, readSecret, secretInfo, writeSecret } from '../lib/secrets.js';
import { databaseState } from '../db/index.js';

/**
 * Centre de gestion de la console : comptes, coffre de secrets, état de la
 * machine et conteneurs Docker.
 *
 * Règles tenues ici :
 *   1. un secret n'est JAMAIS renvoyé par une liste — seulement un indice masqué ;
 *      la révélation est une route séparée, journalisée dans `audit_logs` ;
 *   2. on ne supprime ni son propre compte ni le dernier propriétaire actif ;
 *   3. Docker est lu en lecture seule + start/stop/restart sur un conteneur
 *      explicitement nommé : aucune commande construite depuis le corps HTTP.
 */

const run = promisify(execFile);

export const adminConsoleRouter: Router = Router();

/* ------------------------------------------------------------------ comptes */

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'admin' | 'editor';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  totp_enabled: boolean;
  totp_confirmed_at: string | null;
};

adminConsoleRouter.get('/admin/users', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all<UserRow>(
      `select id, email, full_name, role, is_active, last_login_at, created_at,
              coalesce(totp_enabled, false) as totp_enabled, totp_confirmed_at
         from users
        order by (role = 'owner') desc, created_at asc`,
    );
    res.json({ ok: true, data: { users: rows } });
  } catch (err) {
    next(err);
  }
});

adminConsoleRouter.post(
  '/admin/users',
  requireAdmin,
  validate(
    z.object({
      email: z.string().email(),
      full_name: z.string().min(2).max(120),
      password: z.string().min(8).max(200),
      role: z.enum(['owner', 'admin', 'editor']).default('editor'),
    }),
  ),
  async (req, res, next) => {
    try {
      const { email, full_name, password, role } = req.body as {
        email: string;
        full_name: string;
        password: string;
        role: 'owner' | 'admin' | 'editor';
      };

      const exists = await one<{ id: string }>('select id from users where lower(email)=lower($1)', [email]);
      if (exists) throw new AppError(409, 'EMAIL_TAKEN', 'Cette adresse est déjà utilisée.');

      const row = await one<UserRow>(
        `insert into users(email, full_name, password_hash, role, is_active)
         values($1,$2,$3,$4,true)
         returning id, email, full_name, role, is_active, last_login_at, created_at`,
        [email, full_name, hashPassword(password), role],
      );

      await one(
        `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
         values('user',$1,'user.create','user',$2,$3,$4::jsonb)`,
        [req.user?.id ?? null, row?.id ?? null, req.ip ?? null, JSON.stringify({ email, role })],
      );

      res.status(201).json({ ok: true, data: { user: row } });
    } catch (err) {
      next(err);
    }
  },
);

adminConsoleRouter.patch(
  '/admin/users/:id',
  requireAdmin,
  validate(
    z.object({
      email: z.string().email().optional(),
      full_name: z.string().min(2).max(120).optional(),
      role: z.enum(['owner', 'admin', 'editor']).optional(),
      is_active: z.boolean().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const patch = req.body as { email?: string; full_name?: string; role?: string; is_active?: boolean };

      // Se désactiver soi-même ou retirer le dernier propriétaire casserait la console.
      if (id === req.user?.id && patch.is_active === false) {
        throw new AppError(409, 'SELF_LOCKOUT', 'Vous ne pouvez pas désactiver votre propre compte.');
      }

      const target = await one<{ role: string; is_active: boolean }>(
        'select role, is_active from users where id=$1',
        [id],
      );
      if (!target) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');

      if (target.role === 'owner' && (patch.role && patch.role !== 'owner' || patch.is_active === false)) {
        const owners = await one<{ n: number }>(
          "select count(*)::int as n from users where role='owner' and is_active",
        );
        if ((owners?.n ?? 0) <= 1) {
          throw new AppError(409, 'LAST_OWNER', 'Il doit rester au moins un propriétaire actif.');
        }
      }

      if (patch.email) {
        const dup = await one<{ id: string }>(
          'select id from users where lower(email)=lower($1) and id<>$2',
          [patch.email, id],
        );
        if (dup) throw new AppError(409, 'EMAIL_TAKEN', 'Cette adresse est déjà utilisée.');
      }

      const row = await one<UserRow>(
        `update users set
           email = coalesce($2, email),
           full_name = coalesce($3, full_name),
           role = coalesce($4, role),
           is_active = coalesce($5, is_active),
           updated_at = now()
         where id=$1
         returning id, email, full_name, role, is_active, last_login_at, created_at`,
        [id, patch.email ?? null, patch.full_name ?? null, patch.role ?? null, patch.is_active ?? null],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');

      await one(
        `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
         values('user',$1,'user.update','user',$2,$3,$4::jsonb)`,
        [req.user?.id ?? null, id, req.ip ?? null, JSON.stringify(patch)],
      );

      res.json({ ok: true, data: { user: row } });
    } catch (err) {
      next(err);
    }
  },
);

adminConsoleRouter.post(
  '/admin/users/:id/password',
  requireAdmin,
  validate(z.object({ password: z.string().min(8).max(200) })),
  async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const { password } = req.body as { password: string };

      const row = await one<{ id: string }>(
        `update users set password_hash=$2, updated_at=now() where id=$1 returning id`,
        [id, hashPassword(password)],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');

      // Toutes les sessions de ce compte tombent : un mot de passe changé doit
      // invalider les sessions ouvertes, sinon il ne protège rien.
      await one('delete from sessions where user_id=$1', [id]).catch(() => null);

      await one(
        `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
         values('user',$1,'user.password','user',$2,$3,'{}'::jsonb)`,
        [req.user?.id ?? null, id, req.ip ?? null],
      );

      res.json({ ok: true, data: { updated: true, sessions_revoked: true } });
    } catch (err) {
      next(err);
    }
  },
);

adminConsoleRouter.delete('/admin/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (id === req.user?.id) {
      throw new AppError(409, 'SELF_DELETE', 'Vous ne pouvez pas supprimer votre propre compte.');
    }

    const target = await one<{ role: string }>('select role from users where id=$1', [id]);
    if (!target) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');

    if (target.role === 'owner') {
      const owners = await one<{ n: number }>(
        "select count(*)::int as n from users where role='owner' and is_active",
      );
      if ((owners?.n ?? 0) <= 1) {
        throw new AppError(409, 'LAST_OWNER', 'Il doit rester au moins un propriétaire actif.');
      }
    }

    const row = await one<{ id: string }>('delete from users where id=$1 returning id', [id]);
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Compte introuvable.');

    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
       values('user',$1,'user.delete','user',$2,$3,'{}'::jsonb)`,
      [req.user?.id ?? null, id, req.ip ?? null],
    );

    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

/* --------------------------------------------------------- coffre de secrets */

const SECRET_NAME = /^[a-z0-9][a-z0-9_.-]{1,60}$/;

adminConsoleRouter.get('/admin/secrets', requireAdmin, async (_req, res, next) => {
  try {
    // Liste blanche de noms : les valeurs restent en base, chiffrées.
    const rows = await all<{ name: string; hint: string | null; updated_at: string }>(
      'select name, hint, updated_at from secrets order by name',
    );
    res.json({ ok: true, data: { secrets: rows } });
  } catch (err) {
    next(err);
  }
});

adminConsoleRouter.put('/admin/secrets/:name', requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.params.name).toLowerCase();
    if (!SECRET_NAME.test(name)) throw new AppError(422, 'INVALID_NAME', 'Nom de clé invalide.');

    const parsed = z.object({ value: z.string().min(1).max(4000) }).safeParse(req.body);
    if (!parsed.success) throw new AppError(422, 'VALIDATION', 'Valeur manquante.');

    const { hint } = await writeSecret(name, parsed.data.value.trim());
    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
       values('user',$1,'secret.write','secret',$2,$3,'{}'::jsonb)`,
      [req.user?.id ?? null, name, req.ip ?? null],
    );

    res.json({ ok: true, data: { saved: true, name, hint } });
  } catch (err) {
    next(err);
  }
});

adminConsoleRouter.post('/admin/secrets/:name/reveal', requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.params.name).toLowerCase();
    const value = await readSecret(name);
    if (value === null) throw new AppError(404, 'NOT_FOUND', 'Clé absente ou illisible (secret serveur modifié ?).');

    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
       values('user',$1,'secret.reveal','secret',$2,$3,'{}'::jsonb)`,
      [req.user?.id ?? null, name, req.ip ?? null],
    ).catch(() => null);

    res.json({ ok: true, data: { name, value } });
  } catch (err) {
    next(err);
  }
});

adminConsoleRouter.delete('/admin/secrets/:name', requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.params.name).toLowerCase();
    const info = await secretInfo(name);
    if (!info.configured) throw new AppError(404, 'NOT_FOUND', 'Clé introuvable.');

    await deleteSecret(name);
    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
       values('user',$1,'secret.delete','secret',$2,$3,'{}'::jsonb)`,
      [req.user?.id ?? null, name, req.ip ?? null],
    ).catch(() => null);

    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------------- état et Docker */

adminConsoleRouter.get('/admin/system', requireAdmin, async (_req, res, next) => {
  try {
    const info = await one<{
      version: string;
      db_size: string;
      connections: number;
      started: string;
    }>(
      `select current_setting('server_version') as version,
              pg_size_pretty(pg_database_size(current_database())) as db_size,
              (select count(*)::int from pg_stat_activity where datname = current_database()) as connections,
              (select to_char(now(), 'YYYY-MM-DD HH24:MI:SS')) as started`,
    );

    const counts = await one<Record<string, number>>(
      `select (select count(*) from users)::int as users,
              (select count(*) from projects_pm where deleted_at is null)::int as projects,
              (select count(*) from tasks)::int as tasks,
              (select count(*) from leads)::int as leads,
              (select count(*) from secrets)::int as secrets`,
    );

    res.json({
      ok: true,
      data: {
        runtime: {
          node: process.version,
          platform: `${process.platform} ${process.arch}`,
          uptime_seconds: Math.round(process.uptime()),
          env: process.env.NODE_ENV ?? 'development',
          port: Number(process.env.PORT ?? 4000),
        },
        database: { state: await databaseState(), ...info },
        counts,
      },
    });
  } catch (err) {
    next(err);
  }
});

type DockerContainer = {
  ID: string;
  Names: string;
  Image: string;
  State: string;
  Status: string;
  Ports?: string;
  CreatedAt?: string;
};

/** `docker` absent ou démon arrêté n'est pas une erreur : c'est un état à afficher. */
async function dockerAvailable(): Promise<{ ok: boolean; message?: string }> {
  try {
    await run('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 6000 });
    return { ok: true };
  } catch {
    return { ok: false, message: 'Docker n’est pas joignable depuis cette machine (démon arrêté ou absent).' };
  }
}

adminConsoleRouter.get('/admin/system/docker', requireAdmin, async (_req, res, next) => {
  try {
    const available = await dockerAvailable();
    if (!available.ok) {
      res.json({ ok: true, data: { available: false, message: available.message, containers: [] } });
      return;
    }

    // --format json : une ligne JSON par conteneur, pas de parsing de tableau.
    const { stdout } = await run('docker', ['ps', '-a', '--format', '{{json .}}'], {
      timeout: 10000,
      maxBuffer: 4 * 1024 * 1024,
    });

    const containers = stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          const c = JSON.parse(line) as DockerContainer;
          return {
            id: c.ID,
            name: c.Names,
            image: c.Image,
            state: c.State,
            status: c.Status,
            ports: c.Ports ?? '',
          };
        } catch {
          return null;
        }
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    res.json({ ok: true, data: { available: true, containers } });
  } catch (err) {
    next(err);
  }
});

adminConsoleRouter.post('/admin/system/docker/:id/:action', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const action = String(req.params.action);

    // Identifiant de conteneur uniquement : rien d'autre ne part vers le shell.
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,80}$/.test(id)) {
      throw new AppError(422, 'INVALID_ID', 'Identifiant de conteneur invalide.');
    }
    if (!['start', 'stop', 'restart'].includes(action)) {
      throw new AppError(422, 'INVALID_ACTION', 'Action non autorisée.');
    }

    await run('docker', [action, id], { timeout: 30000 });
    await one(
      `insert into audit_logs(actor_type, actor_id, action, target_type, target_id, ip, meta)
       values('user',$1,'docker.'||$2,'container',$3,$4,'{}'::jsonb)`,
      [req.user?.id ?? null, action, id, req.ip ?? null],
    ).catch(() => null);

    res.json({ ok: true, data: { done: true, container: id, action } });
  } catch (err) {
    next(err);
  }
});
