import io, re

p = r'C:\Users\rene\5dev\apps\api\src\modules\market.ts'
s = io.open(p, encoding='utf-8').read()

page_sources = r'''
/* ------------------------------------------------ relevé sur page tarifaire
 * Certains fournisseurs ne publient pas d'interface JSON ouverte. On lit alors
 * leur page de tarifs et on extrait UN prix, encadré par un intervalle plausible
 * (min/max) : hors intervalle, l'extraction est considérée ratée et rien n'est
 * écrit. `source_kind = 'page'` le dit explicitement — ce n'est pas un contrat,
 * c'est une lecture datée, et la page 5DEV affiche le lien officiel.
 */

type PageSource = {
  category: (typeof CATEGORIES)[number];
  provider: string;
  plan: string;
  specs: string;
  url: string;
  pattern: RegExp;
  min: number;
  max: number;
  currency: string;
  unit: string;
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36';

export const PAGE_SOURCES: PageSource[] = [
  { category: 'stockage-objet', provider: 'Backblaze B2', plan: 'Stockage — au To', specs: '10 Go gratuits, sortie 3x le stockage', url: 'https://www.backblaze.com/cloud-storage/pricing', pattern: /\$\s?([\d.]+)\s*(?:per|\/)\s*TB/i, min: 3, max: 30, currency: 'USD', unit: '/To' },
  { category: 'stockage-objet', provider: 'Cloudflare R2', plan: 'Stockage standard', specs: 'Sortie gratuite, 10 Go offerts', url: 'https://developers.cloudflare.com/r2/pricing/', pattern: /\$\s?(0\.0\d+)\s*\/\s*GB/i, min: 0.005, max: 0.1, currency: 'USD', unit: '/Go' },
  { category: 'stockage-objet', provider: 'Bunny Storage', plan: 'Storage', specs: 'Replication optionnelle, CDN inclus', url: 'https://bunny.net/pricing/', pattern: /\$\s?(0\.\d+)/, min: 0.005, max: 1, currency: 'USD', unit: '/Go' },
  { category: 'images-cdn', provider: 'Bunny CDN', plan: 'Trafic CDN', specs: 'Volume, Afrique incluse', url: 'https://bunny.net/pricing/', pattern: /\$\s?(0\.0\d+)/, min: 0.001, max: 0.2, currency: 'USD', unit: '/Go' },
  { category: 'images-cdn', provider: 'Cloudflare Images', plan: 'Forfait mensuel', specs: 'Stockage + livraison', url: 'https://developers.cloudflare.com/images/pricing/', pattern: /\$\s?(\d+)/, min: 1, max: 60, currency: 'USD', unit: '/mois' },
  { category: 'domaines', provider: 'Porkbun', plan: '.com — 1re annee', specs: 'WHOIS privacy inclus', url: 'https://porkbun.com/products/domains', pattern: /\.com[\s\S]{0,300}?\$\s?([\d.]+)/i, min: 5, max: 40, currency: 'USD', unit: '/an' },
  { category: 'hebergement', provider: 'Hostinger', plan: 'Premium — engagement long', specs: '100 sites, SSL, 100 Go', url: 'https://www.hostinger.com/pricing', pattern: /\$\s?([\d.]+)\s*\/?\s*mo/i, min: 1, max: 40, currency: 'USD', unit: '/mois' },
  { category: 'paas', provider: 'Railway', plan: 'Hobby', specs: 'Credit inclus, facturation a l usage', url: 'https://railway.com/pricing', pattern: /\$\s?([\d.]+)\s*\/?\s*(?:mo|month)/i, min: 1, max: 40, currency: 'USD', unit: '/mois' },
  { category: 'base-de-donnees', provider: 'Neon', plan: 'Launch', specs: 'Postgres serverless, autoscaling', url: 'https://neon.tech/pricing', pattern: /\$\s?(\d+)/, min: 5, max: 80, currency: 'USD', unit: '/mois' },
  { category: 'email', provider: 'Brevo', plan: 'Starter', specs: '20 k emails/mois, expediteur valide', url: 'https://www.brevo.com/pricing/', pattern: /\$\s?(\d+)/, min: 5, max: 80, currency: 'USD', unit: '/mois' },
  { category: 'email', provider: 'Resend', plan: 'Pro', specs: '50 k emails/mois, API simple', url: 'https://resend.com/pricing', pattern: /\$\s?(\d+)/, min: 5, max: 80, currency: 'USD', unit: '/mois' },
  { category: 'sauvegarde', provider: 'Backblaze Computer Backup', plan: 'Par poste', specs: 'Sauvegarde illimitee, versioning 30 j', url: 'https://www.backblaze.com/computer-backup/pricing', pattern: /\$\s?([\d.]+)\s*(?:\/|per)\s*month/i, min: 5, max: 30, currency: 'USD', unit: '/mois' },
];

/** Lit une page et renvoie le premier prix plausible, ou null. */
async function readPagePrice(src: PageSource): Promise<number | null> {
  try {
    const res = await fetch(src.url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(src.pattern);
    if (!m?.[1]) return null;
    const value = Number(String(m[1]).replace(',', '.'));
    if (!Number.isFinite(value)) return null;
    if (value < src.min || value > src.max) return null;
    return value;
  } catch {
    return null;
  }
}
'''

anchor = "const liveSources = [{ name: 'Vultr', run: fetchVultr }];"
assert anchor in s, 'ancre liveSources introuvable'
s = s.replace(anchor, page_sources.strip('\n') + '\n\n' + anchor, 1)

old_end = "    res.json({ ok: true, data: { report } });"
new_end = r'''    // Pages tarifaires : un relevé par fournisseur, silence en cas d'échec.
    let pageOk = 0;
    let pageKo = 0;
    for (const src of PAGE_SOURCES) {
      const price = await readPagePrice(src);
      if (price === null) {
        pageKo += 1;
        continue;
      }

      const existing = await one<{ id: string; price: string | null }>(
        'select id, price from market_offers where category=$1 and provider=$2 and plan=$3',
        [src.category, src.provider, src.plan],
      );

      if (!existing) {
        const created = await one<{ id: string }>(
          `insert into market_offers(category, provider, plan, specs, price, currency, unit, url, source_kind, checked_at)
           values($1,$2,$3,$4,$5,$6,$7,$8,'page', now()) returning id`,
          [src.category, src.provider, src.plan, src.specs, price, src.currency, src.unit, src.url],
        );
        if (created) {
          await one('insert into market_price_history(offer_id, price, currency) values($1,$2,$3)', [
            created.id,
            price,
            src.currency,
          ]).catch(() => null);
        }
      } else {
        const changed = Number(existing.price ?? -1) !== price;
        await one(
          `update market_offers set price=$2, specs=$3, url=$4, currency=$5, unit=$6,
                  prev_price = case when price is distinct from $2 then price else prev_price end,
                  source_kind='page', checked_at=now(), updated_at=now()
            where id=$1`,
          [existing.id, price, src.specs, src.url, src.currency, src.unit],
        );
        if (changed) {
          await one('insert into market_price_history(offer_id, price, currency) values($1,$2,$3)', [
            existing.id,
            price,
            src.currency,
          ]).catch(() => null);
        }
      }
      pageOk += 1;
    }
    report.push({
      provider: 'Pages tarifaires',
      ok: pageOk > 0,
      updated: pageOk,
      error: pageKo ? `${pageKo} page(s) illisible(s)` : undefined,
    });

    res.json({ ok: true, data: { report } });'''
assert old_end in s
s = s.replace(old_end, new_end, 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('sources page ajoutees')
