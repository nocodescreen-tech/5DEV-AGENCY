import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// `.env` vit à la racine du dépôt (apps/api/src/config.ts → ../../../.env).
// Silencieux si absent : en production, tout vient de l'environnement.
loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

/**
 * Configuration serveur validée au démarrage.
 * Aucune valeur secrète n'a de défaut : si elle manque, on le sait tout de suite.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_NAME: z.string().default('5DEV'),
  APP_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z
    .string()
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  DEFAULT_CURRENCY: z.enum(['USD', 'CDF']).default('USD'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof schema> & { version: string };

function readVersion(): string {
  return process.env.npm_package_version ?? '0.1.0';
}

function load(): Config {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(' | ');
    throw new Error(`Configuration invalide — ${details}`);
  }
  return { ...parsed.data, version: readVersion() };
}

export const config: Config = load();
export const isTest = config.NODE_ENV === 'test';
