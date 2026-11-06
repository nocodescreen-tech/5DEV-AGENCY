import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Play } from 'lucide-react';
import { apiGet, apiPost, ApiRequestError } from '../../lib/api';
import { frDateTime } from '../../lib/format';

type Status = {
  ready: boolean;
  environment: string;
  provider: string;
  models: string[];
  modelsError: string | null;
  tasks: { task: string; label: string; description: string; models: string[] }[];
  usage: { total: number; ok: number; failed: number; avgLatencyMs: number | null; last24h: number };
};

type UsageRow = {
  id: number;
  task: string;
  provider: string;
  model: string;
  latency_ms: number | null;
  ok: boolean;
  error: string | null;
  created_at: string;
};

export default function AdminAI() {
  const [task, setTask] = useState('classify_lead');
  const [input, setInput] = useState(
    'Bonjour, je cherche quelqu’un pour photographier mon mariage en décembre, budget limité.',
  );
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => apiGet<Status>('/api/v1/admin/ai/status'),
    refetchInterval: 60_000,
  });

  const { data: usage } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => apiGet<UsageRow[]>('/api/v1/admin/ai/usage'),
  });

  const run = useMutation({
    mutationFn: () => apiPost<{ text: string; model: string; provider: string; latencyMs: number; stubbed: boolean }>(
      '/api/v1/admin/ai/run',
      { task, input },
    ),
    onSuccess: (data) => {
      setError(null);
      setResult(
        `${data.stubbed ? '[MODE SANS FOURNISSEUR — clé NVIDIA absente]\n' : ''}${data.text}\n\n— ${data.provider} · ${data.model} · ${data.latencyMs} ms`,
      );
    },
    onError: (err) => {
      setResult(null);
      setError(err instanceof ApiRequestError ? err.message : 'Appel IA impossible.');
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-black">Intelligence artificielle</h1>
      <p className="mt-1 text-sm text-muted">
        Passerelle unique (AI Gateway) vers NVIDIA NIM. Aucune clé n’est exposée au navigateur.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Fournisseur</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium">
            {status?.ready ? (
              <>
                <CheckCircle2 className="size-4 text-emerald-600" /> NVIDIA NIM configuré
              </>
            ) : (
              <>
                <AlertTriangle className="size-4 text-brand" /> clé absente
              </>
            )}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Modèles accessibles</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{status?.models.length ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Appels (24 h)</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{status?.usage.last24h ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Latence moyenne</p>
          <p className="mt-2 text-2xl font-black tabular-nums">
            {status?.usage.avgLatencyMs ? `${status.usage.avgLatencyMs} ms` : '—'}
          </p>
        </div>
      </div>

      {status && !status.ready && (
        <p className="mt-4 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
          Aucune clé <code className="font-mono">NVIDIA_API_KEY</code> n’est configurée. Les tâches
          renvoient un repli déterministe explicitement marqué, jamais une fausse réponse IA.
          Ajoutez la clé dans <code className="font-mono">.env</code> puis redémarrez l’API.
        </p>
      )}
      {status?.modelsError && (
        <p className="mt-3 rounded-lg border border-line p-3 text-xs text-muted">
          Liste des modèles indisponible : {status.modelsError}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Tester une tâche</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="ai-task">
                Tâche
              </label>
              <select id="ai-task" className="field" value={task} onChange={(e) => setTask(e.target.value)}>
                {(status?.tasks ?? []).map((t) => (
                  <option key={t.task} value={t.task}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ai-input">
                Texte à traiter
              </label>
              <textarea
                id="ai-input"
                className="field min-h-24"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-primary !py-2.5"
              disabled={run.isPending || input.trim().length < 3}
              onClick={() => run.mutate()}
            >
              <Play className="size-4" /> {run.isPending ? 'Exécution…' : 'Exécuter la tâche'}
            </button>

            {error && <p className="rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">{error}</p>}
            {result && (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-wash p-3 text-xs leading-relaxed">
                {result}
              </pre>
            )}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Registre des tâches</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {(status?.tasks ?? []).map((t) => (
              <li key={t.task} className="py-3">
                <p className="font-medium">{t.label}</p>
                <p className="text-xs text-muted">{t.description}</p>
                <p className="mt-1 font-mono text-[10px] text-muted">{t.models.join(' → ')}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold">Journal d’utilisation</h2>
          <p className="mt-1 text-xs text-muted">
            Chaque appel est tracé (modèle, latence, succès, erreur) : base du suivi de quotas et de coûts.
          </p>
        </div>
        {(usage ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Aucun appel enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-2">Tâche</th>
                  <th className="px-3 py-2">Modèle</th>
                  <th className="px-3 py-2">Latence</th>
                  <th className="px-3 py-2">État</th>
                  <th className="px-5 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {(usage ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-line/60">
                    <td className="px-5 py-2 font-mono text-[11px]">{u.task}</td>
                    <td className="px-3 py-2 text-xs">{u.model}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{u.latency_ms ?? 0} ms</td>
                    <td className="px-3 py-2 text-xs">
                      {u.ok ? (
                        <span className="text-emerald-700">ok</span>
                      ) : (
                        <span className="text-brand" title={u.error ?? ''}>
                          échec
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-xs text-muted">{frDateTime(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
