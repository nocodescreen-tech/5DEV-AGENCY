import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  CalendarClock,
  Inbox,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';
import { apiGet } from '../../lib/api';
import { frDate, frDateTime } from '../../lib/format';
import { Skeleton } from '../../components/ui';

type Dash = {
  kpis: {
    leads_total: number;
    leads_new: number;
    leads_week: number;
    leads_prev_week: number;
    bookings_pending: number;
    bookings_upcoming: number;
    projects_active: number;
    tasks_open: number;
    tasks_late: number;
    time_week: number;
    ai_calls_24h: number;
    subscribers_confirmed: number;
    services_published: number;
    works_published: number;
  };
  catalog: { services: number; projets: number; modeles: number };
  series: { jour: string; demandes: number; reservations: number; minutes: number }[];
  activity: { type: string; id: string; label: string; status: string; created_at: string }[];
  tasksSoon: { id: string; title: string; priority: string; due_date: string | null; project_name: string; project_id: string }[];
  statuses: { status: string; n: number }[];
  generatedAt: string;
};

const STATUS_FR: Record<string, string> = {
  new: 'nouvelle',
  in_progress: 'en cours',
  quoted: 'devis envoyé',
  won: 'gagnée',
  lost: 'perdue',
  pending: 'à confirmer',
  confirmed: 'confirmée',
  done: 'terminée',
  cancelled: 'annulée',
  planning: 'planification',
  active: 'en cours',
  paused: 'en pause',
  blocked: 'bloqué',
};

const TYPE_FR: Record<string, string> = { lead: 'Demande', booking: 'Réservation', project: 'Projet' };

const hours = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;

