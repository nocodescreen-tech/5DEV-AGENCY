import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('en-têtes de sécurité', () => {
  it('pose les en-têtes durcis et interdit le reniflage de type', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['permissions-policy']).toContain('camera=()');
  });

  it('interdit la mise en cache des réponses API', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('CORS', () => {
  it('accepte uniquement une origine connue', async () => {
    const res = await request(app).get('/healthz').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('ne pose aucun en-tête CORS pour une origine inconnue', async () => {
    const res = await request(app).get('/healthz').set('Origin', 'https://mechant.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('répond au pré-vol sans divulguer de données', async () => {
    const res = await request(app).options('/api/v1/leads').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(204);
  });
});

describe('refus par défaut', () => {
  const routes = [
    '/api/v1/admin/prefs',
    '/api/v1/admin/leads',
    '/api/v1/admin/pm/projects',
    '/api/v1/admin/ai/models',
    '/api/v1/admin/ai/key',
    '/api/v1/admin/ai-chat/conversations',
    '/api/v1/admin/emails',
    '/api/v1/admin/subscribers',
  ];

  for (const path of routes) {
    it(`${path} → 401 sans session`, async () => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  }

  it('une route inconnue renvoie une 404 normalisée, sans fuite de pile', async () => {
    const res = await request(app).get('/api/v1/route-inexistante');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/at |\.ts|node_modules/);
  });
});

describe('aucun secret dans les réponses publiques', () => {
  it('/healthz n’expose ni clé ni chaîne de connexion', async () => {
    const res = await request(app).get('/healthz');
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/nvapi-|postgres:\/\/|password|secret/i);
  });
});
