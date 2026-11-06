import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { apiPut } from '../../lib/api';
import { useSettings } from '../../components/SiteLayout';
import type { Settings } from '../../lib/types';

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data } = useSettings();
  const [form, setForm] = useState({
    name: '',
    tagline: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    hours: '',
    base: 'USD' as 'USD' | 'CDF',
    usd_to_cdf: '',
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.studio?.name ?? '',
      tagline: data.studio?.tagline ?? '',
      phone: data.studio?.phone ?? '',
      whatsapp: data.studio?.whatsapp ?? '',
      email: data.studio?.email ?? '',
      address: data.studio?.address ?? '',
      hours: data.studio?.hours ?? '',
      base: data.currencies?.base ?? 'USD',
      usd_to_cdf: data.currencies?.usd_to_cdf ? String(data.currencies.usd_to_cdf) : '',
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiPut('/api/v1/admin/settings', {
        studio: {
          name: form.name,
          tagline: form.tagline,
          phone: form.phone,
          whatsapp: form.whatsapp,
          email: form.email,
          address: form.address,
          hours: form.hours,
        },
        currencies: {
          base: form.base,
          usd_to_cdf: Number(form.usd_to_cdf || 0),
          updated_at: new Date().toISOString().slice(0, 10),
        },
      } satisfies Partial<Settings>),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-black">Réglages</h1>
      <p className="mt-1 text-sm text-muted">
        Ces informations alimentent tout le site (en-tête, pied de page, pages contact).
      </p>

      <form
        className="mt-6 space-y-5 card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="r-name">
              Nom du studio
            </label>
            <input id="r-name" className="field" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="r-tagline">
              Signature
            </label>
            <input
              id="r-tagline"
              className="field"
              value={form.tagline}
              onChange={(e) => set('tagline', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="r-email">
              Email public
            </label>
            <input
              id="r-email"
              type="email"
              className="field"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="r-phone">
              Téléphone
            </label>
            <input id="r-phone" className="field" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="r-wa">
              WhatsApp
            </label>
            <input id="r-wa" className="field" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="r-hours">
              Horaires
            </label>
            <input id="r-hours" className="field" value={form.hours} onChange={(e) => set('hours', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="r-address">
              Adresse
            </label>
            <input id="r-address" className="field" value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <h2 className="text-sm font-semibold">Devises</h2>
          <p className="mt-1 text-xs text-muted">
            Le taux est saisi manuellement. Il est figé sur chaque devis émis.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="r-base">
                Devise de référence
              </label>
              <select
                id="r-base"
                className="field"
                value={form.base}
                onChange={(e) => set('base', e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="CDF">CDF</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="r-rate">
                1 USD = ? CDF
              </label>
              <input
                id="r-rate"
                className="field"
                inputMode="numeric"
                value={form.usd_to_cdf}
                onChange={(e) => set('usd_to_cdf', e.target.value.replace(/[^\d]/g, ''))}
                placeholder="2800"
              />
            </div>
          </div>
        </div>

        {save.isError && <p className="text-sm text-brand">Enregistrement impossible.</p>}
        {save.isSuccess && (
          <p className="flex items-center gap-2 text-sm text-green-700">
            <Check className="size-4" /> Réglages enregistrés.
          </p>
        )}

        <button type="submit" className="btn-primary !py-2.5" disabled={save.isPending}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  );
}
