import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Pause, Play, Plus } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { frDate } from '../../lib/format';

type Report = {
  byProject: { id: string; name: string; reference: string; minutes: number }[];
  byTask: { id: string; title: string; project_name: string; minutes: number }[];
  byDay: { jour: string; minutes: number }[];
};

const hours = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;

export default function AdminTime() {
  const qc = useQueryClient();
  const [manual, setManual] = useState({ project_id: '', minutes: '', date: '', note: '' });

  const { data: projects } = useQuery({
    queryKey: ['pm-projects'],
    queryFn: () => apiGet<{ id: string; name: string; reference: string }[]>('/api/v1/admin/pm/projects'),
  });

  const { data: running } = useQuery({
    queryKey: ['time-running'],
    queryFn: () => apiGet<{ id: string; project_id: string; started_at: string } | null>('/api/v1/admin/pm/time/running'),
    refetchInterval: 20_000,
  });

  const { data: report, isPending } = useQuery({
    queryKey: ['time-report'],
    queryFn: () => apiGet<Report>('/api/v1/admin/pm/time/report'),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['time-report'] });
    void qc.invalidateQueries({ queryKey: ['time-running'] });
    void qc.invalidateQueries({ queryKey: ['workspace-overview'] });
  };

  const start = useMutation({
    mutationFn: (projectId: string) => apiPost('/api/v1/admin/pm/time/start', { project_id: projectId }),
    onSuccess: invalidate,
  });
  const stop = useMutation({ mutationFn: () => apiPost('/api/v1/admin/pm/time/stop'), onSuccess: invalidate });

  const addManual = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/admin/pm/time/manual', {
        project_id: manual.project_id,
        minutes: Number(manual.minutes),
        date: manual.date || undefined,
        note: manual.note || undefined,
      }),
    onSuccess: () => {
      setManual({ project_id: '', minutes: '', date: '', note: '' });
      invalidate();
    },
  });

  const total = (report?.byProject ?? []).reduce((acc, p) => acc + p.minutes, 0);
  const maxDay = Math.max(1, ...(report?.byDay ?? []).map((d) => d.minutes));

  return (
    <div>
      <h1 className="text-2xl font-black">Temps de travail</h1>
      <p className="mt-1 text-sm text-muted">
        Chronomètre par projet, saisie manuelle et rapport sur 30 jours. Les sessions ouvertes ne comptent qu’à l’arrêt.
      </p>

      {running && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand/5 p-4">
          <p className="flex items-center gap-2 text-sm">
            <Clock className="size-4 text-brand" />
            Session en cours depuis {new Date(running.started_at).toLocaleTimeString('fr-FR')}
          </p>
          <button type="button" className="btn-ghost !py-2 text-xs" onClick={() => stop.mutate()}>
            <Pause className="size-3.5" /> Arrêter et enregistrer
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Temps par projet (30 jours)</h2>
          {isPending && <p className="mt-3 text-sm text-muted">Chargement…</p>}
          <ul className="mt-4 space-y-3">
            {(report?.byProject ?? []).map((p) => {
              const pct = total ? Math.round((p.minutes / total) * 100) : 0;
              return (
                <li key={p.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">
                      <span className="font-mono text-[11px] text-muted">{p.reference}</span> {p.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-xs text-muted">{hours(p.minutes)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
            {(report?.byProject ?? []).length === 0 && (
              <li className="text-sm text-muted">Aucune session enregistrée sur la période.</li>
            )}
          </ul>

          <h3 className="mt-6 text-sm font-semibold">Tâches les plus consommatrices</h3>
          <ul className="mt-2 divide-y divide-line text-sm">
            {(report?.byTask ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span className="truncate">
                  {t.title} <span className="text-xs text-muted">· {t.project_name}</span>
                </span>
                <span className="tabular-nums text-xs text-muted">{hours(t.minutes)}</span>
              </li>
            ))}
            {(report?.byTask ?? []).length === 0 && <li className="py-2 text-xs text-muted">—</li>}
          </ul>
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="font-semibold">Démarrer une session</h2>
            <p className="mt-1 text-xs text-muted">Une seule session ouverte à la fois (contrainte en base).</p>
            <div className="mt-3 space-y-2">
              {(projects ?? []).slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={Boolean(running) || start.isPending}
                  onClick={() => start.mutate(p.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-xs hover:border-brand hover:text-brand disabled:opacity-40"
                >
                  <span className="truncate">{p.name}</span>
                  <Play className="size-3" />
                </button>
              ))}
              {(projects ?? []).length === 0 && <p className="text-xs text-muted">Créez d’abord un projet.</p>}
            </div>
          </section>

          <form
            className="card space-y-2 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.project_id && Number(manual.minutes) > 0) addManual.mutate();
            }}
          >
            <h2 className="font-semibold">Saisie manuelle</h2>
            <select
              className="field text-xs"
              value={manual.project_id}
              onChange={(e) => setManual({ ...manual, project_id: e.target.value })}
              aria-label="Projet"
            >
              <option value="">Choisir un projet…</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="field text-xs"
                placeholder="minutes"
                inputMode="numeric"
                value={manual.minutes}
                onChange={(e) => setManual({ ...manual, minutes: e.target.value.replace(/\D/g, '') })}
                aria-label="Minutes"
              />
              <input
                type="date"
                className="field text-xs"
                value={manual.date}
                onChange={(e) => setManual({ ...manual, date: e.target.value })}
                aria-label="Date"
              />
            </div>
            <input
              className="field text-xs"
              placeholder="note (facultatif)"
              value={manual.note}
              onChange={(e) => setManual({ ...manual, note: e.target.value })}
              aria-label="Note"
            />
            <button type="submit" className="btn-primary w-full !py-2 text-xs" disabled={addManual.isPending}>
              <Plus className="size-3.5" /> Enregistrer
            </button>
          </form>
        </div>
      </div>

      <section className="card mt-4 p-5">
        <h2 className="font-semibold">14 derniers jours</h2>
        <div className="mt-4 flex h-24 items-end gap-1.5">
          {(report?.byDay ?? []).map((d) => (
            <div key={d.jour} className="group flex-1">
              <div
                className="w-full rounded-t bg-brand/70 transition group-hover:bg-brand"
                style={{ height: `${Math.max(3, (d.minutes / maxDay) * 88)}px` }}
                title={`${frDate(d.jour)} — ${hours(d.minutes)}`}
              />
            </div>
          ))}
          {(report?.byDay ?? []).length === 0 && <p className="text-xs text-muted">Aucune donnée.</p>}
        </div>
      </section>
    </div>
  );
}
