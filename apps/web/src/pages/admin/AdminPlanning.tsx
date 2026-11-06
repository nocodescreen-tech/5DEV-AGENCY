import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { frDate } from '../../lib/format';
import { Skeleton } from '../../components/ui';

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  project_id: string;
  project_name: string;
  reference: string;
  stage_name: string | null;
};
type Milestone = { id: string; name: string; due_date: string | null; status: string; project_id: string; project_name: string };
type Booking = { id: string; full_name: string; shoot_date: string; slot: string; status: string };
type Planning = { tasks: Task[]; milestones: Milestone[]; bookings: Booking[]; lateCount: number };

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

function monthRange(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10), first, last };
}

export default function AdminPlanning() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'calendar' | 'gantt'>('calendar');
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const { from, to, first } = monthRange(cursor.year, cursor.month);

  const { data, isPending } = useQuery({
    queryKey: ['planning', from, to],
    queryFn: () => apiGet<Planning>(`/api/v1/admin/pm/planning?from=${from}&to=${to}`),
  });

  const scan = useMutation({
    mutationFn: () => apiPost<{ late: number; soon: number }>('/api/v1/admin/pm/scan-due'),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const cells = useMemo(() => {
    const startOffset = (first.getUTCDay() + 6) % 7; // lundi = 0
    const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
    const out: { day: number | null; iso: string | null }[] = [];
    for (let i = 0; i < startOffset; i++) out.push({ day: null, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ day: d, iso: `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }
    return out;
  }, [cursor, first]);

  const byDay = useMemo(() => {
    const map = new Map<string, { tasks: Task[]; milestones: Milestone[]; bookings: Booking[] }>();
    const get = (k: string) => {
      if (!map.has(k)) map.set(k, { tasks: [], milestones: [], bookings: [] });
      return map.get(k)!;
    };
    for (const t of data?.tasks ?? []) {
      const k = t.due_date ?? t.start_date;
      if (k) get(k).tasks.push(t);
    }
    for (const m of data?.milestones ?? []) if (m.due_date) get(m.due_date).milestones.push(m);
    for (const b of data?.bookings ?? []) get(b.shoot_date).bookings.push(b);
    return map;
  }, [data]);

  // Gantt : bornes de la fenêtre affichée
  const gantt = useMemo(() => {
    const items = (data?.tasks ?? []).filter((t) => t.due_date || t.start_date);
    if (!items.length) return { rows: [], min: 0, span: 1 };
    const dates = items.flatMap((t) => [t.start_date, t.due_date]).filter(Boolean).map((d) => new Date(String(d)).getTime());
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const span = Math.max(1, max - min);
    return {
      rows: items.slice(0, 40).map((t) => {
        const s = new Date(t.start_date ?? t.due_date ?? '').getTime();
        const e = new Date(t.due_date ?? t.start_date ?? '').getTime();
        return {
          ...t,
          left: ((s - min) / span) * 100,
          width: Math.max(2.5, ((e - s) / span) * 100),
          late: t.status !== 'done' && t.due_date ? new Date(t.due_date) < new Date() : false,
        };
      }),
      min,
      span,
    };
  }, [data]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Planning</h1>
          <p className="mt-1 text-sm text-muted">
            Échéances, jalons et séances photo. {data?.lateCount ?? 0} tâche(s) en retard.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-line p-0.5">
          <button
            type="button"
            onClick={() => setTab('calendar')}
            className={`rounded-md px-3 py-1.5 text-xs ${tab === 'calendar' ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}
          >
            <CalendarDays className="mr-1 inline size-3.5" /> Calendrier
          </button>
          <button
            type="button"
            onClick={() => setTab('gantt')}
            className={`rounded-md px-3 py-1.5 text-xs ${tab === 'gantt' ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}
          >
            Chronologie
          </button>
        </div>
      </div>

      {isPending && <Skeleton className="mt-6 h-96" />}

      {tab === 'calendar' && !isPending && (
        <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-paper">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <button
              type="button"
              className="rounded-md p-1.5 text-muted hover:text-brand"
              onClick={() =>
                setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 }))
              }
              aria-label="Mois précédent"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-semibold capitalize">
              {MONTHS[cursor.month]} {cursor.year}
            </p>
            <button
              type="button"
              className="rounded-md p-1.5 text-muted hover:text-brand"
              onClick={() =>
                setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 }))
              }
              aria-label="Mois suivant"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-line text-center text-[10px] uppercase tracking-wider text-muted">
            {DAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((c, i) => {
              const entries = c.iso ? byDay.get(c.iso) : undefined;
              const isToday = c.iso === new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={i}
                  className={`min-w-0 overflow-hidden border-b border-r border-line/70 p-1.5 min-h-[104px] ${c.day ? '' : 'bg-wash/50'} ${
                    isToday ? 'ring-1 ring-inset ring-brand/50' : ''
                  }`}
                >
                  {c.day && (
                    <>
                      <p className={`text-[11px] ${isToday ? 'font-bold text-brand' : 'text-muted'}`}>{c.day}</p>
                      <ul className="mt-1 min-w-0 space-y-0.5">
                        {(entries?.milestones ?? []).map((m) => (
                          <li key={m.id} className="truncate rounded bg-brand/10 px-1 py-0.5 text-[9px] text-brand" title={`Jalon — ${m.name}`}>
                            <Flag className="mr-0.5 inline size-2.5" />
                            {m.name}
                          </li>
                        ))}
                        {(entries?.tasks ?? []).slice(0, 3).map((t) => (
                          <li
                            key={t.id}
                            className={`truncate rounded px-1 py-0.5 text-[9px] ${
                              t.status === 'done' ? 'bg-emerald-50 text-emerald-800' : t.priority === 'urgent' ? 'bg-brand/15 text-brand' : 'bg-wash text-ink/70'
                            }`}
                            title={`${t.title} — ${t.project_name}`}
                          >
                            {t.title}
                          </li>
                        ))}
                        {(entries?.bookings ?? []).map((b) => (
                          <li key={b.id} className="truncate rounded bg-ink/10 px-1 py-0.5 text-[9px]" title={`Séance photo — ${b.full_name}`}>
                            {b.slot} · {b.full_name}
                          </li>
                        ))}
                        {(entries?.tasks ?? []).length > 3 && (
                          <li className="px-1 text-[9px] text-muted">+{(entries?.tasks ?? []).length - 3}</li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === 'gantt' && !isPending && (
        <section className="mt-5 rounded-2xl border border-line bg-paper p-4">
          <p className="mb-3 text-xs text-muted">
            Barres proportionnelles aux dates réelles des tâches, groupées par projet. Les barres
            rouges sont en retard ; une barre courte signifie une tâche d’un jour.
          </p>
          {gantt.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Aucune tâche datée. Ajoutez des dates sur les tâches pour voir la chronologie.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {gantt.rows.map((t) => (
                <li key={t.id} className="group">
                  <Link to={`/admin/projets/${t.project_id}`} className="block">
                    <div className="flex items-center gap-2">
                      <span className="w-44 shrink-0 truncate text-[11px] text-muted">{t.title}</span>
                      <div className="relative h-4 flex-1 rounded bg-wash">
                        <div
                          className={`absolute top-0 h-4 rounded ${t.late ? 'bg-brand' : t.status === 'done' ? 'bg-emerald-500/70' : 'bg-ink/30'}`}
                          style={{ left: `${t.left}%`, width: `${t.width}%` }}
                          title={`${t.start_date ?? t.due_date} → ${t.due_date ?? t.start_date}`}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-[10px] text-muted">
                        {t.due_date ? frDate(t.due_date) : '—'}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost !py-2 text-xs" onClick={() => scan.mutate()} disabled={scan.isPending}>
          {scan.isPending ? 'Analyse…' : 'Générer les rappels d’échéance'}
        </button>
        {scan.data && (
          <span className="text-[11px] text-muted">
            {scan.data.late} retard(s), {scan.data.soon} échéance(s) proche(s) — notifications créées une seule fois par jour.
          </span>
        )}
      </div>
    </div>
  );
}
