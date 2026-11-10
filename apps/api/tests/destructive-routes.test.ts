import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

/**
 * Gardes des routes destructives : sans session, rien ne doit être supprimé.
 * Ces tests ne touchent pas la base : le 401 tombe avant toute requête SQL.
 */

const app = createApp();

const DELETE_ROUTES = [
  '/api/v1/admin/leads/:id',
  '/api/v1/admin/bookings/:id',
  '/api/v1/admin/services/:id',
  '/api/v1/admin/projects/:id',
  '/api/v1/admin/pm/projects/:id',
  '/api/v1/admin/pm/tasks/:id',
  '/api/v1/admin/pm/notes/:id',
  '/api/v1/admin/pm/documents/:id',
  '/api/v1/admin/pm/milestones/:id',
  '/api/v1/admin/ai-chat/conversations/:id',
];

describe('suppressions — session obligatoire', () => {
  const id = '00000000-0000-4000-8000-000000000000';

  for (const route of DELETE_ROUTES) {
    it(`DELETE ${route} sans session → 401`, async () => {
      const res = await request(app).delete(route.replace(':id', id));
      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBe('UNAUTHENTICATED');
    });
  }
});

describe('actions assistées — session obligatoire', () => {
  it('refuse l’exécution sans session', async () => {
    const res = await request(app)
      .post('/api/v1/admin/ai-chat/actions/execute')
      .send({ action: 'task_delete', params: { task_id: '00000000-0000-4000-8000-000000000000' } });
    expect(res.status).toBe(401);
  });

  it('refuse la lecture de la liste blanche sans session', async () => {
    const res = await request(app).get('/api/v1/admin/ai-chat/actions');
    expect(res.status).toBe(401);
  });
});

describe('transport email — session obligatoire', () => {
  it('refuse le diagnostic sans session', async () => {
    const res = await request(app).get('/api/v1/admin/email-transport');
    expect(res.status).toBe(401);
  });

  it('refuse un envoi de test sans session', async () => {
    const res = await request(app).post('/api/v1/admin/email-test').send({});
    expect(res.status).toBe(401);
  });
});

describe('catalogue public — contenu servi sans session', () => {
  it('expose les catégories et services', async () => {
    const res = await request(app).get('/api/v1/services');
    // la base peut être absente en CI : on accepte 200 (contenu) ou 500 (base injoignable),
    // jamais 401/404 — c'est une route publique.
    expect([200, 500]).toContain(res.status);
    expect(res.status).not.toBe(401);
  });
});

describe('nouvelles routes — session obligatoire', () => {
  it('refuse la liste des clients sans session', async () => {
    const res = await request(app).get('/api/v1/admin/pm/clients');
    expect(res.status).toBe(401);
  });

  it('refuse l’analyse de la bulle d’assistant sans session', async () => {
    const res = await request(app).get('/api/v1/admin/ai/assistant');
    expect(res.status).toBe(401);
  });
});

describe('clients — session obligatoire', () => {
  const id = '00000000-0000-4000-8000-000000000000';

  it('DELETE /admin/pm/clients/:id sans session → 401', async () => {
    const res = await request(app).delete(`/api/v1/admin/pm/clients/${id}`);
    expect(res.status).toBe(401);
  });

  it('POST /admin/pm/clients sans session → 401', async () => {
    const res = await request(app).post('/api/v1/admin/pm/clients').send({ name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('PATCH /admin/pm/clients/:id sans session → 401', async () => {
    const res = await request(app).patch(`/api/v1/admin/pm/clients/${id}`).send({ name: 'Test' });
    expect(res.status).toBe(401);
  });
});
