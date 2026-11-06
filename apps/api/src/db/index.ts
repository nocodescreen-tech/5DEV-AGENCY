import { Sequelize } from 'sequelize';
import { config } from '../config.js';

/**
 * Connexion base de données.
 * Optionnelle au démarrage : le squelette doit pouvoir tourner sans Postgres
 * (utile en CI et pour `/healthz`), mais signale clairement l'état.
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

/** Ping court : ne lève jamais, renvoie l'état pour /healthz. */
export async function databaseState(): Promise<DbState> {
  if (!sequelize) return 'not_configured';
  try {
    await sequelize.authenticate();
    return 'up';
  } catch {
    return 'down';
  }
}

export async function closeDatabase(): Promise<void> {
  if (sequelize) await sequelize.close();
}
