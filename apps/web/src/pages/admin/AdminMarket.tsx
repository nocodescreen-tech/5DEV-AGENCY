import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BadgeCheck,
  Clock,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
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

type MarketData = {
  offers: Offer[];
  counts: { category: string; n: number }[];
  categories: string[];
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

  const liveCount = offers.filter((o) => o.source_kind === 'api').length;

  return (
    <div>
      <PageHeader
        eyebrow="Veille"
        title="Prix du marché"
        sub="Domaines, hébergement, VPS, stockage, CDN… — relevés directement chez les fournisseurs"
        actions={
          <>
            <SearchInput value={query} onChange={setQuery} placeholder="Filtrer un fournisseur…" />
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
          <ul className="divide-y divide-line">
            {visible.map((o, i) => (
              <Stagger as="li" key={o.id} index={i} step={30} className="px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{o.provider}</p>
                      <span className="rounded bg-muted/10 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {CATEGORY_FR[o.category]?.label ?? o.category}
                      </span>
                      {o.source_kind === 'api' ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald">
                          <BadgeCheck className="size-3" /> relevé automatique
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-orange">
                          <TriangleAlert className="size-3" /> indicatif
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">{o.plan}</p>
                    {o.specs && <p className="mt-0.5 truncate text-[11px] text-muted">{o.specs}</p>}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums">{money(o)}</p>
                      <p className="text-[10px] text-muted">{o.unit}</p>
                      {o.delta !== null && (
                        <p
                          className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
                            o.delta > 0 ? 'text-red' : 'text-emerald'
                          }`}
                        >
                          <ArrowUpRight className={`size-3 ${o.delta < 0 ? 'rotate-90' : ''}`} />
                          {o.delta > 0 ? '+' : ''}
                          {o.delta} % depuis le dernier relevé
                        </p>
                      )}
                    </div>
                    {o.url && (
                      <a
                        href={o.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost !px-2 !py-1.5"
                        aria-label={`Voir ${o.provider}`}
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </Stagger>
            ))}
          </ul>
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
