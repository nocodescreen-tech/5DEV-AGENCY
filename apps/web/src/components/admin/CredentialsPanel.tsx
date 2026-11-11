import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Eye, EyeOff, Globe, Loader2, Lock, Plus, ShieldCheck, User } from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';
import { frDateTime } from '../../lib/format';
import { AnimatedBar, PressableButton, Stagger } from './anim-ui';
import { PasswordGenerator } from './PasswordGenerator';
import { Modal } from '../ui';
import { useToast } from '../Toaster';

/**
 * Onglet « Comptes d'applications » : liste, création, modification,
 * révélation et suppression. Les mots de passe arrivent chiffrés par l'API ;
 * la liste ne reçoit qu'un indice, la valeur n'est demandée qu'à la révélation.
 */

export type Credential = {
  id: string;
  app_name: string;
  category: string;
  username: string | null;
  url: string | null;
  notes: string;
  hint: string;
  updated_at: string;
  last_revealed_at: string | null;
};

export const CATEGORY_FR: Record<string, string> = {
  hebergement: 'Hébergement',
  'base-de-donnees': 'Base de données',
  email: 'Email',
  paiement: 'Paiement',
  cms: 'CMS',
  'reseaux-sociaux': 'Réseaux sociaux',
  registrar: 'Nom de domaine',
  'outil-interne': 'Outil interne',
  autre: 'Autre',
};

const emptyForm = {
  app_name: '',
  category: 'hebergement',
  username: '',
  password: '',
  url: '',
  notes: '',
};

