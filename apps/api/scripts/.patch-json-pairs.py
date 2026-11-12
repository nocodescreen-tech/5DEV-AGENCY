import io

p = r'C:\Users\rene\5dev\apps\api\src\modules\market.ts'
s = io.open(p, encoding='utf-8').read()

helper = r'''
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
async function writeJsonPairs(src: PageSource, html: string): Promise<number> {
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
'''

anchor = "const liveSources = [{ name: 'Vultr', run: fetchVultr }];"
assert anchor in s
s = s.replace(anchor, helper.strip('\n') + '\n\n' + anchor, 1)

# brancher dans la boucle des pages : JSON d'abord, puis modèle
old = """    for (const src of PAGE_SOURCES) {
      const price = await readPagePrice(src);
      if (price === null) {
        pageKo += 1;
        continue;
      }
"""
new = """    for (const src of PAGE_SOURCES) {
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
"""
assert old in s
s = s.replace(old, new, 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('extraction JSON déterministe branchée')
