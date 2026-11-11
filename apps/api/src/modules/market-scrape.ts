import { all, one } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { chat } from './ai/providers/nvidia.js';

/**
 * Scrapeur tarifaire assisté par IA.
 *
 * Pourquoi l'IA : écrire une expression régulière par fournisseur ne tient pas
 * (90 plateformes, pages qui changent). Le modèle lit le texte de la page et
 * rend une liste structurée. Mais un modèle peut inventer un prix plausible —
 * c'est exactement ce qu'il faut empêcher.
 *
 * Garde-fou, non négociable : chaque prix proposé doit apparaître **littéralement**
 * dans le texte de la page (mêmes chiffres, virgule ou point tolérés). Un prix
 * absent du texte est rejeté, et le rejet est compté dans le rapport. Aucune
 * valeur n'est donc écrite en base sur la seule parole du modèle.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36';

/** Modèle d'extraction : petit et rapide, suffisant pour lire une grille tarifaire. */
const FALLBACK_MODEL = 'nvidia/nemotron-3.5-bolt-e4b';

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Réduit la page à la zone qui contient des prix : le début d'une page tarifs est du marketing. */
function focusOnPrices(text: string, limit = 9000): string {
  const marks = ['€', '$', '/mois', '/month', 'per month', '/an', '/year', 'par mois'];
  const first = marks
    .map((m) => text.indexOf(m))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];
  const start = first === undefined ? 0 : Math.max(0, first - 1500);
  return text.slice(start, start + limit);
}

/** Un prix n'est accepté que s'il est présent dans le texte, sous une forme ou une autre. */
function priceIsInText(value: number, text: string): boolean {
  const fixed = value.toFixed(2);
  const candidates = new Set<string>([
    String(value),
    fixed,
    fixed.replace('.', ','),
    value.toFixed(1),
    value.toFixed(1).replace('.', ','),
    String(Math.round(value)),
  ]);
  const compact = text.replace(/\s/g, '');
  for (const c of candidates) {
    if (compact.includes(c)) return true;
  }
  return false;
}

type Extracted = {
  plan: string;
  price: number | null;
  unit?: string;
  currency?: string;
  unite?: string;
  devise?: string;
};

