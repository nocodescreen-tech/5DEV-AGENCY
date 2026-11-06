import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, KeyRound, Loader2, Trash2, UserRound } from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost, ApiRequestError } from '../../lib/api';
import { useToast } from '../../components/Toaster';

type Profile = {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  job_title: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  last_login_at: string | null;
  created_at: string;
};

type Session = { id: string; created_at: string; expires_at: string; user_agent: string | null };

export default function AdminProfile() {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({ display_name: '', full_name: '', job_title: '', phone: '' });
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm: '' });
  const [preview, setPreview] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiGet<{ profile: Profile; sessions: Session[] }>('/api/v1/admin/profile'),
  });

  const profile = data?.profile;

  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name ?? '',
      full_name: profile.full_name ?? '',
      job_title: profile.job_title ?? '',
      phone: profile.phone ?? '',
    });
  }, [profile]);

  const save = useMutation({
    mutationFn: () => apiPatch('/api/v1/admin/profile', form),
    onSuccess: () => {
      toast.push('success', 'Profil enregistré.');
      void qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (e) => toast.push('error', e instanceof ApiRequestError ? e.message : 'Enregistrement impossible.'),
  });

  const upload = useMutation({
    mutationFn: (dataUrl: string) => apiPost<{ avatar_url: string }>('/api/v1/admin/profile/avatar', { data: dataUrl }),
    onSuccess: () => {
      toast.push('success', 'Photo de profil mise à jour.');
      setPreview(null);
      void qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (e) => {
      setPreview(null);
      toast.push('error', e instanceof ApiRequestError ? e.message : 'Envoi impossible.');
    },
  });

  const removeAvatar = useMutation({
    mutationFn: () => apiDelete('/api/v1/admin/profile/avatar'),
    onSuccess: () => {
      toast.push('success', 'Photo supprimée.');
      void qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const changePwd = useMutation({
    mutationFn: () =>
      apiPost('/api/v1/admin/profile/password', {
        current_password: pwd.current_password,
        new_password: pwd.new_password,
      }),
    onSuccess: () => {
      setPwd({ current_password: '', new_password: '', confirm: '' });
      toast.push('success', 'Mot de passe modifié. Les autres sessions ont été déconnectées.');
    },
    onError: (e) => toast.push('error', e instanceof ApiRequestError ? e.message : 'Modification impossible.'),
  });

  function pickFile(file: File) {
    if (file.size > 400 * 1024) {
      toast.push('error', 'Image trop lourde : 400 Ko maximum.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setPreview(url);
      upload.mutate(url);
    };
    reader.readAsDataURL(file);
  }

  if (isPending || !profile) return <p className="text-sm text-muted">Chargement…</p>;

  const avatar = preview ?? profile.avatar_url;
  const initials = (profile.display_name ?? profile.full_name ?? profile.email)
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div>
      <h1 className="text-2xl font-black">Mon profil</h1>
      <p className="mt-1 text-sm text-muted">Photo, informations et mot de passe du compte administrateur.</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* --------------------------------------------------------- avatar */}
        <section className="card p-5">
          <h2 className="font-semibold">Photo de profil</h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Photo de profil"
                  width={88}
                  height={88}
                  className="size-[88px] rounded-full border border-line object-cover"
                />
              ) : (
                <div className="flex size-[88px] items-center justify-center rounded-full border border-line bg-wash text-lg font-bold text-muted">
                  {initials || <UserRound className="size-6" />}
                </div>
              )}
              {upload.isPending && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/50">
                  <Loader2 className="size-5 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickFile(f);
                  e.target.value = '';
                }}
              />
              <button type="button" className="btn-primary !py-2 text-xs" onClick={() => fileRef.current?.click()}>
                <Camera className="size-3.5" /> Choisir une image
              </button>
              {profile.avatar_url && (
                <button
                  type="button"
                  className="block text-xs text-muted hover:text-brand"
                  onClick={() => removeAvatar.mutate()}
                >
                  <Trash2 className="mr-1 inline size-3" /> Retirer
                </button>
              )}
              <p className="text-[10px] leading-relaxed text-muted">JPEG, PNG ou WebP · 400 Ko max.</p>
            </div>
          </div>

          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Email</dt>
              <dd className="truncate font-medium">{profile.email}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Rôle</dt>
              <dd className="font-medium">{profile.role}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Dernière connexion</dt>
              <dd>{profile.last_login_at ? new Date(profile.last_login_at).toLocaleString('fr-FR') : '—'}</dd>
            </div>
          </dl>
        </section>

        {/* ------------------------------------------------------ formulaire */}
        <div className="space-y-4">
          <form
            className="card p-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <h2 className="font-semibold">Informations</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="p-display">
                  Nom affiché
                </label>
                <input
                  id="p-display"
                  className="field"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="ce qui apparaît dans la console"
                />
              </div>
              <div>
                <label className="label" htmlFor="p-full">
                  Nom complet
                </label>
                <input
                  id="p-full"
                  className="field"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="p-job">
                  Fonction
                </label>
                <input
                  id="p-job"
                  className="field"
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  placeholder="Direction, développement, photo…"
                />
              </div>
              <div>
                <label className="label" htmlFor="p-phone">
                  Téléphone
                </label>
                <input
                  id="p-phone"
                  className="field"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary mt-4 !py-2.5" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Enregistrer
            </button>
          </form>

          <form
            className="card p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (pwd.new_password !== pwd.confirm) {
                toast.push('error', 'Les deux mots de passe ne correspondent pas.');
                return;
              }
              changePwd.mutate();
            }}
          >
            <h2 className="flex items-center gap-2 font-semibold">
              <KeyRound className="size-4 text-brand" /> Mot de passe
            </h2>
            <p className="mt-1 text-xs text-muted">
              12 caractères minimum. Toutes les autres sessions seront déconnectées après le changement.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="p-cur">
                  Actuel
                </label>
                <input
                  id="p-cur"
                  type="password"
                  autoComplete="current-password"
                  className="field"
                  value={pwd.current_password}
                  onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="p-new">
                  Nouveau
                </label>
                <input
                  id="p-new"
                  type="password"
                  autoComplete="new-password"
                  className="field"
                  value={pwd.new_password}
                  onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="p-conf">
                  Confirmer
                </label>
                <input
                  id="p-conf"
                  type="password"
                  autoComplete="new-password"
                  className="field"
                  value={pwd.confirm}
                  onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn-ghost mt-4 !py-2.5"
              disabled={changePwd.isPending || pwd.new_password.length < 12}
            >
              {changePwd.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Changer le mot de passe
            </button>
          </form>

          <section className="card p-5">
            <h2 className="font-semibold">Sessions actives</h2>
            <ul className="mt-3 divide-y divide-line text-xs">
              {(data?.sessions ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate text-muted">{s.user_agent ?? 'navigateur inconnu'}</span>
                  <span className="shrink-0 text-muted">expire {new Date(s.expires_at).toLocaleDateString('fr-FR')}</span>
                </li>
              ))}
              {(data?.sessions ?? []).length === 0 && <li className="py-2 text-muted">Aucune session enregistrée.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
