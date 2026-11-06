import express, { type Express } from 'express';
import { healthRouter } from './routes/health.js';
import { errorHandler, notFound } from './middlewares/errors.js';

/**
 * Application Express (sans écoute réseau) : testable directement avec supertest.
 */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // En-têtes de base (durcissement minimal ; CSP côté front en production)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  app.use('/api/v1', healthRouter);
  app.use(healthRouter); // /healthz à la racine pour les sondes d'hébergeur

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
