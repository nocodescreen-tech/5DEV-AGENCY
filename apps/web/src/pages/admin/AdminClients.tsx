import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Mail, MapPin, Pencil, Phone, Plus, Search, X } from 'lucide-react';
import { PageHeader } from '../../components/admin/PageHeader';
import { DeleteButton } from '../../components/DeleteButton';
import { useToast } from '../../components/Toaster';
import { apiGet, apiPatch, apiPost, ApiRequestError } from '../../lib/api';
import { frDate } from '../../lib/format';

type ClientProject = {
  id: string;
  reference: string;
  name: string;
  status: string;
  priority: string;
  due_date: string | null;
  progress: number;
  tasks_total: number;
  tasks_done: number;
};

type Client = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  projets: number;
  proj_list: ClientProject[];
};

const STATUS_FR: Record<string, string> = {
  planning: 'Planification',
  active: 'En cours',
  paused: 'En pause',
  blocked: 'Bloqué',
  done: 'Terminé',
  archived: 'Archivé',
};

const EMPTY = { name: '', company: '', email: '', phone: '', address: '', city: '', notes: '' };

/**
 * Clients et projets liés (1 client → n projets).
 * Les coordonnées vivent ici ; elles sont recopiées sur chaque projet au moment de sa
 * création, et restent modifiables depuis la fiche projet comme depuis cette page.
 */
