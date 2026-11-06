/**
 * Initialisation de la base 5DEV : schéma, compte propriétaire, réglages, catalogue.
 * Idempotent : rejouable sans dupliquer (sauf les services, protégés par slug).
 *
 *   node scripts/setup.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';
const { Client } = pg;
import dotenv from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, '../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant dans .env');
  process.exit(1);
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 });
  return ['scrypt', 16384, 8, 1, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

const POLES = [
  {
    slug: 'web-development',
    name: 'Développement web',
    tagline: 'Des sites et applications qui travaillent pour vous.',
    services: [
      {
        slug: 'creation-sites-web',
        title: 'Création de sites web',
        summary: 'Site vitrine, institutionnel ou e-commerce, conçu pour convertir.',
        deliverables: ['Maquette validée', 'Site responsive', 'Mise en ligne', 'Formation à la prise en main'],
        duration: '2 à 6 semaines',
      },
      {
        slug: 'applications-web',
        title: 'Applications web',
        summary: 'Espace client, tableau de bord, outil métier sur mesure.',
        deliverables: ['Architecture', 'Développement', 'Tests', 'Documentation'],
        duration: '4 à 12 semaines',
      },
      {
        slug: 'developpement-technique',
        title: 'Développement technique',
        summary: 'Intégrations, API, automatisations et reprises de projets existants.',
        deliverables: ['Audit du code existant', 'Intégration', 'Recette'],
        duration: 'selon périmètre',
      },
    ],
  },
  {
    slug: 'digital-solutions',
    name: 'Solutions digitales',
    tagline: 'Ce qui fait tourner le site après la mise en ligne.',
    services: [
      {
        slug: 'maintenance-web',
        title: 'Maintenance web',
        summary: 'Mises à jour, sauvegardes, corrections et surveillance.',
        deliverables: ['Sauvegardes', 'Mises à jour de sécurité', 'Interventions correctives'],
        duration: 'mensuel',
      },
      {
        slug: 'hebergement-infrastructure',
        title: 'Hébergement et infrastructure',
        summary: 'Domaine, hébergement, certificats, messagerie et sauvegardes.',
        deliverables: ['Nom de domaine', 'Hébergement', 'HTTPS', 'Emails professionnels'],
        duration: 'mensuel',
      },
      {
        slug: 'ia-automatisation',
        title: 'Intelligence artificielle et automatisation',
        summary: 'Automatiser les tâches répétitives et brancher des assistants utiles.',
        deliverables: ['Cartographie des tâches', 'Automatisations', 'Documentation'],
        duration: '2 à 8 semaines',
      },
      {
        slug: 'audit-optimisation',
        title: 'Audit et optimisation',
        summary: 'Diagnostic technique, performance et sécurité du site existant.',
        deliverables: ['Rapport d’audit', 'Plan de correction', 'Suivi'],
        duration: '1 à 2 semaines',
      },
    ],
  },
  {
    slug: 'digital-growth',
    name: 'Croissance digitale',
    tagline: 'Être trouvé, être suivi, être choisi.',
    services: [
      {
        slug: 'reseaux-sociaux',
        title: 'Gestion des réseaux sociaux',
        summary: 'Ligne éditoriale, calendrier, publications et réponses.',
        deliverables: ['Calendrier éditorial', 'Publications', 'Rapport mensuel'],
        duration: 'mensuel',
      },
      {
        slug: 'croissance-numerique',
        title: 'Croissance numérique',
        summary: 'Campagnes, tunnels de conversion et suivi des résultats.',
        deliverables: ['Plan d’acquisition', 'Campagnes', 'Tableau de suivi'],
        duration: 'mensuel',
      },
      {
        slug: 'referencement',
        title: 'Référencement',
        summary: 'SEO technique et contenu pour apparaître sur les bonnes recherches.',
        deliverables: ['Audit SEO', 'Optimisations techniques', 'Recommandations de contenu'],
        duration: '1 à 3 mois',
      },
    ],
  },
  {
    slug: 'creative-photography',
    name: 'Photographie créative',
    tagline: 'Des images qui restent.',
    services: [
      {
        slug: 'photographie-mariage',
        title: 'Photographie de mariage',
        summary: 'Couverture complète : préparatifs, cérémonie et soirée.',
        deliverables: ['Couverture de la journée', 'Sélection retouchée', 'Galerie privée en ligne'],
        duration: '1 journée',
      },
      {
        slug: 'portrait-studio',
        title: 'Portrait et studio',
        summary: 'Portraits éditoriaux, identité professionnelle, familles.',
        deliverables: ['Séance en studio ou extérieur', 'Retouche', 'Galerie privée'],
        duration: '1 à 3 heures',
      },
      {
        slug: 'photographie-evenement',
        title: 'Photographie événementielle',
        summary: 'Conférences, concerts, cérémonies institutionnelles.',
        deliverables: ['Couverture', 'Retouche', 'Livraison rapide'],
        duration: 'selon événement',
      },
      {
        slug: 'photographie-produit',
        title: 'Photographie de produit',
        summary: 'Packshots et mises en scène pour catalogues et réseaux.',
        deliverables: ['Prise de vue', 'Détourage si besoin', 'Fichiers optimisés web'],
        duration: '1/2 à 2 journées',
      },
      {
        slug: 'post-production',
        title: 'Post-production',
        summary: 'Retouche, étalonnage et préparation des fichiers.',
        deliverables: ['Sélection', 'Retouche', 'Export web et impression'],
        duration: 'selon volume',
      },
    ],
  },
];

const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
await client.connect();

// 1. schéma
const schema = readFileSync(join(here, '../src/db/schema.sql'), 'utf8');
await client.query(schema);
const eco = readFileSync(join(here, '../src/db/schema-ecosystem.sql'), 'utf8');
await client.query(eco);
const ws = readFileSync(join(here, '../src/db/schema-workspace.sql'), 'utf8');
await client.query(ws);
const chat = readFileSync(join(here, '../src/db/schema-ai-chat.sql'), 'utf8');
await client.query(chat);
const prof = readFileSync(join(here, '../src/db/schema-profile.sql'), 'utf8');
await client.query(prof);
const ws2 = readFileSync(join(here, '../src/db/schema-workspace-2.sql'), 'utf8');
await client.query(ws2);
console.log('✓ schéma appliqué (base + écosystème + workspace)');

// 2. compte propriétaire
const email = process.env.ADMIN_EMAIL ?? 'admin@5dev.com';
const password = process.env.ADMIN_PASSWORD ?? 'ChangezMoi2026!';
const exists = await client.query('select id from users where lower(email) = lower($1)', [email]);
if (exists.rowCount === 0) {
  await client.query(
    `insert into users(email, password_hash, full_name, role) values($1,$2,$3,'owner')`,
    [email, hashPassword(password), 'Administrateur 5DEV'],
  );
  console.log(`✓ compte propriétaire créé : ${email}`);
} else {
  console.log(`• compte propriétaire déjà présent : ${email}`);
}

// 3. réglages
const settings = {
  studio: {
    name: '5DEV',
    tagline: 'Build. Innovate. Grow.',
    phone: '+243 891 755 172',
    whatsapp: '+243891755172',
    email: 'mio.appservice@gmail.com',
    address: 'Matadi, République démocratique du Congo',
    hours: 'Lundi — samedi, 08:00 → 18:00',
  },
  currencies: { base: 'USD', usd_to_cdf: 2800, updated_at: new Date().toISOString().slice(0, 10) },
};
for (const [key, value] of Object.entries(settings)) {
  await client.query(
    `insert into settings(key, value) values($1, $2::jsonb)
     on conflict (key) do nothing`,
    [key, JSON.stringify(value)],
  );
}
console.log('✓ réglages en place');

// 4. catalogue
let cats = 0;
let svcs = 0;
for (const [i, pole] of POLES.entries()) {
  const cat = await client.query(
    `insert into service_categories(slug, name, tagline, position, is_published)
     values($1,$2,$3,$4,true)
     on conflict (slug) do update set name = excluded.name, tagline = excluded.tagline
     returning id`,
    [pole.slug, pole.name, pole.tagline, i],
  );
  cats += 1;
  const categoryId = cat.rows[0].id;
  for (const [j, s] of pole.services.entries()) {
    const before = await client.query('select 1 from services where slug = $1', [s.slug]);
    await client.query(
      `insert into services(category_id, slug, title, summary, deliverables, duration_label, price_note, position, is_published)
       values($1,$2,$3,$4,$5,$6,'Sur devis',$7,true)
       on conflict (slug) do update set category_id = excluded.category_id, title = excluded.title,
         summary = excluded.summary, deliverables = excluded.deliverables`,
      [categoryId, s.slug, s.title, s.summary, s.deliverables, s.duration, j],
    );
    if (before.rowCount === 0) svcs += 1;
  }
}
console.log(`✓ catalogue : ${cats} pôles, ${svcs} nouveaux services`);

// 5. automatisation par défaut (qualification IA des demandes)
const auto = await client.query("select id from automations where name = 'Qualification des demandes'");
if (auto.rowCount === 0) {
  await client.query(
    "insert into automations(name, trigger, conditions, actions, is_active) values($1,'lead.created','[]'::jsonb,$2::jsonb,true)",
    [
      'Qualification des demandes',
      JSON.stringify([
        { type: 'ai_classify' },
        { type: 'notify_admin', title: 'Nouvelle demande reçue', body: 'Une demande vient d arriver sur le site.' },
      ]),
    ],
  );
  console.log('OK automatisation « Qualification des demandes » creee');
} else {
  console.log('- automatisation deja presente');
}

// 6. modèles de projets (workflows réutilisables)
const TEMPLATES = [
  { name: 'Site vitrine', category: 'dev-web', stages: [
    { name: 'Analyse', weight: 2 }, { name: 'Design', weight: 2 },
    { name: 'Développement', weight: 4 }, { name: 'Tests', weight: 2 }, { name: 'Livraison', weight: 1 } ] },
  { name: 'E-commerce', category: 'dev-web', stages: [
    { name: 'Analyse', weight: 2 }, { name: 'Catalogue', weight: 3 }, { name: 'Panier', weight: 3 },
    { name: 'Paiement', weight: 3 }, { name: 'Tests', weight: 2 }, { name: 'Lancement', weight: 1 } ] },
  { name: 'Application web', category: 'app-web', stages: [
    { name: 'Cahier des charges', weight: 2 }, { name: 'Architecture', weight: 3 }, { name: 'UI/UX', weight: 3 },
    { name: 'Développement', weight: 5 }, { name: 'QA', weight: 2 }, { name: 'Mise en production', weight: 1 } ] },
  { name: 'Photographie', category: 'photo', stages: [
    { name: 'Réservation', weight: 1 }, { name: 'Préparation', weight: 2 },
    { name: 'Shooting', weight: 4 }, { name: 'Retouche', weight: 3 }, { name: 'Livraison', weight: 1 } ] },
  { name: 'Marketing', category: 'marketing', stages: [
    { name: 'Audit', weight: 2 }, { name: 'Stratégie', weight: 3 }, { name: 'Préparation', weight: 2 },
    { name: 'Campagne', weight: 4 }, { name: 'Analyse', weight: 2 } ] },
  { name: 'Infrastructure', category: 'infra', stages: [
    { name: 'Audit', weight: 2 }, { name: 'Configuration', weight: 3 },
    { name: 'Déploiement', weight: 3 }, { name: 'Sécurisation', weight: 3 }, { name: 'Validation', weight: 2 } ] },
  { name: 'Projet interne', category: 'interne', stages: [
    { name: 'Recherche', weight: 2 }, { name: 'Planification', weight: 2 },
    { name: 'Développement', weight: 4 }, { name: 'Tests', weight: 2 }, { name: 'Lancement', weight: 1 } ] },
];
for (const t of TEMPLATES) {
  await client.query(
    `insert into project_templates(name, category, stages) values($1,$2,$3::jsonb)
     on conflict (name) do update set stages = excluded.stages`,
    [t.name, t.category, JSON.stringify(t.stages)],
  );
}
console.log(`OK ${TEMPLATES.length} modeles de projets disponibles`);

await client.end();
console.log('\nBase prête. Démarrez : npm run dev:api');
