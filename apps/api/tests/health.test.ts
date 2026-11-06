import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /healthz', () => {
  it('répond 200 avec une charge normalisée', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.service).toBeTruthy();
    expect(res.body.data.version).toBeTruthy();
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
    expect(['up', 'down', 'not_configured']).toContain(res.body.data.database);
    expect(() => new Date(res.body.data.timestamp).toISOString()).not.toThrow();
  });

  it('est aussi exposé sous /api/v1', async () => {
    const res = await request(app).get('/api/v1/healthz');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('gestion des erreurs', () => {
  it('renvoie une erreur normalisée en 404 pour une route inconnue', async () => {
    const res = await request(app).get('/route/inexistante');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('Route inconnue');
  });

  it('expose les en-têtes de durcissement de base', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
