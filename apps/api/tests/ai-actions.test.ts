import { describe, expect, it } from 'vitest';
import { ACTION_SPECS, describeAction, extractAction, isActionName } from '../src/modules/ai/actions.js';

/**
 * Tests unitaires des actions assistées : aucune base, aucun réseau.
 * On vérifie la liste blanche, l'extraction depuis la réponse du modèle et la
 * normalisation des valeurs françaises (c'est là que ça cassait en pratique).
 */

describe('extractAction', () => {
  it('lit un bloc ```action', () => {
    const text = 'Je propose ceci :\n```action\n{"action":"task_create","params":{"title":"X"}}\n```';
    expect(extractAction(text)).toEqual({ name: 'task_create', params: { title: 'X' } });
  });

  it('lit un bloc ```json où figure "action"', () => {
    const text = '```json\n{"action":"task_delete","params":{"task_id":"abc"}}\n```';
    expect(extractAction(text)?.name).toBe('task_delete');
  });

  it('lit une forme inline sans bloc de code', () => {
    const text = 'Je peux le faire : {"action":"note_add","params":{"title":"Décision"}}';
    expect(extractAction(text)?.params).toEqual({ title: 'Décision' });
  });

  it('ignore une action inconnue', () => {
    expect(extractAction('```action\n{"action":"drop_schema","params":{}}\n```')).toBeNull();
  });

  it('ignore un JSON cassé', () => {
    expect(extractAction('```action\n{"action":"task_create",\n```')).toBeNull();
  });

  it('ne trouve rien dans une réponse normale', () => {
    expect(extractAction('Voici trois priorités pour cette semaine…')).toBeNull();
  });
});

describe('liste blanche', () => {
  it('expose les douze actions attendues', () => {
    expect(Object.keys(ACTION_SPECS).sort()).toEqual([
      'booking_set_status',
      'email_send',
      'lead_note',
      'lead_reply_email',
      'lead_set_status',
      'milestone_create',
      'note_add',
      'project_create',
      'project_set_status',
      'task_create',
      'task_delete',
      'task_set_status',
    ]);
  });

  it('reconnaît les noms valides et rejette le reste', () => {
    expect(isActionName('task_create')).toBe(true);
    expect(isActionName('drop_all')).toBe(false);
    expect(isActionName('toString')).toBe(false);
  });

  it('refuse une action hors liste', () => {
    expect(() => describeAction('drop_all', {})).toThrow();
  });
});

describe('normalisation des valeurs écrites en français', () => {
  it('traduit les priorités', () => {
    expect(describeAction('task_create', { project_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70', title: 'Test action', priority: 'haute' }).params.priority).toBe('high');
    expect(describeAction('task_create', { project_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70', title: 'Test action', priority: 'Urgente' }).params.priority).toBe('urgent');
  });

  it('traduit les statuts de tâche', () => {
    const base = { task_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70' };
    expect(describeAction('task_set_status', { ...base, status: 'terminé' }).params.status).toBe('done');
    expect(describeAction('task_set_status', { ...base, status: 'En cours' }).params.status).toBe('doing');
    expect(describeAction('task_set_status', { ...base, status: 'bloqué' }).params.status).toBe('blocked');
  });

  it('traduit les types de note', () => {
    const base = { project_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70', title: 'Réunion client' };
    expect(describeAction('note_add', { ...base, kind: 'réunion' }).params.kind).toBe('meeting');
    expect(describeAction('note_add', { ...base, kind: 'décision' }).params.kind).toBe('decision');
  });

  it('convertit une date jj/mm/aaaa en ISO', () => {
    const r = describeAction('task_create', {
      project_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70',
      title: 'Test action',
      due_date: '25/11/2026',
    });
    expect(r.params.due_date).toBe('2026-11-25');
  });

  it('refuse un identifiant qui n’est pas un uuid', () => {
    expect(() => describeAction('task_delete', { task_id: 'pas-un-uuid' })).toThrow();
  });

  it('produit un libellé lisible pour la confirmation', () => {
    const r = describeAction('task_create', {
      project_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70',
      title: 'Préparer les maquettes',
    });
    expect(r.label).toContain('Préparer les maquettes');
    expect(r.sensitive).toBe(false);
  });

  it('marque l’envoi d’email comme sensible', () => {
    const r = describeAction('email_send', { to: 'a@b.cd', subject: 'Test', body: 'Bonjour' });
    expect(r.sensitive).toBe(true);
  });
});
