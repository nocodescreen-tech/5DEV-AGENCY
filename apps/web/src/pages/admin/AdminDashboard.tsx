import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { apiGet } from '../../lib/api';
import { frDateTime } from '../../lib/format';
import Reveal from '../../components/Reveal';

type Point = { jour: string; demandes: number; reservations: number };
type Dash = {
  leads: { nouvelles: number; en_cours: number; gagnees: number; total: number };
  bookings: { a_confirmer: number; confirmees: number; a_venir: number; total: number };
  catalog: { services: number; projets: number };
  activity: { type: string; id: string; label: string; status: string; created_at: string }[];
  series?: Point[];
};

const STATUS_FR: Record<string, string> = {
  new: 'nouvelle',
  in_progress: 'en cours',
  quoted: 'devis envoyé',
  won: 'gagnée',
  lost: 'perdue',
  pending: 'à confirmer',
  confirmed: 'confirmée',
  done: 'réalisée',
  cancelled: 'annulée',
};

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-5">
          <div className="h-2.5 w-24 animate-pulse rounded bg-line" />
          <div className="mt-4 h-7 w-16 animate-pulse rounded bg-line" />
          <div className="mt-3 h-2 w-20 animate-pulse rounded bg-line" />
        </div>
      ))}
    </div>
  );
}

/** Courbe réelle (14 derniers jours) — SVG natif, aucune librairie de graphes. */
function SeriesChart({ points }: { points: Point[] }) {
  if (!points.length) return null;
  const w = 640;
  const h = 160;
  const pad = 8;
  const max = Math.max(1, ...points.map((p) => Math.max(p.demandes, p.reservations)));
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const path = (key: 'demandes' | 'reservations') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

  const area = `${path('demandes')} L${x(points.length - 1)},${h - pad} L${x(0)},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" role="img" aria-label="Demandes et réservations des 14 derniers jours">
      <defs>
        <linearGradient id="fillDemandes" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F47721" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#F47721" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#fillDemandes)" />
      <path d={path('demandes')} fill="none" stroke="#F47721" strokeWidth="2" strokeLinecap="round" />
      <path d={path('reservations')} fill="none" stroke="#9a9aa0" strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={p.jour} cx={x(i)} cy={y(p.demandes)} r="2.5" fill="#F47721">
          <title>{`${p.jour} — ${p.demandes} demande(s), ${p.reservations} réservation(s)`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default function AdminDashboard() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<Dash>('/api/v1/admin/dashboard'),
    refetchInterval: 60_000,
  });

  if (isPending) {
    return (
      <div>
        <h1 className="text-2xl font-black">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted">Chargement des données réelles…</p>
        <div className="mt-8">
          <Skeleton />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-brand/40 bg-brand/5 p-5 text-sm">
        Le tableau de bord est indisponible. Vérifiez que l’API et la base répondent.
      </div>
    );
  }

  const cards = [
    { label: 'Demandes à traiter', value: data.leads.nouvelles, hint: `${data.leads.total} au total`, to: '/admin/demandes' },
    { label: 'Réservations à confirmer', value: data.bookings.a_confirmer, hint: `${data.bookings.a_venir} à venir`, to: '/admin/reservations' },
    { label: 'Services publiés', value: data.catalog.services, hint: 'catalogue', to: '/admin/services' },
    { label: 'Réalisations publiées', value: data.catalog.projets, hint: 'portefeuille', to: '/admin/realisations' },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Overview</p>
          <h1 className="mt-1 text-2xl font-black">Tableau de bord</h1>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Build. Innovate. Grow.</p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <Reveal key={c.label} delay={i * 0.05}>
            <Link to={c.to} className="card block p-5 transition hover:border-brand/40">
              <p className="text-xs uppercase tracking-wider text-muted">{c.label}</p>
              <p className="mt-3 text-3xl font-black tabular-nums">{c.value}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                {c.hint} <ArrowUpRight className="size-3" aria-hidden />
              </p>
            </Link>
          </Reveal>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Activité — 14 derniers jours</h2>
            <div className="flex items-center gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-brand" /> demandes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-muted" /> réservations
              </span>
            </div>
          </div>
          <div className="mt-4">
            <SeriesChart points={data.series ?? []} />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Données issues de la base PostgreSQL — aucune valeur simulée.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Répartition des demandes</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              { label: 'Nouvelles', value: data.leads.nouvelles, tone: 'bg-brand' },
              { label: 'En cours', value: data.leads.en_cours, tone: 'bg-ink/40' },
              { label: 'Gagnées', value: data.leads.gagnees, tone: 'bg-emerald-500' },
            ].map((row) => {
              const total = Math.max(1, data.leads.total);
              const pct = Math.round((row.value / total) * 100);
              return (
                <li key={row.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{row.label}</span>
                    <span className="tabular-nums text-muted">
                      {row.value} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <Link to="/admin/demandes" className="mt-5 inline-block text-xs font-medium text-brand hover:underline">
            Ouvrir les demandes
          </Link>
        </section>
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">Activité récente</h2>
          <Link to="/admin/automatisations" className="text-xs text-brand hover:underline">
            Voir les automatisations
          </Link>
        </div>
        {data.activity.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">
            Aucune activité pour l’instant. Les demandes et réservations apparaîtront ici.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {data.activity.map((a) => (
              <li key={`${a.type}-${a.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-brand">
                    {a.type === 'lead' ? 'demande' : 'réservation'}
                  </span>
                  <span className="ml-3">{a.label}</span>
                </span>
                <span className="text-xs text-muted">
                  {STATUS_FR[a.status] ?? a.status} · {frDateTime(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
