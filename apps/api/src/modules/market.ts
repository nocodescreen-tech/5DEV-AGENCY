import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin } from '../middlewares/auth.js';
import { scrapeAll, scrapeOne } from './market-scrape.js';

/**
 * Veille tarifaire des fournisseurs (domaines, hébergement, VPS, stockage, CDN…).
 *
 * Règle de vérité, non négociable : un prix n'est « temps réel » que s'il a été
 * relevé sur une interface publique du fournisseur (`source_kind = 'api'`) et
 * que `checked_at` est récent. Tout le reste est marqué `manuel` et affiché
 * comme indicatif avec sa date de relevé. On ne comble jamais un trou par une
 * estimation : mieux vaut « non vérifié » qu'un chiffre inventé.
 *
 * Source réellement branchée : l'API publique de Vultr (`/v2/plans`), sans clé.
 * Ajouter un fournisseur = ajouter un relevé dans `liveSources` ci-dessous.
 */

export const marketRouter: Router = Router();

export const CATEGORIES = [
  'gratuit',
  'domaines',
  'hebergement',
  'vps',
  'stockage-objet',
  'images-cdn',
  'base-de-donnees',
  'email',
  'paas',
  'dns',
  'sauvegarde',
] as const;

type LiveOffer = {
  category: (typeof CATEGORIES)[number];
  provider: string;
  plan: string;
  specs: string;
  price: number | null;
  currency: string;
  unit: string;
  url: string;
  source_ref: string;
};

/* ------------------------------------------------------------------ sources */

