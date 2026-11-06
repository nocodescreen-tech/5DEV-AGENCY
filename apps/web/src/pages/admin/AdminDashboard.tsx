import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet } from '../../lib/api';
import { frDateTime } from '../../lib/format';

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

type Dash = {
  leads: { nouvelles: number; en_cours: number; gagnees: number; total: number };
  bookings: { a_confirmer: number; confirmees: number; a_venir: number; total: number };
  catalog: { services: number; projets: number };
  activity: { type: string; id: string; label: string; status: string; created_at: string }[];
};

export default function AdminDashboard() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<Dash>('/api/v1/admin/dashboard'),
  });

  if (isPending) return <p className="text-sm text-muted">Chargement…</p>;
  if (isError || !data) return <p className="text-sm text-brand">Tableau de bord indisponible.</p>;

  const cards = [
    { label: 'Demandes à traiter', value: data.leads.nouvelles, to: '/admin/demandes', hint: `${data.leads.total} au total` },
    { label: 'Réservations à confirmer', value: data.bookings.a_confirmer, to: '/admin/reservations', hint: `${data.bookings.a_venir} à venir` },
    { label: 'Services publiés', value: data.catalog.services, to: '/admin/services', hint: 'catalogue' },
    { label: 'Réalisations publiées', value: data.catalog.projets, to: '/admin/realisations', hint: 'portefeuille' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black">Tableau de bord</h1>
      <p className="mt-1 text-sm text-muted">Vue d’ensemble de l’activité du studio.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="card p-5 transition hover:border-brand/40">
            <p className="text-xs uppercase tracking-wider text-muted">{c.label}</p>
            <p className="mt-3 text-3xl font-black">{c.value}</p>
            <p className="mt-1 text-xs text-muted">{c.hint}</p>
          </Link>
        ))}
      </div>

      <div className="mt-10 card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold">Activité récente</h2>
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
                  <span className="font-mono text-[11px] uppercase tracking-wider text-brand">
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
      </div>
    </div>
  );
}
