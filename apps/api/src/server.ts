import { createApp } from './app.js';
import { config } from './config.js';
import { closeDatabase, databaseState } from './db/index.js';
import { startWorker, stopWorker } from './lib/worker.js';

const app = createApp();

const server = app.listen(config.PORT, '0.0.0.0', async () => {
  const db = await databaseState();
  console.log(`[api] ${config.APP_NAME} v${config.version} — http://localhost:${config.PORT}`);
  console.log(`[api] base de données : ${db}`);
  startWorker();
  console.log('[api] worker de tâches démarré');
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[api] arrêt demandé (${signal})`);
  stopWorker();
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
  // filet de sécurité : on ne reste pas bloqué indéfiniment
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
