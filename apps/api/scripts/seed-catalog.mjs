// Catalogue des plateformes : 10 par catégorie, avec leurs paliers.
//
// Le prix n'est renseigné QUE s'il est relevé (voir market.ts : API ou page
// tarifaire). Les lignes sans prix restent à NULL : la page affiche alors
// « prix non relevé » et le lien officiel — on ne devine jamais un tarif.
// Rejouable : `on conflict (category, provider, plan)` met à jour sans dupliquer.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');

const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();

/** [catégorie, fournisseur, offre, détail, unité, page tarifaire] */
const CATALOG = [
  // ------------------------------------------------------------------ EMAIL (10)
  ['email', 'Brevo', 'Free', '300 emails/jour, expéditeur validé requis', '/mois', 'https://www.brevo.com/pricing/'],
  ['email', 'Brevo', 'Starter', '20 000 emails/mois, sans logo Brevo', '/mois', 'https://www.brevo.com/pricing/'],
  ['email', 'Brevo', 'Business', 'Volume supérieur, IP dédiée en option', '/mois', 'https://www.brevo.com/pricing/'],
  ['email', 'Resend', 'Free', '3 000 emails/mois, 100/jour', '/mois', 'https://resend.com/pricing'],
  ['email', 'Resend', 'Pro', '50 000 emails/mois, domaines illimités', '/mois', 'https://resend.com/pricing'],
  ['email', 'Mailgun', 'Foundation', '10 000 emails/mois, journal 5 jours', '/mois', 'https://www.mailgun.com/pricing/'],
  ['email', 'Postmark', 'Basic', '10 000 emails/mois, transactionnel prioritaire', '/mois', 'https://postmarkapp.com/pricing'],
  ['email', 'Amazon SES', 'Pay as you go', '0,10 $/1 000 emails, sandbox à lever', '/1000 emails', 'https://aws.amazon.com/ses/pricing/'],
  ['email', 'Mailtrap', 'Free', '1 000 emails/mois, sandbox incluse', '/mois', 'https://mailtrap.io/pricing/'],
  ['email', 'Zoho Mail', 'Mail Lite', '5 Go/boîte, domaine personnalisé', '/utilisateur', 'https://www.zoho.com/mail/zohomail-pricing.html'],

  // -------------------------------------------------------------------- DNS (10)
  ['dns', 'Cloudflare DNS', 'Zone gratuite', 'Anycast, DNSSEC, requêtes illimitées', '/mois', 'https://www.cloudflare.com/dns/'],
  ['dns', 'Bunny DNS', 'Standard', '0,50 $/zone + requêtes, anycast', '/mois', 'https://bunny.net/dns/'],
  ['dns', 'Hetzner DNS', 'Zone gratuite', 'Zone et requêtes incluses', '/mois', 'https://www.hetzner.com/dns-console'],
  ['dns', 'deSEC', 'Gratuit', 'DNSSEC par défaut, open source', '/mois', 'https://desec.io/'],
  ['dns', 'NS1', 'Essai', 'Routage avancé, API', '/mois', 'https://ns1.com/pricing'],
  ['dns', 'Amazon Route 53', 'Pay as you go', '0,50 $/zone hébergée', '/mois', 'https://aws.amazon.com/route53/pricing/'],
  ['dns', 'Google Cloud DNS', 'Pay as you go', '0,20 $/zone, 0,35 $/million requêtes', '/mois', 'https://cloud.google.com/dns/pricing'],
  ['dns', 'DNSimple', 'Essai', 'Zones et enregistrements illimités', '/mois', 'https://dnsimple.com/pricing'],
  ['dns', 'Gandi LiveDNS', 'Inclus', 'Inclus avec un domaine Gandi', '/mois', 'https://www.gandi.net/fr/domain/dns'],
  ['dns', 'OVH DNS', 'Inclus', 'Inclus avec un domaine OVH', '/mois', 'https://www.ovhcloud.com/fr/domains/'],

  // ------------------------------------------------------- STOCKAGE OBJET (10)
  ['stockage-objet', 'Cloudflare R2', 'Standard', '10 Go offerts, sortie gratuite', '/Go', 'https://developers.cloudflare.com/r2/pricing/'],
  ['stockage-objet', 'Backblaze B2', 'Cloud Storage', '10 Go offerts, sortie 3× le stockage', '/To', 'https://www.backblaze.com/cloud-storage/pricing'],
  ['stockage-objet', 'Amazon S3', 'Standard', 'Facturation au Go stocké', '/Go', 'https://aws.amazon.com/s3/pricing/'],
  ['stockage-objet', 'Wasabi', 'Pay as you go', 'Sans frais de sortie, minimum 1 To', '/To', 'https://wasabi.com/cloud-storage-pricing/'],
  ['stockage-objet', 'Bunny Storage', 'Storage', 'Réplication optionnelle, CDN inclus', '/Go', 'https://bunny.net/pricing/'],
  ['stockage-objet', 'Scaleway Object Storage', 'Standard', 'Paris, multi-AZ en option', '/Go', 'https://www.scaleway.com/en/pricing/object-storage/'],
  ['stockage-objet', 'OVH Object Storage', 'Standard', 'S3 compatible, facturé à l’usage', '/Go', 'https://www.ovhcloud.com/fr/public-cloud/object-storage/'],
  ['stockage-objet', 'MinIO', 'Auto-hébergé', 'Gratuit sur votre serveur, S3 compatible', '/mois', 'https://min.io/pricing'],
  ['stockage-objet', 'Supabase Storage', 'Free', '1 Go inclus avec le plan Postgres gratuit', '/mois', 'https://supabase.com/pricing'],
  ['stockage-objet', 'Google Cloud Storage', 'Standard', 'Facturation au Go et aux opérations', '/Go', 'https://cloud.google.com/storage/pricing'],

  // --------------------------------------------------------- IMAGES / CDN (10)
  ['images-cdn', 'Cloudflare Images', 'Forfait', 'Stockage + livraison d’images', '/mois', 'https://developers.cloudflare.com/images/pricing/'],
  ['images-cdn', 'Bunny CDN', 'Trafic', 'Volume, Afrique incluse', '/Go', 'https://bunny.net/pricing/'],
  ['images-cdn', 'Cloudflare CDN', 'Gratuit', 'Cache mondial inclus', '/mois', 'https://www.cloudflare.com/plans/'],
  ['images-cdn', 'imgix', 'Basic', 'Transformation à la volée', '/mois', 'https://imgix.com/pricing'],
  ['images-cdn', 'Cloudinary', 'Free', '25 crédits/mois, transformations incluses', '/mois', 'https://cloudinary.com/pricing'],
  ['images-cdn', 'ImageKit', 'Free', '20 Go bande passante, transformations', '/mois', 'https://imagekit.io/pricing'],
  ['images-cdn', 'Fastly', 'Pay as you go', 'CDN à l’usage', '/Go', 'https://www.fastly.com/pricing'],
  ['images-cdn', 'Amazon CloudFront', 'Pay as you go', 'CDN AWS, tarif par région', '/Go', 'https://aws.amazon.com/cloudfront/pricing/'],
  ['images-cdn', 'Uploadcare', 'Free', '3 Go trafic, CDN inclus', '/mois', 'https://uploadcare.com/pricing/'],
  ['images-cdn', 'Cloudflare Stream', 'Vidéo', 'Stockage + livraison vidéo', '/1000 min', 'https://developers.cloudflare.com/stream/pricing/'],

  // ------------------------------------------------------ BASE DE DONNÉES (10)
  ['base-de-donnees', 'Supabase', 'Free', '500 Mo Postgres, auth incluse', '/mois', 'https://supabase.com/pricing'],
  ['base-de-donnees', 'Supabase', 'Pro', '8 Go, sauvegardes 7 jours', '/mois', 'https://supabase.com/pricing'],
  ['base-de-donnees', 'Neon', 'Free', '0,5 Go, autosuspend', '/mois', 'https://neon.tech/pricing'],
  ['base-de-donnees', 'Neon', 'Launch', 'Postgres serverless, autoscaling', '/mois', 'https://neon.tech/pricing'],
  ['base-de-donnees', 'Turso', 'Free', '500 bases, 9 Go', '/mois', 'https://turso.tech/pricing'],
  ['base-de-donnees', 'PlanetScale', 'Scaler', 'MySQL/Vitess, branches', '/mois', 'https://planetscale.com/pricing'],
  ['base-de-donnees', 'Railway Postgres', 'À l’usage', 'Facturé au temps d’exécution', '/mois', 'https://railway.com/pricing'],
  ['base-de-donnees', 'Aiven', 'Free', 'Postgres managé, 1 Go', '/mois', 'https://aiven.io/pricing'],
  ['base-de-donnees', 'MongoDB Atlas', 'Free', '512 Mo, cluster partagé', '/mois', 'https://www.mongodb.com/pricing'],
  ['base-de-donnees', 'Redis Cloud', 'Free', '30 Mo, 100 connexions', '/mois', 'https://redis.io/pricing/'],

  // ------------------------------------------------------------ HÉBERGEMENT (10)
  ['hebergement', 'Hostinger', 'Single', '1 site, 50 Go SSD', '/mois', 'https://www.hostinger.com/pricing'],
  ['hebergement', 'Hostinger', 'Premium', '100 sites, SSL, 100 Go', '/mois', 'https://www.hostinger.com/pricing'],
  ['hebergement', 'Hostinger', 'Business', 'SEO, sauvegardes quotidiennes', '/mois', 'https://www.hostinger.com/pricing'],
  ['hebergement', 'o2switch', 'Mutualisé', 'Illimité, hébergement français', '/mois', 'https://www.o2switch.fr/'],
  ['hebergement', 'PlanetHoster', 'Pro', 'Hébergement français, cPanel', '/mois', 'https://www.planethoster.com/fr/Offres'],
  ['hebergement', 'OVH Perso', 'Perso', '100 Go, nom de domaine inclus', '/mois', 'https://www.ovhcloud.com/fr/web-hosting/'],
  ['hebergement', 'Infomaniak', 'Site simple', 'Hébergement suisse, énergie verte', '/mois', 'https://www.infomaniak.com/fr/hebergement'],
  ['hebergement', 'Netlify', 'Starter', '100 Go bande passante, builds inclus', '/mois', 'https://www.netlify.com/pricing/'],
  ['hebergement', 'Vercel', 'Hobby', 'Sites statiques et fonctions', '/mois', 'https://vercel.com/pricing'],
  ['hebergement', 'GitHub Pages', 'Public', '1 Go de site, domaine custom', '/mois', 'https://docs.github.com/pages'],

  // ------------------------------------------------------------------ VPS (10)
  ['vps', 'Vultr', 'Cloud compute', 'API publique, prix relevés automatiquement', '/mois', 'https://www.vultr.com/pricing/'],
  ['vps', 'Akamai Linode', 'Shared CPU', 'API publique, prix relevés automatiquement', '/mois', 'https://www.linode.com/pricing/'],
  ['vps', 'Hetzner Cloud', 'CX22', 'Allemagne/Finlande, meilleur rapport qualité-prix', '/mois', 'https://www.hetzner.com/cloud/'],
  ['vps', 'DigitalOcean', 'Droplet Basic', 'Documentation de référence, 1 vCPU', '/mois', 'https://www.digitalocean.com/pricing/droplets'],
  ['vps', 'Contabo', 'Cloud VPS S', 'Beaucoup de RAM, disques lents', '/mois', 'https://contabo.com/en/vps/'],
  ['vps', 'OVH VPS', 'VPS-1', 'Datacenters européens et canadiens', '/mois', 'https://www.ovhcloud.com/fr/vps/'],
  ['vps', 'Scaleway', 'DEV1-S', 'Paris, facturation horaire', '/mois', 'https://www.scaleway.com/en/pricing/virtual-instances/'],
  ['vps', 'IONOS', 'VPS Linux XS', 'Offres promotionnelles fréquentes', '/mois', 'https://www.ionos.fr/serveurs/vps'],
  ['vps', 'Hostinger VPS', 'KVM 1', 'Console hPanel, sauvegardes hebdo', '/mois', 'https://www.hostinger.com/vps-hosting'],
  ['vps', 'Kamatera', '1 vCPU / 1 Go', 'Facturation à l’heure, 18 régions', '/mois', 'https://www.kamatera.com/pricing/'],

  // ------------------------------------------------------------------ PAAAS (10)
  ['paas', 'Railway', 'Hobby', 'Crédit inclus, facturation à l’usage', '/mois', 'https://railway.com/pricing'],
  ['paas', 'Render', 'Free web service', '750 h/mois, mise en veille', '/mois', 'https://render.com/pricing'],
  ['paas', 'Fly.io', 'Pay as you go', 'Machines partagées, à la seconde', '/mois', 'https://fly.io/docs/about/pricing/'],
  ['paas', 'Koyeb', 'Free', '1 service, 512 Mo', '/mois', 'https://www.koyeb.com/pricing'],
  ['paas', 'Northflank', 'Free', 'Carte bancaire requise', '/mois', 'https://northflank.com/pricing'],
  ['paas', 'Coolify', 'Auto-hébergé', 'Gratuit sur votre VPS', '/mois', 'https://coolify.io/pricing'],
  ['paas', 'Dokploy', 'Auto-hébergé', 'Gratuit, alternative à Coolify', '/mois', 'https://dokploy.com/pricing'],
  ['paas', 'Clever Cloud', 'À l’usage', 'PaaS français, scalabilité auto', '/mois', 'https://www.clever-cloud.com/pricing/'],
  ['paas', 'Scaleway Containers', 'À l’usage', 'Conteneurs serverless', '/mois', 'https://www.scaleway.com/en/pricing/containers/'],
  ['paas', 'Google Cloud Run', 'Pay as you go', 'Requêtes facturées à l’usage', '/mois', 'https://cloud.google.com/run/pricing'],

  // --------------------------------------------------------------- DOMAINES (10)
  ['domaines', 'Porkbun', '.com', 'WHOIS privacy inclus', '/an', 'https://porkbun.com/products/domains'],
  ['domaines', 'Cloudflare Registrar', '.com', 'Prix coûtant, sans marge', '/an', 'https://www.cloudflare.com/products/registrar/'],
  ['domaines', 'Namecheap', '.com', 'WHOIS gratuit 1re année', '/an', 'https://www.namecheap.com/domains/registration/pricing/'],
  ['domaines', 'Gandi', '.com', 'Boîte mail incluse, France', '/an', 'https://www.gandi.net/fr/domain'],
  ['domaines', 'OVH', '.com', 'Registrar français', '/an', 'https://www.ovhcloud.com/fr/domains/'],
  ['domaines', 'Infomaniak', '.com', 'Registrar suisse', '/an', 'https://www.infomaniak.com/fr/domaines'],
  ['domaines', 'Namesilo', '.com', 'WHOIS gratuit à vie', '/an', 'https://www.namesilo.com/pricing'],
  ['domaines', 'Dynadot', '.com', 'Interface simple', '/an', 'https://www.dynadot.com/domain/pricing'],
  ['domaines', 'GoDaddy', '.com', 'Support téléphonique', '/an', 'https://www.godaddy.com/domains'],
  ['domaines', 'Hostinger Domaines', '.com', 'Souvent en promo la 1re année', '/an', 'https://www.hostinger.com/domain-name-search'],

  // -------------------------------------------------------------- SAUVEGARDE (10)
  ['sauvegarde', 'Backblaze Computer Backup', 'Par poste', 'Sauvegarde illimitée, 30 j de versions', '/mois', 'https://www.backblaze.com/computer-backup/pricing'],
  ['sauvegarde', 'IDrive', 'Personal', '5 To, sauvegarde continue', '/an', 'https://www.idrive.com/pricing'],
  ['sauvegarde', 'pCloud', 'Premium', '500 Go, synchronisation', '/an', 'https://www.pcloud.com/cloud-storage-pricing-plans.html'],
  ['sauvegarde', 'rsync.net', 'Standard', 'Archive distante, accès SSH', '/Go', 'https://www.rsync.net/pricing.html'],
  ['sauvegarde', 'Hetzner Storage Box', 'BX11', '1 To, snapshots', '/mois', 'https://www.hetzner.com/storage/storage-box'],
  ['sauvegarde', 'OVH Backup', 'À l’usage', 'Sauvegarde de VPS', '/mois', 'https://www.ovhcloud.com/fr/public-cloud/'],
  ['sauvegarde', 'Borgbase', 'Standard', 'Dépôts Borg, déduplication', '/mois', 'https://www.borgbase.com/pricing'],
  ['sauvegarde', 'Tarsnap', 'À l’usage', '0,25 $/Go stocké, chiffré', '/Go', 'https://www.tarsnap.com/pricing.html'],
  ['sauvegarde', 'AWS Backup', 'À l’usage', 'Centralise les sauvegardes AWS', '/mois', 'https://aws.amazon.com/backup/pricing/'],
  ['sauvegarde', 'Restique', 'Auto-hébergé', 'Restique + stockage objet', '/mois', 'https://restic.net/'],
];

const client = new pg.Client({ connectionString: url });
await client.connect();

let n = 0;
for (const [category, provider, plan, specs, unit, link] of CATALOG) {
  await client.query(
    `insert into market_offers(category, provider, plan, specs, currency, unit, url, source_kind, checked_at)
     values($1,$2,$3,$4,'USD',$5,$6,'manuel', now())
     on conflict (category, provider, plan) do update
       set specs=excluded.specs, unit=excluded.unit, url=excluded.url, updated_at=now()`,
    [category, provider, plan, specs, unit, link],
  );
  n += 1;
}

const totals = await client.query(
  'select category, count(distinct provider)::int as plateformes, count(*)::int as offres from market_offers group by category order by category',
);
console.log(`entrées catalogue : ${n}`);
for (const r of totals.rows) console.log(`${r.category.padEnd(16)} ${r.plateformes} plateformes · ${r.offres} offres`);

await client.end();
process.exit(0);