export function CredentialsPanel({ query }: { query: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Credential | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'credentials'],
    queryFn: () => apiGet<{ credentials: Credential[]; categories: string[] }>('/api/v1/admin/credentials'),
  });

  const rows = data?.credentials ?? [];

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      q
        ? rows.filter((c) => `${c.app_name} ${c.category} ${c.username ?? ''} ${c.notes}`.toLowerCase().includes(q))
        : rows,
    [rows, q],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'credentials'] });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? apiPatch(`/api/v1/admin/credentials/${editing.id}`, { ...form, password: form.password || undefined })
        : apiPost('/api/v1/admin/credentials', form),
    onSuccess: () => {
      toast.push('success', editing ? 'Compte mis à jour' : 'Compte enregistré, mot de passe chiffré');
      setOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      void invalidate();
    },
    onError: (e: Error) => toast.push('error', e.message),
  });

  async function fetchPassword(c: Credential): Promise<string | null> {
    setBusy(c.id);
    try {
      const res = await apiPost<{ password: string }>(`/api/v1/admin/credentials/${c.id}/reveal`, {});
      return res.password;
    } catch (e) {
      toast.push('error', (e as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function toggleReveal(c: Credential) {
    if (revealed[c.id]) {
      const next = { ...revealed };
      delete next[c.id];
      setRevealed(next);
      return;
    }
    const password = await fetchPassword(c);
    if (password) setRevealed({ ...revealed, [c.id]: password });
  }

  async function copy(c: Credential) {
    const value = revealed[c.id] ?? (await fetchPassword(c));
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(c.id);
      window.setTimeout(() => setCopied(null), 1600);
      toast.push('success', 'Mot de passe copié');
    } catch {
      toast.push('error', 'Le navigateur a refusé le presse-papiers');
    }
  }

  async function remove(c: Credential) {
    setBusy(c.id);
    try {
      await apiDelete(`/api/v1/admin/credentials/${c.id}`);
      toast.push('success', `« ${c.app_name} » supprimé`);
      void invalidate();
    } catch (e) {
      toast.push('error', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function openEdit(c: Credential) {
    setEditing(c);
    setForm({
      app_name: c.app_name,
      category: c.category,
      username: c.username ?? '',
      password: '',
      url: c.url ?? '',
      notes: c.notes,
    });
    setOpen(true);
  }

  return (
    <>
      <div className="panel mt-4 flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
        <div className="text-xs text-muted">
          <p className="font-medium text-ink">Chaque mot de passe est chiffré avant d’entrer en base.</p>
          <p className="mt-1">
            La liste n’affiche qu’un indice (début, fin, longueur). Copier ou révéler écrit une ligne dans le journal
            d’audit. Si <code className="rounded bg-wash px-1">SESSION_SECRET</code> change, les mots de passe
            deviennent illisibles : il faudra les ressaisir.
          </p>
        </div>
      </div>

      <section className="panel mt-4 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
          <h2 className="font-semibold">Comptes enregistrés ({rows.length})</h2>
          <PressableButton
            className="btn-primary !py-1.5 text-xs"
            onClick={() => {
              setEditing(null);
              setForm({ ...emptyForm });
              setOpen(true);
            }}
          >
            <Plus className="size-3.5" /> Nouveau compte
          </PressableButton>
        </div>

        {isPending ? (
          <p className="px-5 py-8 text-sm text-muted">Chargement…</p>
        ) : visible.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted">
            <Lock className="mx-auto mb-3 size-10 opacity-30" />
            <p className="text-sm">
              {q ? 'Aucun compte ne correspond.' : 'Aucun compte enregistré. Ajoutez votre premier accès.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((c, i) => (
              <Stagger as="li" key={c.id} index={i} step={35} className="px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{c.app_name}</p>
                      <span className="rounded bg-muted/10 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {CATEGORY_FR[c.category] ?? c.category}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      {c.username && (
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3" aria-hidden /> {c.username}
                        </span>
                      )}
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-brand"
                        >
                          <Globe className="size-3" aria-hidden /> ouvrir
                        </a>
                      )}
                      <span className="font-mono">
                        {revealed[c.id] ? <span className="break-all text-ink">{revealed[c.id]}</span> : c.hint}
                      </span>
                    </div>

                    {c.notes && <p className="mt-1 truncate text-[11px] text-muted">{c.notes}</p>}
                    <p className="mt-0.5 text-[11px] text-muted">
                      modifié le {frDateTime(c.updated_at)}
                      {c.last_revealed_at ? ` · consulté le ${frDateTime(c.last_revealed_at)}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <PressableButton className="btn-ghost !py-1 text-xs" onClick={() => void toggleReveal(c)} disabled={busy === c.id}>
                      {busy === c.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : revealed[c.id] ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                      {revealed[c.id] ? 'Masquer' : 'Révéler'}
                    </PressableButton>

                    <PressableButton className="btn-ghost !py-1 text-xs" onClick={() => void copy(c)} disabled={busy === c.id}>
                      {copied === c.id ? <Check className="size-3.5 text-emerald" /> : <Copy className="size-3.5" />}
                      Copier
                    </PressableButton>

                    <PressableButton className="btn-ghost !py-1 text-xs" onClick={() => openEdit(c)}>
                      Modifier
                    </PressableButton>

                    <PressableButton className="btn-ghost !py-1 text-xs text-red" onClick={() => void remove(c)} disabled={busy === c.id}>
                      Supprimer
                    </PressableButton>
                  </div>
                </div>
              </Stagger>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-4">
        <AnimatedBar value={rows.length} max={Math.max(1, rows.length + 3)} height={5} label="Comptes enregistrés" />
      </div>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? `Modifier ${editing.app_name}` : 'Nouveau compte d’application'}
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-muted">Application</span>
              <input
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={form.app_name}
                onChange={(e) => setForm({ ...form, app_name: e.target.value })}
                placeholder="Hostinger, Gmail, Stripe…"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted">Catégorie</span>
              <select
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {Object.entries(CATEGORY_FR).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs">
            <span className="text-muted">Identifiant (email ou nom d’utilisateur)</span>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="mio.appservice@gmail.com"
            />
          </label>

          <label className="block text-xs">
            <span className="text-muted">
              Mot de passe {editing && <span className="text-[10px]">(laisser vide pour conserver l’actuel)</span>}
            </span>
            <input
              type="text"
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="coller ou générer ci-dessous"
            />
          </label>

          <PasswordGenerator compact onUse={(p) => setForm((f) => ({ ...f, password: p }))} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="text-muted">Adresse de connexion</span>
              <input
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://…"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted">Note (optionnel)</span>
              <input
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="2FA activée, propriétaire du domaine…"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={save.isPending || form.app_name.trim().length < 2 || (!editing && !form.password)}
              onClick={() => save.mutate()}
            >
              {save.isPending && <Loader2 className="size-4 animate-spin" />}
              {editing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export const CredentialsIcon = Plus;
