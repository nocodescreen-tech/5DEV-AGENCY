import io

# 1) brancher les routes de scrape dans market.ts
p = r'C:\Users\rene\5dev\apps\api\src\modules\market.ts'
s = io.open(p, encoding='utf-8').read()

if 'scrapeAll' not in s:
    s = s.replace(
        "import { requireAdmin } from '../middlewares/auth.js';",
        "import { requireAdmin } from '../middlewares/auth.js';\nimport { scrapeAll, scrapeOne } from './market-scrape.js';",
        1,
    )
    s += r'''

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
'''
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('routes scrape ajoutees')
else:
    print('deja present')

# 2) UI : bouton « relever avec l'IA » + zone de rapport
p2 = r'C:\Users\rene\5dev\apps\web\src\pages\admin\AdminMarket.tsx'
t = io.open(p2, encoding='utf-8').read()

if 'scrape' not in t:
    t = t.replace(
        "  const add = useMutation({",
        """  const scrape = useMutation({
    mutationFn: () =>
      apiPost<{ providers: number; written: number; rejected: number; failed: number }>(
        '/api/v1/admin/market/scrape',
        {},
      ),
    onSuccess: (r) => {
      toast.push(
        'success',
        `${r.written} offre(s) mise(s) à jour sur ${r.providers} plateforme(s)` +
          (r.rejected ? ` · ${r.rejected} prix rejeté(s) car absents de la page` : ''),
      );
      if (r.failed) toast.push('error', `${r.failed} page(s) illisible(s) — voir le détail`);
      void qc.invalidateQueries({ queryKey: ['admin', 'market'] });
    },
    onError: (e: Error) => toast.push('error', e.message),
  });

  const add = useMutation({""",
        1,
    )

    t = t.replace(
        """            <PressableButton className="btn-ghost !py-2 text-xs" onClick={() => refresh.mutate()} disabled={refresh.isPending}>""",
        """            <PressableButton className="btn-primary !py-2 text-xs" onClick={() => scrape.mutate()} disabled={scrape.isPending}>
              {scrape.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Relever avec l’IA
            </PressableButton>
            <PressableButton className="btn-ghost !py-2 text-xs" onClick={() => refresh.mutate()} disabled={refresh.isPending}>""",
        1,
    )

    t = t.replace(
        "  RefreshCw,\n  TriangleAlert,",
        "  RefreshCw,\n  Sparkles,\n  TriangleAlert,",
        1,
    )

    io.open(p2, 'w', encoding='utf-8', newline='').write(t)
    print('bouton IA ajoute')
else:
    print('bouton deja present')
