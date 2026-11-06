import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { apiGet, apiPost, ApiRequestError } from '../../lib/api';
import { frDateTime } from '../../lib/format';

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  status: 'pending' | 'confirmed' | 'unsubscribed' | 'bounced';
  created_at: string;
  confirmed_at: string | null;
};

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  sent_at: string | null;
  created_at: string;
  sent: number;
  failed: number;
};

export default function AdminNewsletter() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', subject: '', html: '' });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: subs } = useQuery({
    queryKey: ['subscribers'],
    queryFn: () => apiGet<{ subscribers: Subscriber[]; counts: Record<string, number> }>('/api/v1/admin/subscribers'),
  });

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => apiGet<Campaign[]>('/api/v1/admin/campaigns'),
  });

  const create = useMutation({
    mutationFn: () => apiPost('/api/v1/admin/campaigns', form),
    onSuccess: () => {
      setError(null);
      setFeedback('Campagne créée en brouillon. Aucun envoi tant que vous ne lancez pas.');
      setForm({ name: '', subject: '', html: '' });
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Création impossible.'),
  });

  const send = useMutation({
    mutationFn: (id: string) => apiPost<{ sent: number; failed: number; recipients: number }>(`/api/v1/admin/campaigns/${id}/send`),
    onSuccess: (r) => {
      setError(null);
      setFeedback(`Envoi terminé : ${r.sent}/${r.recipients} messages acceptés par le fournisseur, ${r.failed} échec(s).`);
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Envoi impossible.'),
  });

  const counts = subs?.counts ?? {};

  return (
    <div>
      <h1 className="text-2xl font-black">Newsletter</h1>
      <p className="mt-1 text-sm text-muted">
        Envoi uniquement aux abonnés confirmés (double opt-in). Le lien de désinscription est ajouté automatiquement.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Confirmés</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{counts.confirmed ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">En attente</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{counts.pending ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Désinscrits</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{counts.unsubscribed ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wider text-muted">Campagnes</p>
          <p className="mt-2 text-2xl font-black tabular-nums">{(campaigns ?? []).length}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Nouvelle campagne</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="n-name">
                Nom interne
              </label>
              <input id="n-name" className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="n-subject">
                Objet
              </label>
              <input
                id="n-subject"
                className="field"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="n-html">
                Contenu HTML (utilisez <code className="font-mono">{'{{unsubscribe_url}}'}</code> pour le lien de désinscription)
              </label>
              <textarea
                id="n-html"
                className="field min-h-32 font-mono text-xs"
                value={form.html}
                onChange={(e) => setForm({ ...form, html: e.target.value })}
                placeholder="<p>Bonjour,</p><p>…</p>"
              />
            </div>
            <button
              type="button"
              className="btn-primary !py-2.5"
              disabled={create.isPending || form.name.length < 2 || form.subject.length < 2 || form.html.length < 20}
              onClick={() => create.mutate()}
            >
              Créer le brouillon
            </button>
            {feedback && <p className="text-sm text-emerald-700">{feedback}</p>}
            {error && <p className="rounded-lg border border-brand/40 bg-brand/5 p-3 text-sm">{error}</p>}
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-semibold">Campagnes</h2>
          </div>
          {(campaigns ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Aucune campagne.</p>
          ) : (
            <ul className="divide-y divide-line">
              {(campaigns ?? []).map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.subject}</p>
                      <p className="text-xs text-muted">
                        {c.name} · {c.status}
                        {c.sent > 0 ? ` · ${c.sent} envoyé(s)` : ''}
                        {c.failed > 0 ? ` · ${c.failed} échec(s)` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-brand hover:underline disabled:opacity-40"
                      disabled={c.status === 'sent' || send.isPending || (counts.confirmed ?? 0) === 0}
                      onClick={() => {
                        if (confirm(`Envoyer « ${c.subject} » à ${counts.confirmed ?? 0} abonné(s) confirmé(s) ?`)) {
                          send.mutate(c.id);
                        }
                      }}
                    >
                      <Send className="mr-1 inline size-3" />
                      Envoyer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold">Abonnés</h2>
          <p className="mt-1 text-xs text-muted">
            Le formulaire du site crée une inscription « en attente » : elle ne devient active qu’après confirmation par email.
          </p>
        </div>
        {(subs?.subscribers ?? []).length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Aucun abonné pour l’instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-2">Email</th>
                  <th className="px-3 py-2">Nom</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-5 py-2">Inscription</th>
                </tr>
              </thead>
              <tbody>
                {(subs?.subscribers ?? []).map((s) => (
                  <tr key={s.id} className="border-b border-line/60">
                    <td className="px-5 py-2 text-xs">{s.email}</td>
                    <td className="px-3 py-2 text-xs">{s.name ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          s.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'unsubscribed'
                              ? 'bg-line text-muted'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-xs text-muted">{frDateTime(s.created_at)}</td>
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
