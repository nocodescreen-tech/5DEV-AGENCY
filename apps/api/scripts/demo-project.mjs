/**
 * Crée un projet COMPLET (étapes du modèle, tâches, jalons) par le même chemin que
 * l'assistant IA : describeAction → executeAction → audit_logs.
 * Sert de preuve que l'action `project_create` produit un projet utilisable, pas une coquille.
 *
 * usage: node --import tsx apps/api/scripts/demo-project.mjs ["Nom du projet"]
 */
import { all, one } from '../src/db/index.ts';
import { describeAction, executeAction } from '../src/modules/ai/actions.ts';

if (process.env.NODE_ENV === 'production') {
  console.error('Script de démonstration désactivé en production.');
  process.exit(2);
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const jours = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const owner = await one(`select id, display_name from users where is_active order by created_at limit 1`);
if (!owner) {
  console.error('Aucun compte actif : lancez npm run setup.');
  process.exit(2);
}

const modeles = await all(`select name from project_templates where is_active order by created_at`);
if (!modeles.length) {
  console.error('Aucun modèle de projet : lancez npm run setup.');
  process.exit(2);
}

const clients = [
  'Boulangerie Le Fournil',
  'Cabinet Médical Kivu',
  'Transports Matadi Express',
  'École Sainte-Marie',
  'Hôtel Fleuve Congo',
  'Coopérative Agricole Bas-Congo',
];
const briefs = {
  'site vitrine': [
    ['Cadrage et brief client', 'Arborescence et wireframes', 'Maquettes des 5 pages', 'Intégration responsive', 'Mise en ligne et formation'],
    ['Valider le brief', 'Livrer les maquettes', 'Mettre le site en production'],
  ],
  'e-commerce': [
    ['Catalogue produits et fiches', 'Tunnel de commande', 'Paiement mobile money', 'Gestion des stocks', 'Tests de commande réels'],
    ['Valider le catalogue', 'Ouvrir la boutique'],
  ],
  'app web': [
    ['Modèle de données', 'API et authentification', 'Écrans principaux', 'Tests et recette', 'Déploiement'],
    ['Valider l’architecture', 'Livrer la version bêta'],
  ],
  photographie: [
    ['Repérage des lieux', 'Prise de vue', 'Sélection et retouche', 'Livraison des fichiers'],
    ['Valider la sélection'],
  ],
  marketing: [
    ['Audit de la présence en ligne', 'Calendrier éditorial', 'Production des contenus', 'Rapport de performance'],
    ['Valider le calendrier'],
  ],
  infrastructure: [
    ['Inventaire du parc', 'Plan d’adressage réseau', 'Configuration des équipements', 'Tests de coupure'],
    ['Valider le plan réseau'],
  ],
  interne: [
    ['Cadrage interne', 'Exécution', 'Revue et clôture'],
    ['Revue intermédiaire'],
  ],
};

// le modèle d'étapes est choisi d'abord, puis les tâches suivent la même famille :
// un nom « site vitrine » ne doit jamais recevoir les étapes « infrastructure ».
const nomDemande = process.argv[2]?.toLowerCase() ?? '';
const cle =
  Object.keys(briefs).find((k) => nomDemande.includes(k)) ??
  pick(Object.keys(briefs));
const modele =
  modeles.find((m) => m.name.toLowerCase().includes(cle))?.name ??
  modeles.find((m) => m.name.toLowerCase().includes(cle.split(' ')[0]))?.name ??
  modeles[0].name;
const [taches, jalons] = briefs[cle];
const client = pick(clients);
const nomProjet = {
  'site vitrine': ['Site vitrine', 'Refonte du site'],
  'e-commerce': ['Boutique en ligne', 'Boutique en ligne'],
  'app web': ['Application de gestion', 'Application métier'],
  photographie: ['Séance photo', 'Reportage photo'],
  marketing: ['Campagne de communication', 'Plan éditorial'],
  infrastructure: ['Mise à niveau réseau', 'Installation réseau'],
  interne: ['Refonte interne — outils de l’agence', 'Migration interne — outillage'],
};
const base = pick(nomProjet[cle] ?? ['Nouveau projet']);
const nom = process.argv[2] ?? (cle === 'interne' ? base : `${base} — ${client}`);

const priorities = ['normal', 'normal', 'high', 'urgent', 'low'];
const params = {
  name: nom,
  description:
    `Projet ${cle} pour ${client}. Périmètre validé lors de l’appel de cadrage : ` +
    `${taches.length} lots de travail, livraison par étapes, recette avec le client avant mise en ligne.`,
  priority: pick(priorities),
  due_date: jours(60 + Math.floor(Math.random() * 30)),
  budget_amount: [1800, 2500, 3400, 4500, 6200][Math.floor(Math.random() * 5)],
  budget_currency: 'USD',
  template: modele,
  client_name: cle === 'interne' ? undefined : client,
  tasks: taches.map((title, i) => ({
    title,
    priority: priorities[i % priorities.length],
    due_date: jours(10 + i * 9),
    stage: undefined,
  })),
  milestones: jalons.map((title, i) => ({ title, due_date: jours(20 + i * 20) })),
  note:
    `Brief — ${client}\n\n` +
    `Besoin exprimé : ${pick([
      'reprendre la communication en ligne, aujourd’hui éclatée entre une page Facebook et un numéro WhatsApp',
      'remplacer un site qui date de 2019 et que personne ne met à jour',
      'recevoir des demandes de devis sans passer par le téléphone',
      'montrer le travail réel avec des photos à jour',
    ])}.\n\n` +
    `Périmètre validé : ${taches.length} lots, ${jalons.length} point(s) de validation client.\n` +
    `Points de vigilance : les textes et photos viennent du client ; prévoir une relecture avant mise en ligne.`,
};

const proposition = describeAction('project_create', params);
console.log('Proposition :', proposition.label);

const result = await executeAction('project_create', proposition.params, owner.id);
console.log('Exécution  :', result.summary);
console.log('Lien       :', result.link);

// relecture en base : on prouve le contenu, pas seulement le code retour
const project = await one(
  `select id, reference, name, status, priority, budget_amount, budget_currency, due_date, template_id
     from projects_pm where name=$1 and deleted_at is null order by created_at desc limit 1`,
  [nom],
);
if (!project) {
  console.error('Projet introuvable en base après création.');
  process.exit(1);
}
const [etapes, tachesDb, jalonsDb] = await Promise.all([
  all(`select name, weight, position from project_stages where project_id=$1 order by position`, [project.id]),
  all(`select title, status, priority, due_date, stage_id from tasks where project_id=$1 and deleted_at is null order by position`, [project.id]),
  all(`select name, due_date from milestones where project_id=$1 order by due_date`, [project.id]),
]);

console.log(
  JSON.stringify(
    {
      project: {
        reference: project.reference,
        name: project.name,
        status: project.status,
        priority: project.priority,
        budget: `${project.budget_amount} ${project.budget_currency}`,
        due_date: project.due_date,
        template_id: project.template_id,
      },
      etapes: etapes.length,
      taches: tachesDb.length,
      jalons: jalonsDb.length,
      detail_taches: tachesDb.map((t) => `${t.title} · ${t.priority} · ${t.due_date ?? 'sans date'}`),
      detail_jalons: jalonsDb.map((j) => `${j.name} · ${j.due_date}`),
    },
    null,
    2,
  ),
);

process.exit(0);
