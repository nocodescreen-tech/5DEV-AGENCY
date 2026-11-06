import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { DeleteButton } from '../../components/DeleteButton';
import { apiGet, apiPost, ApiRequestError } from '../../lib/api';
import { frDate } from '../../lib/format';

type Project = {
  id: string;
  reference: string;
  name: string;
  category: string;
  client_name: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  progress: number;
  tasks_total: number;
  tasks_done: number;
  tasks_late: number;
  budget_amount: string | null;
  budget_currency: 'USD' | 'CDF';
};

type Template = { id: string; name: string; category: string | null; stages: { name: string }[] };

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'dev-web', label: 'Développement web' },
  { value: 'app-web', label: 'Application web' },
  { value: 'photo', label: 'Photographie' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'infra', label: 'Infrastructure' },
  { value: 'interne', label: 'Projet interne' },
  { value: 'recherche', label: 'Recherche' },
];

const STATUS_FR: Record<string, string> = {
  planning: 'Planification',
  active: 'En cours',
  paused: 'En pause',
  blocked: 'Bloqué',
  done: 'Terminé',
  archived: 'Archivé',
};

export default function AdminWorkspaceProjects() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    client_name: '',
    category: 'dev-web',
    template_id: '',
    due_date: '',
    priority: 'normal',
    status: 'planning',
    budget_amount: '',
    description: '',
  });
  const [error, setError] = useState<string | null>(null);

  const { data: projects, isPending } = useQuery({
    queryKey: ['pm-projects'],
    queryFn: () => apiGet<Project[]>('/api/v1/admin/pm/projects'),
  });

  const { data: templates } = useQuery({
    queryKey: ['pm-templates'],
    queryFn: () => apiGet<Template[]>('/api/v1/admin/pm/templates'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost<{ reference: string; stages_created: number }>('/api/v1/admin/pm/projects', {
        name: form.name,
        client_name: form.client_name || null,
        category: form.category,
        template_id: form.template_id || null,
        due_date: form.due_date || null,
        priority: form.priority,
        status: form.status,
        budget_amount: form.budget_amount ? Number(form.budget_amount) : null,
        description: form.description,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm({ name: '', client_name: '', category: 'dev-web', template_id: '', due_date: '', priority: 'normal', status: 'planning', budget_amount: '', description: '' });
      setError(null);
      void qc.invalidateQueries({ queryKey: ['pm-projects'] });
      void qc.invalidateQueries({ queryKey: ['workspace-overview'] });
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Création impossible.'),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Projets</h1>
          <p className="mt-1 text-sm text-muted">
            Projets clients et internes. Les étapes sont générées depuis le modèle choisi, jamais codées en dur.
          </p>
        </div>
        <button type="button" className="btn-primary !px-4 !py-2.5 text-sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="size-4" /> Nouveau projet
        </button>
      </div>

      {open && (
        <form
          className="mt-6 card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="p-name">
                Nom du projet *
              </label>
              <input
                id="p-name"
                className="field"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="p-client">
                Client (facultatif)
              </label>
              <input
                id="p-client"
                className="field"
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="laisser vide pour un projet interne"
              />
            </div>
            <div>
              <label className="label" htmlFor="p-cat">
                Catégorie
              </label>
              <select
                id="p-cat"
                className="field"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="p-tpl">
                Modèle d’étapes
              </label>
              <select
                id="p-tpl"
                className="field"
                value={form.template_id}
                onChange={(e) => setForm({ ...form, template_id: e.target.value })}
              >
                <option value="">Aucun (étapes à créer à la main)</option>
                {(templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.stages.length} étapes
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="p-due">
                Échéance
              </label>
              <input
                id="p-due"
                type="date"
                className="field"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="p-priority">
                Priorité
              </label>
              <select
                id="p-priority"
                className="field"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">Basse</option>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="p-budget">
                Budget prévu (USD)
              </label>
              <input
                id="p-budget"
                className="field"
                inputMode="numeric"
                value={form.budget_amount}
                onChange={(e) => setForm({ ...form, budget_amount: e.target.value.replace(/[^\d]/g, '') })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="p-desc">
                Description / objectifs
              </label>
              <textarea
                id="p-desc"
                className="field min-h-24"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          {error && <p className="mt-3 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">{error}</p>}

          <div className="mt-5 flex gap-3">
            <button type="submit" className="btn-primary !py-2.5" disabled={create.isPending || form.name.length < 2}>
              {create.isPending ? 'Création…' : 'Créer le projet'}
            </button>
            <button type="button" className="btn-ghost !py-2.5" onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {isPending && <p className="mt-8 text-sm text-muted">Chargement…</p>}

      <ul className="mt-6 space-y-3">
        {(projects ?? []).map((p) => (
          <li key={p.id}>
            <div className="flex items-stretch gap-2">
            <Link to={`/admin/projets/${p.id}`} className="card lift block flex-1 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-muted">{p.reference}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        p.status === 'done'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'blocked'
                            ? 'bg-brand/15 text-brand'
                            : 'bg-line text-ink/70'
                      }`}
                    >
                      {STATUS_FR[p.status] ?? p.status}
                    </span>
                    {p.priority === 'urgent' && (
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] text-brand">urgent</span>
                    )}
                  </div>
                  <p className="mt-1 font-semibold">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {p.client_name ?? 'projet interne'} · {p.tasks_done}/{p.tasks_total} tâche(s)
                    {p.tasks_late > 0 ? ` · ${p.tasks_late} en retard` : ''}
                    {p.due_date ? ` · ${frDate(p.due_date)}` : ''}
                  </p>
                </div>
                <div className="w-full sm:w-40">
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>avancement</span>
                    <span className="tabular-nums">{p.progress}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
              </div>
            </Link>
              <DeleteButton
                label={`le projet ${p.reference}`}
                detail="les tâches, jalons et documents liés seront supprimés"
                path={`/api/v1/admin/pm/projects/${p.id}`}
                invalidate={[['pm-projects'], ['dashboard']]}
                title="Supprimer ce projet ?"
              />
            </div>
          </li>
        ))}
        {projects && projects.length === 0 && (
          <li className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Aucun projet. Créez-en un — les étapes seront générées depuis un modèle.
          </li>
        )}
      </ul>
    </div>
  );
}
