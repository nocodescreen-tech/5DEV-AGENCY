import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch } from '../../lib/api';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toaster';
import { Trash2 } from 'lucide-react';
import type { Lead } from '../../lib/types';
import { frDateTime, money } from '../../lib/format';

const STATUS: { value: Lead['status']; label: string }[] = [
  { value: 'new', label: 'Nouvelle' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'quoted', label: 'Devis envoyé' },
  { value: 'won', label: 'Gagnée' },
  { value: 'lost', label: 'Perdue' },
];

export default function AdminLeads() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'' | Lead['status']>('');
  const [open, setOpen] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<{ id: string; label: string } | null>(null);
  const toast = useToast();

  const { data, isPending } = useQuery({
    queryKey: ['leads', filter],
    queryFn: () => apiGet<Lead[]>(`/api/v1/admin/leads${filter ? `?status=${filter}` : ''}`),
  });

  const patch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Lead['status'] }) =>
      apiPatch(`/api/v1/admin/leads/${id}`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Demandes</h1>
          <p className="mt-1 text-sm text-muted">Devis et messages reçus depuis le site.</p>
        </div>
        <select
          className="field !w-auto !py-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          {STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {isPending && <p className="mt-8 text-sm text-muted">Chargement…</p>}

      {data && data.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Aucune demande pour ce filtre.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {(data ?? []).map((lead) => (
          <li key={lead.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
                    {lead.kind === 'quote' ? 'devis' : 'message'}
                  </span>
                  <span className="text-sm font-semibold">{lead.contact_name}</span>
                  <span className="text-xs text-muted">{lead.contact_email}</span>
                  {lead.contact_phone && <span className="text-xs text-muted">· {lead.contact_phone}</span>}
                </div>
                <p className="mt-2 max-w-2xl text-sm text-ink/75">{lead.message}</p>
                <p className="mt-2 text-xs text-muted">
                  {lead.service_title ? `${lead.service_title} · ` : ''}
                  {lead.budget_amount ? money(lead.budget_amount, lead.budget_currency) : 'budget non précisé'} ·{' '}
                  {frDateTime(lead.created_at)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <select
                  className="field !w-auto !py-2 text-xs"
                  value={lead.status}
                  onChange={(e) => patch.mutate({ id: lead.id, status: e.target.value as Lead['status'] })}
                  aria-label={`Statut de la demande de ${lead.contact_name}`}
                >
                  {STATUS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-xs text-muted underline"
                  onClick={() => setOpen(open === lead.id ? null : lead.id)}
                >
                  {open === lead.id ? 'masquer' : 'détail'}
                </button>
                <button
                  type="button"
                  aria-label={`Supprimer la demande de ${lead.contact_name}`}
                  className="rounded-md p-1.5 text-muted transition hover:bg-brand/10 hover:text-brand"
                  onClick={() => setToDelete({ id: lead.id, label: lead.contact_name })}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            {open === lead.id && (
              <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted">Référence</dt>
                  <dd className="font-mono">{lead.id.slice(0, 8).toUpperCase()}</dd>
                </div>
                <div>
                  <dt className="text-muted">Note interne</dt>
                  <dd>{lead.admin_note ?? '—'}</dd>
                </div>
              </dl>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Supprimer cette demande ?"
        description={
          <>
            La demande de <strong>{toDelete?.label}</strong> sera définitivement supprimée. Cette action
            n’est pas réversible.
          </>
        }
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await apiDelete(`/api/v1/admin/leads/${toDelete.id}`);
          await qc.invalidateQueries({ queryKey: ['leads'] });
          await qc.invalidateQueries({ queryKey: ['dashboard'] });
          toast.push('success', 'Demande supprimée.');
        }}
      />
    </div>
  );
}
