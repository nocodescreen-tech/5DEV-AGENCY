import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Send } from 'lucide-react';
import { apiGet, apiPost, ApiRequestError } from '../../lib/api';
import { frDateTime } from '../../lib/format';

type Outbox = {
  id: string;
  to_email: string;
  subject: string;
  status: 'queued' | 'sent' | 'failed';
  provider: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
};

type Data = {
  provider: { provider: string; ready: boolean; from: string; environment: string };
  outbox: Outbox[];
  stats: { queued: number; sent: number; failed: number; jobs: number };
};

export default function AdminEmails() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ to: '', subject: '', body: '' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['emails'],
    queryFn: () => apiGet<Data>('/api/v1/admin/emails'),
    refetchInterval: 30_000,
  });

  const test = useMutation({
    mutationFn: () => apiPost<{ to: string; providerId: string | null }>('/api/v1/admin/email-test'),
    onSuccess: (r) => {
      setError(null);
      setFeedback(`Email de test envoyé à ${r.to} (id ${r.providerId ?? 'n/a'}).`);
      void qc.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: (err) => {
      setFeedback(null);
      setError(err instanceof ApiRequestError ? err.message : 'Envoi impossible.');
    },
  });

  const send = useMutation({
    mutationFn: () => apiPost('/api/v1/admin/emails/send', form),
    onSuccess: () => {
      setError(null);
      setFeedback(`Message envoyé à ${form.to}.`);
      setForm({ to: '', subject: '', body: '' });
      void qc.invalidateQueries({ queryKey: ['emails'] });
    },
    onError: (err) => {
      setFeedback(null);
      setError(err instanceof ApiRequestError ? err.message : 'Envoi impossible.');
    },
  });

  const stats = data?.stats;

  return (
    <div>
      <h1 className="text-2xl font-black">Emails</h1>
      <p className="mt-1 text-sm text-muted">
        Transport réel via Brevo. L’IA rédige, elle n’envoie jamais : chaque envoi part d’ici ou d’une automatisation validée.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Fournisseur</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium">
            {data?.provider.ready ? (
              <>
                <CheckCircle2 className="size-4 text-emerald-600" /> {data.provider.provider}
              </>
            ) : (
              <>
                <AlertTriangle className="size-4 text-brand" /> non configuré
              </>
            )}
          </p>
          <p className="mt-1 truncate text-[11px] text-muted">{data?.provider.from}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Envoyés</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{stats?.sent ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">En échec</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{stats?.failed ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Tâches en file</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{stats?.jobs ?? 0}</p>
        </div>
      </div>

      {data && !data.provider.ready && (
        <p className="mt-4 rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">
          <code className="font-mono">BREVO_API_KEY</code> absente : aucun envoi ne sera effectué.
          Les tentatives sont journalisées en échec, jamais simulées en succès.
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Envoyer un email</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="e-to">
                Destinataire
              </label>
              <input
                id="e-to"
                type="email"
                className="field"
                value={form.to}
                onChange={(e) => setForm({ ...form, to: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="e-subject">
                Objet
              </label>
              <input
                id="e-subject"
                className="field"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="e-body">
                Message (texte, mis en page automatiquement)
              </label>
              <textarea
                id="e-body"
                className="field min-h-28"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-primary !py-2.5"
                disabled={send.isPending || !form.to || !form.subject || form.body.length < 5}
                onClick={() => send.mutate()}
              >
                <Send className="size-4" /> {send.isPending ? 'Envoi…' : 'Envoyer'}
              </button>
              <button
                type="button"
                className="btn-ghost !py-2.5"
                disabled={test.isPending}
                onClick={() => test.mutate()}
              >
                {test.isPending ? 'Test…' : 'Envoyer un test au studio'}
              </button>
            </div>
            {feedback && <p className="text-sm text-emerald-700">{feedback}</p>}
            {error && <p className="rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">{error}</p>}
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-semibold">Journal d’envoi</h2>
          </div>
          {(data?.outbox ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Aucun email envoyé pour l’instant.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line overflow-auto">
              {(data?.outbox ?? []).map((m) => (
                <li key={m.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium">{m.subject}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                        m.status === 'sent'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.status === 'failed'
                            ? 'bg-brand/15 text-brand'
                            : 'bg-line text-muted'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">
                    {m.to_email} · {frDateTime(m.sent_at ?? m.created_at)}
                  </p>
                  {m.error && <p className="mt-1 text-[11px] text-brand">{m.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
