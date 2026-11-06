import { describe, expect, it } from 'vitest';
import { apiUrl, databaseLabel } from './api';

describe('apiUrl', () => {
  it('ajoute un slash initial manquant', () => {
    expect(apiUrl('api/v1/healthz')).toBe('/api/v1/healthz');
  });

  it('ne double pas le slash', () => {
    expect(apiUrl('/api/v1/healthz')).toBe('/api/v1/healthz');
  });
});

describe('databaseLabel', () => {
  it('traduit chaque état', () => {
    expect(databaseLabel('up')).toContain('connectée');
    expect(databaseLabel('down')).toContain('injoignable');
    expect(databaseLabel('not_configured')).toContain('non configurée');
  });
});
