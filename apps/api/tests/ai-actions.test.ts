import { describe, expect, it } from 'vitest';
import { ACTION_SPECS, actionsForPrompt, describeAction, extractAction, extractActionLoose, isActionName } from '../src/modules/ai/actions.js';

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
  it('expose les vingt-huit actions attendues', () => {
    expect(Object.keys(ACTION_SPECS).sort()).toEqual([
      'automation_create',
      'automation_delete',
      'automation_toggle',
      'booking_set_status',
      'client_create',
      'client_delete',
      'client_update',
      'email_send',
      'lead_note',
      'lead_reply_email',
      'lead_set_status',
      'milestone_create',
      'milestone_delete',
      'milestone_update',
      'note_add',
      'note_delete',
      'project_create',
      'project_set_status',
      'realization_create',
      'realization_delete',
      'realization_update',
      'service_create',
      'service_delete',
      'service_update',
      'task_create',
      'task_delete',
      'task_set_status',
      'task_update',
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

describe('projet complet créé par l’assistant', () => {
  it('accepte un modèle d’étapes, des tâches et des jalons', () => {
    const r = describeAction('project_create', {
      name: 'Refonte du site vitrine',
      template: 'site vitrine',
      budget_amount: 4500,
      tasks: [
        { title: 'Cadrage et brief client', priority: 'haute', due_date: '10/12/2026' },
        { title: 'Maquettes des 5 pages', priority: 'normale', stage: 'Design' },
      ],
      milestones: [{ title: 'Validation des maquettes', due_date: '20/12/2026' }],
    });
    const params = r.params as {
      template: string;
      tasks: { title: string; priority: string; due_date?: string | null }[];
      milestones: { title: string; due_date: string }[];
    };
    expect(params.template).toBe('site vitrine');
    expect(params.tasks).toHaveLength(2);
    // normalisation descendue dans les listes : priorité et date françaises
    expect(params.tasks[0]?.priority).toBe('high');
    expect(params.tasks[0]?.due_date).toBe('2026-12-10');
    expect(params.milestones[0]?.due_date).toBe('2026-12-20');
    expect(r.label).toContain('2 tâches');
    expect(r.label).toContain('1 jalon');
  });

  it('reste utilisable sans tâche ni modèle', () => {
    const r = describeAction('project_create', { name: 'Projet interne' });
    const params = r.params as { tasks: unknown[]; milestones: unknown[] };
    expect(params.tasks).toEqual([]);
    expect(params.milestones).toEqual([]);
    expect(r.label).toBe('Créer le projet « Projet interne »');
  });

  it('expose project_create dans le catalogue du prompt agent', () => {
    expect(actionsForPrompt()).toContain('project_create');
    expect(actionsForPrompt()).toContain('Créer un projet');
  });
});

describe('réparation d’une action coupée par la limite de tokens', () => {
  it('referme un JSON tronqué au milieu des tâches', () => {
    // cas réel : le modèle écrit un projet avec 13 tâches, la réponse est coupée
    const tronque =
      'Je crée le projet.\n```action\n{"action":"project_create","params":{"name":"Refonte site vitrine",' +
      '"template":"site vitrine","tasks":[{"title":"Cadrage","priority":"haute"},{"title":"Maquettes","prio';
    const r = extractActionLoose(tronque);
    expect(r?.name).toBe('project_create');
    expect(r?.params.name).toBe('Refonte site vitrine');
    expect(Array.isArray(r?.params.tasks)).toBe(true);
  });

  it('ne répare pas une réponse sans action', () => {
    expect(extractActionLoose('Voici le planning de la semaine, sans JSON.')).toBeNull();
  });

  it('ignore une action hors liste blanche même tronquée', () => {
    expect(extractActionLoose('```action\n{"action":"drop_schema","params":{')).toBeNull();
  });

  it('laisse la version stricte refuser un JSON coupé (elle ne devine pas)', () => {
    expect(extractAction('```action\n{"action":"project_create","params":{"name":"X"')).toBeNull();
  });
});

describe('robustesse des synonymes de priorité', () => {
  it('accepte « moyenne » et « très haute » sans rejeter l’action', () => {
    const r = describeAction('project_create', {
      name: 'Projet test priorités',
      priority: 'très haute',
      tasks: [{ title: 'Tâche une', priority: 'moyenne' }],
    });
    const params = r.params as { priority: string; tasks: { priority: string }[] };
    expect(params.priority).toBe('normal');
    expect(params.tasks[0]?.priority).toBe('normal');
  });
});

describe('automatisation proposee par l’assistant', () => {
  it('accepte un déclencheur et une réponse type', () => {
    const r = describeAction('automation_create', {
      name: 'Accusé de réception des demandes',
      trigger: 'demandes',
      reply_subject: 'Nous avons reçu votre demande',
      reply_body: 'Bonjour {{name}}, votre message est arrivé. On vous répond dans la journée.',
    });
    const params = r.params as { trigger: string; notify_admin: boolean; is_active: boolean };
    expect(params.trigger).toBe('lead.created');
    expect(params.notify_admin).toBe(true);
    expect(params.is_active).toBe(true);
    expect(r.label).toContain('nouvelle demande');
    expect(r.label).toContain('réponse automatique');
  });

  it('traduit « réservation » en booking.created', () => {
    const r = describeAction('automation_create', { name: 'Réservation', trigger: 'réservations' });
    expect((r.params as { trigger: string }).trigger).toBe('booking.created');
    expect(r.label).toContain('nouvelle réservation');
  });
});

describe('CRUD des autres modules', () => {
  it('aucune action ne supprime un projet', () => {
    // consigne client : l’IA a des CRUD partout, sauf la suppression de projet
    expect(Object.keys(ACTION_SPECS).some((n) => n.startsWith('project_delete'))).toBe(false);
    expect(Object.keys(ACTION_SPECS).some((n) => n.includes('project') && n.includes('delete'))).toBe(false);
  });

  it('expose create / update / delete pour services, clients et réalisations', () => {
    for (const base of ['service', 'client', 'realization']) {
      expect(isActionName(`${base}_create`)).toBe(true);
      expect(isActionName(`${base}_update`)).toBe(true);
      expect(isActionName(`${base}_delete`)).toBe(true);
    }
    expect(isActionName('task_update')).toBe(true);
    expect(isActionName('milestone_update')).toBe(true);
    expect(isActionName('milestone_delete')).toBe(true);
    expect(isActionName('note_delete')).toBe(true);
    expect(isActionName('automation_toggle')).toBe(true);
    expect(isActionName('automation_delete')).toBe(true);
  });

  it('marque les suppressions comme sensibles', () => {
    for (const n of ['client_delete', 'service_delete', 'realization_delete', 'milestone_delete', 'note_delete', 'automation_delete', 'task_delete']) {
      const cible =
        n === 'client_delete' ? { client_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70' }
        : n === 'service_delete' ? { service_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70' }
        : n === 'realization_delete' ? { realization_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70' }
        : n === 'milestone_delete' ? { milestone_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70' }
        : n === 'note_delete' ? { note_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70' }
        : n === 'automation_delete' ? { automation_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70' }
        : { task_id: '0b8f2a5e-1c1d-4d3e-9f8a-2b3c4d5e6f70' };
      expect(describeAction(n, cible).sensitive).toBe(true);
    }
  });

  it('valide les champs d’un service et d’une réalisation', () => {
    const s = describeAction('service_create', { title: 'Site vitrine', price_from_usd: 1200 });
    expect((s.params as { slug?: string }).title).toBe('Site vitrine');
    const r = describeAction('realization_create', { title: 'Boutique Kongo', year: 2026 });
    expect(r.label).toContain('Boutique Kongo');
  });
});
