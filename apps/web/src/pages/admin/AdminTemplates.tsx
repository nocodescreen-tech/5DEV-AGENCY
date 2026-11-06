import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2, Plus, Trash2 } from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut, ApiRequestError } from '../../lib/api';
import { useToast } from '../../components/Toaster';

type Template = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  stages: { name: string; description?: string; weight?: number }[];
  is_active: boolean;
};

export default function AdminTemplates() {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', category: 'dev-web', stages: 'Analyse:2\nDesign:2\nDéveloppement:4\nTests:2\nLivraison:1' });

  const { data, isPending } = useQuery({
    queryKey: ['pm-templates-admin'],
    queryFn: () => apiGet<Template[]>('/api/v1/admin/pm/templates'),
  });

  const parse = () =>
    form.stages
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [name = '', weight] = l.split(':');
        return { name: name.trim(), weight: Number(weight) || 1 };
      })
      .filter((s) => s.name.length >= 2);

  const create = useMutation({
    mutationFn: () => apiPost('/api/v1/admin/pm/templates', { name: form.name, category: form.category, stages: parse() }),
    onSuccess: () => {
      setForm({ ...form, name: '' });
      toast.push('success', 'Modèle créé.');
      void qc.invalidateQueries({ queryKey: ['pm-templates-admin'] });
      void qc.invalidateQueries({ queryKey: ['pm-templates'] });
    },
    onError: (e) => toast.push('error', e instanceof ApiRequestError ? e.message : 'Création impossible.'),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => apiPost(`/api/v1/admin/pm/templates/${id}/duplicate`),
    onSuccess: () => {
      toast.push('success', 'Modèle dupliqué.');
      void qc.invalidateQueries({ queryKey: ['pm-templates-admin'] });
      void qc.invalidateQueries({ queryKey: ['pm-templates'] });
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v1/admin/pm/templates/${id}`),
    onSuccess: () => {
      toast.push('success', 'Modèle archivé (les projets existants gardent leurs étapes).');
      void qc.invalidateQueries({ queryKey: ['pm-templates-admin'] });
      void qc.invalidateQueries({ queryKey: ['pm-templates'] });
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiPut(`/api/v1/admin/pm/templates/${id}`, { is_active: active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pm-templates-admin'] }),
  });

  return (
    <div>
      <h1 className="text-2xl font-black">Modèles de projets</h1>
      <p className="mt-1 text-sm text-muted">
        Un modèle décrit le cycle de vie : les étapes générées à la création d’un projet viennent d’ici.
        Aucune étape n’est codée en dur.
      </p>

      <form
        className="mt-5 card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.name.length >= 2 && parse().length > 0) create.mutate();
        }}
      >
        <h2 className="font-semibold">Nouveau modèle</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px]">
          <div>
            <label className="label" htmlFor="t-name">
              Nom
            </label>
            <input
              id="t-name"
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Refonte e-commerce"
            />
          </div>
          <div>
            <label className="label" htmlFor="t-cat">
              Catégorie
            </label>
            <select id="t-cat" className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="dev-web">Développement web</option>
              <option value="app-web">Application web</option>
              <option value="photo">Photographie</option>
              <option value="marketing">Marketing</option>
              <option value="infra">Infrastructure</option>
              <option value="interne">Projet interne</option>
              <option value="recherche">Recherche</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className="label" htmlFor="t-stages">
            Étapes — une par ligne, « nom:poids » (poids 1 à 10, sert à la progression)
          </label>
          <textarea
            id="t-stages"
            className="field min-h-28 font-mono text-xs"
            value={form.stages}
            onChange={(e) => setForm({ ...form, stages: e.target.value })}
          />
        </div>
        <button type="submit" className="btn-primary mt-4 !py-2.5" disabled={create.isPending || form.name.length < 2}>
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Créer le modèle
        </button>
      </form>

      {isPending && <p className="mt-6 text-sm text-muted">Chargement…</p>}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {(data ?? []).map((t) => (
          <article key={t.id} className={`card p-5 ${t.is_active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{t.name}</h2>
                <p className="text-[11px] uppercase tracking-wider text-muted">
                  {t.category ?? 'sans catégorie'} · {t.stages.length} étapes
                  {t.is_active ? '' : ' · archivé'}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Dupliquer"
                  className="rounded-md p-1.5 text-muted hover:text-brand"
                  onClick={() => duplicate.mutate(t.id)}
                >
                  <Copy className="size-3.5" />
                </button>
                {t.is_active && (
                  <button
                    type="button"
                    aria-label="Archiver"
                    className="rounded-md p-1.5 text-muted hover:text-brand"
                    onClick={() => archive.mutate(t.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            <ol className="mt-3 space-y-1">
              {t.stages.map((s, i) => (
                <li key={`${t.id}-${i}`} className="flex items-center justify-between rounded bg-wash px-2 py-1 text-xs">
                  <span>
                    <span className="text-muted">{String(i + 1).padStart(2, '0')}</span> {s.name}
                  </span>
                  <span className="text-[10px] text-muted">poids {s.weight ?? 1}</span>
                </li>
              ))}
            </ol>

            {!t.is_active && (
              <button
                type="button"
                className="mt-3 text-xs text-brand hover:underline"
                onClick={() => toggle.mutate({ id: t.id, active: true })}
              >
                Réactiver ce modèle
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
