// Contenu éditorial des services 5DEV — voix humaine, concrète, sans promesse inventée.
// Idempotent : met à jour par slug. Exécuter : node scripts/content-services.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const here = dirname(fileURLToPath(import.meta.url));

const url =
  process.env.DATABASE_URL ??
  (() => {
    const env = readFileSync(join(here, '../../../.env'), 'utf8');
    return env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
  })();

if (!url) {
  console.error('DATABASE_URL introuvable.');
  process.exit(1);
}

const SERVICES = [
  {
    slug: 'creation-sites-web',
    summary: 'Un site clair, rapide, qui explique ce que vous faites et donne envie de vous appeler.',
    description:
      "On commence par comprendre votre activité : qui vous voulez toucher, ce qu'ils cherchent, et ce qui les fait hésiter. Ensuite on construit un site qui répond à ces questions, sans jargon et sans page inutile. Vous repartez avec un site que vous pouvez faire évoluer vous-même.",
    deliverables: ['Structure et textes travaillés avec vous', 'Design sur mesure, mobile compris', 'Mise en ligne et formation courte', 'Suivi des premiers jours'],
  },
  {
    slug: 'applications-web',
    summary: 'Un outil qui remplace vos tableurs, vos cahiers et vos allers-retours WhatsApp.',
    description:
      "Quand votre activité grandit, les fichiers Excel et les messages finissent par coûter plus cher que l'outil qui manque. On conçoit l'application autour de votre façon de travailler réelle, pas d'un modèle générique. Chaque écran doit vous faire gagner du temps, sinon il n'a pas sa place.",
    deliverables: ['Cadrage des besoins réels', 'Maquettes avant développement', 'Application déployée et sauvegardée', 'Accompagnement à la prise en main'],
  },
  {
    slug: 'developpement-technique',
    summary: 'Intégrations, API, corrections profondes : le travail que personne ne voit mais qui tient tout debout.',
    description:
      "Un paiement qui ne passe pas, une API qui répond mal, un site qui rame dès qu'il y a du monde : on intervient sur ces sujets que les outils « prêts à l'emploi » ne règlent pas. On documente ce qu'on touche pour que vous ne soyez pas bloqué après nous.",
    deliverables: ['Diagnostic écrit', 'Correctifs livrés et testés', 'Documentation technique', 'Passation si besoin'],
  },
  {
    slug: 'maintenance-web',
    summary: 'Mises à jour, sauvegardes, petites évolutions : votre site reste en vie sans y penser.',
    description:
      "Un site laissé seul finit par casser : mises à jour de sécurité, sauvegardes oubliées, formulaire qui n'envoie plus rien. On surveille, on corrige, et on vous prévient quand quelque chose mérite votre attention. Vous gardez la tête dans votre métier.",
    deliverables: ['Mises à jour de sécurité', 'Sauvegardes régulières', 'Petites modifications incluses', 'Interlocuteur direct'],
  },
  {
    slug: 'hebergement-infrastructure',
    summary: 'Nom de domaine, serveur, sauvegardes, certificat : la base technique, installée proprement.',
    description:
      "On installe et on configure l'infrastructure qui fait tourner votre site ou votre application : domaine, serveur, certificats, sauvegardes automatiques. L'objectif n'est pas la technique pour la technique, mais un service qui reste disponible quand vos clients en ont besoin.",
    deliverables: ['Domaine et DNS configurés', 'Serveur ou hébergement adapté', 'Certificat HTTPS', 'Sauvegardes et supervision'],
  },
  {
    slug: 'ia-automatisation',
    summary: 'Confier à la machine ce qui vous prend du temps chaque semaine, sans perdre le contrôle.',
    description:
      "Répondre aux mêmes questions, recopier des informations d'un outil à l'autre, relancer des clients : ces tâches se règlent souvent avec un peu d'automatisation et une IA bien cadrée. On la branche sur vos vraies données, avec des garde-fous et une validation humaine sur ce qui compte.",
    deliverables: ['Repérage des tâches répétitives', 'Automatisations branchées sur vos outils', 'Validation humaine sur les actions sensibles', 'Suivi des résultats'],
  },
  {
    slug: 'audit-optimisation',
    summary: "Un regard extérieur sur ce qui freine votre site, avec un plan d'action concret.",
    description:
      "Vitesse, référencement, parcours d'achat, sécurité : on regarde votre site comme un visiteur pressé, et on note tout ce qui le fait partir. Vous recevez une liste priorisée, avec ce qui se règle en une heure et ce qui demande un vrai chantier.",
    deliverables: ['Rapport écrit et priorisé', 'Captures et mesures réelles', 'Recommandations applicables', "Échange d'une heure pour en parler"],
  },
  {
    slug: 'referencement',
    summary: 'Être trouvé par les bonnes personnes, sur les recherches qui comptent vraiment.',
    description:
      "Le référencement utile n'est pas une liste de mots-clés : c'est comprendre ce que vos clients tapent quand ils ont un problème, et mériter leur clic. On travaille le contenu, la structure technique et les fiches locales, puis on mesure ce qui bouge réellement.",
    deliverables: ['Recherches et intentions identifiées', 'Optimisation des pages clés', 'Fiche Google et cohérence locale', 'Suivi mensuel commenté'],
  },
  {
    slug: 'reseaux-sociaux',
    summary: 'Des publications régulières qui ressemblent à votre marque, pas à un catalogue.',
    description:
      "Publier pour publier ne sert à rien. On définit une ligne éditoriale simple, on prépare des visuels cohérents et on publie au bon rythme pour votre activité. Vous voyez ce qui est publié, et pourquoi.",
    deliverables: ['Ligne éditoriale', 'Calendrier de publication', 'Visuels et rédaction', 'Bilan mensuel honnête'],
  },
  {
    slug: 'croissance-numerique',
    summary: 'Relier vos canaux entre eux pour que chaque contact devienne une vraie conversation.',
    description:
      "Site, réseaux, email, WhatsApp : quand tout fonctionne séparément, vous perdez des contacts sans le savoir. On relie les morceaux, on met en place un suivi clair, et on regarde ensemble ce qui amène réellement des clients.",
    deliverables: ['Parcours client cartographié', 'Outils connectés', 'Tableau de suivi simple', 'Points de suivi réguliers'],
  },
  {
    slug: 'photographie-mariage',
    summary: 'Des images qui vous ressemblent, loin des poses interminables.',
    description:
      "Un mariage se vit, il ne se récite pas. On vous suit discrètement, on saisit les regards, les mains, l'ambiance, et on vous laisse profiter de votre journée. La sélection est retouchée avec soin, dans un rendu naturel.",
    deliverables: ['Échange préparatoire avec les mariés', 'Couverture de la journée', 'Sélection retouchée en haute définition', 'Galerie privée à partager'],
  },
  {
    slug: 'portrait-studio',
    summary: 'Un portrait professionnel qui inspire confiance au premier regard.',
    description:
      "Pour un profil, un CV, une page équipe ou une campagne : on installe la lumière, on vous met à l'aise, et on cherche l'expression juste. Vous repartez avec plusieurs choix, retouchés sobrement.",
    deliverables: ['Séance en studio ou sur site', 'Choix guidé pendant la séance', 'Retouche naturelle', 'Fichiers prêts pour le web et l’impression'],
  },
  {
    slug: 'photographie-produit',
    summary: 'Des photos de produit qui donnent envie de commander, pas juste envie de regarder.',
    description:
      "Fond, lumière, angle : trois détails qui changent la perception d'un produit. On photographie vos articles pour qu'ils soient lisibles, désirables et cohérents d'une fiche à l'autre, avec un rendu utilisable sur votre site et vos réseaux.",
    deliverables: ['Mise en scène et éclairage', 'Série cohérente', 'Détourage si nécessaire', 'Formats adaptés au web'],
  },
  {
    slug: 'photographie-evenement',
    summary: "L'énergie d'un événement, sans rater les moments qui comptent.",
    description:
      "Conférence, lancement, remise de diplômes, soirée d'entreprise : on se déplace, on se fond dans l'ambiance et on ramène de quoi raconter la journée. Les images arrivent triées, prêtes à publier.",
    deliverables: ['Repérage du déroulé', 'Couverture photo de l’événement', 'Tri et retouche', 'Livraison rapide pour publication'],
  },
  {
    slug: 'post-production',
    summary: 'Retouche, montage, harmonisation : donner une cohérence à des images déjà prises.',
    description:
      "Vous avez les photos mais le rendu part dans tous les sens, ou certaines ont besoin d'un vrai nettoyage. On harmonise les couleurs, on corrige ce qui doit l'être, et on livre des fichiers homogènes, prêts à être publiés.",
    deliverables: ['Sélection et harmonisation', 'Retouche ciblée', 'Export aux formats demandés', 'Copie de sauvegarde'],
  },
];

const client = new Client({ connectionString: url });
await client.connect();

let updated = 0;
for (const [i, s] of SERVICES.entries()) {
  const res = await client.query(
    `update services
        set summary=$2, description=$3, deliverables=$4::text[], position=$5, updated_at=now()
      where slug=$1`,
    [s.slug, s.summary, s.description, s.deliverables, i + 1],
  );
  updated += res.rowCount ?? 0;
}

const missing = await client.query(
  `select slug from services where summary is null or summary='' or description is null or description=''`,
);
console.log(`services mis à jour : ${updated}`);
console.log(`sans texte restants : ${missing.rowCount}`);
if (missing.rowCount) console.log(missing.rows.map((r) => r.slug).join(', '));

await client.end();
