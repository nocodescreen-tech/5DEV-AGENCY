import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeySquare, Loader2, Plus } from 'lucide-react';
import { apiGet, apiPut } from '../../lib/api';
import { frDateTime } from '../../lib/format';
import { PageHeader } from '../../components/admin/PageHeader';
import { SearchInput, Stagger, PressableButton } from '../../components/admin/anim-ui';
import { CredentialsPanel } from '../../components/admin/CredentialsPanel';
import { PasswordGenerator } from '../../components/admin/PasswordGenerator';
import { Modal } from '../../components/ui';
import { useToast } from '../../components/Toaster';

type SecretRow = { name: string; hint: string | null; updated_at: string };

/** Clés lues par le code applicatif : proposées, jamais imposées. */
const SUGGESTIONS = [
  { name: 'github_token', label: 'GitHub — jeton personnel' },
  { name: 'nvidia_api_key', label: 'NVIDIA — clé du modèle IA' },
  { name: 'brevo_api_key', label: 'Brevo — envoi d’emails' },
  { name: 'cloudinary_url', label: 'Cloudinary — stockage médias' },
];

/**
 * Écran unique des identifiants : deux onglets, une seule page.
 * Les comptes d'applications vivent dans `CredentialsPanel`, les jetons
 * techniques (lus par le code) restent ici — ce sont deux usages différents.
 */
export default function AdminSecrets() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'comptes' | 'cles'>('comptes');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');

  const secrets = useQuery({
    queryKey: ['admin', 'secrets'],
    queryFn: () => apiGet<{ secrets: SecretRow[] }>('/api/v1/admin/secrets'),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'secrets'] });

  const save = useMutation({
    mutationFn: () => apiPut(`/api/v1/admin/secrets/${name.trim().toLowerCase()}`, { value }),
    onSuccess: () => {
      toast.push('success', `Clé « ${name} » enregistrée, chiffrée en base`);
      setOpen(false);
      setName('');
      setValue('');
      void invalidate();
    },
    onError: (e: Error) => toast.push('error', e.message),
  });

  const list = secrets.data?.secrets ?? [];
  const q = query.trim().toLowerCase();
  const visible = q ? list.filter((s) => `${s.name} ${s.hint ?? ''}`.toLowerCase().includes(q)) : list;
  const missing = SUGGESTIONS.filter((s) => !list.some((x) => x.name === s.name));

  return (
    <div>
      <PageHeader
        eyebrow="Gestion"
        title="Comptes et clés"
        sub="Identifiants de vos autres applications et jetons techniques — chiffrés en base (AES-256-GCM)"
        actions={
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={tab === 'comptes' ? 'Rechercher une application…' : 'Rechercher une clé…'}
            />
            {tab === 'cles' && (
              <PressableButton className="btn-primary !py-2 text-xs" onClick={() => setOpen(true)}>
                <Plus className="size-3.5" /> Nouvelle clé
              </PressableButton>
            )}
          </>
        }
      />

      <div className="mt-4 flex gap-1 border-b border-line" role="tablist" aria-label="Type d’identifiant">
        {(
          [
            ['comptes', `Comptes d’applications (${tab === 'cles' ? '' : ''}${list.length ? '' : ''})`],
            ['cles', `Clés techniques (${list.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`relative px-3 py-2 text-xs font-medium transition-colors ${
              tab === key ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {key === 'comptes' ? 'Comptes d’applications' : label}
            {tab === key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
          </button>
        ))}
      </div>

      {tab === 'comptes' ? (
        <CredentialsPanel query={query} />
      ) : (
        <section className="panel mt-4 overflow-hidden">
          <div className="border-b border-line px-5 py-3">
            <h2 className="font-semibold">Clés techniques ({list.length})</h2>
          </div>

          {secrets.isPending ? (
            <p className="px-5 py-8 text-sm text-muted">Chargement…</p>
          ) : visible.length === 0 ? (
            <div className="px-5 py-10 text-center text-muted">
              <KeySquare className="mx-auto mb-3 size-10 opacity-30" />
              <p className="text-sm">{q ? 'Aucune clé ne correspond.' : 'Aucune clé enregistrée.'}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((s, i) => (
                <Stagger as="li" key={s.name} index={i} step={35} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      <KeySquare className="size-4 text-muted" aria-hidden /> {s.name}
                    </p>
                    <p className="mt-1 text-xs text-muted">{s.hint ?? '—'}</p>
                    <p className="mt-0.5 text-[11px] text-muted">modifiée le {frDateTime(s.updated_at)}</p>
                  </div>
                  <PressableButton
                    className="btn-ghost !py-1 text-xs"
                    onClick={() => {
                      setName(s.name);
                      setValue('');
                      setOpen(true);
                    }}
                  >
                    Remplacer
                  </PressableButton>
                </Stagger>
              ))}
            </ul>
          )}

          {missing.length > 0 && (
            <div className="border-t border-line px-5 py-4">
              <p className="text-xs text-muted">Clés attendues par l’application :</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {missing.map((s) => (
                  <li key={s.name}>
                    <button
                      type="button"
                      className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-brand hover:text-brand"
                      onClick={() => {
                        setName(s.name);
                        setValue('');
                        setOpen(true);
                      }}
                    >
                      + {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={name ? `Clé « ${name} »` : 'Nouvelle clé'}>
        <div className="space-y-3">
          <label className="block text-xs">
            <span className="text-muted">Nom de la clé (minuscules, tirets autorisés)</span>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="github_token"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted">Valeur secrète</span>
            <input
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="coller le jeton"
            />
          </label>
          <PasswordGenerator compact onUse={setValue} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={save.isPending || name.trim().length < 2 || value.length < 1}
              onClick={() => save.mutate()}
            >
              {save.isPending && <Loader2 className="size-4 animate-spin" />} Enregistrer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
