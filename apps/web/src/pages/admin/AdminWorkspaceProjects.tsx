import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, RotateCcw } from 'lucide-react';
import { DeleteButton } from '../../components/DeleteButton';
import { apiGet, apiPatch, apiPost, ApiRequestError } from '../../lib/api';
import { frDate } from '../../lib/format';

import { TiltCard3D } from '../../components/motion/TiltCard3D';
type TaskPreview = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  stage_name: string | null;
};
type Project = {
  id: string;
  reference: string;
  name: string;
  category: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  progress: number;
  tasks_total: number;
  tasks_done: number;
  tasks_late: number;
  tasks_preview: TaskPreview[];
  budget_amount: string | null;
  budget_currency: 'USD' | 'CDF';
};

type Template = { id: string; name: string; category: string | null; stages: { name: string }[] };
type Client = { id: string; name: string; email: string | null; phone: string | null; address: string | null };

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

const TASK_STATUS_FR: { value: string; label: string }[] = [
  { value: 'todo', label: 'À faire' },
  { value: 'doing', label: 'En cours' },
  { value: 'review', label: 'En revue' },
  { value: 'blocked', label: 'Bloqué' },
  { value: 'done', label: 'Terminé' },
];

/**
 * Une tâche affichée à côté de son projet, avec l'action en un clic :
 * Terminer / Rouvrir, plus le changement de statut. Pas besoin d'ouvrir le Kanban.
 */
function TaskLine({ task, projectId }: { task: TaskPreview; projectId: string }) {
  const qc = useQueryClient();
  const patch = useMutation({
    mutationFn: (status: string) => apiPatch(`/api/v1/admin/pm/tasks/${task.id}`, { status }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['pm-projects'] }),
        qc.invalidateQueries({ queryKey: ['all-tasks'] }),
        qc.invalidateQueries({ queryKey: ['pm-project', projectId] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
  const done = task.status === 'done';
  const late = !done && task.due_date && new Date(task.due_date) < new Date();

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line/60 py-1.5 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => patch.mutate(done ? 'todo' : 'done')}
        disabled={patch.isPending}
        title={done ? 'Rouvrir la tâche' : 'Marquer comme terminée'}
        className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition disabled:opacity-50 ${
          done
            ? 'border-line text-muted hover:border-brand hover:text-brand'
            : 'border-brand/40 text-brand hover:bg-brand hover:text-white'
        }`}
      >
        {done ? <RotateCcw className="size-3" /> : <Check className="size-3" />}
        {done ? 'Rouvrir' : 'Terminer'}
      </button>
      <span className={`min-w-0 flex-1 truncate text-xs ${done ? 'text-muted line-through' : 'text-ink'}`}>
        {task.title}
      </span>
      {task.stage_name && <span className="text-[10px] text-muted">{task.stage_name}</span>}
      <span className={`text-[10px] tabular-nums ${late ? 'font-medium text-brand' : 'text-muted'}`}>
        {task.due_date ? frDate(task.due_date) : '—'}
      </span>
      <select
        value={task.status}
        onChange={(e) => patch.mutate(e.target.value)}
        disabled={patch.isPending}
        aria-label={`Statut de ${task.title}`}
        className="field !w-auto !px-1 !py-0.5 text-[11px]"
      >
        {TASK_STATUS_FR.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </li>
  );
}

export default function AdminWorkspaceProjects() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    client_address: '',
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

  // fiches clients existantes : le nom saisi dans le formulaire complète les coordonnées
  const { data: clients } = useQuery({
    queryKey: ['pm-clients'],
    queryFn: () => apiGet<Client[]>('/api/v1/admin/pm/clients'),
    staleTime: 60_000,
  });

  /** Un projet pour un client déjà connu : ses coordonnées reviennent toutes seules. */
  const chooseClient = (name: string) => {
    const known = (clients ?? []).find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    setForm((f) => ({
      ...f,
      client_name: name,
      client_email: known?.email ?? f.client_email,
      client_phone: known?.phone ?? f.client_phone,
      client_address: known?.address ?? f.client_address,
    }));
  };

  const { data: templates } = useQuery({
    queryKey: ['pm-templates'],
    queryFn: () => apiGet<Template[]>('/api/v1/admin/pm/templates'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost<{ reference: string; stages_created: number }>('/api/v1/admin/pm/projects', {
        name: form.name,
        client_name: form.client_name || null,
        client_email: form.client_email || null,
        client_phone: form.client_phone || null,
        client_address: form.client_address || null,
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
      setForm({ name: '', client_name: '', client_email: '', client_phone: '', client_address: '', category: 'dev-web', template_id: '', due_date: '', priority: 'normal', status: 'planning', budget_amount: '', description: '' });
      setError(null);
      void qc.invalidateQueries({ queryKey: ['pm-projects'] });
      void qc.invalidateQueries({ queryKey: ['pm-clients'] });
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
                list="pm-clients-list"
                value={form.client_name}
                onChange={(e) => chooseClient(e.target.value)}
                placeholder="laisser vide pour un projet interne"
              />
              <datalist id="pm-clients-list">
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.email ?? c.phone ?? ''}
                  </option>
                ))}
              </datalist>
              <p className="mt-1 text-[11px] text-muted">
                Un client déjà enregistré remplit ses coordonnées automatiquement.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="p-client-email">
                Email du client
              </label>
              <input
                id="p-client-email"
                type="email"
                className="field"
                value={form.client_email}
                onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                placeholder="client@exemple.cd"
              />
            </div>
            <div>
              <label className="label" htmlFor="p-client-phone">
                Téléphone du client
              </label>
              <input
                id="p-client-phone"
                className="field"
                value={form.client_phone}
                onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                placeholder="+243 …"
              />
            </div>
            <div>
              <label className="label" htmlFor="p-client-address">
                Adresse du client
              </label>
              <input
                id="p-client-address"
                className="field"
                value={form.client_address}
                onChange={(e) => setForm({ ...form, client_address: e.target.value })}
                placeholder="Matadi, quartier…"
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
            <TiltCard3D className="flex-1">
              <div className="card lift block h-full p-5">
              <Link to={`/admin/projets/${p.id}`} className="block">
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
                  {(p.client_email || p.client_phone || p.client_address) && (
                    <p className="mt-0.5 text-[11px] text-muted">
                      {[p.client_email, p.client_phone, p.client_address].filter(Boolean).join(' · ')}
                    </p>
                  )}
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

              {p.tasks_preview?.length ? (
                <ul className="mt-3 border-t border-line pt-2">
                  {p.tasks_preview.map((t) => (
                    <TaskLine key={t.id} task={t} projectId={p.id} />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 border-t border-line pt-2 text-xs text-muted">
                  Aucune tâche pour l’instant — ouvrez le projet pour en ajouter.
                </p>
              )}
              {p.tasks_total > (p.tasks_preview?.length ?? 0) && (
                <Link
                  to={`/admin/projets/${p.id}`}
                  className="mt-1 inline-block text-[11px] text-muted hover:text-brand"
                >
                  Voir les {p.tasks_total} tâches du projet →
                </Link>
              )}
              </div>
            </TiltCard3D>
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
