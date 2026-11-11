import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { healthRouter } from './routes/health.js';
import { authRouter } from './modules/auth.js';
import { catalogRouter } from './modules/catalog.js';
import { bookingsRouter, leadsRouter } from './modules/intake.js';
import { dashboardRouter } from './modules/dashboard.js';
import { aiRouter } from './modules/ai/routes.js';
import { emailRouter } from './modules/email.js';
import { newsletterRouter } from './modules/newsletter.js';
import { automationRouter } from './modules/automation.js';
import { prefsRouter } from './modules/prefs.js';
import { workspaceRouter } from './modules/workspace.js';
import { workspacePlanRouter } from './modules/workspace-plan.js';
import { aiChatRouter } from './modules/ai-chat.js';
import { profileRouter } from './modules/profile.js';
import { adminConsoleRouter } from './modules/admin-console.js';
import { credentialsRouter } from './modules/credentials.js';
import { marketRouter } from './modules/market.js';
import { errorHandler, notFound } from './middlewares/errors.js';
import { corsAllowlist, securityHeaders } from './middlewares/security.js';
import { currentUser } from './lib/session.js';

/**
 * Application Express (sans écoute réseau) : testable directement avec supertest.
 */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use(securityHeaders);
  app.use(corsAllowlist);

  // session facultative sur toutes les routes (les médias privés en ont besoin)
  app.use(async (req, _res, next) => {
    try {
      req.user = (await currentUser(req)) ?? undefined;
    } catch {
      req.user = undefined;
    }
    next();
  });

  app.use('/api/v1', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', catalogRouter);
  app.use('/api/v1', leadsRouter);
  app.use('/api/v1', bookingsRouter);
  app.use('/api/v1', dashboardRouter);
  app.use('/api/v1', aiRouter);
  app.use('/api/v1', emailRouter);
  app.use('/api/v1', newsletterRouter);
  app.use('/api/v1', automationRouter);
  app.use('/api/v1', prefsRouter);
  app.use('/api/v1', workspaceRouter);
  app.use('/api/v1', workspacePlanRouter);
  app.use('/api/v1', aiChatRouter);
  app.use('/api/v1', profileRouter);
  app.use('/api/v1', adminConsoleRouter);
  app.use('/api/v1', credentialsRouter);
  app.use('/api/v1', marketRouter);
  app.use(healthRouter); // /healthz à la racine pour les sondes d'hébergeur

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
