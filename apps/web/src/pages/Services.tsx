import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { apiGet } from '../lib/api';
import type { Category, Service } from '../lib/types';
import Reveal from '../components/Reveal';

export default function Services() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiGet<{ categories: Category[]; services: Service[] }>('/api/v1/services'),
  });

  return (
    <div className="container-x py-14 sm:py-20">
      <p className="eyebrow">Services</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
        Ce que 5DEV réalise, concrètement.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-ink/65">
        Chaque prestation indique ce qui est livré. Les prix sont donnés au devis, selon le
        périmètre réel — jamais un forfait caché.
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
                  <Reveal key={s.id} delay={i * 0.05} className="card flex h-full flex-col p-6">
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

                    <div className="mt-auto flex items-center justify-between pt-6">
                      <span className="text-xs text-muted">{s.duration_label ?? ''}</span>
                      <Link
                        to={`/devis?service=${s.slug}`}
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        Demander ce service
                      </Link>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>
          );
        })}
      </div>

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
