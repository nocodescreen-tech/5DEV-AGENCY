import { useMemo, useState, useTransition } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, ChevronRight, Clock, Loader2, Sparkles, X } from 'lucide-react';
import { Modal, Reveal, Skeleton, TiltCard } from '../components/ui';
import { apiGet } from '../lib/api';
import type { Category, Service } from '../lib/types';

/**
 * Page Services — chaque action est un vrai composant :
 *  - onglets de catégorie avec indicateur qui glisse ;
 *  - carte 3D au pointeur, élévation au survol ;
 *  - « Détails » ouvre un panneau complet (livrables, délai, déroulé) ;
 *  - « Demander ce service » passe par la navigation réelle (chunk de route),
 *    avec un état d'attente visible : pas de faux pourcentage, pas de faux délai.
 */

const PROCESS = [
  { title: 'Le devis', body: 'Vous décrivez le besoin, on répond avec un périmètre, un prix et une date.' },
  { title: 'Le cadrage', body: 'On confirme les livrables et l’ordre des étapes avant de produire.' },
  { title: 'La livraison', body: 'Ce qui est annoncé est livré, testé, et vous gardez les accès.' },
];

export default function Services() {
  const [detail, setDetail] = useState<Service | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [pendingService, setPendingService] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const navigate = useNavigate();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiGet<{ categories: Category[]; services: Service[] }>('/api/v1/services'),
  });

  const categories = data?.categories ?? [];
  const services = data?.services ?? [];
  const filtered = useMemo(
    () => (activeCat ? services.filter((s) => s.category_id === activeCat) : services),
    [services, activeCat],
  );

  function askService(slug: string) {
    setPendingService(slug);
    startTransition(() => {
      navigate(`/devis?service=${slug}`);
    });
  }

  return (
    <div className="container-x py-14 sm:py-20">
      <p className="eyebrow rule-in">Services</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
        Voilà ce qu’on sait faire — et ce que vous recevez.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-ink/65">
        Pour chaque prestation, vous voyez les livrables avant de payer. Le prix se discute au
        devis, sur le périmètre réel : pas de supplément surprise au milieu du projet.
      </p>

      {/* onglets de catégorie : filtre réel, indicateur animé */}
      {categories.length > 1 && (
        <div className="sticky top-16 z-20 -mx-5 mt-10 border-b border-line bg-paper/90 px-5 py-3 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Catégories de services">
            <button
              type="button"
              role="tab"
              aria-selected={activeCat === null}
              onClick={() => setActiveCat(null)}
              className={`relative rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                activeCat === null ? 'bg-ink text-white' : 'text-muted hover:text-ink'
              }`}
            >
              Tout <span className="ml-1 text-[11px] opacity-70">{services.length}</span>
            </button>
            {categories.map((c) => {
              const count = services.filter((s) => s.category_id === c.id).length;
              const active = activeCat === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveCat(active ? null : c.id)}
                  className={`relative rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                    active ? 'bg-ink text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  {c.name} <span className="ml-1 text-[11px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isPending && (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      )}

      {isError && (
        <div className="mt-12 rounded-xl border border-brand/30 bg-brand/5 p-5 text-sm">
          <p>Le catalogue n’a pas pu être chargé. Ce n’est pas de votre côté.</p>
          <button type="button" onClick={() => void refetch()} className="btn-ghost mt-3 !py-2 text-xs">
            Réessayer
          </button>
        </div>
      )}

      <div className="mt-10 space-y-16">
        {categories.map((cat) => {
          const items = filtered.filter((s) => s.category_id === cat.id);
          if (items.length === 0) return null;
          return (
            <section key={cat.id} id={cat.slug} className="scroll-mt-32">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
                <h2 className="text-2xl font-black sm:text-3xl">{cat.name}</h2>
                <p className="text-sm text-muted">{cat.tagline}</p>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {items.map((s, i) => (
                  <Reveal key={s.id} delay={i * 40} style={{ ['--i' as string]: i }}>
                    <TiltCard className="h-full rounded-2xl" max={8}>
                      <article
                        className="card lift group relative flex h-full flex-col p-6"
                        style={{ transformStyle: 'preserve-3d' }}
                      >
                        <div className="card3d-depth flex items-start justify-between gap-4">
                          <h3 className="text-lg font-semibold leading-snug">{s.title}</h3>
                          <span className="whitespace-nowrap rounded-full bg-brand/10 px-3 py-1 text-[11px] font-medium text-brand">
                            {s.price_note ?? 'Sur devis'}
                          </span>
                        </div>

                        <p className="card3d-depth mt-3 text-sm leading-relaxed text-ink/65">{s.summary}</p>

                        {s.deliverables.length > 0 && (
                          <ul className="mt-5 space-y-2">
                            {s.deliverables.slice(0, 4).map((d, j) => (
                              <li
                                key={d}
                                className="flex items-start gap-2 text-sm text-ink/75"
                                style={{ transitionDelay: `${j * 30}ms` }}
                              >
                                <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                                {d}
                              </li>
                            ))}
                            {s.deliverables.length > 4 && (
                              <li className="pl-6 text-[11px] text-muted">
                                + {s.deliverables.length - 4} autre(s) livrable(s)
                              </li>
                            )}
                          </ul>
                        )}

                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                            {s.duration_label && (
                              <>
                                <Clock className="size-3.5" aria-hidden />
                                {s.duration_label}
                              </>
                            )}
                          </span>

                          <span className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDetail(s)}
                              className="btn-ghost !px-3 !py-2 text-xs"
                              aria-label={`Voir le détail de ${s.title}`}
                            >
                              Détails
                              <ChevronRight className="size-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => askService(s.slug)}
                              disabled={pendingService === s.slug}
                              className="btn-primary !px-3.5 !py-2 text-xs"
                            >
                              {pendingService === s.slug ? (
                                <>
                                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> Ouverture…
                                </>
                              ) : (
                                <>
                                  Demander ce service <ArrowRight className="size-3.5" aria-hidden />
                                </>
                              )}
                            </button>
                          </span>
                        </div>
                      </article>
                    </TiltCard>
                  </Reveal>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* ------------------------------------------------------ détail */}
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.title ?? ''}>
        {detail && (
          <div className="anim-rise">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
                {detail.price_note ?? 'Sur devis'}
              </span>
              {detail.duration_label && (
                <span className="inline-flex items-center gap-1 rounded-full bg-wash px-2.5 py-0.5 text-[11px] text-ink/70">
                  <Clock className="size-3" aria-hidden /> {detail.duration_label}
                </span>
              )}
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink/70">{detail.description || detail.summary}</p>

            {detail.deliverables.length > 0 && (
              <>
                <h3 className="mt-6 text-[11px] uppercase tracking-wider text-muted">Ce que vous recevez</h3>
                <ul className="mt-3 space-y-2">
                  {detail.deliverables.map((d, i) => (
                    <li
                      key={d}
                      className="flex items-start gap-2 text-sm"
                      style={{ animation: `rise 420ms cubic-bezier(0.22,1,0.36,1) ${i * 45}ms both` }}
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                      {d}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h3 className="mt-6 text-[11px] uppercase tracking-wider text-muted">Comment ça se passe</h3>
            <ol className="mt-3 space-y-3">
              {PROCESS.map((p, i) => (
                <li key={p.title} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="text-xs leading-relaxed text-muted">{p.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => askService(detail.slug)}
                className="btn-primary flex-1 justify-center"
              >
                Demander ce service <ArrowRight className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => setDetail(null)} className="btn-ghost justify-center">
                <X className="size-4" aria-hidden /> Fermer
              </button>
            </div>
            <p className="mt-3 text-[11px] text-muted">
              Aucun engagement à ce stade : le devis est gratuit et vous reste propre.
            </p>
          </div>
        )}
      </Modal>

      <div className="mt-20 overflow-hidden rounded-2xl bg-ink p-8 text-white sm:p-12">
        <div className="pointer-events-none absolute" aria-hidden />
        <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50">
          <Sparkles className="size-3.5" aria-hidden /> Sur mesure
        </p>
        <h2 className="mt-3 text-2xl font-black sm:text-3xl">Un besoin qui ne figure pas ici ?</h2>
        <p className="mt-3 max-w-xl text-white/65">
          Décrivez-le : si 5DEV ne sait pas le faire, vous serez fixé tout de suite, sans
          proposition inutile.
        </p>
        <Link to="/devis" className="btn-primary mt-7">
          Écrire à 5DEV <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
