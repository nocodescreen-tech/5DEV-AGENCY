import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { Category, Service } from '../../lib/types';
import { slugify } from '../../lib/format';

type Draft = {
  id?: string;
  title: string;
  slug: string;
  category_id: string;
  summary: string;
  deliverables: string;
  duration_label: string;
  price_note: string;
  is_published: boolean;
};

const empty = (categoryId: string): Draft => ({
  title: '',
  slug: '',
  category_id: categoryId,
  summary: '',
  deliverables: '',
  duration_label: '',
  price_note: 'Sur devis',
  is_published: true,
});

export default function AdminServices() {
  const [toDelete, setToDelete] = useState<{ id: string; label: string } | null>(null);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);

  const { data: catalog } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiGet<{ categories: Category[]; services: Service[] }>('/api/v1/services'),
  });

  const { data: allServices, isPending } = useQuery({
    queryKey: ['admin-services'],
    queryFn: () => apiGet<Service[]>('/api/v1/admin/services'),
  });

  const categories = catalog?.categories ?? [];

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const payload = {
        slug: d.slug || slugify(d.title),
        title: d.title,
        category_id: d.category_id || null,
        summary: d.summary,
        deliverables: d.deliverables
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        duration_label: d.duration_label || null,
        price_note: d.price_note || 'Sur devis',
        is_published: d.is_published,
      };
      return d.id
        ? apiPatch(`/api/v1/admin/services/${d.id}`, payload)
        : apiPost('/api/v1/admin/services', payload);
    },
    onSuccess: () => {
      setDraft(null);
      void qc.invalidateQueries({ queryKey: ['admin-services'] });
      void qc.invalidateQueries({ queryKey: ['services'] });
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Services</h1>
          <p className="mt-1 text-sm text-muted">Catalogue affiché sur le site.</p>
        </div>
        <button
          type="button"
          className="btn-primary !px-4 !py-2.5 text-sm"
          onClick={() => setDraft(empty(categories[0]?.id ?? ''))}
          disabled={!categories.length}
        >
          <Plus className="size-4" /> Nouveau service
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
              <label className="label" htmlFor="s-title">
                Titre
              </label>
              <input
                id="s-title"
                className="field"
                required
                value={draft.title}
                onChange={(e) =>
                  setDraft({ ...draft, title: e.target.value, slug: draft.slug || slugify(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="s-cat">
                Pôle
              </label>
              <select
                id="s-cat"
                className="field"
                value={draft.category_id}
                onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}
              >
                <option value="">— sans pôle —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="s-summary">
                Résumé (1 phrase)
              </label>
              <input
                id="s-summary"
                className="field"
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="s-deliv">
                Livrables (séparés par des virgules)
              </label>
              <input
                id="s-deliv"
                className="field"
                value={draft.deliverables}
                onChange={(e) => setDraft({ ...draft, deliverables: e.target.value })}
                placeholder="Maquette validée, Site responsive, Mise en ligne"
              />
            </div>
            <div>
              <label className="label" htmlFor="s-duration">
                Durée
              </label>
              <input
                id="s-duration"
                className="field"
                value={draft.duration_label}
                onChange={(e) => setDraft({ ...draft, duration_label: e.target.value })}
                placeholder="2 à 6 semaines"
              />
            </div>
            <div>
              <label className="label" htmlFor="s-price">
                Mention de prix
              </label>
              <input
                id="s-price"
                className="field"
                value={draft.price_note}
                onChange={(e) => setDraft({ ...draft, price_note: e.target.value })}
              />
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.is_published}
              onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })}
            />
            Publié sur le site
          </label>

          {save.isError && (
            <p className="mt-3 text-sm text-brand">Enregistrement impossible (slug déjà utilisé ?).</p>
          )}

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

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-2 pr-3">Service</th>
              <th className="py-2 pr-3">Pôle</th>
              <th className="py-2 pr-3">Durée</th>
              <th className="py-2 pr-3">Prix</th>
              <th className="py-2 pr-3">État</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(allServices ?? []).map((s) => (
              <tr key={s.id} className="border-b border-line/60">
                <td className="py-3 pr-3">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-muted">{s.summary}</p>
                </td>
                <td className="py-3 pr-3 text-xs">
                  {categories.find((c) => c.id === s.category_id)?.name ?? '—'}
                </td>
                <td className="py-3 pr-3 text-xs">{s.duration_label ?? '—'}</td>
                <td className="py-3 pr-3 text-xs">{s.price_note ?? 'Sur devis'}</td>
                <td className="py-3 pr-3 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 ${s.is_published ? 'bg-green-100 text-green-800' : 'bg-line text-muted'}`}
                  >
                    {s.is_published ? 'publié' : 'brouillon'}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-label={`Modifier ${s.title}`}
                      className="text-ink/60 hover:text-brand"
                      onClick={() =>
                        setDraft({
                          id: s.id,
                          title: s.title,
                          slug: s.slug,
                          category_id: s.category_id ?? '',
                          summary: s.summary,
                          deliverables: s.deliverables.join(', '),
                          duration_label: s.duration_label ?? '',
                          price_note: s.price_note ?? 'Sur devis',
                          is_published: s.is_published ?? true,
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Supprimer ${s.title}`}
                      className="text-ink/60 hover:text-brand"
                      onClick={() => {
                        setToDelete({ id: s.id, label: s.title });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {allServices && allServices.length === 0 && (
          <p className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Aucun service. Créez le premier.
          </p>
        )}
      </div>
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Supprimer ce service ?"
        description={
          <>
            «&nbsp;{toDelete?.label}&nbsp;» sera retiré du catalogue. Les demandes déjà reçues qui y font
            référence sont conservées.
          </>
        }
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await apiDelete(`/api/v1/admin/services/${toDelete.id}`);
          await qc.invalidateQueries({ queryKey: ['admin-services'] });
          setToDelete(null);
        }}
      />
    </div>
  );
}