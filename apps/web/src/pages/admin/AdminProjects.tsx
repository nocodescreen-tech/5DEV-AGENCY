import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { Category, Project } from '../../lib/types';
import { slugify } from '../../lib/format';

type Draft = {
  id?: string;
  title: string;
  slug: string;
  client_name: string;
  year: string;
  category_id: string;
  summary: string;
  body: string;
  cover_url: string;
  live_url: string;
  is_published: boolean;
};

const empty = (categoryId: string): Draft => ({
  title: '',
  slug: '',
  client_name: '',
  year: String(new Date().getFullYear()),
  category_id: categoryId,
  summary: '',
  body: '',
  cover_url: '',
  live_url: '',
  is_published: false,
});

export default function AdminProjects() {
  const [toDelete, setToDelete] = useState<{ id: string; label: string } | null>(null);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);

  const { data: catalog } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiGet<{ categories: Category[] }>('/api/v1/services'),
  });
  const { data: projects, isPending } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: () => apiGet<Project[]>('/api/v1/admin/projects'),
  });

  const categories = catalog?.categories ?? [];

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const payload = {
        slug: d.slug || slugify(d.title),
        title: d.title,
        client_name: d.client_name || null,
        year: d.year ? Number(d.year) : null,
        category_id: d.category_id || null,
        summary: d.summary,
        body: d.body,
        cover_url: d.cover_url || null,
        live_url: d.live_url || null,
        is_published: d.is_published,
      };
      return d.id
        ? apiPatch(`/api/v1/admin/projects/${d.id}`, payload)
        : apiPost('/api/v1/admin/projects', payload);
    },
    onSuccess: () => {
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ['admin-projects'] });
      void qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Réalisations</h1>
          <p className="mt-1 text-sm text-muted">
            Publiez uniquement des projets livrés et autorisés par le client.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary !px-4 !py-2.5 text-sm"
          onClick={() => setDraft(empty(categories[0]?.id ?? ''))}
        >
          <Plus className="size-4" /> Nouvelle réalisation
        </button>
      </div>

      {draft && (
        <form
          className="mt-6 card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(draft);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="p-title">
                Titre
              </label>
              <input
                id="p-title"
                className="field"
                required
                value={draft.title}
                onChange={(e) =>
                  setDraft({ ...draft, title: e.target.value, slug: draft.slug || slugify(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="p-client">
                Client
              </label>
              <input
                id="p-client"
                className="field"
                value={draft.client_name}
                onChange={(e) => setDraft({ ...draft, client_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="p-cat">
                Pôle
              </label>
              <select
                id="p-cat"
                className="field"
                value={draft.category_id}
                onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="p-year">
                Année
              </label>
              <input
                id="p-year"
                className="field"
                inputMode="numeric"
                value={draft.year}
                onChange={(e) => setDraft({ ...draft, year: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="p-summary">
                Résumé
              </label>
              <input
                id="p-summary"
                className="field"
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="p-body">
                Description
              </label>
              <textarea
                id="p-body"
                className="field min-h-28"
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder="Contexte, ce qui a été réalisé, résultat."
              />
            </div>
            <div>
              <label className="label" htmlFor="p-cover">
                URL du visuel
              </label>
              <input
                id="p-cover"
                className="field"
                type="url"
                value={draft.cover_url}
                onChange={(e) => setDraft({ ...draft, cover_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="label" htmlFor="p-live">
                URL du site livré
              </label>
              <input
                id="p-live"
                className="field"
                type="url"
                value={draft.live_url}
                onChange={(e) => setDraft({ ...draft, live_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.is_published}
              onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })}
            />
            Publier sur le site
          </label>

          {save.isError && <p className="mt-3 text-sm text-brand">Enregistrement impossible (slug pris ?).</p>}

          <div className="mt-5 flex gap-3">
            <button type="submit" className="btn-primary !py-2.5" disabled={save.isPending}>
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="btn-ghost !py-2.5" onClick={() => setDraft(null)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {isPending && <p className="mt-8 text-sm text-muted">Chargement…</p>}

      <ul className="mt-6 space-y-3">
        {(projects ?? []).map((p) => (
          <li key={p.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${p.is_published ? 'bg-green-100 text-green-800' : 'bg-line text-muted'}`}
                >
                  {p.is_published ? 'publié' : 'brouillon'}
                </span>
                <p className="font-medium">{p.title}</p>
                {p.year && <span className="text-xs text-muted">{p.year}</span>}
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-muted">{p.summary}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label={`Modifier ${p.title}`}
                className="text-ink/60 hover:text-brand"
                onClick={() =>
                  setDraft({
                    id: p.id,
                    title: p.title,
                    slug: p.slug,
                    client_name: p.client_name ?? '',
                    year: p.year ? String(p.year) : '',
                    category_id: '',
                    summary: p.summary,
                    body: p.body ?? '',
                    cover_url: p.cover_url ?? '',
                    live_url: p.live_url ?? '',
                    is_published: p.is_published ?? false,
                  })
                }
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Supprimer ${p.title}`}
                className="text-ink/60 hover:text-brand"
                onClick={() => {
                  setToDelete({ id: p.id, label: p.title });
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
        {projects && projects.length === 0 && (
          <li className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Aucune réalisation. La page publique affichera un état vide honnête jusqu’à publication.
          </li>
        )}
      </ul>
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Supprimer cette réalisation ?"
        description={
          <>
            «&nbsp;{toDelete?.label}&nbsp;» sera retirée du portfolio public. Cette action est définitive.
          </>
        }
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await apiDelete(`/api/v1/admin/projects/${toDelete.id}`);
          await qc.invalidateQueries({ queryKey: ['admin-projects'] });
          setToDelete(null);
        }}
      />
    </div>
  );
}
