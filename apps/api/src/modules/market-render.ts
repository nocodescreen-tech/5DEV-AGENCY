import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { all } from '../db/index.js';
import { AppError } from '../middlewares/errors.js';
import { writeJsonPairs, type PageSource } from './market.js';

/**
 * Rendu des pages tarifaires en JavaScript.
 *
 * Beaucoup de grilles tarifaires (Hetzner Cloud, IONOS, Hostinger VPS…) n'ont
 * aucun prix dans le HTML servi : il est injecté par le navigateur. Un simple
 * `fetch` ne peut donc rien lire. On rend la page avec le navigateur déjà
 * installé sur la machine (Edge via playwright-core), puis on applique la même
 * extraction déterministe que pour les pages statiques.
 *
 * `playwright-core` n'est pas une dépendance du serveur : on le résout à
 * l'exécution (dépôt, dossier de QA, global) et si aucun n'est trouvé, la route
 * répond 409 avec un message clair au lieu de planter.
 */

type Browser = {
  newPage: (opts?: Record<string, unknown>) => Promise<Page>;
  close: () => Promise<void>;
};
type Page = {
  goto: (url: string, opts?: Record<string, unknown>) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
  content: () => Promise<string>;
  close: () => Promise<void>;
};

const CANDIDATES = [
  'file:///C:/Users/rene/5dev/apps/api/package.json',
  'file:///C:/Users/rene/clover/package.json',
  pathToFileURL(`${process.cwd()}/package.json`).href,
];

function loadPlaywright(): { chromium: { launch: (o: Record<string, unknown>) => Promise<Browser> } } {
  for (const candidate of CANDIDATES) {
    try {
      const req = createRequire(candidate);
      return req('playwright-core') as { chromium: { launch: (o: Record<string, unknown>) => Promise<Browser> } };
    } catch {
      /* on essaie le suivant */
    }
  }
  throw new AppError(
    409,
    'NO_RENDERER',
    'playwright-core introuvable : le rendu des pages JavaScript est indisponible sur ce serveur. Installez-le (npm i -D playwright-core) et utilisez Edge ou Chrome.',
  );
}

async function renderHtml(url: string): Promise<string> {
  const { chromium } = loadPlaywright();
  let browser: Browser | null = null;
  let page: Page | null = null;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    page = await browser.newPage({ locale: 'fr-FR' });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    // Laisse le temps aux composants de prix de s'hydrater.
    await page.waitForTimeout(1800);
    return await page.content();
  } finally {
    await page?.close().catch(() => null);
    await browser?.close().catch(() => null);
  }
}

export type RenderReport = { provider: string; url: string; priced: number; error?: string };

/**
 * Rend les plateformes qui n'ont encore AUCUN prix vérifié.
 * Les autres sont laissées tranquilles : inutile de payer 8 s de navigateur
 * pour une page dont on a déjà lu les tarifs.
 */
export async function renderMissing(limit = 12): Promise<RenderReport[]> {
  const targets = await all<{ provider: string; url: string; category: string }>(
    `select o.provider, min(o.url) as url, min(o.category) as category
       from market_offers o
      where o.url <> ''
        and not exists (
          select 1 from market_offers p
           where lower(p.provider) = lower(o.provider) and p.price is not null
        )
      group by o.provider
      order by o.provider
      limit $1`,
    [limit],
  );

  const out: RenderReport[] = [];
  for (const t of targets) {
    try {
      const html = await renderHtml(t.url);
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
      const priced = await writeJsonPairs(src, html);
      out.push({ provider: t.provider, url: t.url, priced });
    } catch (err) {
      out.push({ provider: t.provider, url: t.url, priced: 0, error: (err as Error).message.slice(0, 140) });
    }
  }
  return out;
}