/** Vultr — `monthly_cost` en USD, sans authentification. */
async function fetchVultr(): Promise<LiveOffer[]> {
  const res = await fetch('https://api.vultr.com/v2/plans?per_page=100', {
    headers: { Accept: 'application/json', 'User-Agent': '5dev-console' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new AppError(502, 'PROVIDER', `Vultr a répondu ${res.status}.`);

  const body = (await res.json()) as {
    plans?: {
      id: string;
      vcpu_count: number;
      ram: number;
      disk: number;
      monthly_cost: number;
      type: string;
      bandwidth: number;
    }[];
  };

  const plans = (body.plans ?? []).filter((p) => Number(p.monthly_cost) >= 0);

  // Toutes les offres sont conservées : une même famille propose plusieurs
  // tailles, et c'est justement l'éventail qu'on veut comparer. Le plan porte
  // la famille et l'identifiant pour rester unique en base.
  const out: LiveOffer[] = [];

  for (const p of plans.sort((a, b) => a.monthly_cost - b.monthly_cost)) {
    const famille =
      p.type === 'vc2' ? 'Cloud compute' :
      p.type === 'vdc' ? 'Dédié' :
      p.type === 'vhp' ? 'Haute performance' :
      p.type === 'voc' ? 'Optimisé compute' :
      p.type === 'vbm' ? 'Métal' :
      p.type === 'vcg' ? 'GPU' : p.type;

    out.push({
      category: 'vps',
      provider: 'Vultr',
      plan: `${famille} · ${p.vcpu_count} vCPU · ${(p.ram / 1024).toFixed(1)} Go — ${p.id}`,
      specs: `${p.disk} Go SSD · ${p.bandwidth} Go transfert`,
      price: Number(p.monthly_cost),
      currency: 'USD',
      unit: '/mois',
      url: 'https://www.vultr.com/pricing/',
      source_ref: p.id,
    });
  }
  return out;
}

/* ------------------------------------------------ relevé sur page tarifaire
 * Certains fournisseurs ne publient pas d'interface JSON ouverte. On lit alors
 * leur page de tarifs et on extrait UN prix, encadré par un intervalle plausible
 * (min/max) : hors intervalle, l'extraction est considérée ratée et rien n'est
 * écrit. `source_kind = 'page'` le dit explicitement — ce n'est pas un contrat,
 * c'est une lecture datée, et la page 5DEV affiche le lien officiel.
 */

export type PageSource = {
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

/**
 * Extraction déterministe des paires « nom d'offre + prix » dans le JSON
 * embarqué des pages tarifaires (`__NEXT_DATA__`, JSON-LD, état d'hydratation).
 *
 * C'est la source la plus fiable : les deux valeurs sont lues dans la page,
 * sans passer par un modèle. Utilisée AVANT l'IA ; l'IA ne sert qu'en secours.
 */
function pairsFromJson(html: string): { plan: string; price: number; currency: string }[] {
  const out: { plan: string; price: number; currency: string }[] = [];
  const seen = new Set<string>();

  // "name":"Starter" ... "price":9   (ou l'inverse), dans un même objet
  const patterns = [
    /"name"\s*:\s*"([^"]{2,60})"[\s\S]{0,240}?"(?:price|amount|monthly)"\s*:\s*"?([0-9]+(?:\.[0-9]{1,2})?)"?/gi,
    /"(?:price|amount|monthly)"\s*:\s*"?([0-9]+(?:\.[0-9]{1,2})?)"?[\s\S]{0,240}?"name"\s*:\s*"([^"]{2,60})"/gi,
  ];

  for (const [idx, re] of patterns.entries()) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const plan = String(idx === 0 ? m[1] : m[2] ?? '').trim();
      const price = Number(idx === 0 ? m[2] : m[1]);
      if (!plan || plan.length < 2) continue;
      if (!Number.isFinite(price) || price <= 0 || price > 100000) continue;
      const key = `${plan.toLowerCase()}|${price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ plan: plan.slice(0, 120), price, currency: 'USD' });
      if (out.length >= 8) return out;
    }
  }
  return out;
}

/** Écrit les paires trouvées dans le JSON de la page. */
export async function writeJsonPairs(src: PageSource, html: string): Promise<number> {
  const pairs = pairsFromJson(html);
  let written = 0;

  for (const pair of pairs) {
    const plan = `${src.provider} — ${pair.plan}`.slice(0, 120);
    const existing = await one<{ id: string; price: string | null }>(
      'select id, price from market_offers where category=$1 and provider=$2 and plan=$3',
      [src.category, src.provider, plan],
    );

    if (existing) {
      await one(
        `update market_offers set price=$2, currency=$3, unit=$4, url=$5, source_kind='page',
                prev_price = case when price is distinct from $2 then price else prev_price end,
                checked_at=now(), updated_at=now()
          where id=$1`,
        [existing.id, pair.price, pair.currency, src.unit, src.url],
      );
      if (Number(existing.price ?? -1) !== pair.price) {
        await one('insert into market_price_history(offer_id, price, currency) values($1,$2,$3)', [
          existing.id,
          pair.price,
          pair.currency,
        ]).catch(() => null);
      }
    } else {
      const created = await one<{ id: string }>(
        `insert into market_offers(category, provider, plan, specs, price, currency, unit, url, source_kind, checked_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,'page', now()) returning id`,
        [src.category, src.provider, plan, pair.plan, pair.price, pair.currency, src.unit, src.url],
      );
      if (created) {
        await one('insert into market_price_history(offer_id, price, currency) values($1,$2,$3)', [
          created.id,
          pair.price,
          pair.currency,
        ]).catch(() => null);
      }
    }
    written += 1;
  }
  return written;
}

/** Akamai Linode — `/v4/linode/types` est public (aucune clé), prix mensuels réels. */
async function fetchLinode(): Promise<LiveOffer[]> {
  const res = await fetch('https://api.linode.com/v4/linode/types?page_size=500', {
    headers: { Accept: 'application/json', 'User-Agent': '5dev-console' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new AppError(502, 'PROVIDER', `Linode a répondu ${res.status}.`);

  const body = (await res.json()) as {
    data?: {
      id: string;
      label: string;
      price: { monthly: number | null };
      memory: number;
      vcpus: number;
      disk: number;
      class?: string;
    }[];
  };

  const out: LiveOffer[] = [];
  for (const t of body.data ?? []) {
    const monthly = Number(t.price?.monthly ?? 0);
    if (!Number.isFinite(monthly) || monthly <= 0) continue;
    out.push({
      category: 'vps',
      provider: 'Akamai Linode',
      plan: `${t.label} · ${t.vcpus} vCPU · ${(t.memory / 1024).toFixed(1)} Go — ${t.id}`,
      specs: `${t.disk} Go SSD${t.class ? ` · ${t.class}` : ''}`,
      price: monthly,
      currency: 'USD',
      unit: '/mois',
      url: 'https://www.linode.com/pricing/',
      source_ref: t.id,
    });
  }
  return out;
}

const liveSources = [
  { name: 'Vultr', run: fetchVultr },
  { name: 'Akamai Linode', run: fetchLinode },
];

/* ------------------------------------------------------------------- routes */

type OfferRow = {
  id: string;
  category: string;
  provider: string;
  plan: string;
  specs: string;
  price: string | null;
  currency: string;
  unit: string;
  url: string;
  source_kind: 'api' | 'manuel';
  prev_price: string | null;
  checked_at: string | null;
  updated_at: string;
};

marketRouter.get('/admin/market', requireAdmin, async (req, res, next) => {
  try {
    const cat = typeof req.query.category === 'string' ? req.query.category : null;
    const rows = await all<OfferRow>(
      `select id, category, provider, plan, specs, price, currency, unit, url,
              source_kind, prev_price, checked_at, updated_at
         from market_offers
        where ($1::text is null or category = $1)
        order by category, price nulls last, provider`,
      [cat],
    );

    const counts = await all<{ category: string; n: number }>(
      'select category, count(*)::int as n from market_offers group by category order by category',
    );
    const docs = await all<{
      provider: string;
      doc_url: string;
      sdk_node: string | null;
      sdk_python: string | null;
      snippet_node: string | null;
      snippet_python: string | null;
      api_style: string;
      note: string;
    }>(
      `select provider, doc_url, sdk_node, sdk_python, snippet_node, snippet_python, api_style, note
         from market_platform_docs`,
    );

    const lastRun = await one<{ at: string | null }>(
      "select max(checked_at) as at from market_offers where source_kind = 'api'",
    );

    res.json({
      ok: true,
      data: {
        offers: rows.map((r) => ({
          ...r,
          price: r.price === null ? null : Number(r.price),
          prev_price: r.prev_price === null ? null : Number(r.prev_price),
          delta:
            r.price !== null && r.prev_price !== null && Number(r.prev_price) !== 0
              ? Math.round(((Number(r.price) - Number(r.prev_price)) / Number(r.prev_price)) * 1000) / 10
              : null,
        })),
        counts,
        categories: CATEGORIES,
        docs: docs.map((d) => ({ ...d, provider_key: d.provider.toLowerCase() })),
        last_checked: lastRun?.at ?? null,
        sources: liveSources.map((s) => s.name),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Relevé des prix. Écrit l'ancien prix dans `prev_price` **et** une ligne
 * d'historique : c'est ce qui permet de dire « ce prix a changé chez le
 * fournisseur » au lieu de l'affirmer sans preuve.
 */
marketRouter.post('/admin/market/refresh', requireAdmin, async (_req, res, next) => {
  try {
    const report: { provider: string; ok: boolean; updated: number; error?: string }[] = [];

    for (const source of liveSources) {
      try {
        const offers = await source.run();
        let updated = 0;

        for (const o of offers) {
          const existing = await one<{ id: string; price: string | null }>(
            'select id, price from market_offers where category=$1 and provider=$2 and plan=$3',
            [o.category, o.provider, o.plan],
          );

          if (!existing) {
            const created = await one<{ id: string }>(
              `insert into market_offers(category, provider, plan, specs, price, currency, unit, url, source_kind, source_ref, checked_at)
               values($1,$2,$3,$4,$5,$6,$7,$8,'api',$9, now()) returning id`,
              [o.category, o.provider, o.plan, o.specs, o.price, o.currency, o.unit, o.url, o.source_ref],
            );
            if (created && o.price !== null) {
              await one('insert into market_price_history(offer_id, price, currency) values($1,$2,$3)', [
                created.id,
                o.price,
                o.currency,
              ]).catch(() => null);
            }
            updated += 1;
            continue;
          }

          const changed = Number(existing.price ?? -1) !== Number(o.price ?? -1);
          await one(
            `update market_offers
                set specs=$2, price=$3, currency=$4, unit=$5, url=$6, source_ref=$7,
                    prev_price = case when price is distinct from $3 then price else prev_price end,
                    checked_at = now(), updated_at = now()
              where id=$1`,
            [existing.id, o.specs, o.price, o.currency, o.unit, o.url, o.source_ref],
          );

          if (changed && o.price !== null) {
            await one('insert into market_price_history(offer_id, price, currency) values($1,$2,$3)', [
              existing.id,
              o.price,
              o.currency,
            ]).catch(() => null);
          }
          updated += 1;
        }

        report.push({ provider: source.name, ok: true, updated });
      } catch (err) {
        report.push({ provider: source.name, ok: false, updated: 0, error: (err as Error).message });
      }
    }

    // Pages tarifaires : un relevé par fournisseur, silence en cas d'échec.
    let pageOk = 0;
    let pageKo = 0;
    for (const src of PAGE_SOURCES) {
      // 1. paires nom/prix lues dans le JSON de la page (déterministe)
      try {
        const res = await fetch(src.url, {
          headers: { 'User-Agent': UA, Accept: 'text/html' },
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const html = await res.text();
          const pairs = await writeJsonPairs(src, html);
          if (pairs > 0) {
            pageOk += pairs;
            continue;
          }
        }
      } catch {
        /* on retombe sur l'extraction simple */
      }

      // 2. sinon, le premier prix plausible de la page
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
    // Passe générale : toutes les plateformes du catalogue, paires JSON uniquement
    // (déterministe). C'est ce qui couvre les 86 fournisseurs sans écrire 86 regex.
    const allTargets = await all<{ provider: string; url: string; category: string }>(
      `select provider, min(url) as url, min(category) as category
         from market_offers where url <> '' group by provider`,
    );
    let bulk = 0;
    for (const t of allTargets) {
      try {
        const res = await fetch(t.url, {
          headers: { 'User-Agent': UA, Accept: 'text/html' },
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) continue;
        const html = await res.text();
        const src: PageSource = {
          category: t.category as PageSource['category'],
          provider: t.provider,
          plan: '',
          specs: '',
          url: t.url,
          pattern: /./,
          min: 0,
          max: 0,
          currency: 'USD',
          unit: '/mois',
        };
        bulk += await writeJsonPairs(src, html);
      } catch {
        /* fournisseur injoignable : on n'écrit rien */
      }
    }
    report.push({ provider: 'JSON embarqué (toutes plateformes)', ok: bulk > 0, updated: bulk });

    report.push({
      provider: 'Pages tarifaires',
      ok: pageOk > 0,
      updated: pageOk,
      error: pageKo ? `${pageKo} page(s) illisible(s)` : undefined,
    });

    const alerts = await notifyPriceChanges();
    res.json({ ok: true, data: { report, alerts } });
  } catch (err) {
    next(err);
  }
});

/** Edition manuelle d'une offre (prix relevé à la main, ou correction). */
marketRouter.patch('/admin/market/:id', requireAdmin, async (req, res, next) => {
  try {
      const id = String(req.params.id);
      if (!z.string().uuid().safeParse(id).success) throw new AppError(404, 'NOT_FOUND', 'Offre introuvable.');

      const parsed = z
        .object({
          price: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
          url: z.string().max(300).optional(),
          specs: z.string().max(300).optional(),
          currency: z.enum(['USD', 'EUR', 'CDF']).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) throw new AppError(422, 'VALIDATION', 'Champs invalides.');

      const p = parsed.data;
      const row = await one<{ id: string }>(
        `update market_offers set
           price = coalesce($2, price),
           url = coalesce($3, url),
           specs = coalesce($4, specs),
           currency = coalesce($5, currency),
           source_kind = 'manuel',
           updated_at = now()
         where id=$1 returning id`,
        [id, p.price ?? null, p.url ?? null, p.specs ?? null, p.currency ?? null],
      );
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Offre introuvable.');

      res.json({ ok: true, data: { updated: true } });
    } catch (err) {
      next(err);
    }
  },
);

/** Historique d'une offre : preuve des variations. */
marketRouter.get('/admin/market/:id/history', requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!z.string().uuid().safeParse(id).success) throw new AppError(404, 'NOT_FOUND', 'Offre introuvable.');
    const rows = await all<{ price: string | null; currency: string; seen_at: string }>(
      'select price, currency, seen_at from market_price_history where offer_id=$1 order by seen_at desc limit 30',
      [id],
    );
    res.json({
      ok: true,
      data: { history: rows.map((r) => ({ ...r, price: r.price === null ? null : Number(r.price) })) },
    });
  } catch (err) {
    next(err);
  }
});

/** Ajout manuel : un fournisseur sans interface publique, prix relevé à la main. */
marketRouter.post('/admin/market', requireAdmin, async (req, res, next) => {
  try {
    const parsed = z
      .object({
        category: z.enum(CATEGORIES),
        provider: z.string().min(2).max(60),
        plan: z.string().min(2).max(120),
        specs: z.string().max(300).default(''),
        price: z.coerce.number().min(0).max(1_000_000).nullable().default(null),
        currency: z.enum(['USD', 'EUR', 'CDF']).default('USD'),
        unit: z.string().max(40).default('/mois'),
        url: z.string().max(300).default(''),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(422, 'VALIDATION', parsed.error.issues[0]?.message ?? 'Champs invalides.');
    }
    const o = parsed.data;

    const row = await one<{ id: string }>(
      `insert into market_offers(category, provider, plan, specs, price, currency, unit, url, source_kind, checked_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,'manuel', now())
       on conflict (category, provider, plan) do update
         set specs=excluded.specs, price=excluded.price, currency=excluded.currency,
             unit=excluded.unit, url=excluded.url, source_kind='manuel', checked_at=now(), updated_at=now()
       returning id`,
      [o.category, o.provider, o.plan, o.specs, o.price, o.currency, o.unit, o.url],
    );

    res.status(201).json({ ok: true, data: { id: row?.id } });
  } catch (err) {
    next(err);
  }
});


/* --------------------------------------------------- alertes de variation
 * La table `market_price_history` garde la trace ; ici on prévient l'humain.
 * Deux règles apprises sur ce projet : une notification doit cibler un
 * `user_id` (sinon elle n'apparaît jamais dans la cloche), et elle ne doit pas
 * être recréée à chaque relevé — on déduplique sur le titre et la dernière 24 h.
 */
async function notifyPriceChanges(): Promise<number> {
  const changes = await all<{
    provider: string;
    plan: string;
    price: string | null;
    prev_price: string | null;
    currency: string;
  }>(
    `select provider, plan, price, prev_price, currency
       from market_offers
      where prev_price is not null
        and price is not null
        and price is distinct from prev_price
        and updated_at > now() - interval '15 minutes'
      order by updated_at desc
      limit 20`,
  );

  let sent = 0;
  for (const c of changes) {
    const title = `Prix modifié : ${c.provider}`;
    const body = `${c.plan} — ${c.prev_price} → ${c.price} ${c.currency}`;

    const already = await one<{ id: string }>(
      `select id from notifications
        where title = $1 and body = $2 and created_at > now() - interval '24 hours'
        limit 1`,
      [title, body],
    );
    if (already) continue;

    await one(
      `insert into notifications(user_id, kind, title, body, link)
       select u.id, 'info', $1, $2, '/admin/marche' from users u where u.is_active`,
      [title, body],
    ).catch(() => null);
    sent += 1;
  }
  return sent;
}

/* ------------------------------------------------------------- export CSV */

marketRouter.get('/admin/market/export.csv', requireAdmin, async (_req, res, next) => {
  try {
    const rows = await all<{
      category: string;
      provider: string;
      plan: string;
      specs: string;
      price: string | null;
      currency: string;
      unit: string;
      source_kind: string;
      checked_at: string | null;
      url: string;
    }>(
      `select category, provider, plan, specs, price, currency, unit, source_kind, checked_at, url
         from market_offers
        order by category, provider, price nulls last`,
    );

    // Séparateur « ; » et BOM : Excel en français ouvre le fichier correctement,
    // accents compris, sans assistant d'importation.
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['categorie', 'plateforme', 'offre', 'details', 'prix', 'devise', 'unite', 'source', 'releve_le', 'page'];
    const lines = [
      header.join(';'),
      ...rows.map((r) =>
        [r.category, r.provider, r.plan, r.specs, r.price ?? '', r.currency, r.unit, r.source_kind, r.checked_at ? new Date(r.checked_at).toISOString().slice(0, 19).replace('T', ' ') : '', r.url]
          .map(esc)
          .join(';'),
      ),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="5dev-prix-marche-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${lines.join('\r\n')}`);
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------ rendu des pages JavaScript */

