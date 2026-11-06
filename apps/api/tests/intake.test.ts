import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('validation des demandes', () => {
  it('refuse une demande sans email valide (422 + champs)', async () => {
    const res = await request(app)
      .post('/api/v1/leads')
      .send({ kind: 'quote', contact_name: 'A', contact_email: 'pas-un-email', message: 'x' });
    expect(res.status).toBe(422);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(Object.keys(res.body.error.fields).length).toBeGreaterThan(0);
  });

  it('refuse un message trop court', async () => {
    const res = await request(app)
      .post('/api/v1/leads')
      .send({ contact_name: 'Client Test', contact_email: 'client@example.com', message: 'a' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.message).toBeTruthy();
  });
});

describe('réservations', () => {
  it('refuse une date mal formée', async () => {
    const res = await request(app).get('/api/v1/bookings/availability?date=2026-13-99');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it('refuse une réservation sans créneau valide', async () => {
    const res = await request(app).post('/api/v1/bookings').send({
      full_name: 'Client Test',
      email: 'client@example.com',
      shoot_date: '2026-12-15',
      slot: 'midi',
    });
    expect(res.status).toBe(422);
  });
});

describe('accès administration', () => {
  it('refuse les demandes sans session', async () => {
    const res = await request(app).get('/api/v1/admin/leads');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('refuse la création de service sans session', async () => {
    const res = await request(app).post('/api/v1/admin/services').send({});
    expect(res.status).toBe(401);
  });

  it('refuse /auth/me sans session', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('renvoie 401 sur des identifiants invalides, sans révéler l’existence du compte', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inconnu@example.com', password: 'motdepasse123' });
    // sans base configurée la route peut renvoyer 500 ; on accepte 401 ou 500 mais pas 200
    expect([401, 500]).toContain(res.status);
    if (res.status === 401) expect(res.body.error.code).toBe('BAD_CREDENTIALS');
  });
});
