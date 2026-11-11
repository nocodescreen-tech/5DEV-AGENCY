import io

p = r'C:\Users\rene\5dev\apps\web\src\pages\admin\AdminMarket.tsx'
s = io.open(p, encoding='utf-8').read()

# 1) type des docs
s = s.replace(
    """type MarketData = {
  offers: Offer[];
  counts: { category: string; n: number }[];
  categories: string[];
  last_checked: string | null;
  sources: string[];
};""",
    """type PlatformDoc = {
  provider: string;
  provider_key: string;
  doc_url: string;
  sdk_node: string | null;
  sdk_python: string | null;
  snippet_node: string | null;
  snippet_python: string | null;
  api_style: string;
  note: string;
};

type MarketData = {
  offers: Offer[];
  counts: { category: string; n: number }[];
  categories: string[];
  docs: PlatformDoc[];
  last_checked: string | null;
  sources: string[];
};""",
    1,
)

# 2) index des docs
s = s.replace(
    "  const offers = data?.offers ?? [];",
    """  const offers = data?.offers ?? [];
  const docsByProvider = new Map((data?.docs ?? []).map((d) => [d.provider_key, d]));""",
    1,
)

# 3) bloc « Intégration » repliable dans chaque carte, avant le footer
old_footer = """                    <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-2">"""
new_footer = """                    {(() => {
                      const doc = docsByProvider.get(provider.toLowerCase());
                      if (!doc) return null;
                      return (
                        <details className="group border-t border-line px-4 py-2">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium text-muted hover:text-ink">
                            <span className="inline-flex items-center gap-1">
                              <Code2 className="size-3" /> Intégration ({doc.api_style})
                            </span>
                            <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="mt-2 space-y-1.5">
                            {doc.snippet_node && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted">Node / JS</p>
                                <code className="block select-all break-all rounded bg-wash px-2 py-1 font-mono text-[11px]">
                                  {doc.snippet_node}
                                </code>
                              </div>
                            )}
                            {doc.snippet_python && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted">Python</p>
                                <code className="block select-all break-all rounded bg-wash px-2 py-1 font-mono text-[11px]">
                                  {doc.snippet_python}
                                </code>
                              </div>
                            )}
                            {doc.note && <p className="text-[11px] leading-snug text-muted">{doc.note}</p>}
                            {doc.doc_url && (
                              <a
                                href={doc.doc_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
                              >
                                documentation <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                        </details>
                      );
                    })()}

                    <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-2">"""
assert old_footer in s
s = s.replace(old_footer, new_footer, 1)

# 4) imports d'icônes
s = s.replace("  BadgeCheck,\n", "  BadgeCheck,\n  ChevronDown,\n  Code2,\n", 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('bloc intégration ajouté')
