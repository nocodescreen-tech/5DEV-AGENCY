import { Router } from 'express';
import { z } from 'zod';
import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { requireAdmin } from '../middlewares/auth.js';

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

const liveSources = [{ name: 'Vultr', run: fetchVultr }];

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

    res.json({ ok: true, data: { report } });
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
