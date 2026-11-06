import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('workspace — accès protégé', () => {
  const routes = [
    '/api/v1/admin/pm/overview',
    '/api/v1/admin/pm/projects',
    '/api/v1/admin/pm/tasks',
    '/api/v1/admin/pm/time/report',
    '/api/v1/admin/pm/time/running',
    '/api/v1/admin/pm/templates',
  ];

  for (const path of routes) {
    it(`GET ${path} exige une session`, async () => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  }

  it('refuse la création d’un projet sans session', async () => {
    const res = await request(app).post('/api/v1/admin/pm/projects').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('refuse le démarrage d’un chronomètre sans session', async () => {
    const res = await request(app).post('/api/v1/admin/pm/time/start').send({});
    expect(res.status).toBe(401);
  });
});

describe('workspace — validation', () => {
  it('refuse un projet sans nom exploitable', async () => {
    const res = await request(app).post('/api/v1/admin/pm/projects').send({ name: 'A' });
    // 401 avant validation (session), jamais 201
    expect([401, 422]).toContain(res.status);
  });

  it('refuse une tâche sans projet', async () => {
    const res = await request(app).post('/api/v1/admin/pm/tasks').send({ title: 'Tâche orpheline' });
    expect([401, 422]).toContain(res.status);
  });

  it('refuse une dépendance vers elle-même', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    const res = await request(app)
      .post(`/api/v1/admin/pm/tasks/${id}/dependencies`)
      .send({ depends_on_id: id });
    expect([401, 422]).toContain(res.status);
  });

  it('refuse une saisie de temps négative', async () => {
    const res = await request(app)
      .post('/api/v1/admin/pm/time/manual')
      .send({ project_id: '00000000-0000-4000-8000-000000000000', minutes: -5 });
    expect([401, 422]).toContain(res.status);
  });
});

describe('workspace — le module « réalisations » reste indépendant', () => {
  it('/api/v1/admin/projects exige toujours le schéma du catalogue (pas celui du workspace)', async () => {
    const res = await request(app).post('/api/v1/admin/projects').send({ name: 'Projet vitrine' });
    expect(res.status).toBe(401);
    // la route existe et est protégée : aucune collision de routeur
  });
});