/** Extrait le premier objet JSON équilibré d'une réponse modèle. */
function extractJson(raw: string): unknown {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function modelId(): Promise<string> {
  const row = await one<{ model: string }>(
    "select model from ai_models where slot = 'chat' and model is not null and model <> '' limit 1",
  ).catch(() => null);
  return row?.model ?? FALLBACK_MODEL;
}

const SYSTEM = `Tu lis une page tarifaire et tu en extrais les offres.
Réponds UNIQUEMENT par un objet JSON, sans texte autour, de cette forme :
{"offres":[{"plan":"nom court de l'offre","prix":12.99,"unite":"/mois","devise":"USD"}]}

Règles absolues :
- "prix" doit être un nombre repris TEL QUEL de la page. Si aucun prix n'est lisible, mets null.
- N'invente jamais un prix, n'arrondis pas, ne convertis pas de devise.
- Maximum 8 offres, les plus représentatives.
- "unite" parmi : /mois, /an, /Go, /To, /1000 emails.
- "devise" parmi : USD, EUR, CDF.`;

export type ScrapeReport = {
  provider: string;
  url: string;
  offers: number;
  rejected: number;
  error?: string;
};

/**
 * Lit la page d'un fournisseur et met à jour ses offres.
 * `url` vient de la base : aucune URL n'est construite depuis la requête HTTP.
 */
async function scrapeProvider(url: string, provider: string): Promise<ScrapeReport> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { provider, url, offers: 0, rejected: 0, error: `HTTP ${res.status}` };
    html = await res.text();
  } catch (err) {
    return { provider, url, offers: 0, rejected: 0, error: (err as Error).message.slice(0, 120) };
  }

  const text = focusOnPrices(stripHtml(html));
  if (text.length < 200) return { provider, url, offers: 0, rejected: 0, error: 'page vide ou rendue en JavaScript' };

  let raw: string;
  try {
    const model = await modelId();
    const out = await chat(
      model,
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Fournisseur : ${provider}\nPage : ${url}\n\nTexte :\n${text}` },
      ],
      { temperature: 0.1, maxTokens: 900, timeoutMs: 45000 },
    );
    raw = out.text;
  } catch (err) {
    return { provider, url, offers: 0, rejected: 0, error: `IA indisponible : ${(err as Error).message.slice(0, 100)}` };
  }

  const parsed = extractJson(raw) as { offres?: Extracted[] } | null;
  if (!parsed?.offres?.length) {
    return { provider, url, offers: 0, rejected: 0, error: 'aucune offre exploitable dans la réponse du modèle' };
  }

  let written = 0;
  let rejected = 0;

  for (const o of parsed.offres.slice(0, 8)) {
    const plan = String(o?.plan ?? '').trim().slice(0, 120);
    if (plan.length < 2) {
      rejected += 1;
      continue;
    }

    const price: number | null = o?.price === null || o?.price === undefined ? null : Number(o.price);
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 100000)) {
      rejected += 1;
      continue;
    }

    // LE contrôle qui compte : le prix doit exister dans la page.
    if (price !== null && !priceIsInText(price, text)) {
      rejected += 1;
      continue;
    }

    const currency = ['USD', 'EUR', 'CDF'].includes(String(o?.currency ?? o?.devise))
      ? String(o?.currency ?? o?.devise)
      : 'USD';
    const unit = String(o?.unite ?? o?.unit ?? '/mois').slice(0, 20);

    const existing = await one<{ id: string; price: string | null }>(
      'select id, price from market_offers where category=(select category from market_offers where provider=$1 limit 1) and provider=$1 and plan=$2',
      [provider, plan],
    );

    if (existing) {
      await one(
        `update market_offers set price=$2, currency=$3, unit=$4, source_kind='page',
                prev_price = case when price is distinct from $2 then price else prev_price end,
                checked_at=now(), updated_at=now()
          where id=$1`,
        [existing.id, price, currency, unit],
      );
      if (Number(existing.price ?? -1) !== Number(price ?? -1) && price !== null) {
        await one('insert into market_price_history(offer_id, price, currency) values($1,$2,$3)', [
          existing.id,
          price,
          currency,
        ]).catch(() => null);
      }
    } else if (price === null) {
      // Une offre inconnue SANS prix vérifié n'apporte rien : elle pollue la
      // grille avec des lignes « — ». On ne crée que ce qu'on a réellement lu.
      rejected += 1;
      continue;
    } else {
      const created = await one<{ id: string }>(
        `insert into market_offers(category, provider, plan, specs, price, currency, unit, url, source_kind, checked_at)
         values(
           coalesce((select category from market_offers where provider=$1 limit 1), 'autre'),
           $1,$2,'', $3,$4,$5,$6,'page', now()
         ) returning id`,
        [provider, plan, price, currency, unit, url],
      );
      if (created && price !== null) {
        await one('insert into market_price_history(offer_id, price, currency) values($1,$2,$3)', [
          created.id,
          price,
          currency,
        ]).catch(() => null);
      }
    }
    written += 1;
  }

  return { provider, url, offers: written, rejected };
}

/** Parcourt toutes les plateformes connues, une page chacune. */
export async function scrapeAll(): Promise<ScrapeReport[]> {
  const targets = await all<{ provider: string; url: string }>(
    `select provider, min(url) as url
       from market_offers
      where url <> ''
      group by provider
      order by provider`,
  );

  if (targets.length === 0) throw new AppError(409, 'NO_TARGETS', 'Aucune plateforme avec une page tarifaire.');

  const out: ScrapeReport[] = [];
  // Séquentiel : on ne veut pas déclencher 60 requêtes simultanées depuis le serveur.
  for (const t of targets) {
    out.push(await scrapeProvider(t.url, t.provider));
  }
  return out;
}

/** Une seule plateforme, pour le bouton « relever » d'une carte. */
export async function scrapeOne(provider: string): Promise<ScrapeReport> {
  const row = await one<{ provider: string; url: string }>(
    'select provider, min(url) as url from market_offers where provider=$1 and url <> \'\' group by provider',
    [provider],
  );
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Plateforme inconnue ou sans page tarifaire.');
  return scrapeProvider(row.url, row.provider);
}
