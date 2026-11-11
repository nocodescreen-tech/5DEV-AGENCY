import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {

  BadgeCheck,
  ChevronDown,
  Code2,
  Clock,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { frDateTime } from '../../lib/format';
import { PageHeader } from '../../components/admin/PageHeader';
import { SearchInput, Stagger, PressableButton } from '../../components/admin/anim-ui';
import { Modal } from '../../components/ui';
import { useToast } from '../../components/Toaster';

type Offer = {
  id: string;
  category: string;
  provider: string;
  plan: string;
  specs: string;
  price: number | null;
  currency: string;
  unit: string;
  url: string;
  source_kind: 'api' | 'manuel';
  prev_price: number | null;
  delta: number | null;
  checked_at: string | null;
  updated_at: string;
};

type PlatformDoc = {
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
};

const CATEGORY_FR: Record<string, { label: string; hint: string }> = {
  domaines: { label: 'Noms de domaine', hint: 'Enregistrement et renouvellement annuel' },
  hebergement: { label: 'Hébergement web', hint: 'Mutualisé et WordPress' },
  vps: { label: 'VPS', hint: 'Serveurs virtuels, prix mensuel' },
  'stockage-objet': { label: 'Stockage objet', hint: 'Bucket S3-compatible, au Go' },
  'images-cdn': { label: 'Images & CDN', hint: 'Livraison et transformation d’images' },
  'base-de-donnees': { label: 'Base de données', hint: 'Postgres, MySQL, Redis managés' },
  email: { label: 'Email', hint: 'Transactionnel et boîtes' },
  paas: { label: 'PaaS', hint: 'Déploiement applicatif' },
  dns: { label: 'DNS', hint: 'Zones et résolution' },
  sauvegarde: { label: 'Sauvegarde', hint: 'Backups hors site' },
};

const money = (o: Offer) =>
  o.price === null
    ? '—'
    : `${o.price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${o.currency}`;

const emptyForm = {
  category: 'domaines',
  provider: '',
  plan: '',
  specs: '',
  price: '',
  currency: 'USD',
  unit: '/mois',
  url: '',
};

export default function AdminMarket() {
  const qc = useQueryClient();
  const toast = useToast();
  const [category, setCategory] = useState<string>('tous');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'market'],
    queryFn: () => apiGet<MarketData>('/api/v1/admin/market'),
  });

  const refresh = useMutation({
    mutationFn: () => apiPost<{ report: { provider: string; ok: boolean; updated: number; error?: string }[] }>(
      '/api/v1/admin/market/refresh',
      {},
    ),
    onSuccess: (r) => {
      const ok = r.report.filter((x) => x.ok);
      const ko = r.report.filter((x) => !x.ok);
      toast.push('success', `${ok.reduce((n, x) => n + x.updated, 0)} offre(s) relevée(s) sur ${ok.length} source(s)`);
      if (ko.length) toast.push('error', `${ko[0]?.provider} : ${ko[0]?.error ?? 'relevé impossible'}`);
      void qc.invalidateQueries({ queryKey: ['admin', 'market'] });
    },
    onError: (e: Error) => toast.push('error', e.message),
  });

  const scrape = useMutation({
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

  const add = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/admin/market', {
        ...form,
        price: form.price === '' ? null : Number(form.price),
      }),
    onSuccess: () => {
      toast.push('success', 'Offre ajoutée');
      setOpen(false);
      setForm({ ...emptyForm });
      void qc.invalidateQueries({ queryKey: ['admin', 'market'] });
    },
    onError: (e: Error) => toast.push('error', e.message),
  });

  const offers = data?.offers ?? [];
  const docsByProvider = new Map((data?.docs ?? []).map((d) => [d.provider_key, d]));
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of data?.counts ?? []) map.set(c.category, c.n);
    return map;
  }, [data]);

  const q = query.trim().toLowerCase();
  const visible = offers.filter(
    (o) =>
      (category === 'tous' || o.category === category) &&
      (!q || `${o.provider} ${o.plan} ${o.specs}`.toLowerCase().includes(q)),
  );

  const liveCount = offers.filter((o) => o.source_kind !== 'manuel').length;

  // Une carte par plateforme : c'est ainsi qu'on compare « qui propose quoi ».
  const grouped = visible.reduce<Map<string, Offer[]>>((acc, o) => {
    const list = acc.get(o.provider) ?? [];
    list.push(o);
    acc.set(o.provider, list);
    return acc;
  }, new Map());
  const platforms = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));

  return (
    <div>
      <PageHeader
        eyebrow="Veille"
        title="Prix du marché"
        sub="Domaines, hébergement, VPS, stockage, CDN… — relevés directement chez les fournisseurs"
        actions={
          <>
            <SearchInput value={query} onChange={setQuery} placeholder="Filtrer un fournisseur…" />
            <PressableButton className="btn-primary !py-2 text-xs" onClick={() => scrape.mutate()} disabled={scrape.isPending}>
              {scrape.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Relever avec l’IA
            </PressableButton>
            <PressableButton className="btn-ghost !py-2 text-xs" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              {refresh.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Relever les prix
            </PressableButton>
            <PressableButton className="btn-primary !py-2 text-xs" onClick={() => setOpen(true)}>
              <Plus className="size-3.5" /> Ajouter une offre
            </PressableButton>
          </>
        }
      />

      <div className="panel mt-4 flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-xs text-muted">
          <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          <p>
            <span className="font-medium text-ink">{liveCount} offre(s) relevée(s) automatiquement</span> ·{' '}
            {offers.length - liveCount} saisie(s) à la main.{' '}
            {data?.last_checked ? `Dernier relevé le ${frDateTime(data.last_checked)}.` : 'Aucun relevé encore.'}{' '}
            Une offre « indicatif » n’est pas revérifiée par l’application : ouvrez le lien pour confirmer.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
          <Clock className="size-3" aria-hidden /> sources : {(data?.sources ?? []).join(', ') || '—'}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory('tous')}
          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
            category === 'tous' ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:border-brand'
          }`}
        >
          Toutes ({offers.length})
        </button>
        {(data?.categories ?? []).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              category === c ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:border-brand'
            }`}
          >
            {CATEGORY_FR[c]?.label ?? c}
            {counts.get(c) ? ` (${counts.get(c)})` : ''}
          </button>
        ))}
      </div>

      <section className="panel mt-3 overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-semibold">
            {category === 'tous' ? 'Toutes les offres' : CATEGORY_FR[category]?.label ?? category} ({visible.length})
          </h2>
          {category !== 'tous' && CATEGORY_FR[category]?.hint && (
            <p className="mt-0.5 text-[11px] text-muted">{CATEGORY_FR[category]?.hint}</p>
          )}
        </div>

        {isPending ? (
          <p className="px-5 py-8 text-sm text-muted">Chargement…</p>
        ) : visible.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted">
            <TriangleAlert className="mx-auto mb-3 size-10 opacity-30" />
            <p className="text-sm">
              {q
                ? 'Aucune offre ne correspond au filtre.'
                : 'Aucune offre enregistrée pour cette catégorie.'}
            </p>
            <p className="mt-1 text-xs">
              Ajoutez-la à la main avec le prix affiché chez le fournisseur — l’application n’invente aucun tarif.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {platforms.map(([provider, list], i) => {
              // « relevé » seulement si au moins un prix a réellement été lu.
              const fromPage = list.some((o) => o.source_kind !== 'manuel' && o.price !== null);
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

                    {(() => {
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
        )}
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="Ajouter une offre relevée à la main">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-muted">Catégorie</span>
              <select
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {(data?.categories ?? []).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_FR[c]?.label ?? c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-muted">Fournisseur</span>
              <input
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                placeholder="Namecheap, Hostinger…"
              />
            </label>
          </div>

          <label className="block text-xs">
            <span className="text-muted">Offre</span>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
              value={form.plan}
              onChange={(e) => setForm({ ...form, plan: e.target.value })}
              placeholder=".com — 1re année"
            />
          </label>

          <label className="block text-xs">
            <span className="text-muted">Détail (optionnel)</span>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
              value={form.specs}
              onChange={(e) => setForm({ ...form, specs: e.target.value })}
              placeholder="WHOIS offert, 1 site, 10 Go"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs">
              <span className="text-muted">Prix relevé</span>
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 tabular-nums"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="9.98"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted">Devise</span>
              <select
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="CDF">CDF</option>
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-muted">Unité</span>
              <select
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                <option value="/mois">/mois</option>
                <option value="/an">/an</option>
                <option value="/Go">/Go</option>
                <option value="/To">/To</option>
              </select>
            </label>
          </div>

          <label className="block text-xs">
            <span className="text-muted">Page tarifaire</span>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://…"
            />
          </label>

          <p className="text-[11px] text-muted">
            Saisissez le prix tel qu’affiché sur le site au moment du relevé. L’offre sera marquée « indicatif » et
            portera la date du jour — elle ne sera jamais présentée comme temps réel.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={add.isPending || form.provider.trim().length < 2 || form.plan.trim().length < 2}
              onClick={() => add.mutate()}
            >
              {add.isPending && <Loader2 className="size-4 animate-spin" />} Ajouter
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
