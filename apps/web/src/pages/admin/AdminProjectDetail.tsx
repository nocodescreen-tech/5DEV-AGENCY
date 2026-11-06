import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bot, Clock, Paperclip, Pause, Pencil, Play, Plus, StickyNote } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../lib/api';
import { frDate, frDateTime } from '../../lib/format';

type Stage = { id: string; name: string; status: 'todo' | 'doing' | 'done'; weight: number; position: number; due_date: string | null };
type Task = {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'doing' | 'review' | 'blocked' | 'done';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  stage_id: string | null;
  stage_name: string | null;
  due_date: string | null;
  estimate_minutes: number | null;
  comments: number;
};
type Doc = { id: string; name: string; url: string; kind: string; is_shared: boolean };
type Note = { id: string; kind: string; title: string; body: string; created_at: string };
type Act = { id: number; kind: string; label: string; created_at: string };

type Detail = {
  project: {
    id: string;
    reference: string;
    name: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    client_name: string | null;
    start_date: string | null;
    due_date: string | null;
    budget_amount: string | null;
    budget_currency: 'USD' | 'CDF';
    objectives?: string;
    progress: number;
  };
  stages: Stage[];
  tasks: Task[];
  documents: Doc[];
  notes: Note[];
  activity: Act[];
  time: { totalMinutes: number; weekMinutes: number };
};

const COLUMNS: { key: Task['status']; label: string }[] = [
  { key: 'todo', label: 'À faire' },
  { key: 'doing', label: 'En cours' },
  { key: 'review', label: 'En revue' },
  { key: 'blocked', label: 'Bloqué' },
  { key: 'done', label: 'Terminé' },
];

const STATUS_FR: Record<string, string> = {
  planning: 'Planification',
  active: 'En cours',
  paused: 'En pause',
  blocked: 'Bloqué',
  done: 'Terminé',
  archived: 'Archivé',
};

const hours = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;

