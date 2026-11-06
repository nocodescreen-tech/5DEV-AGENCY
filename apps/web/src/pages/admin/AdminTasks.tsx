import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet, apiPatch } from '../../lib/api';
import { DeleteButton } from '../../components/DeleteButton';
import { frDate } from '../../lib/format';

type Task = {
  id: string;
  title: string;
  status: 'todo' | 'doing' | 'review' | 'blocked' | 'done';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date: string | null;
  project_id: string;
  project_name: string;
  reference: string;
  stage_name: string | null;
};

const STATUS: { value: Task['status']; label: string }[] = [
  { value: 'todo', label: 'À faire' },
  { value: 'doing', label: 'En cours' },
  { value: 'review', label: 'En revue' },
  { value: 'blocked', label: 'Bloqué' },
  { value: 'done', label: 'Terminé' },
];

export default function AdminTasks() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>('');
  const [project, setProject] = useState<string>('');

  const { data: projects } = useQuery({
    queryKey: ['pm-projects'],
    queryFn: () => apiGet<{ id: string; name: string; reference: string }[]>('/api/v1/admin/pm/projects'),
  });

  const { data, isPending } = useQuery({
    queryKey: ['all-tasks', status, project],
    queryFn: () =>
      apiGet<Task[]>(
        `/api/v1/admin/pm/tasks?${status ? `status=${status}&` : ''}${project ? `project=${project}` : ''}`,
      ),
  });

  const patch = useMutation({
    mutationFn: ({ id, value }: { id: string; value: Task['status'] }) =>
      apiPatch(`/api/v1/admin/pm/tasks/${id}`, { status: value }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['all-tasks'] });
      void qc.invalidateQueries({ queryKey: ['workspace-overview'] });
    },
  });

  const late = (t: Task) => t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Toutes les tâches</h1>
          <p className="mt-1 text-sm text-muted">Vue transversale, tous projets confondus.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="field !w-auto !py-2 text-xs"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            aria-label="Filtrer par projet"
          >
            <option value="">Tous les projets</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.reference} — {p.name}
              </option>
            ))}
          </select>
          <select
            className="field !w-auto !py-2 text-xs"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filtrer par statut"
          >
            <option value="">Tous les statuts</option>
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isPending && <p className="mt-6 text-sm text-muted">Chargement…</p>}

      <div className="mt-6 overflow-x-auto">
        {data && data.length > 0 && (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-2 pr-3">Tâche</th>
                <th className="py-2 pr-3">Projet</th>
                <th className="py-2 pr-3">Étape</th>
                <th className="py-2 pr-3">Priorité</th>
                <th className="py-2 pr-3">Échéance</th>
                <th className="py-2">Statut</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} className="border-b border-line/60">
                  <td className="py-2 pr-3">
                    <span className={t.status === 'done' ? 'line-through text-muted' : ''}>{t.title}</span>
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    <Link to={`/admin/projets/${t.project_id}`} className="text-muted hover:text-brand">
                      {t.reference}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted">{t.stage_name ?? '—'}</td>
                  <td className="py-2 pr-3 text-xs">
                    <span className={t.priority === 'urgent' ? 'text-brand font-medium' : t.priority === 'high' ? 'text-ink' : 'text-muted'}>
                      {t.priority}
                    </span>
                  </td>
                  <td className={`py-2 pr-3 text-xs ${late(t) ? 'text-brand font-medium' : 'text-muted'}`}>
                    {t.due_date ? frDate(t.due_date) : '—'}
                  </td>
                  <td className="py-2">
                    <select
                      className="field !w-auto !py-1.5 text-xs"
                      value={t.status}
                      onChange={(e) => patch.mutate({ id: t.id, value: e.target.value as Task['status'] })}
                      aria-label={`Statut de ${t.title}`}
                    >
                      {STATUS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-right">
                    <DeleteButton
                      label={`la tâche « ${t.title} »`}
                      path={`/api/v1/admin/pm/tasks/${t.id}`}
                      invalidate={[['all-tasks'], ['pm-project'], ['dashboard']]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && data.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Aucune tâche pour ce filtre. Créez-en depuis la fiche d’un projet.
          </p>
        )}
      </div>
    </div>
  );
}
