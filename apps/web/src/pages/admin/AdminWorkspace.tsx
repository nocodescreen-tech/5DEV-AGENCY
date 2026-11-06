import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Clock, FolderKanban, ListChecks } from 'lucide-react';
import { apiGet } from '../../lib/api';
import { frDate, frDateTime } from '../../lib/format';

type Overview = {
  counts: {
    actifs: number;
    termines: number;
    bloques: number;
    taches_ouvertes: number;
    taches_retard: number;
    taches_bloquees: number;
    echeances_7j: number;
  };
  urgent: {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    project_id: string;
    project_name: string;
    reference: string;
  }[];
  activity: { id: number; kind: string; label: string; created_at: string; project_name: string; reference: string }[];
  timeWeekMinutes: number;
};

const hours = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;

export default function AdminWorkspace() {
  const { data, isPending } = useQuery({
    queryKey: ['workspace-overview'],
    queryFn: () => apiGet<Overview>('/api/v1/admin/pm/overview'),
    refetchInterval: 60_000,
  });

  if (isPending) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-48 animate-pulse rounded bg-line" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const c = data?.counts;
  const cards = [
    { label: 'Projets actifs', value: c?.actifs ?? 0, hint: `${c?.termines ?? 0} terminé(s)`, icon: FolderKanban, to: '/admin/projets' },
    { label: 'Tâches ouvertes', value: c?.taches_ouvertes ?? 0, hint: `${c?.taches_bloquees ?? 0} bloquée(s)`, icon: ListChecks, to: '/admin/taches' },
    { label: 'Échéances 7 jours', value: c?.echeances_7j ?? 0, hint: `${c?.taches_retard ?? 0} en retard`, icon: CalendarClock, to: '/admin/taches' },
    { label: 'Temps cette semaine', value: hours(data?.timeWeekMinutes ?? 0), hint: 'sessions terminées', icon: Clock, to: '/admin/temps' },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Workspace</p>
          <h1 className="mt-1 text-2xl font-black">Manage. Track. Deliver.</h1>
        </div>
        <Link to="/admin/projets" className="btn-primary !px-4 !py-2 text-sm">
          Nouveau projet
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} to={k.to} className="card p-5 transition hover:border-brand/40">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted">{k.label}</p>
                <Icon className="size-4 text-brand" aria-hidden />
              </div>
              <p className="mt-3 text-3xl font-black tabular-nums">{k.value}</p>
              <p className="mt-1 text-xs text-muted">{k.hint}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-semibold">À traiter en priorité</h2>
            <p className="mt-1 text-xs text-muted">Retards et priorités hautes, tous projets confondus.</p>
          </div>
          {(data?.urgent ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Rien d’urgent. Tout est sous contrôle.</p>
          ) : (
            <ul className="divide-y divide-line">
              {(data?.urgent ?? []).map((t) => (
                <li key={t.id} className="px-5 py-3">
                  <Link to={`/admin/projets/${t.project_id}`} className="group block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium group-hover:text-brand">{t.title}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {t.reference} · {t.project_name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {t.due_date && (
                          <p
                            className={`text-xs ${
                              new Date(t.due_date) < new Date() ? 'text-brand' : 'text-muted'
                            }`}
                          >
                            {frDate(t.due_date)}
                          </p>
                        )}
                        <p className="text-[10px] uppercase tracking-wider text-muted">{t.priority}</p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-semibold">Fil d’activité</h2>
            <p className="mt-1 text-xs text-muted">Créations, changements de statut, documents, temps.</p>
          </div>
          {(data?.activity ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Aucune activité enregistrée.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line overflow-auto">
              {(data?.activity ?? []).map((a) => (
                <li key={a.id} className="px-5 py-3 text-sm">
                  <p>{a.label}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {a.reference} · {frDateTime(a.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {(c?.taches_retard ?? 0) > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand" />
          {c?.taches_retard} tâche(s) dépassent leur échéance. Ouvre « Tâches » pour les replanifier.
        </p>
      )}
    </div>
  );
}
