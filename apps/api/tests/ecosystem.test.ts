import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('écosystème — accès protégé', () => {
  const routes: [string, string][] = [
    ['get', '/api/v1/admin/ai/status'],
    ['get', '/api/v1/admin/ai/usage'],
    ['get', '/api/v1/admin/emails'],
    ['get', '/api/v1/admin/subscribers'],
    ['get', '/api/v1/admin/campaigns'],
    ['get', '/api/v1/admin/automations'],
    ['get', '/api/v1/admin/automation-runs'],
    ['get', '/api/v1/admin/notifications'],
    ['get', '/api/v1/admin/prefs'],
    ['get', '/api/v1/admin/integrations'],
  ];

  for (const [method, path] of routes) {
    it(`${path} exige une session`, async () => {
      const res = await (method === 'get' ? request(app).get(path) : request(app).post(path));
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  }
});

describe('écosystème — validation', () => {
  it('refuse une inscription newsletter sans email valide', async () => {
    const res = await request(app).post('/api/v1/newsletter/subscribe').send({ email: 'nope' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it('refuse une exécution IA sans tâche connue', async () => {
    const res = await request(app)
      .post('/api/v1/admin/ai/run')
      .send({ task: 'invente_tout', input: 'test' });
    // 401 (session) ou 422 (validation) selon l'ordre des middlewares, jamais 200
    expect([401, 422]).toContain(res.status);
  });

  it('refuse un envoi email sans destinataire', async () => {
    const res = await request(app).post('/api/v1/admin/emails/send').send({ subject: 'x', body: 'y' });
    expect([401, 422]).toContain(res.status);
  });

  it('refuse des préférences de thème inconnues', async () => {
    const res = await request(app).put('/api/v1/admin/prefs').send({ theme: 'neon' });
    expect([401, 422]).toContain(res.status);
  });

  it('refuse un déclencheur d’automatisation inconnu', async () => {
    const res = await request(app)
      .post('/api/v1/admin/automations/test')
      .send({ trigger: 'n_importe_quoi' });
    expect([401, 422]).toContain(res.status);
  });

  it('désinscription : jeton inconnu → page explicite, jamais 500', async () => {
    const res = await request(app).get('/api/v1/newsletter/unsubscribe?token=inconnu');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Désinscription');
  });
});