export default function AdminClients() {
  const qc = useQueryClient();
  const toast = useToast();
  const location = useLocation();
  const focus = location.hash.startsWith('#client-') ? location.hash.slice('#client-'.length) : '';
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  // tous les projets : sert au sélecteur « lier un projet » de chaque client
  const { data: projects } = useQuery({
    queryKey: ['pm-projects'],
    queryFn: () => apiGet<{ id: string; reference: string; name: string; client_id: string | null }[]>(
      '/api/v1/admin/pm/projects',
    ),
    staleTime: 30_000,
  });

  const { data: clients, isPending } = useQuery({
    queryKey: ['pm-clients', search],
    queryFn: () => apiGet<Client[]>(`/api/v1/admin/pm/clients?q=${encodeURIComponent(search)}`),
  });

  // lien direct depuis une fiche projet : /admin/clients#client-<id>
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(`client-${focus}`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focus, clients]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['pm-clients'] });
    void qc.invalidateQueries({ queryKey: ['pm-projects'] });
    void qc.invalidateQueries({ queryKey: ['pm-project'] });
  };

  const create = useMutation({
    mutationFn: () =>
      apiPost<Client>('/api/v1/admin/pm/clients', {
        name: form.name.trim(),
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      toast.push('success', `Client « ${form.name.trim()} » enregistré.`);
      setCreating(false);
      setForm(EMPTY);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Création impossible.'),
  });

  /** Lie (ou détache) un projet à un client : la liaison vit sur le projet. */
  const link = useMutation({
    mutationFn: ({ projectId, clientId }: { projectId: string; clientId: string | null }) =>
      apiPatch(`/api/v1/admin/pm/projects/${projectId}`, { client_id: clientId }),
    onSuccess: (_d, vars) => {
      toast.push('success', vars.clientId ? 'Projet rattaché au client.' : 'Projet détaché.');
      invalidate();
      void qc.invalidateQueries({ queryKey: ['ai-assistant'] });
    },
    onError: (err) => toast.push('error', err instanceof ApiRequestError ? err.message : 'Liaison impossible.'),
  });

  const save = useMutation({
    mutationFn: (id: string) =>
      apiPatch(`/api/v1/admin/pm/clients/${id}`, {
        name: editForm.name.trim(),
        company: editForm.company || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        address: editForm.address || null,
        city: editForm.city || null,
        notes: editForm.notes || null,
      }),
    onSuccess: () => {
      toast.push('success', 'Fiche client mise à jour.');
      setEditingId(null);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Enregistrement impossible.'),
  });

  function startEdit(c: Client) {
    setError(null);
    setEditingId(c.id);
    setEditForm({
      name: c.name,
      company: c.company ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
      city: c.city ?? '',
      notes: c.notes ?? '',
    });
  }

  const champs = (state: typeof EMPTY, set: (v: typeof EMPTY) => void) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="c-name">Nom du client *</label>
        <input id="c-name" className="field" required value={state.name} onChange={(e) => set({ ...state, name: e.target.value })} placeholder="Boulangerie Le Fournil" />
      </div>
      <div>
        <label className="label" htmlFor="c-company">Société</label>
        <input id="c-company" className="field" value={state.company} onChange={(e) => set({ ...state, company: e.target.value })} placeholder="facultatif" />
      </div>
      <div>
        <label className="label" htmlFor="c-email">Email</label>
        <input id="c-email" type="email" className="field" value={state.email} onChange={(e) => set({ ...state, email: e.target.value })} placeholder="client@exemple.cd" />
      </div>
      <div>
        <label className="label" htmlFor="c-phone">Téléphone</label>
        <input id="c-phone" className="field" value={state.phone} onChange={(e) => set({ ...state, phone: e.target.value })} placeholder="+243 …" />
      </div>
      <div>
        <label className="label" htmlFor="c-address">Adresse</label>
        <input id="c-address" className="field" value={state.address} onChange={(e) => set({ ...state, address: e.target.value })} placeholder="Avenue du Port" />
      </div>
      <div>
        <label className="label" htmlFor="c-city">Ville</label>
        <input id="c-city" className="field" value={state.city} onChange={(e) => set({ ...state, city: e.target.value })} placeholder="Matadi" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="c-notes">Notes</label>
        <textarea id="c-notes" className="field min-h-20" value={state.notes} onChange={(e) => set({ ...state, notes: e.target.value })} placeholder="Contexte, interlocuteur, historique…" />
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Commercial"
        title="Clients"
        sub="Un client, ses coordonnées, et tous ses projets. Les coordonnées saisies ici sont reprises automatiquement au prochain projet du même client."
        actions={
          <button
            type="button"
            className="btn-primary !px-4 !py-2.5 text-sm"
            onClick={() => {
              setCreating((v) => !v);
              setError(null);
            }}
          >
            {creating ? <X className="size-4" /> : <Plus className="size-4" />}
            {creating ? 'Fermer' : 'Nouveau client'}
          </button>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2">
          <Search className="size-3.5 text-muted" />
          <input
            className="w-full bg-transparent text-sm outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client (nom, société, email)"
            aria-label="Rechercher un client"
          />
        </label>
        <span className="text-xs text-muted">
          {clients?.length ?? 0} fiche{(clients?.length ?? 0) > 1 ? 's' : ''}
        </span>
      </div>

      {creating && (
        <form
          className="mt-4 card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          {champs(form, setForm)}
          {error && <p className="mt-3 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button type="submit" className="btn-primary !py-2.5" disabled={create.isPending || form.name.trim().length < 2}>
              {create.isPending ? 'Enregistrement…' : 'Créer le client'}
            </button>
          </div>
        </form>
      )}

      {isPending && <p className="mt-6 text-sm text-muted">Chargement…</p>}

      <ul className="mt-5 space-y-3">
        {(clients ?? []).map((c) => (
          <li
            key={c.id}
            id={`client-${c.id}`}
            className={`card p-5 ${focus === c.id ? 'ring-2 ring-brand/40' : ''}`}
          >
            {editingId === c.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate(c.id);
                }}
              >
                {champs(editForm, setEditForm)}
                {error && <p className="mt-3 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">{error}</p>}
                <div className="mt-4 flex gap-3">
                  <button type="submit" className="btn-primary !py-2.5" disabled={save.isPending || editForm.name.trim().length < 2}>
                    {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button type="button" className="btn-ghost !py-2.5" onClick={() => setEditingId(null)}>
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      <Building2 className="size-4 text-brand" />
                      {c.name}
                      {c.projets > 0 && (
                        <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-normal text-ink/70">
                          {c.projets} projet{c.projets > 1 ? 's' : ''}
                        </span>
                      )}
                    </p>
                    {c.company && <p className="mt-0.5 text-xs text-muted">{c.company}</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-ink/80 hover:text-brand">
                          <Mail className="size-3" /> {c.email}
                        </a>
                      ) : (
                        <span className="text-muted">email manquant</span>
                      )}
                      {c.phone ? (
                        <a href={`tel:${c.phone.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-1 text-ink/80 hover:text-brand">
                          <Phone className="size-3" /> {c.phone}
                        </a>
                      ) : (
                        <span className="text-muted">téléphone manquant</span>
                      )}
                      {(c.address || c.city) && (
                        <span className="inline-flex items-center gap-1 text-muted">
                          <MapPin className="size-3" /> {[c.address, c.city].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </p>
                    {c.notes && <p className="mt-2 line-clamp-2 text-[11px] text-muted">{c.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] text-ink/70 hover:border-brand hover:text-brand"
                    >
                      <Pencil className="size-3" /> Modifier
                    </button>
                    <DeleteButton
                      label={`la fiche client « ${c.name} »`}
                      detail={c.projets > 0 ? 'refusé tant que des projets y sont rattachés' : undefined}
                      path={`/api/v1/admin/pm/clients/${c.id}`}
                      invalidate={[['pm-clients'], ['pm-projects']]}
                      title="Supprimer cette fiche client ?"
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2">
                  <label className="text-[11px] text-muted" htmlFor={`link-${c.id}`}>
                    Lier un projet
                  </label>
                  <select
                    id={`link-${c.id}`}
                    className="field !w-auto !py-1 text-[11px]"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) link.mutate({ projectId: e.target.value, clientId: c.id });
                      e.currentTarget.value = '';
                    }}
                    disabled={link.isPending}
                  >
                    <option value="">choisir un projet…</option>
                    {(projects ?? [])
                      .filter((p) => p.client_id !== c.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.reference} · {p.name}
                          {p.client_id ? ' (autre client)' : ''}
                        </option>
                      ))}
                  </select>
                  <Link to="/admin/projets" className="text-[11px] text-brand hover:underline">
                    ou créer un projet →
                  </Link>
                </div>

                {c.proj_list.length > 0 ? (
                  <ul className="mt-3 border-t border-line pt-2">
                    {c.proj_list.map((p) => (
                      <li key={p.id} className="border-t border-line/60 py-2 first:border-t-0 first:pt-0">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 font-mono text-[10px] text-muted">{p.reference}</span>
                          <Link
                            to={`/admin/projets/${p.id}`}
                            className="min-w-0 flex-1 truncate text-xs text-ink hover:text-brand"
                          >
                            {p.name}
                          </Link>
                          <button
                            type="button"
                            onClick={() => link.mutate({ projectId: p.id, clientId: null })}
                            disabled={link.isPending}
                            title="Détacher ce projet du client"
                            className="shrink-0 rounded p-1 text-muted hover:bg-brand/10 hover:text-brand disabled:opacity-40"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-0 text-[10px] text-muted">
                          <span className="rounded-full bg-line px-2 py-0.5 text-ink/70">
                            {STATUS_FR[p.status] ?? p.status}
                          </span>
                          <span className="tabular-nums">
                            {p.tasks_done}/{p.tasks_total} tâche{p.tasks_total > 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-line">
                              <span
                                className="block h-full rounded-full bg-brand"
                                style={{ width: `${Math.min(100, Number(p.progress))}%` }}
                              />
                            </span>
                            <span className="tabular-nums">{Math.round(Number(p.progress))}%</span>
                          </span>
                          {p.due_date && <span>échéance {frDate(p.due_date)}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 border-t border-line pt-2 text-xs text-muted">
                    Aucun projet pour ce client — créez-en un depuis{' '}
                    <Link to="/admin/projets" className="text-brand hover:underline">
                      Projets
                    </Link>
                    .
                  </p>
                )}
              </>
            )}
          </li>
        ))}
        {clients && clients.length === 0 && (
          <li className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Aucun client {search ? 'pour cette recherche' : 'enregistré'}. Créez la première fiche pour
            rattacher vos projets.
          </li>
        )}
      </ul>
    </div>
  );
}
