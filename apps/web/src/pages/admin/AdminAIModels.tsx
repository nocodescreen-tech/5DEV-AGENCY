import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, Loader2, ShieldCheck, Trash2, XCircle, Zap } from 'lucide-react';
import { apiDelete, apiGet, apiPost, apiPut, ApiRequestError } from '../../lib/api';
import { useToast } from '../../components/Toaster';

type Slot = {
  slot: 'general' | 'reasoning' | 'code' | 'fast' | 'multimodal';
  label: string;
  model_id: string | null;
  capabilities: string[];
  context_window: number | null;
  status: 'verified' | 'unverified' | 'unavailable' | 'disabled';
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  last_checked_at: string | null;
  last_error: string | null;
};

const SLOT_HELP: Record<Slot['slot'], string> = {
  general: 'Rédaction, réponses polyvalentes, synthèses.',
  reasoning: 'Analyse, plans, raisonnement multi-étapes.',
  code: 'Code, revue, extraction structurée.',
  fast: 'Tâches courtes, classification, résumés.',
  multimodal: 'Si le compte expose un modèle image + texte.',
};

const STATUS_STYLE: Record<Slot['status'], string> = {
  verified: 'bg-emerald-100 text-emerald-800',
  unverified: 'bg-amber-100 text-amber-800',
  unavailable: 'bg-brand/15 text-brand',
  disabled: 'bg-line text-muted',
};

