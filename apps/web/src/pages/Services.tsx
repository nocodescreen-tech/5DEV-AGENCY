import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check } from 'lucide-react';
import { Modal, Reveal } from '../components/ui';
import { apiGet } from '../lib/api';
import type { Category, Service } from '../lib/types';

export default function Services() {
  const [detail, setDetail] = useState<Service | null>(null);
  const { data, isPending, isError } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiGet<{ categories: Category[]; services: Service[] }>('/api/v1/services'),
  });

  return (
    <div className="container-x py-14 sm:py-20">
      <p className="eyebrow">Services</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
        Voilà ce qu’on sait faire — et ce que vous recevez.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-ink/65">
        Pour chaque prestation, vous voyez les livrables avant de payer. Le prix se discute au
        devis, sur le périmètre réel : pas de supplément surprise au milieu du projet.
      </p>

      {isPending && <p className="mt-12 text-sm text-muted">Chargement du catalogue…</p>}
      {isError && (
        <p className="mt-12 rounded-lg border border-brand/30 bg-brand/5 p-4 text-sm">
          Le catalogue est momentanément indisponible. Réessayez dans un instant.
        </p>
      )}

      <div className="mt-14 space-y-16">
        {(data?.categories ?? []).map((cat) => {
          const items = (data?.services ?? []).filter((s) => s.category_id === cat.id);
          return (
            <section key={cat.id} id={cat.slug} className="scroll-mt-24">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
                <h2 className="text-2xl font-black sm:text-3xl">{cat.name}</h2>
                <p className="text-sm text-muted">{cat.tagline}</p>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {items.map((s, i) => (
                  <Reveal key={s.id} delay={i * 40} className="card flex h-full flex-col p-6">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-lg font-semibold">{s.title}</h3>
                      <span className="whitespace-nowrap rounded-full bg-brand/10 px-3 py-1 text-[11px] font-medium text-brand">
                        {s.price_note ?? 'Sur devis'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink/65">{s.summary}</p>

                    {s.deliverables.length > 0 && (
                      <ul className="mt-5 space-y-2">
                        {s.deliverables.map((d) => (
                          <li key={d} className="flex items-start gap-2 text-sm text-ink/75">
                            <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                            {d}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-6">
                      <span className="text-xs text-muted">{s.duration_label ?? ''}</span>
                      <span className="flex items-center gap-4">
                        <button type="button" onClick={() => setDetail(s)} className="text-sm text-muted transition hover:text-brand">
                          Détail
                        </button>
                        <Link to={`/devis?service=${s.slug}`} className="text-sm font-medium text-brand hover:underline">
                          Demander ce service
                        </Link>
                      </span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.title ?? ''}>
        {detail && (
          <div>
            <p className="text-sm leading-relaxed text-muted">{detail.description || detail.summary}</p>
            {detail.deliverables.length > 0 && (
              <ul className="mt-4 space-y-2">
                {detail.deliverables.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                    {d}
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted">
              <div>
                <dt className="uppercase tracking-wider">Tarif</dt>
                <dd className="mt-0.5 text-sm text-ink">{detail.price_note ?? 'Sur devis'}</dd>
              </div>
              {detail.duration_label && (
                <div>
                  <dt className="uppercase tracking-wider">Délai</dt>
                  <dd className="mt-0.5 text-sm text-ink">{detail.duration_label}</dd>
                </div>
              )}
            </dl>
            <Link to={`/devis?service=${detail.slug}`} className="btn-primary mt-6 w-full justify-center">
              Demander ce service <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        )}
      </Modal>

      <div className="mt-20 rounded-2xl bg-ink p-8 text-white sm:p-12">
        <h2 className="text-2xl font-black sm:text-3xl">Un besoin qui ne figure pas ici ?</h2>
        <p className="mt-3 max-w-xl text-white/65">
          Décrivez-le : si 5DEV ne sait pas le faire, vous serez fixé tout de suite, sans
          proposition inutile.
        </p>
        <Link to="/devis" className="btn-primary mt-7">
          Écrire à 5DEV
        </Link>
      </div>
    </div>
  );
}
