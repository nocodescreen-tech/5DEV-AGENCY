import { Router } from 'express';
import type { ApiOk, HealthPayload } from '@5dev/shared';
import { config } from '../config.js';
import { databaseState } from '../db/index.js';

export const healthRouter: Router = Router();

/**
 * Sonde de santé : publique, sans secret, utilisable par un hébergeur
 * (répond 200 même si la base est absente — l'état est dans le corps).
 */
healthRouter.get('/healthz', async (_req, res) => {
  const payload: HealthPayload = {
    service: config.APP_NAME,
    version: config.version,
    uptimeSeconds: Math.round(process.uptime()),
    database: await databaseState(),
    timestamp: new Date().toISOString(),
  };
  const body: ApiOk<HealthPayload> = { ok: true, data: payload };
  res.status(200).json(body);
});
