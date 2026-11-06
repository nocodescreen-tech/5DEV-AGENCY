// Recherche d'images libres via Bing (un processus = une requête, cf. skill stock-photo-sourcing)
import { chromium } from 'playwright-core';
import { appendFileSync } from 'node:fs';

const SAFE = ['images.pexels.com', 'images.unsplash.com', 'plus.unsplash.com', 'cdn.pixabay.com', 'burst.shopifycdn.com'];
const q = process.argv[2];
const out = process.argv[3] ?? 'C:/tmp/img-candidates.jsonl';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 }, locale: 'en-US' });
const page = await ctx.newPage();
await page.goto(`https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=IRFLTR`, {
  waitUntil: 'domcontentloaded',
  timeout: 45000,
});
await page.waitForTimeout(2200);
await page.mouse.wheel(0, 1200);
await page.waitForTimeout(1800);

const items = await page.evaluate(() =>
  [...document.querySelectorAll('a.iusc')]
    .map((a) => {
      try {
        return JSON.parse(a.getAttribute('m') || '{}');
      } catch {
        return {};
      }
    })
    .filter((m) => m.murl),
);

const safe = items.filter((m) => SAFE.some((h) => m.murl.includes(h)));
for (const m of safe) {
  appendFileSync(out, JSON.stringify({ q, murl: m.murl, title: m.t || '', page: m.purl || '' }) + '\n');
}
await browser.close();
console.log(JSON.stringify({ query: q, total: items.length, safe: safe.length }));
