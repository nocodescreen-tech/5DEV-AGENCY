import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Users as UsersIcon,
  XCircle,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../../lib/api';
import { frDateTime } from '../../lib/format';
import { PageHeader } from '../../components/admin/PageHeader';
import { Stagger, SearchInput, AnimatedBar } from '../../components/admin/anim-ui';
import { DeleteButton } from '../../components/DeleteButton';
import { Modal } from '../../components/ui';
import { useToast } from '../../components/Toaster';

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'admin' | 'editor';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  totp_enabled: boolean;
};

const ROLE_FR: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Administrateur',
  editor: 'Éditeur',
};

export default function AdminUsers() {
  const qc = useQueryClient();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [pwdFor, setPwdFor] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'editor' as UserRow['role'] });
  const [newPassword, setNewPassword] = useState('');

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiGet<{ users: UserRow[] }>('/api/v1/admin/users'),
  });

  const users = data?.users ?? [];
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (q ? users.filter((u) => `${u.full_name} ${u.email} ${ROLE_FR[u.role]}`.toLowerCase().includes(q)) : users),
    [users, q],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] });

  const create = useMutation({
    mutationFn: () => apiPost('/api/v1/admin/users', form),
    onSuccess: () => {
      toast.push('success', 'Compte créé');
      setCreateOpen(false);
      setForm({ email: '', full_name: '', password: '', role: 'editor' });
      void invalidate();
    },
    onError: (e: Error) => toast.push('error', e.message),
  });

  const patch = useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown> }) => apiPatch(`/api/v1/admin/users/${v.id}`, v.body),
    onSuccess: () => {
      toast.push('success', 'Compte mis à jour');
      void invalidate();
    },
    onError: (e: Error) => toast.push('error', e.message),
  });

  const setPassword = useMutation({
    mutationFn: (v: { id: string; password: string }) =>
      apiPost(`/api/v1/admin/users/${v.id}/password`, { password: v.password }),
    onSuccess: () => {
      toast.push('success', 'Mot de passe changé, sessions fermées');
      setPwdFor(null);
      setNewPassword('');
    },
    onError: (e: Error) => toast.push('error', e.message),
  });

  const actifs = users.filter((u) => u.is_active).length;

  return (
    <div>
      <PageHeader
        eyebrow="Gestion"
        title="Comptes"
        sub={`${users.length} compte(s) · ${actifs} actif(s) · double authentification gérée par compte`}
        actions={
          <>
            <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un compte…" />
            <button type="button" className="btn-primary !py-2 text-xs" onClick={() => setCreateOpen(true)}>
              <UserPlus className="size-3.5" /> Nouveau compte
            </button>
          </>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Comptes', value: users.length, icon: UsersIcon },
          { label: 'Actifs', value: actifs, icon: CheckCircle2 },
          { label: 'Protégés par un code', value: users.filter((u) => u.totp_enabled).length, icon: ShieldCheck },
        ].map((k, i) => (
          <Stagger key={k.label} index={i} step={60}>
            <div className="panel flex items-center justify-between p-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted">{k.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{k.value}</p>
              </div>
              <k.icon className="size-5 text-muted" aria-hidden />
            </div>
          </Stagger>
        ))}
      </div>

      <section className="panel mt-4 overflow-hidden">
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-semibold">Comptes de la console</h2>
        </div>

        {isPending ? (
          <p className="px-5 py-8 text-sm text-muted">Chargement…</p>
        ) : visible.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">
            {q ? 'Aucun compte ne correspond à la recherche.' : 'Aucun compte.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((u, i) => (
              <Stagger as="li" key={u.id} index={i} step={35} className="px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{u.full_name}</p>
                      <span className="rounded bg-muted/10 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {ROLE_FR[u.role] ?? u.role}
                      </span>
                      {u.totp_enabled ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald">
                          <ShieldCheck className="size-3" /> 2FA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-orange">
                          <ShieldOff className="size-3" /> enrôlement à faire
                        </span>
                      )}
                      {!u.is_active && (
                        <span className="inline-flex items-center gap-1 rounded bg-red/10 px-1.5 py-0.5 text-[10px] font-medium text-red">
                          <XCircle className="size-3" /> désactivé
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">{u.email}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Créé le {frDateTime(u.created_at)}
                      {u.last_login_at ? ` · dernière connexion ${frDateTime(u.last_login_at)}` : ' · jamais connecté'}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <select
                      className="rounded-lg border border-line bg-paper px-2 py-1 text-xs"
                      value={u.role}
                      onChange={(e) => patch.mutate({ id: u.id, body: { role: e.target.value } })}
                      aria-label={`Rôle de ${u.full_name}`}
                    >
                      <option value="owner">Propriétaire</option>
                      <option value="admin">Administrateur</option>
                      <option value="editor">Éditeur</option>
                    </select>

                    <button
                      type="button"
                      className="btn-ghost !py-1 text-xs"
                      onClick={() => setPwdFor(u)}
                      title="Réinitialiser le mot de passe"
                    >
                      <KeyRound className="size-3.5" />
                    </button>

                    <button
                      type="button"
                      className="btn-ghost !py-1 text-xs"
                      onClick={() => patch.mutate({ id: u.id, body: { is_active: !u.is_active } })}
                    >
                      {u.is_active ? 'Désactiver' : 'Réactiver'}
                    </button>

                    <DeleteButton
                      label={u.full_name}
                      detail="Le compte et ses sessions sont supprimés définitivement."
                      path={`/api/v1/admin/users/${u.id}`}
                      invalidate={[['admin', 'users']]}
                    />
                  </div>
                </div>
              </Stagger>
            ))}
          </ul>
        )}
      </section>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau compte">
        <div className="space-y-3">
          <label className="block text-xs">
            <span className="text-muted">Nom affiché</span>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Prénom Nom"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted">Adresse email</span>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="prenom@5dev.com"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted">Mot de passe provisoire (8 caractères minimum)</span>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="à communiquer à la personne"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted">Rôle</span>
            <select
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRow['role'] })}
            >
              <option value="editor">Éditeur — contenu et suivi</option>
              <option value="admin">Administrateur — tout sauf la gestion des comptes</option>
              <option value="owner">Propriétaire — accès total</option>
            </select>
          </label>
          <p className="text-[11px] text-muted">
            À la première connexion, la personne devra scanner un QR code pour activer la double authentification.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={create.isPending || !form.email || !form.full_name || form.password.length < 8}
              onClick={() => create.mutate()}
            >
              {create.isPending && <Loader2 className="size-4 animate-spin" />} Créer le compte
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!pwdFor} onClose={() => setPwdFor(null)} title={`Mot de passe — ${pwdFor?.full_name ?? ''}`}>
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Le nouveau mot de passe remplace l’ancien et ferme toutes les sessions ouvertes de ce compte.
          </p>
          <input
            type="text"
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="nouveau mot de passe (8 caractères minimum)"
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPwdFor(null)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={setPassword.isPending || newPassword.length < 8}
              onClick={() => pwdFor && setPassword.mutate({ id: pwdFor.id, password: newPassword })}
            >
              {setPassword.isPending && <Loader2 className="size-4 animate-spin" />} Changer
            </button>
          </div>
        </div>
      </Modal>

      <div className="mt-4">
        <AnimatedBar value={actifs} max={Math.max(1, users.length)} height={5} label="Comptes actifs" />
      </div>
    </div>
  );
}