export default function AdminAIModels() {
  const qc = useQueryClient();
  const toast = useToast();
  const [keyInput, setKeyInput] = useState('');
  const [catalog, setCatalog] = useState<string[] | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => apiGet<{ models: Slot[]; key: { configured: boolean; source: string; hint: string | null; updated_at: string | null } }>(
      '/api/v1/admin/ai/models',
    ),
  });

  const saveKey = useMutation({
    mutationFn: () => apiPut('/api/v1/admin/ai/key', { api_key: keyInput.trim() }),
    onSuccess: () => {
      setKeyInput('');
      toast.push('success', 'Clé enregistrée chiffrée. Elle n’est jamais renvoyée au navigateur.');
      void qc.invalidateQueries({ queryKey: ['ai-models'] });
    },
    onError: (e) => toast.push('error', e instanceof ApiRequestError ? e.message : 'Enregistrement impossible.'),
  });

  const removeKey = useMutation({
    mutationFn: () => apiDelete('/api/v1/admin/ai/key'),
    onSuccess: () => {
      toast.push('success', 'Clé supprimée.');
      void qc.invalidateQueries({ queryKey: ['ai-models'] });
    },
  });

  const saveSlot = useMutation({
    mutationFn: ({ slot, body }: { slot: string; body: Record<string, unknown> }) =>
      apiPut(`/api/v1/admin/ai/models/${slot}`, body),
    onSuccess: () => {
      toast.push('success', 'Emplacement enregistré.');
      void qc.invalidateQueries({ queryKey: ['ai-models'] });
    },
    onError: (e) => toast.push('error', e instanceof ApiRequestError ? e.message : 'Échec.'),
  });

  const testSlot = useMutation({
    mutationFn: (slot: string) => apiPost<{ status: string; latencyMs: number; error?: string }>(`/api/v1/admin/ai/models/${slot}/test`),
    onSuccess: (r, slot) => {
      if (r.status === 'verified') toast.push('success', `${slot} vérifié — ${r.latencyMs} ms`);
      else toast.push('error', r.error ?? 'Test échoué.');
      void qc.invalidateQueries({ queryKey: ['ai-models'] });
    },
    onError: (e) => toast.push('error', e instanceof ApiRequestError ? e.message : 'Test impossible.'),
  });

  const sync = useMutation({
    mutationFn: () => apiPost<{ count: number; models: string[] }>('/api/v1/admin/ai/models/sync'),
    onSuccess: (r) => {
      setCatalog(r.models);
      toast.push('success', `${r.count} modèles accessibles avec cette clé.`);
    },
    onError: (e) => {
      setCatalog(null);
      toast.push('error', e instanceof ApiRequestError ? e.message : 'Catalogue injoignable.');
    },
  });

  if (isPending) return <p className="text-sm text-muted">Chargement…</p>;

  const key = data?.key;

  return (
    <div>
      <h1 className="text-2xl font-black">IA &amp; modèles</h1>
      <p className="mt-1 text-sm text-muted">
        Cinq emplacements, une clé, aucune exposition navigateur. Toute requête passe par l’AI Gateway du backend.
      </p>

      {/* ------------------------------------------------------------- clé */}
      <section className="card mt-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <KeyRound className="size-4 text-brand" /> Clé NVIDIA
            </h2>
            <p className="mt-1 text-xs text-muted">
              Chiffrée au repos (AES-256-GCM). Seul le serveur la déchiffre, au moment de l’appel.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
              key?.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {key?.configured ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
            {key?.configured ? `configurée (${key.source})` : 'non configurée'}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1">
            <label className="label" htmlFor="nvidia-key">
              Nouvelle clé (nvapi-…)
            </label>
            <input
              id="nvidia-key"
              type="password"
              autoComplete="off"
              className="field font-mono text-xs"
              placeholder="coller la clé puis enregistrer"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-primary !py-2.5"
            disabled={keyInput.trim().length < 20 || saveKey.isPending}
            onClick={() => saveKey.mutate()}
          >
            {saveKey.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Enregistrer
          </button>
          {key?.configured && (
            <button
              type="button"
              className="btn-ghost !py-2.5 text-xs"
              onClick={() => {
                if (confirm('Supprimer la clé NVIDIA du serveur ?')) removeKey.mutate();
              }}
            >
              <Trash2 className="size-3.5" /> Supprimer
            </button>
          )}
        </div>

        {key?.hint && <p className="mt-2 font-mono text-[11px] text-muted">indice : {key.hint}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button type="button" className="btn-ghost !py-2 text-xs" disabled={!key?.configured || sync.isPending} onClick={() => sync.mutate()}>
            {sync.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
            Vérifier le catalogue accessible
          </button>
          {catalog && <span className="text-[11px] text-muted">{catalog.length} modèles renvoyés par /v1/models</span>}
        </div>

        {catalog && catalog.length > 0 && (
          <div className="mt-3 max-h-40 overflow-auto rounded-lg border border-line bg-wash p-2">
            <ul className="grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-2">
              {catalog.slice(0, 60).map((m) => (
                <li key={m} className="truncate font-mono text-ink/70">
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- slots */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {(data?.models ?? []).map((m) => (
          <ModelCard
            key={m.slot}
            model={m}
            onSave={(body) => saveSlot.mutate({ slot: m.slot, body })}
            onTest={() => testSlot.mutate(m.slot)}
            testing={testSlot.isPending && testSlot.variables === m.slot}
          />
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Les endpoints gratuits NVIDIA servent au prototypage : les quotas et l’autorisation d’usage commercial
        dépendent du compte et du modèle. Cet écran enregistre la date de dernière vérification et le statut réel
        de chaque emplacement — aucun modèle n’est affiché comme « vérifié » sans un appel réussi.
      </p>
    </div>
  );
}

function ModelCard({
  model,
  onSave,
  onTest,
  testing,
}: {
  model: Slot;
  onSave: (body: Record<string, unknown>) => void;
  onTest: () => void;
  testing: boolean;
}) {
  const [modelId, setModelId] = useState(model.model_id ?? '');
  const [context, setContext] = useState(model.context_window ? String(model.context_window) : '');

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Emplacement</p>
          <h2 className="font-semibold">{model.label}</h2>
          <p className="mt-0.5 text-xs text-muted">{SLOT_HELP[model.slot]}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_STYLE[model.status]}`}>{model.status}</span>
      </div>

      <div className="mt-3 space-y-2">
        <input
          className="field font-mono text-xs"
          placeholder="meta/llama-3.1-8b-instruct"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          aria-label={`Identifiant du modèle ${model.label}`}
        />
        <div className="flex gap-2">
          <input
            className="field !w-32 text-xs"
            placeholder="context"
            inputMode="numeric"
            value={context}
            onChange={(e) => setContext(e.target.value.replace(/\D/g, ''))}
            aria-label="Context window"
          />
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              defaultChecked={model.is_default}
              onChange={(e) => onSave({ model_id: modelId || null, is_default: e.target.checked })}
            />
            par défaut
          </label>
        </div>
      </div>

      {model.last_error && <p className="mt-2 text-[11px] text-brand">{model.last_error}</p>}
      {model.last_checked_at && (
        <p className="mt-1 text-[10px] text-muted">
          dernière vérification : {new Date(model.last_checked_at).toLocaleString('fr-FR')}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary !px-3 !py-2 text-xs"
          onClick={() => onSave({ model_id: modelId || null, context_window: context ? Number(context) : null })}
        >
          Enregistrer
        </button>
        <button type="button" className="btn-ghost !px-3 !py-2 text-xs" onClick={onTest} disabled={!modelId || testing}>
          {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
          Tester l’appel
        </button>
      </div>
    </section>
  );
}
