/**
 * Pose les automatisations de réponse immédiate (demandes + réservations).
 * Idempotent : une règle portant déjà ce nom est laissée telle quelle.
 *
 * usage: node --import tsx apps/api/scripts/content-automations.mjs
 */
import { all, one } from '../src/db/index.ts';

if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_AUTOMATIONS) {
  console.error('Script de contenu désactivé en production (ALLOW_AUTOMATIONS=1 pour forcer).');
  process.exit(2);
}

export const REGLES = [
  {
    name: 'Accusé de réception — demandes',
    trigger: 'lead.created',
    actions: [
      {
        type: 'notify_admin',
        title: 'Nouvelle demande reçue',
        body: 'Un message vient d’arriver. Ouvrez la liste pour répondre.',
      },
      {
        type: 'email_client',
        subject: 'Votre demande est bien arrivée chez 5DEV',
        body:
          'Bonjour {{name}},\n\n' +
          'Votre message nous est parvenu. On le lit aujourd’hui et vous recevez une réponse — le plus souvent ' +
          'dans la journée, sinon sous 48 heures ouvrées.\n\n' +
          'Si c’est urgent, répondez à cet email en mettant « urgent » dans l’objet : ça remonte en haut de la pile.\n\n' +
          '— L’équipe 5DEV\nMatadi · +243 891 755 172',
      },
      { type: 'set_lead_status', value: 'in_progress' },
    ],
  },
  {
    name: 'Accusé de réception — réservations',
    trigger: 'booking.created',
    actions: [
      {
        type: 'notify_admin',
        title: 'Nouvelle réservation à confirmer',
        body: 'Un créneau a été demandé. Confirmez-le depuis Réservations.',
      },
      {
        type: 'email_client',
        subject: 'Votre demande de séance est enregistrée',
        body:
          'Bonjour {{name}},\n\n' +
          'Nous avons reçu votre demande de séance (référence {{reference}}). Nous confirmons le créneau sous ' +
          '24 heures ouvrées ; vous recevrez un message dès qu’il est validé.\n\n' +
          'Si le créneau ne convient plus, répondez simplement à cet email.\n\n' +
          '— L’équipe 5DEV',
      },
    ],
  },
];

let crees = 0;
for (const regle of REGLES) {
  const existe = await one(`select id from automations where name=$1`, [regle.name]);
  if (existe) {
    console.log(`= ${regle.name} (déjà présente)`);
    continue;
  }
  await one(
    `insert into automations(name, trigger, conditions, actions, is_active)
     values($1,$2,'[]'::jsonb,$3::jsonb,true)`,
    [regle.name, regle.trigger, JSON.stringify(regle.actions)],
  );
  crees += 1;
  console.log(`+ ${regle.name} → ${regle.trigger} (${regle.actions.length} actions)`);
}

const rows = await all(
  `select name, trigger, is_active, jsonb_array_length(actions) as actions from automations order by created_at`,
);
console.log(`\n${crees} créée(s). En base :`);
for (const r of rows) console.log(`- ${r.name} · ${r.trigger} · ${r.actions} action(s) · ${r.is_active ? 'active' : 'inactive'}`);
process.exit(0);