marketRouter.post('/admin/market/render', requireAdmin, async (req, res, next) => {
  try {
    const limit = Number((req.body as { limit?: number } | undefined)?.limit ?? 12);
    const { renderMissing } = await import('./market-render.js');
    const reports = await renderMissing(Number.isFinite(limit) ? Math.min(30, Math.max(1, limit)) : 12);
    const priced = reports.reduce((n, r) => n + r.priced, 0);
    const alerts = await notifyPriceChanges();
    res.json({
      ok: true,
      data: {
        rendered: reports.length,
        priced,
        alerts,
        failed: reports.filter((r) => r.error).length,
        reports,
      },
    });
  } catch (err) {
    next(err);
  }
});

/* ------------------------------------------------ relevé assisté par l'IA
 * L'IA lit la page tarifaire et propose des offres ; chaque prix doit ensuite
 * exister littéralement dans le texte de la page (voir market-scrape.ts).
 * Ce que le modèle invente est rejeté et compté, jamais enregistré.
 */

marketRouter.post('/admin/market/scrape', requireAdmin, async (_req, res, next) => {
  try {
    const reports = await scrapeAll();
    const written = reports.reduce((n, r) => n + r.offers, 0);
    const rejected = reports.reduce((n, r) => n + r.rejected, 0);
    const errors = reports.filter((r) => r.error);
    res.json({
      ok: true,
      data: {
        providers: reports.length,
        written,
        rejected,
        failed: errors.length,
        reports,
      },
    });
  } catch (err) {
    next(err);
  }
});

marketRouter.post('/admin/market/scrape/:provider', requireAdmin, async (req, res, next) => {
  try {
    const report = await scrapeOne(String(req.params.provider));
    res.json({ ok: true, data: { report } });
  } catch (err) {
    next(err);
  }
});
