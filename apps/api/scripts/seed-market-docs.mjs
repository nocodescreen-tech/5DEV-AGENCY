// Documentation d'intégration des plateformes : paquet Node, paquet Python,
// commande d'installation, et lien officiel. Aucune commande inventée : quand
// il n'existe pas de SDK, on écrit REST (fetch / requests).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire('C:/Users/rene/5dev/apps/api/package.json');
const pg = require_('pg');

const env = readFileSync(new URL('../../../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();

/** [provider, doc_url, sdk_node, sdk_python, note] */
const DOCS = [
  // stockage objet / S3-compatible
  ['Amazon S3', 'https://docs.aws.amazon.com/s3/', '@aws-sdk/client-s3', 'boto3', 'S3 natif.'],
  ['Cloudflare R2', 'https://developers.cloudflare.com/r2/api/', '@aws-sdk/client-s3', 'boto3', 'S3 compatible : renseigner endpoint https://<account>.r2.cloudflarestorage.com et region auto.'],
  ['Backblaze B2', 'https://www.backblaze.com/docs/cloud-storage-s3-compatible-api', '@aws-sdk/client-s3', 'boto3', 'S3 compatible via l’endpoint s3.<region>.backblazeb2.com.'],
  ['Wasabi', 'https://docs.wasabi.com/', '@aws-sdk/client-s3', 'boto3', 'S3 compatible, endpoint par région.'],
  ['Scaleway Object Storage', 'https://www.scaleway.com/en/docs/object-storage/', '@aws-sdk/client-s3', 'boto3', 'S3 compatible, endpoint s3.fr-par.scw.cloud.'],
  ['OVH Object Storage', 'https://help.ovhcloud.com/csm/fr-public-cloud-storage-s3', '@aws-sdk/client-s3', 'boto3', 'S3 compatible, endpoint s3.<region>.io.cloud.ovh.net.'],
  ['Google Cloud Storage', 'https://cloud.google.com/storage/docs', '@google-cloud/storage', 'google-cloud-storage', 'SDK dédié, pas S3.'],
  ['MinIO', 'https://min.io/docs/minio/linux/developers/minio-drivers.html', 'minio', 'minio', 'Auto-hébergé, S3 compatible.'],
  ['Supabase Storage', 'https://supabase.com/docs/guides/storage', '@supabase/supabase-js', 'supabase', 'Stockage adossé à Postgres, API JS/Python.'],
  ['Bunny Storage', 'https://docs.bunny.net/reference/storage-api', null, null, 'API REST, upload par PUT signé.'],

  // base de données
  ['Supabase', 'https://supabase.com/docs/reference/javascript', '@supabase/supabase-js', 'supabase', 'Client PostgREST + auth.'],
  ['Neon', 'https://neon.tech/docs/guides/node', '@neondatabase/serverless', 'psycopg', 'Postgres : driver serverless (HTTP) côté Node, psycopg côté Python.'],
  ['Turso', 'https://docs.turso.tech/sdk', '@libsql/client', 'libsql-client', 'SQLite distribué (libSQL).'],
  ['PlanetScale', 'https://planetscale.com/docs', '@planetscale/database', 'pymysql', 'MySQL/Vitess : driver HTTP côté Node.'],
  ['MongoDB Atlas', 'https://www.mongodb.com/docs/drivers/', 'mongodb', 'pymongo', 'Drivers officiels.'],
  ['Redis Cloud', 'https://redis.io/docs/latest/develop/clients/', 'redis', 'redis', 'Client officiel.'],
  ['Railway Postgres', 'https://docs.railway.com/guides/postgresql', 'pg', 'psycopg', 'Postgres standard : DATABASE_URL fournie.'],
  ['Aiven', 'https://docs.aiven.io/docs/products', 'pg', 'psycopg', 'Postgres/MySQL managé : mêmes drivers que le moteur.'],

  // email
  ['Brevo', 'https://developers.brevo.com/docs', '@getbrevo/brevo', 'sib-api-v3-sdk', 'API transactionnelle v3.'],
  ['Resend', 'https://resend.com/docs/send-with-nodejs', 'resend', 'resend', 'SDK minimal, clé API.'],
  ['Mailgun', 'https://documentation.mailgun.com/docs/mailgun/api-reference/', 'mailgun.js', 'mailgun', 'API HTTP + SDK.'],
  ['Postmark', 'https://postmarkapp.com/developer', 'postmark', 'postmarker', 'API transactionnelle.'],
  ['Amazon SES', 'https://docs.aws.amazon.com/ses/', '@aws-sdk/client-ses', 'boto3', 'Sandbox à lever avant envoi réel.'],
  ['Mailtrap', 'https://docs.mailtrap.io/', 'mailtrap', 'mailtrap', 'Sandbox de test + envoi réel.'],
  ['Zoho Mail', 'https://www.zoho.com/mail/help/api/', null, null, 'API REST Zoho, OAuth2.'],

  // dns
  ['Cloudflare DNS', 'https://developers.cloudflare.com/api/', 'cloudflare', 'cloudflare', 'API v4, token scoped.'],
  ['Google Cloud DNS', 'https://cloud.google.com/dns/docs', '@google-cloud/dns', 'google-cloud-dns', 'SDK GCP.'],
  ['Amazon Route 53', 'https://docs.aws.amazon.com/route53/', '@aws-sdk/client-route-53', 'boto3', 'API AWS.'],
  ['NS1', 'https://docs.ns1.com/', null, 'ns1-python', 'SDK Python officiel ; REST côté Node.'],
  ['deSEC', 'https://desec.readthedocs.io/', null, 'desec-dns', 'API REST + client Python.'],
  ['Hetzner DNS', 'https://dns.hetzner.com/api-docs', null, null, 'API REST avec token.'],
  ['Bunny DNS', 'https://docs.bunny.net/reference/dnszonepublic_index', null, null, 'API REST.'],
  ['DNSimple', 'https://developer.dnsimple.com/', null, 'dnsimple-python', 'API REST + SDK Python.'],
  ['Gandi LiveDNS', 'https://api.gandi.net/docs/livedns/', null, null, 'API REST, clé personnelle.'],
  ['OVH DNS', 'https://api.ovh.com/', null, 'ovh', 'SDK Python officiel, API REST.'],

  // cdn / images
  ['Cloudflare Images', 'https://developers.cloudflare.com/images/', null, null, 'API REST, upload direct.'],
  ['Cloudflare CDN', 'https://developers.cloudflare.com/cache/', 'cloudflare', 'cloudflare', 'Cache via API ou en-têtes.'],
  ['Cloudflare Stream', 'https://developers.cloudflare.com/stream/', null, null, 'API REST vidéo.'],
  ['Cloudflare Pages', 'https://developers.cloudflare.com/pages/', 'wrangler', null, 'CLI wrangler pour déployer.'],
  ['Cloudflare Workers', 'https://developers.cloudflare.com/workers/', 'wrangler', null, 'CLI wrangler, runtime V8.'],
  ['Bunny CDN', 'https://docs.bunny.net/reference/api-overview', null, null, 'API REST de purge et statistiques.'],
  ['Cloudinary', 'https://cloudinary.com/documentation', 'cloudinary', 'cloudinary', 'SDK officiel, transformations par URL.'],
  ['imgix', 'https://docs.imgix.com/', 'imgix-core-js', 'imgix', 'URL signées + SDK.'],
  ['ImageKit', 'https://docs.imagekit.io/', 'imagekit', 'imagekitio', 'SDK officiel, transformations.'],
  ['Uploadcare', 'https://uploadcare.com/docs/', '@uploadcare/upload-client', 'pyuploadcare', 'Upload direct + CDN.'],
  ['Fastly', 'https://www.fastly.com/documentation/reference/api/', null, null, 'API REST de purge et configuration.'],
  ['Amazon CloudFront', 'https://docs.aws.amazon.com/cloudfront/', '@aws-sdk/client-cloudfront', 'boto3', 'API AWS.'],

  // paas
  ['Railway', 'https://docs.railway.com/reference/public-api', null, null, 'API GraphQL + CLI.'],
  ['Render', 'https://api-docs.render.com/', null, null, 'API REST + déploiement par Git.'],
  ['Fly.io', 'https://fly.io/docs/', 'flyctl', null, 'CLI flyctl, machines via API.'],
  ['Koyeb', 'https://www.koyeb.com/docs/api', null, null, 'API REST.'],
  ['Northflank', 'https://northflank.com/docs/v1/application/overview', null, null, 'API REST, carte requise.'],
  ['Coolify', 'https://coolify.io/docs/api-reference', null, null, 'Auto-hébergé, API REST + webhooks.'],
  ['Dokploy', 'https://docs.dokploy.com/docs/api', null, null, 'Auto-hébergé, API REST.'],
  ['Clever Cloud', 'https://www.clever-cloud.com/developers/api/', null, 'clevercloud-sdk', 'API REST + SDK Python.'],
  ['Scaleway Containers', 'https://www.scaleway.com/en/docs/containers/', null, null, 'API REST Scaleway.'],
  ['Google Cloud Run', 'https://cloud.google.com/run/docs', '@google-cloud/run', 'google-cloud-run', 'SDK GCP, déploiement de conteneurs.'],

  // hébergement
  ['Hostinger', 'https://developers.hostinger.com/', null, null, 'API REST pour VPS et domaine.'],
  ['Netlify', 'https://docs.netlify.com/api/get-started/', 'netlify-cli', null, 'CLI netlify deploy.'],
  ['Vercel', 'https://vercel.com/docs/rest-api', 'vercel', null, 'CLI vercel --prod.'],
  ['GitHub Pages', 'https://docs.github.com/pages', null, null, 'Déploiement par branche gh-pages ou Actions.'],
  ['o2switch', 'https://faq.o2switch.fr/', null, null, 'cPanel + accès SSH, pas d’API publique.'],
  ['PlanetHoster', 'https://www.planethoster.com/fr/Aide', null, null, 'cPanel, pas de SDK.'],
  ['OVH Perso', 'https://help.ovhcloud.com/', null, null, 'cPanel, accès FTP/SSH.'],
  ['Infomaniak', 'https://developer.infomaniak.com/', null, null, 'API REST partielle.'],

  // domaines
  ['Porkbun', 'https://porkbun.com/api/json/v3/documentation', null, null, 'API JSON v3, clé + secret.'],
  ['Cloudflare Registrar', 'https://developers.cloudflare.com/registrar/', 'cloudflare', 'cloudflare', 'Via l’API Cloudflare.'],
  ['Namecheap', 'https://www.namecheap.com/support/api/intro/', null, null, 'API XML, IP à autoriser.'],
  ['Gandi', 'https://api.gandi.net/docs/', null, null, 'API REST, clé personnelle.'],
  ['OVH', 'https://api.ovh.com/', null, 'ovh', 'SDK Python officiel.'],
  ['Infomaniak Domaines', 'https://developer.infomaniak.com/', null, null, 'API REST.'],
  ['Namesilo', 'https://www.namesilo.com/api-reference', null, null, 'API REST XML/JSON.'],
  ['Dynadot', 'https://www.dynadot.com/domain/api3', null, null, 'API v3.'],
  ['GoDaddy', 'https://developer.godaddy.com/doc', null, null, 'API REST, clé + secret.'],
  ['Hostinger Domaines', 'https://developers.hostinger.com/', null, null, 'API REST Hostinger.'],

  // sauvegarde
  ['Backblaze Computer Backup', 'https://www.backblaze.com/docs', null, null, 'Application cliente, pas d’API d’envoi.'],
  ['IDrive', 'https://www.idrive.com/enterprise/api', null, null, 'API REST entreprise.'],
  ['pCloud', 'https://docs.pcloud.com/', null, null, 'API REST, OAuth2.'],
  ['rsync.net', 'https://www.rsync.net/resources/howto/index.html', null, null, 'SSH/rsync, aucun SDK.'],
  ['Hetzner Storage Box', 'https://docs.hetzner.com/storage/storage-box/', null, null, 'rsync, SFTP, BorgBackup.'],
  ['Borgbase', 'https://docs.borgbase.com/', null, null, 'Borg + borgmatic.'],
  ['Tarsnap', 'https://www.tarsnap.com/documentation.html', null, null, 'Client CLI tarsnap.'],
  ['AWS Backup', 'https://docs.aws.amazon.com/aws-backup/', '@aws-sdk/client-backup', 'boto3', 'API AWS.'],
  ['Restique', 'https://restic.readthedocs.io/', null, null, 'restic + stockage objet.'],
  ['OVH Backup', 'https://help.ovhcloud.com/', null, null, 'Depuis l’espace client.'],
];

function snippetNode(pkg) {
  if (!pkg) return null;
  if (pkg === 'wrangler') return 'npx wrangler deploy';
  if (pkg === 'netlify-cli') return 'npx netlify deploy --prod';
  if (pkg === 'vercel') return 'npx vercel --prod';
  if (pkg === 'flyctl') return 'fly deploy';
  return `npm i ${pkg}`;
}

function snippetPython(pkg) {
  if (!pkg) return null;
  if (pkg === 'borgbackup') return 'pip install borgbackup';
  return `pip install ${pkg}`;
}

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(readFileSync(new URL('../src/db/schema-market-docs.sql', import.meta.url), 'utf8'));

let n = 0;
for (const [provider, docUrl, nodePkg, pyPkg, note] of DOCS) {
  const apiStyle = nodePkg || pyPkg ? 'SDK' : 'REST';
  await client.query(
    `insert into market_platform_docs(provider, doc_url, sdk_node, sdk_python, snippet_node, snippet_python, api_style, note)
     values($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (provider) do update set
       doc_url=excluded.doc_url, sdk_node=excluded.sdk_node, sdk_python=excluded.sdk_python,
       snippet_node=excluded.snippet_node, snippet_python=excluded.snippet_python,
       api_style=excluded.api_style, note=excluded.note, updated_at=now()`,
    [
      provider,
      docUrl,
      nodePkg,
      pyPkg,
      snippetNode(nodePkg, apiStyle),
      snippetPython(pyPkg),
      apiStyle,
      note,
    ],
  );
  n += 1;
}

const total = await client.query('select count(*)::int as n from market_platform_docs');
const couverts = await client.query(
  `select count(distinct o.provider)::int as n from market_offers o
     join market_platform_docs d on lower(d.provider) = lower(o.provider)`,
);
console.log(`fiches doc : ${n} · en base : ${total.rows[0].n}`);
console.log(`plateformes du catalogue couvertes : ${couverts.rows[0].n}`);
await client.end();
process.exit(0);
