import { Sequelize, QueryTypes } from 'sequelize';
import { config } from '../config.js';

/**
 * Couche base de données : Sequelize comme driver unique (pool, types, échappement),
 * requêtes SQL explicites pour rester lisibles et proches du schéma (ADR-008).
 */
export const sequelize: Sequelize | null = config.DATABASE_URL
  ? new Sequelize(config.DATABASE_URL, {
      dialect: 'postgres',
      logging: config.LOG_LEVEL === 'debug' ? console.log : false,
      dialectOptions: config.DATABASE_SSL
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : undefined,
      pool: { max: 10, min: 0, idle: 10_000 },
    })
  : null;

export type DbState = 'up' | 'down' | 'not_configured';

export async function databaseState(): Promise<DbState> {
  if (!sequelize) return 'not_configured';
  try {
    await sequelize.authenticate();
    return 'up';
  } catch {
    return 'down';
  }
}

function requireDb(): Sequelize {
  if (!sequelize) throw new Error('DATABASE_URL absent : base non configurée');
  return sequelize;
}

/** Toutes les lignes d'une requête SELECT. */
export async function all<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const rows = await requireDb().query(sql, { bind: params, type: QueryTypes.SELECT });
  return rows as T[];
}

/** Première ligne ou null. */
export async function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await all<T>(sql, params);
  return rows[0] ?? null;
}

/** Exécute un ordre (insert/update/delete) et renvoie les lignes RETURNING. */
export async function run<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = (await requireDb().query(sql, { bind: params })) as unknown;
  // Sequelize renvoie [résultat, métadonnées] ; les RETURNING sont dans le 2e élément.
  if (Array.isArray(result) && Array.isArray(result[1])) return result[1] as T[];
  return [];
}

export async function closeDatabase(): Promise<void> {
  if (sequelize) await sequelize.close();
}
