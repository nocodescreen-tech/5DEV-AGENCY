import io

p = r'C:\Users\rene\5dev\apps\web\src\pages\admin\AdminMarket.tsx'
s = io.open(p, encoding='utf-8').read()

# 1) regroupement par plateforme, après le calcul de `visible`
old_vis = """  const liveCount = offers.filter((o) => o.source_kind === 'api').length;"""
new_vis = """  const liveCount = offers.filter((o) => o.source_kind !== 'manuel').length;

  // Une carte par plateforme : c'est ainsi qu'on compare « qui propose quoi ».
  const grouped = visible.reduce<Map<string, Offer[]>>((acc, o) => {
    const list = acc.get(o.provider) ?? [];
    list.push(o);
    acc.set(o.provider, list);
    return acc;
  }, new Map());
  const platforms = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));"""
assert old_vis in s
s = s.replace(old_vis, new_vis, 1)

# 2) remplacer la liste plate par des cartes plateforme
start = s.index('          <ul className="divide-y divide-line">')
end = s.index('          </ul>\n        )}\n      </section>') + len('          </ul>\n')

new_block = '''          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {platforms.map(([provider, list], i) => {
              const fromPage = list.some((o) => o.source_kind !== 'manuel');
              const cheapest = list.reduce<Offer | null>(
                (min, o) => (o.price !== null && (min === null || (min.price ?? Infinity) > o.price) ? o : min),
                null,
              );
              return (
                <Stagger key={provider} index={i} step={40} className="h-full">
                  <article className="flex h-full min-w-0 flex-col rounded-xl border border-line bg-paper">
                    <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{provider}</h3>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {list.length} offre{list.length > 1 ? 's' : ''}
                          {cheapest?.price != null ? ` · dès ${money(cheapest)}` : ''}
                        </p>
                      </div>
                      {fromPage ? (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald"
                          title="Prix relevé sur la page tarifaire du fournisseur"
                        >
                          <BadgeCheck className="size-3" /> relevé
                        </span>
                      ) : (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded bg-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-orange"
                          title="Offre enregistrée sans prix relevé : ouvrez le lien pour vérifier"
                        >
                          <TriangleAlert className="size-3" /> à vérifier
                        </span>
                      )}
                    </header>

                    {/* La zone défilante : toutes les offres de la plateforme. */}
                    <ul className="max-h-56 flex-1 divide-y divide-line overflow-y-auto">
                      {list.map((o) => (
                        <li key={o.id} className="flex items-start justify-between gap-2 px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{o.plan}</p>
                            {o.specs && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{o.specs}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums">{money(o)}</p>
                            <p className="text-[10px] text-muted">{o.unit}</p>
                            {o.delta !== null && (
                              <p
                                className={`text-[10px] font-medium ${o.delta > 0 ? 'text-red' : 'text-emerald'}`}
                                title="Écart depuis le relevé précédent"
                              >
                                {o.delta > 0 ? '+' : ''}
                                {o.delta} %
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>

                    <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-2">
                      <span className="truncate text-[10px] text-muted">
                        {list[0]?.checked_at ? `relevé le ${frDateTime(list[0].checked_at)}` : 'non relevé'}
                      </span>
                      {list[0]?.url && (
                        <a
                          href={list[0].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-[11px] text-brand hover:underline"
                        >
                          tarifs <ExternalLink className="size-3" />
                        </a>
                      )}
                    </footer>
                  </article>
                </Stagger>
              );
            })}
          </div>
'''
s = s[:start] + new_block + s[end:]
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('cartes plateformes ok')