export default function AdminDashboard() {
  const { data, isPending } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<Dash>('/api/v1/admin/dashboard'),
    refetchInterval: 60_000,
  });

  if (isPending || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const k = data.kpis;
  const delta = k.leads_prev_week > 0 ? Math.round(((k.leads_week - k.leads_prev_week) / k.leads_prev_week) * 100) : null;
  const maxSeries = Math.max(1, ...data.series.map((s) => Math.max(s.demandes, s.reservations)));
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const cards = [
    {
      label: 'Demandes à traiter',
      value: k.leads_new,
      hint: `${k.leads_total} au total`,
      icon: Inbox,
      to: '/admin/demandes',
      tone: 'brand' as const,
    },
    {
      label: 'Projets en cours',
      value: k.projects_active,
      hint: `${k.tasks_open} tâche(s) ouverte(s)`,
      icon: TrendingUp,
      to: '/admin/projets',
    },
    {
      label: 'Échéances proches',
      value: data.tasksSoon.length,
      hint: k.tasks_late > 0 ? `${k.tasks_late} en retard` : 'aucun retard',
      icon: CalendarClock,
      to: '/admin/taches',
      alert: k.tasks_late > 0,
    },
    {
      label: 'Temps cette semaine',
      value: hours(k.time_week),
      hint: `${k.ai_calls_24h} appel(s) IA sur 24 h`,
      icon: Timer,
      to: '/admin/temps',
    },
  ];

  return (
    <div>
      {/* ------------------------------------------------------------ en-tête */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-brand">Overview</p>
          <h1 className="display-2 mt-1">Tableau de bord</h1>
          <p className="mt-1 text-sm text-muted">
            {today} · données de la base, actualisées toutes les minutes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/ia/chat" className="btn-ghost !py-2 text-xs">
            <Sparkles className="size-3.5" /> Assistant IA
          </Link>
          <Link to="/admin/projets" className="btn-primary !py-2 text-xs">
            Nouveau projet <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* -------------------------------------------------------------- KPI */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              to={c.to}
              className="group relative overflow-hidden rounded-2xl border border-line bg-paper p-5 transition hover:border-brand/50 hover:shadow-lg"
              style={{ animation: `page-in .5s var(--ease-out) ${i * 60}ms both` }}
            >
              <div className="flex items-start justify-between">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{c.label}</p>
                <Icon className={`size-4 ${c.alert ? 'text-brand' : 'text-ink/25'}`} aria-hidden />
              </div>
              <p className={`mt-3 text-4xl font-black leading-none tabular-nums ${c.tone === 'brand' ? 'text-brand' : ''}`}>
                {c.value}
              </p>
              <p className={`mt-2 text-xs ${c.alert ? 'text-brand' : 'text-muted'}`}>{c.hint}</p>
              {c.label === 'Demandes à traiter' && delta !== null && (
                <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-brand/10 text-brand'}`}>
                  {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {Math.abs(delta)} % sur 7 jours
                </p>
              )}
              <span className="pointer-events-none absolute -right-6 -bottom-8 size-24 rounded-full bg-brand/5 transition group-hover:bg-brand/10" aria-hidden />
            </Link>
          );
        })}
      </div>

      {/* --------------------------------------------------- graphique + côté */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-line bg-paper p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">Activité — 14 derniers jours</h2>
              <p className="mt-0.5 text-xs text-muted">Demandes et réservations enregistrées chaque jour.</p>
            </div>
            <div className="flex gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-brand" /> demandes
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-ink/30" /> réservations
              </span>
            </div>
          </div>

          <div className="mt-6 flex h-44 items-end gap-1.5">
            {data.series.map((s) => (
              <div key={s.jour} className="group relative flex flex-1 flex-col items-center gap-1">
                <div className="flex h-36 w-full items-end justify-center gap-0.5">
                  <div
                    className="w-full max-w-[10px] rounded-t bg-brand transition-all group-hover:bg-brand/80"
                    style={{ height: `${Math.max(2, (s.demandes / maxSeries) * 100)}%` }}
                    title={`${frDate(s.jour)} — ${s.demandes} demande(s)`}
                  />
                  <div
                    className="w-full max-w-[10px] rounded-t bg-ink/25 transition-all group-hover:bg-ink/40"
                    style={{ height: `${Math.max(2, (s.reservations / maxSeries) * 100)}%` }}
                    title={`${frDate(s.jour)} — ${s.reservations} réservation(s)`}
                  />
                </div>
                <span className="text-[9px] text-muted">{s.jour.slice(8)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
            <div>
              <p className="text-lg font-bold tabular-nums">{k.leads_week}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted">demandes 7 j</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums">{k.bookings_upcoming}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted">séances à venir</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums">{hours(k.time_week)}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted">temps travaillé</p>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold">Pipeline commercial</h2>
            <ul className="mt-3 space-y-2.5">
              {data.statuses.length === 0 && <li className="text-xs text-muted">Aucune demande.</li>}
              {data.statuses.map((s) => {
                const pct = k.leads_total ? Math.round((s.n / k.leads_total) * 100) : 0;
                return (
                  <li key={s.status}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize">{STATUS_FR[s.status] ?? s.status}</span>
                      <span className="tabular-nums text-muted">
                        {s.n} · {pct} %
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <Link to="/admin/demandes" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              Ouvrir les demandes <ArrowUpRight className="size-3" />
            </Link>
          </section>

          <section className="rounded-2xl border border-line bg-paper p-5">
            <h2 className="font-semibold">Catalogue</h2>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { k: 'Services', v: data.catalog.services },
                { k: 'Réalisations', v: data.catalog.projets },
                { k: 'Modèles', v: data.catalog.modeles },
              ].map((x) => (
                <div key={x.k} className="rounded-xl bg-wash p-2.5">
                  <dd className="text-lg font-bold tabular-nums">{x.v}</dd>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">{x.k}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
              <Users className="size-3" /> {k.subscribers_confirmed} abonné(s) confirmé(s)
            </p>
          </section>
        </div>
      </div>

      {/* ------------------------------------------------ échéances + journal */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-line bg-paper">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold">À traiter</h2>
            <Link to="/admin/taches" className="text-xs text-brand hover:underline">
              toutes les tâches
            </Link>
          </div>
          {data.tasksSoon.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Aucune tâche en attente. Rien ne traîne.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.tasksSoon.map((t) => {
                const late = t.due_date && new Date(t.due_date) < new Date();
                return (
                  <li key={t.id}>
                    <Link to={`/admin/projets/${t.project_id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-wash">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{t.title}</p>
                        <p className="text-[11px] text-muted">{t.project_name}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {t.due_date && (
                          <p className={`text-[11px] ${late ? 'font-medium text-brand' : 'text-muted'}`}>{frDate(t.due_date)}</p>
                        )}
                        {t.priority === 'urgent' && <p className="text-[10px] uppercase tracking-wider text-brand">urgent</p>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-paper">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-semibold">Dernières activités</h2>
          </div>
          <ul className="divide-y divide-line">
            {data.activity.map((a) => (
              <li key={`${a.type}-${a.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <span className="text-[10px] uppercase tracking-wider text-muted">{TYPE_FR[a.type] ?? a.type}</span>{' '}
                    {a.label}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted">
                  {STATUS_FR[a.status] ?? a.status} · {frDateTime(a.created_at)}
                </span>
              </li>
            ))}
            {data.activity.length === 0 && <li className="px-5 py-6 text-sm text-muted">Aucune activité.</li>}
          </ul>
        </section>
      </div>

      <p className="mt-6 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <Banknote className="size-3" aria-hidden /> Build. Innovate. Grow.
      </p>
    </div>
  );
}
