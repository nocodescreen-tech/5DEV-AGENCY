import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import { Users, Activity, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { AnimatedBar, Stagger } from '../../components/admin/anim-ui';

type AnalyticsData = {
  overview: {
    total_users: number;
    active_users_7d: number;
    active_users_30d: number;
    total_projects: number;
    active_projects: number;
    total_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
    total_leads: number;
    new_leads_7d: number;
    conversion_rate: number;
    revenue_month: number;
    revenue_last_month: number;
    revenue_change: number;
  };
  trends: {
    date: string;
    users: number;
    projects: number;
    tasks: number;
    leads: number;
    revenue: number;
  }[];
  top_projects: {
    id: string;
    name: string;
    reference: string;
    progress: number;
    tasks_total: number;
    tasks_done: number;
    revenue: number;
  }[];
  leads_by_status: { status: string; count: number }[];
  tasks_by_priority: { priority: string; count: number }[];
};

function formatNumber(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n);
}

/** Statuts et priorités vivent en base en anglais : la console les affiche en français. */
const STATUT_FR: Record<string, string> = {
  new: 'Nouvelle',
  in_progress: 'En cours',
  quoted: 'Devis envoyé',
  won: 'Gagnée',
  lost: 'Perdue',
  pending: 'À confirmer',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
};
const PRIORITE_FR: Record<string, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
};

function StatCard({ label, value, change, icon: Icon }: { label: string; value: string | number; change?: number; icon: typeof TrendingUp }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="size-5 text-muted shrink-0 mt-0.5" />
      </div>
      {change !== undefined && (
        <div className={`mt-2 flex items-center gap-1 text-xs ${change >= 0 ? 'text-emerald' : 'text-red'}`}>
          {change >= 0 ? <TrendingUp className="size-3" /> : <TrendingUp className="size-3" style={{ transform: 'rotate(180deg)' }} />}
          <span>{Math.abs(change)}%</span>
          <span className="text-muted">vs mois dernier</span>
        </div>
      )}
    </div>
  )
}

export default function AdminAnalytics() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => apiGet<AnalyticsData>('/api/v1/admin/analytics'),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analytics & Rapports</h1>
            <p className="text-muted mt-1">Vue d'ensemble de l'activité</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-ink/[0.06]" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-ink/[0.06]" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red/30 bg-red/5 p-6">
        <h2 className="font-semibold text-red">Impossible de charger les analytics</h2>
      </div>
    );
  }

  const { overview, trends, top_projects, leads_by_status, tasks_by_priority } = data || {
    overview: {},
    trends: [],
    top_projects: [],
    leads_by_status: [],
    tasks_by_priority: [],
  };

  // Aucune tendance inventée : seule celle calculée par l'API est affichée.
  const revenueChange = Number(overview.revenue_change ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analyse et rapports</h1>
          <p className="text-muted mt-1">Vue d'ensemble de l'activité de l'agence</p>
        </div>
        <button onClick={() => refetch()} type="button" className="btn-ghost"><RefreshCw className="size-4" /></button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stagger index={0} step={70}><StatCard label="Utilisateurs actifs (30j)" value={formatNumber(overview.active_users_30d || 0)} icon={Users} /></Stagger>
        <Stagger index={1} step={70}><StatCard label="Projets actifs" value={formatNumber(overview.active_projects || 0)} icon={Activity} /></Stagger>
        <Stagger index={2} step={70}><StatCard label="Tâches terminées" value={formatNumber(overview.completed_tasks || 0)} icon={CheckCircle} /></Stagger>
        <Stagger index={3} step={70}><StatCard label="CA du mois" value={formatCurrency(overview.revenue_month || 0)} icon={TrendingUp} change={revenueChange} /></Stagger>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-xl border border-line bg-paper p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Activity className="size-5" /> Évolution 30 jours</h2>
          <div className="flex h-64 items-end gap-1">
            {trends.slice(-30).map((t, i, arr) => {
              const maxTasks = Math.max(1, ...trends.map((x) => x.tasks));
              // Une étiquette tous les 5 jours : sinon les dates élargissent les colonnes
              // et la rangée déborde du panneau.
              const showLabel = i % 5 === 0 || i === arr.length - 1;
              return (
                <div key={t.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="chart-col w-full max-w-[12px] rounded-t bg-brand/80"
                    style={{ height: `${Math.max(3, (t.tasks / maxTasks) * 100)}%`, animationDelay: `${i * 18}ms` }}
                    title={`${t.date} — ${t.tasks} tâche(s), ${t.leads} demande(s)`}
                  />
                  <span className="h-3 shrink-0 text-[9px] tabular-nums text-muted">
                    {showLabel ? new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-line bg-paper p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="size-5" /> Top Projets</h2>
          {top_projects.length === 0 ? (
            <p className="text-muted text-center py-8">Aucun projet</p>
          ) : (
            <div className="space-y-3">
              {top_projects.slice(0, 5).map((p, i) => (
                <Stagger key={p.id} index={i} step={60} className="flex min-w-0 items-center gap-3">
                  <div className="w-8 h-8 shrink-0 rounded bg-brand/10 flex items-center justify-center text-brand text-sm font-medium">{p.reference.slice(-3)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <div className="mt-1">
                      <AnimatedBar value={p.progress} height={7} delay={i * 80} label={`Avancement de ${p.name}`} />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-brand w-16 text-right">{Math.round(p.progress)}%</span>
                </Stagger>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-line bg-paper p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Users className="size-5" /> Demandes par statut</h2>
          {leads_by_status.length === 0 ? (
            <p className="text-muted text-center py-8">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {leads_by_status.map((l, i) => (
                <Stagger key={l.status} index={i} step={55} className="flex items-center justify-between">
                  <span className="text-sm">{STATUT_FR[l.status] ?? l.status}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32">
                      <AnimatedBar value={l.count} max={Math.max(1, ...leads_by_status.map((x) => x.count))} height={7} delay={i * 70} label={STATUT_FR[l.status] ?? l.status} />
                    </div>
                    <span className="text-sm font-medium w-10 text-right">{l.count}</span>
                  </div>
                </Stagger>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-xl border border-line bg-paper p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="size-5" /> Tâches par priorité</h2>
          {tasks_by_priority.length === 0 ? (
            <p className="text-muted text-center py-8">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {tasks_by_priority.map((t, i) => {
                const colors: Record<string, string> = { low: 'bg-muted', normal: 'bg-blue', high: 'bg-amber', urgent: 'bg-red' };
                return (
                  <Stagger key={t.priority} index={i} step={55} className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <span className={`w-3 h-3 rounded ${colors[t.priority] || 'bg-muted'}`} />
                      {PRIORITE_FR[t.priority] ?? t.priority}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-24">
                        <AnimatedBar
                          value={t.count}
                          max={Math.max(1, ...tasks_by_priority.map((x) => x.count))}
                          height={7}
                          tone="ink"
                          delay={i * 70}
                          label={PRIORITE_FR[t.priority] ?? t.priority}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{t.count}</span>
                    </div>
                  </Stagger>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
