import io

# ---------------------------------------------------------------- 1. marché : date ISO
p = r'C:\Users\rene\5dev\apps\api\src\modules\market.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace(
    "[r.category, r.provider, r.plan, r.specs, r.price ?? '', r.currency, r.unit, r.source_kind, r.checked_at ?? '', r.url]",
    "[r.category, r.provider, r.plan, r.specs, r.price ?? '', r.currency, r.unit, r.source_kind, r.checked_at ? new Date(r.checked_at).toISOString().slice(0, 19).replace('T', ' ') : '', r.url]",
    1,
)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('csv: date ISO')

# ------------------------------------- 2. scrape : extraire depuis un texte fourni
p2 = r'C:\Users\rene\5dev\apps\api\src\modules\market-scrape.ts'
t = io.open(p2, encoding='utf-8').read()

# a) la fonction d'écriture devient réutilisable avec un texte externe
old_sig = """async function scrapeProvider(url: string, provider: string): Promise<ScrapeReport> {"""
new_sig = """async function scrapeProvider(url: string, provider: string, providedText?: string): Promise<ScrapeReport> {"""
assert old_sig in t
t = t.replace(old_sig, new_sig, 1)

# b) si un texte est fourni (page rendue en JavaScript), on saute le fetch
old_fetch = """  let html: string;
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

  const hints = structuredHints(html);
  const text = focusOnPrices(stripHtml(html)) + (hints ? `\\n\\n[données structurées de la page : ${hints}]` : '');"""
new_fetch = """  let html = '';
  let hints = '';
  let text: string;

  if (providedText) {
    // Page déjà rendue par un navigateur : les prix sont dans le texte visible.
    text = focusOnPrices(providedText);
  } else {
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
    hints = structuredHints(html);
    text = focusOnPrices(stripHtml(html));
  }

  if (hints) text += `\\n\\n[données structurées de la page : ${hints}]`;"""
assert old_fetch in t
t = t.replace(old_fetch, new_fetch, 1)

# c) exposer une entrée « texte rendu »
t += '''

/**
 * Entrée utilisée par le rendu headless : le texte visible d'une page
 * (innerText) contient les prix que le HTML statique n'a pas.
 */
export async function scrapeFromRenderedText(
  provider: string,
  url: string,
  text: string,
): Promise<ScrapeReport> {
  return scrapeProvider(url, provider, text);
}
'''

io.open(p2, 'w', encoding='utf-8', newline='').write(t)
print('scrape: texte externe accepté')

# ---------------------------------------- 3. rendu : innerText puis IA si besoin
p3 = r'C:\Users\rene\5dev\apps\api\src\modules\market-render.ts'
u = io.open(p3, encoding='utf-8').read()

u = u.replace(
    "import { writeJsonPairs, type PageSource } from './market.js';",
    "import { writeJsonPairs, type PageSource } from './market.js';\nimport { scrapeFromRenderedText } from './market-scrape.js';",
    1,
)

u = u.replace(
    """type Page = {
  goto: (url: string, opts?: Record<string, unknown>) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
  content: () => Promise<string>;
  close: () => Promise<void>;
};""",
    """type Page = {
  goto: (url: string, opts?: Record<string, unknown>) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
  content: () => Promise<string>;
  innerText: (selector?: string) => Promise<string>;
  close: () => Promise<void>;
};""",
    1,
)

u = u.replace(
    """async function renderHtml(url: string): Promise<string> {""",
    """async function renderHtml(url: string): Promise<{ html: string; text: string }> {""",
    1,
)
u = u.replace(
    """    await page.waitForTimeout(1800);
    return await page.content();""",
    """    await page.waitForTimeout(1800);
    const html = await page.content();
    const text = await page.innerText('body').catch(() => '');
    return { html, text };""",
    1,
)

u = u.replace(
    """      const html = await renderHtml(t.url);""",
    """      const { html, text } = await renderHtml(t.url);""",
    1,
)

u = u.replace(
    """      const priced = await writeJsonPairs(src, html);
      out.push({ provider: t.provider, url: t.url, priced });""",
    """      // 1. paires nom/prix dans le DOM rendu (déterministe, gratuit)
      let priced = await writeJsonPairs(src, html);

      // 2. sinon l'IA lit le texte visible : c'est là que sont les prix des
      //    pages qui les injectent en JavaScript.
      if (priced === 0 && text.length > 300) {
        const report = await scrapeFromRenderedText(t.provider, t.url, text);
        priced = report.offers;
      }
      out.push({ provider: t.provider, url: t.url, priced });""",
    1,
)

io.open(p3, 'w', encoding='utf-8', newline='').write(u)
print('rendu: innerText + IA')
