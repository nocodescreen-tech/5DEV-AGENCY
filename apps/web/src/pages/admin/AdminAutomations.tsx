import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Power } from 'lucide-react';
import { DeleteButton } from '../../components/DeleteButton';
import { apiGet, apiPatch, apiPost, ApiRequestError } from '../../lib/api';
import { frDateTime } from '../../lib/format';
import { useState } from 'react';

type Automation = {
  id: string;
  name: string;
  trigger: string;
  conditions: { field: string; op: string; value?: string }[];
  actions: { type: string; [k: string]: unknown }[];
  is_active: boolean;
  runs: number;
  failures: number;
};

type Run = {
  id: string;
  automation_name: string;
  trigger: string;
  status: 'running' | 'done' | 'failed' | 'skipped';
  steps: { action: string; status: string; detail?: string; ms: number }[];
  error: string | null;
  duration_ms: number | null;
  created_at: string;
};

export default function AdminAutomations() {
  const qc = useQueryClient();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: automations } = useQuery({
    queryKey: ['automations'],
    queryFn: () => apiGet<Automation[]>('/api/v1/admin/automations'),
  });

  const { data: runs } = useQuery({
    queryKey: ['automation-runs'],
    queryFn: () => apiGet<Run[]>('/api/v1/admin/automation-runs'),
    refetchInterval: 30_000,
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiPatch(`/api/v1/admin/automations/${id}`, { is_active: active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['automations'] }),
  });

  const test = useMutation({
    mutationFn: (trigger: string) =>
      apiPost<{ runs: { status: string; name: string; error: string | null; steps: { action: string; status: string; detail?: string }[] }[] }>(
        '/api/v1/admin/automations/test',
        { trigger },
      ),
    onSuccess: (data) => {
      setError(null);
      if (!data.runs.length) {
        setResult('Aucune automatisation active pour ce déclencheur.');
        return;
      }
      setResult(
        data.runs
          .map(
            (r) =>
              `${r.name} → ${r.status}${r.error ? ` (${r.error})` : ''}\n` +
              r.steps.map((s) => `   · ${s.action}: ${s.status}${s.detail ? ` — ${s.detail}` : ''}`).join('\n'),
          )
          .join('\n\n'),
      );
      void qc.invalidateQueries({ queryKey: ['automation-runs'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => {
      setResult(null);
      setError(err instanceof ApiRequestError ? err.message : 'Exécution impossible.');
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-black">Automatisations</h1>
      <p className="mt-1 text-sm text-muted">
        Un déclencheur, des conditions, des actions. Chaque exécution est journalisée, avec garde anti-doublon
        (une règle ne se relance pas deux fois pour le même enregistrement dans la minute).
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="btn-primary !py-2.5"
          disabled={test.isPending}
          onClick={() => test.mutate('lead.created')}
        >
          <Play className="size-4" /> {test.isPending ? 'Exécution…' : 'Tester sur une demande fictive'}
        </button>
      </div>

      {result && (
        <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-wash p-4 text-xs leading-relaxed">{result}</pre>
      )}
      {error && <p className="mt-4 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">{error}</p>}

      <section className="mt-6 space-y-3">
        {(automations ?? []).map((a) => (
          <article key={a.id} className="card p-5">
            <div className="absolute right-4 top-4">
              <DeleteButton
                label={`la règle « ${a.name} »`}
                path={`/api/v1/admin/automations/${a.id}`}
                invalidate={[['automations']]}
              />
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      a.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-line text-muted'
                    }`}
                  >
                    {a.is_active ? 'active' : 'inactive'}
                  </span>
                  <h2 className="font-semibold">{a.name}</h2>
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted">
                  {a.trigger}
                  {a.conditions.length > 0 ? ` · si ${a.conditions.map((c) => `${c.field} ${c.op} ${c.value ?? ''}`).join(' et ')}` : ''}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {a.actions.map((act, i) => (
                    <li key={i} className="rounded bg-wash px-2 py-0.5 text-[11px] text-ink/70">
                      {act.type}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-muted">
                  {a.runs} exécution(s) · {a.failures} échec(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle.mutate({ id: a.id, active: !a.is_active })}
                className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs hover:border-brand hover:text-brand"
              >
                <Power className="size-3.5" /> {a.is_active ? 'Désactiver' : 'Activer'}
              </button>
            </div>
          </article>
        ))}
        {(automations ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Aucune automatisation. Lancez <code className="font-mono">npm run setup</code> pour créer la règle de
            qualification des demandes.
          </p>
        )}
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold">Historique d’exécution</h2>
        </div>
        {(runs ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Aucune exécution enregistrée.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(runs ?? []).map((r) => (
              <li key={r.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{r.automation_name}</span>
                  <span className="text-xs text-muted">
                    {r.status} · {r.duration_ms ?? 0} ms · {frDateTime(r.created_at)}
                  </span>
                </div>
                {r.steps.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {r.steps.map((s, i) => (
                      <li key={i} className="text-[11px] text-muted">
                        {s.action} → {s.status}
                        {s.detail ? ` — ${s.detail}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {r.error && <p className="mt-1 text-[11px] text-brand">{r.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