export default function AdminProjectDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'tasks' | 'notes' | 'docs' | 'activity'>('tasks');
  const [dragId, setDragId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({ title: '', stage_id: '', priority: 'normal', due_date: '' });
  const [note, setNote] = useState({ kind: 'note', title: '', body: '' });
  const [doc, setDoc] = useState({ name: '', url: '', kind: 'link', is_shared: false });
  const [aiText, setAiText] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    client_name: '',
    category: 'dev-web',
    priority: 'normal',
    start_date: '',
    due_date: '',
    budget_amount: '',
    description: '',
    objectives: '',
  });

  const { data, isPending, isError } = useQuery({
    queryKey: ['pm-project', id],
    queryFn: () => apiGet<Detail>(`/api/v1/admin/pm/projects/${id}`),
    retry: 0,
  });

  const { data: running } = useQuery({
    queryKey: ['time-running'],
    queryFn: () => apiGet<{ id: string; project_id: string; started_at: string } | null>('/api/v1/admin/pm/time/running'),
    refetchInterval: 30_000,
  });

  const saveProject = useMutation({
    mutationFn: () =>
      apiPatch(`/api/v1/admin/pm/projects/${id}`, {
        name: editForm.name,
        client_name: editForm.client_name || null,
        category: editForm.category,
        priority: editForm.priority,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
        budget_amount: editForm.budget_amount ? Number(editForm.budget_amount) : null,
        description: editForm.description,
        objectives: editForm.objectives,
      }),
    onSuccess: () => {
      setEditing(false);
      invalidate();
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['pm-project', id] });
    void qc.invalidateQueries({ queryKey: ['pm-projects'] });
    void qc.invalidateQueries({ queryKey: ['workspace-overview'] });
    void qc.invalidateQueries({ queryKey: ['time-running'] });
  };

  const moveTask = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: Task['status'] }) =>
      apiPatch(`/api/v1/admin/pm/tasks/${taskId}`, { status }),
    onSuccess: invalidate,
  });

  const addTask = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/admin/pm/tasks', {
        project_id: id,
        title: newTask.title,
        stage_id: newTask.stage_id || null,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
      }),
    onSuccess: () => {
      setNewTask({ title: '', stage_id: '', priority: 'normal', due_date: '' });
      invalidate();
    },
  });

  const toggleStage = useMutation({
    mutationFn: ({ stageId, status }: { stageId: string; status: Stage['status'] }) =>
      apiPatch(`/api/v1/admin/pm/stages/${stageId}`, { status }),
    onSuccess: invalidate,
  });

  const setProjectStatus = useMutation({
    mutationFn: (status: string) => apiPatch(`/api/v1/admin/pm/projects/${id}`, { status }),
    onSuccess: invalidate,
  });

  const startTimer = useMutation({
    mutationFn: () => apiPost('/api/v1/admin/pm/time/start', { project_id: id }),
    onSuccess: invalidate,
  });
  const stopTimer = useMutation({
    mutationFn: () => apiPost('/api/v1/admin/pm/time/stop'),
    onSuccess: invalidate,
  });

  const addNote = useMutation({
    mutationFn: () => apiPost(`/api/v1/admin/pm/projects/${id}/notes`, note),
    onSuccess: () => {
      setNote({ kind: 'note', title: '', body: '' });
      invalidate();
    },
  });

  const addDoc = useMutation({
    mutationFn: () => apiPost(`/api/v1/admin/pm/projects/${id}/documents`, doc),
    onSuccess: () => {
      setDoc({ name: '', url: '', kind: 'link', is_shared: false });
      invalidate();
    },
  });

  const askAi = useMutation({
    mutationFn: () => apiPost<{ text: string; model: string; stubbed: boolean }>(`/api/v1/admin/pm/projects/${id}/ai/summary`),
    onSuccess: (r) => setAiText(`${r.stubbed ? '[repli sans fournisseur IA] ' : ''}${r.text}`),
  });

  if (isPending) return <p className="text-sm text-muted">Chargement du projet…</p>;
  if (isError || !data) {
    return (
      <div>
        <p className="text-sm">Projet introuvable.</p>
        <Link to="/admin/projets" className="btn-ghost mt-4">
          Retour aux projets
        </Link>
      </div>
    );
  }

  const p = data.project;
  const isRunning = running?.project_id === id;

  return (
    <div>
      <Link to="/admin/projets" className="inline-flex items-center gap-2 text-sm text-muted hover:text-brand">
        <ArrowLeft className="size-4" /> Projets
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-muted">
            {p.reference} · {p.client_name ?? 'projet interne'}
          </p>
          <h1 className="mt-1 text-2xl font-black">{p.name}</h1>
          <p className="mt-1 text-xs text-muted">
            {p.start_date ? `début ${frDate(p.start_date)}` : 'début non défini'}
            {p.due_date ? ` · échéance ${frDate(p.due_date)}` : ''}
            {p.budget_amount ? ` · budget ${Number(p.budget_amount).toLocaleString('fr-FR')} ${p.budget_currency}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost !py-2 text-xs"
            onClick={() => {
              setEditForm({
                name: p.name,
                client_name: p.client_name ?? '',
                category: p.category,
                priority: p.priority,
                start_date: p.start_date ?? '',
                due_date: p.due_date ?? '',
                budget_amount: p.budget_amount ? String(Math.round(Number(p.budget_amount))) : '',
                description: p.description ?? '',
                objectives: p.objectives ?? '',
              });
              setEditing((v) => !v);
            }}
          >
            <Pencil className="size-3.5" /> Modifier
          </button>

          <select
            className="field !w-auto !py-2 text-xs"
            value={p.status}
            onChange={(e) => setProjectStatus.mutate(e.target.value)}
            aria-label="Statut du projet"
          >
            {Object.entries(STATUS_FR).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>

          {isRunning ? (
            <button type="button" className="btn-ghost !py-2 text-xs" onClick={() => stopTimer.mutate()}>
              <Pause className="size-3.5" /> Arrêter ({hours(data.time.weekMinutes)} cette semaine)
            </button>
          ) : (
            <button
              type="button"
              className="btn-ghost !py-2 text-xs"
              disabled={Boolean(running)}
              onClick={() => startTimer.mutate()}
            >
              <Play className="size-3.5" /> Chronomètre
            </button>
          )}

          <button type="button" className="btn-ghost !py-2 text-xs" onClick={() => askAi.mutate()} disabled={askAi.isPending}>
            <Bot className="size-3.5" /> {askAi.isPending ? 'Analyse…' : 'Résumé IA'}
          </button>
        </div>
      </div>

      <div className="mt-5 card p-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Avancement calculé depuis les tâches</span>
          <span className="font-semibold tabular-nums">{p.progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${p.progress}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> {hours(data.time.totalMinutes)} au total
          </span>
          <span>{data.tasks.filter((t) => t.status === 'done').length}/{data.tasks.length} tâches terminées</span>
          <span>{data.tasks.filter((t) => t.status === 'blocked').length} bloquée(s)</span>
        </div>
      </div>

      {editing && (
        <form
          className="mt-4 card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            saveProject.mutate();
          }}
        >
          <h2 className="font-semibold">Modifier le projet</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label className="label" htmlFor="e-name">Nom</label>
              <input id="e-name" className="field" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="e-client">Client</label>
              <input id="e-client" className="field" value={editForm.client_name} onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })} placeholder="vide = projet interne" />
            </div>
            <div>
              <label className="label" htmlFor="e-cat">Catégorie</label>
              <select id="e-cat" className="field" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                <option value="dev-web">Développement web</option>
                <option value="app-web">Application web</option>
                <option value="photo">Photographie</option>
                <option value="marketing">Marketing</option>
                <option value="infra">Infrastructure</option>
                <option value="interne">Projet interne</option>
                <option value="recherche">Recherche</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="e-prio">Priorité</label>
              <select id="e-prio" className="field" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                <option value="low">Basse</option>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="e-budget">Budget (USD)</label>
              <input id="e-budget" className="field" inputMode="numeric" value={editForm.budget_amount} onChange={(e) => setEditForm({ ...editForm, budget_amount: e.target.value.replace(/[^0-9]/g, '') })} />
            </div>
            <div>
              <label className="label" htmlFor="e-start">Début</label>
              <input id="e-start" type="date" className="field" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="e-due">Échéance</label>
              <input id="e-due" type="date" className="field" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label" htmlFor="e-desc">Description</label>
              <textarea id="e-desc" className="field min-h-20" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label" htmlFor="e-obj">Objectifs / livrables attendus</label>
              <textarea id="e-obj" className="field min-h-16" value={editForm.objectives} onChange={(e) => setEditForm({ ...editForm, objectives: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="btn-primary !py-2.5" disabled={saveProject.isPending || editForm.name.length < 2}>
              Enregistrer les modifications
            </button>
            <button type="button" className="btn-ghost !py-2.5" onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </form>
      )}

      {aiText && (
        <div className="mt-4 card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Analyse IA</p>
          <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{aiText}</pre>
        </div>
      )}

      {/* étapes */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Étapes</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.stages.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleStage.mutate({ stageId: s.id, status: s.status === 'done' ? 'todo' : 'done' })}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                s.status === 'done' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-line bg-paper hover:border-brand/40'
              }`}
              title="Cliquer pour valider / réouvrir"
            >
              <span className="block font-medium">{s.name}</span>
              <span className="text-[10px] text-muted">
                poids {s.weight} · {s.status === 'done' ? 'terminée' : s.status === 'doing' ? 'en cours' : 'à faire'}
              </span>
            </button>
          ))}
          {data.stages.length === 0 && (
            <p className="text-xs text-muted">
              Aucune étape. Créez le projet depuis un modèle, ou ajoutez des étapes via l’API.
            </p>
          )}
        </div>
      </section>

      {/* onglets */}
      <div className="mt-6 flex gap-1 border-b border-line">
        {[
          { key: 'tasks', label: 'Tâches' },
          { key: 'notes', label: 'Notes & journal' },
          { key: 'docs', label: 'Documents' },
          { key: 'activity', label: 'Activité' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-3 py-2 text-sm ${
              tab === t.key ? 'border-b-2 border-brand font-medium text-brand' : 'text-ink/60 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tasks' && (
        <>
          <form
            className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (newTask.title.trim().length >= 2) addTask.mutate();
            }}
          >
            <input
              className="field"
              placeholder="Nouvelle tâche…"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              aria-label="Titre de la nouvelle tâche"
            />
            <select
              className="field !w-auto text-xs"
              value={newTask.stage_id}
              onChange={(e) => setNewTask({ ...newTask, stage_id: e.target.value })}
              aria-label="Étape"
            >
              <option value="">sans étape</option>
              {data.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="field !w-auto text-xs"
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              aria-label="Priorité"
            >
              <option value="low">basse</option>
              <option value="normal">normale</option>
              <option value="high">haute</option>
              <option value="urgent">urgente</option>
            </select>
            <input
              type="date"
              className="field !w-auto text-xs"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              aria-label="Échéance"
            />
            <button type="submit" className="btn-primary !px-4 !py-2 text-xs" disabled={addTask.isPending}>
              <Plus className="size-3.5" /> Ajouter
            </button>
          </form>

          <div className="mt-4 grid gap-3 lg:grid-cols-5">
            {COLUMNS.map((col) => {
              const items = data.tasks.filter((t) => t.status === col.key);
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) moveTask.mutate({ taskId: dragId, status: col.key });
                    setDragId(null);
                  }}
                  className="rounded-xl border border-line bg-wash p-2"
                >
                  <p className="mb-2 flex items-center justify-between px-1 text-[11px] uppercase tracking-wider text-muted">
                    {col.label}
                    <span className="tabular-nums">{items.length}</span>
                  </p>
                  <ul className="space-y-2">
                    {items.map((t) => (
                      <li
                        key={t.id}
                        draggable
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => setDragId(null)}
                        className="cursor-grab rounded-lg border border-line bg-paper p-2.5 active:cursor-grabbing"
                      >
                        <p className="text-xs font-medium leading-snug">{t.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                          {t.stage_name && <span className="rounded bg-wash px-1.5 py-0.5">{t.stage_name}</span>}
                          {t.priority !== 'normal' && (
                            <span className={t.priority === 'urgent' ? 'text-brand' : ''}>{t.priority}</span>
                          )}
                          {t.due_date && (
                            <span className={new Date(t.due_date) < new Date() && t.status !== 'done' ? 'text-brand' : ''}>
                              {frDate(t.due_date)}
                            </span>
                          )}
                          {t.comments > 0 && <span>{t.comments} comm.</span>}
                        </div>
                      </li>
                    ))}
                    {items.length === 0 && <li className="px-1 py-2 text-[11px] text-muted">—</li>}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Glisser une carte met réellement à jour son statut en base (PATCH /admin/tasks/:id).
          </p>
        </>
      )}

      {tab === 'notes' && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form
            className="card space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (note.title.trim().length >= 2) addNote.mutate();
            }}
          >
            <select
              className="field text-xs"
              value={note.kind}
              onChange={(e) => setNote({ ...note, kind: e.target.value })}
              aria-label="Type de note"
            >
              <option value="note">Note</option>
              <option value="journal">Journal de développement</option>
              <option value="decision">Décision technique</option>
              <option value="meeting">Réunion</option>
              <option value="issue">Problème rencontré</option>
            </select>
            <input
              className="field"
              placeholder="Titre"
              value={note.title}
              onChange={(e) => setNote({ ...note, title: e.target.value })}
            />
            <textarea
              className="field min-h-24"
              placeholder="Contenu…"
              value={note.body}
              onChange={(e) => setNote({ ...note, body: e.target.value })}
            />
            <button type="submit" className="btn-primary !py-2 text-xs">
              <StickyNote className="size-3.5" /> Enregistrer la note
            </button>
          </form>

          <ul className="space-y-2">
            {data.notes.map((n) => (
              <li key={n.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{n.title}</p>
                  <span className="rounded bg-wash px-2 py-0.5 text-[10px] text-muted">{n.kind}</span>
                </div>
                {n.body && <p className="mt-1 whitespace-pre-wrap text-xs text-ink/70">{n.body}</p>}
                <p className="mt-2 text-[10px] text-muted">{frDateTime(n.created_at)}</p>
              </li>
            ))}
            {data.notes.length === 0 && <li className="text-xs text-muted">Aucune note.</li>}
          </ul>
        </div>
      )}

      {tab === 'docs' && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form
            className="card space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (doc.name && doc.url) addDoc.mutate();
            }}
          >
            <input
              className="field"
              placeholder="Nom du document"
              value={doc.name}
              onChange={(e) => setDoc({ ...doc, name: e.target.value })}
            />
            <input
              className="field"
              type="url"
              placeholder="https://…"
              value={doc.url}
              onChange={(e) => setDoc({ ...doc, url: e.target.value })}
            />
            <select
              className="field text-xs"
              value={doc.kind}
              onChange={(e) => setDoc({ ...doc, kind: e.target.value })}
              aria-label="Type de document"
            >
              <option value="link">Lien</option>
              <option value="spec">Cahier des charges</option>
              <option value="design">Maquette</option>
              <option value="delivery">Livrable client</option>
              <option value="file">Fichier</option>
            </select>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={doc.is_shared}
                onChange={(e) => setDoc({ ...doc, is_shared: e.target.checked })}
              />
              Partageable avec le client
            </label>
            <button type="submit" className="btn-primary !py-2 text-xs">
              <Paperclip className="size-3.5" /> Ajouter
            </button>
          </form>

          <ul className="space-y-2">
            {data.documents.map((d) => (
              <li key={d.id} className="card flex items-center justify-between p-3">
                <a href={d.url} target="_blank" rel="noreferrer noopener" className="text-sm hover:text-brand">
                  {d.name}
                </a>
                <span className="text-[10px] uppercase tracking-wider text-muted">
                  {d.kind}
                  {d.is_shared ? ' · partagé' : ''}
                </span>
              </li>
            ))}
            {data.documents.length === 0 && <li className="text-xs text-muted">Aucun document.</li>}
          </ul>
        </div>
      )}

      {tab === 'activity' && (
        <ul className="mt-4 divide-y divide-line">
          {data.activity.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2 text-sm">
              <span>{a.label}</span>
              <span className="text-[11px] text-muted">{frDateTime(a.created_at)}</span>
            </li>
          ))}
          {data.activity.length === 0 && <li className="py-3 text-xs text-muted">Aucune activité.</li>}
        </ul>
      )}
    </div>
  );
}
