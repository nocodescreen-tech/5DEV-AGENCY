import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  Code2,
  LineChart,
  MapPin,
  Server,
  Sparkles,
} from 'lucide-react';
import { apiGet } from '../lib/api';
import type { Category, Project, Service } from '../lib/types';
import { Accordion, EmptyState, MediaImage, Reveal, Skeleton, TiltCard } from '../components/ui';

/* --------------------------------------------------------------- compteur */

/** Compteur animé — uniquement pour des valeurs réelles, figé si reduced-motion. */
function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(value);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const dur = 900;
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / dur);
          setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    const safety = window.setTimeout(() => setN(value), 1800);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
    };
  }, [value]);

  return (
    <span ref={ref} className="tnum">
      {n}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ page */

const PILIER_ICONS = [Code2, Server, LineChart, Camera];

const METHODE = [
  {
    step: '01',
    title: 'Cadrage',
    body: 'Un échange court pour comprendre l’activité, les contraintes et ce que le projet doit produire concrètement.',
  },
  {
    step: '02',
    title: 'Proposition',
    body: 'Périmètre écrit, étapes datées, livrables listés. Vous savez ce qui est inclus et ce qui ne l’est pas.',
  },
  {
    step: '03',
    title: 'Réalisation',
    body: 'Travail par lots courts, avec un point d’avancement visible et des allers-retours limités aux décisions utiles.',
  },
  {
    step: '04',
    title: 'Mise en ligne',
    body: 'Mise en production, vérifications réelles, remise des accès et de la documentation. Puis suivi.',
  },
];

const ENGAGEMENTS = [
  'Un interlocuteur unique, du premier échange à la mise en ligne.',
  'Un périmètre écrit avant de commencer : pas de facture surprise.',
  'Des délais annoncés en jours ouvrés, pas en promesses.',
  'Du code et des contenus qui vous appartiennent : accès et sources remis.',
  'Aucune photo ni réalisation présentée qui ne serait pas la nôtre.',
  'Une mise en ligne vérifiée sur téléphone, tablette et ordinateur.',
];

const FAQ = [
  {
    q: 'Combien de temps prend un site vitrine ?',
    a: 'Cela dépend du nombre de pages et de la disponibilité des contenus. Nous annonçons un délai après le cadrage, pas avant : un site de 5 pages avec textes et photos fournis se fait nettement plus vite qu’un site où tout reste à écrire.',
  },
  {
    q: 'Quels sont les moyens de paiement ?',
    a: 'Les devis sont établis en dollars américains ou en francs congolais. Le règlement se fait par Mobile Money ou virement, en deux ou trois fois selon la taille du projet.',
  },
  {
    q: 'Travaillez-vous avec des clients hors de Matadi ?',
    a: 'Oui. Le suivi se fait à distance par WhatsApp, email et appels. Pour la photographie, le déplacement est étudié au cas par cas.',
  },
  {
    q: 'Que se passe-t-il après la mise en ligne ?',
    a: 'Une période de garantie couvre les corrections de ce qui était prévu. Ensuite, la maintenance est optionnelle : mises à jour, sauvegardes, petites évolutions.',
  },
  {
    q: 'Puis-je récupérer mes contenus et mes accès ?',
    a: 'Toujours. Le nom de domaine, l’hébergement et les comptes sont ouverts à votre nom, et le code source vous est remis à la livraison.',
  },
  {
    q: 'Faites-vous de la photographie hors événementiel ?',
    a: 'Oui : portraits, produits, intérieurs et reportages d’activité. La séance est préparée en amont (lieu, lumière, tenues, liste de prises).',
  },
];

export default function Home() {
  const { data: catalog, isPending } = useQuery({
    queryKey: ['catalog'],
    queryFn: () => apiGet<{ categories: Category[]; services: Service[] }>('/api/v1/services'),
    staleTime: 60_000,
  });

  const { data: projects } = useQuery({
    queryKey: ['works'],
    queryFn: () => apiGet<Project[]>('/api/v1/projects'),
    staleTime: 60_000,
  });

  const categories = catalog?.categories ?? [];
  const services = catalog?.services ?? [];
  const published = (projects ?? []).filter((p) => p.is_published !== false);

  return (
    <div className="page-enter">
      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b border-line/70">
        <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-24 lg:pt-20">
          <div>
            <div>
              <p className="eyebrow flex items-center gap-2 text-brand">
                <MapPin className="size-3.5" aria-hidden /> Matadi · République démocratique du Congo
              </p>
            </div>

            <div>
              <h1 className="display-1 mt-5">
                Des outils numériques
                <br />
                <span className="text-brand">qui travaillent</span> pour vous.
              </h1>
            </div>

            <div>
              <p className="lead mt-6 max-w-[46ch]">
                5DEV conçoit des sites, des applications et des dispositifs de croissance pour les
                entreprises congolaises — et photographie ce qui mérite d’être montré. Un seul
                interlocuteur, un périmètre écrit, une mise en ligne vérifiée.
              </p>
            </div>

            <div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/devis" className="btn-primary">
                  Décrire mon projet <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link to="/services" className="btn-ghost">
                  Voir les services
                </Link>
              </div>
            </div>

            <div>
              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
                {[
                  { k: 'Pôles d’activité', v: categories.length || 4 },
                  { k: 'Services au catalogue', v: services.length || 0 },
                  { k: 'Projets publiés', v: published.length },
                ].map((s) => (
                  <div key={s.k}>
                    <dd className="text-2xl font-black">
                      <Counter value={s.v} />
                    </dd>
                    <dt className="mt-0.5 text-[11px] uppercase tracking-wider text-muted">{s.k}</dt>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="relative">
            <div className="relative">
              <MediaImage
                slug="accueil-conseil"
                alt="Consultante au travail devant son ordinateur dans un bureau lumineux"
                width={1600}
                height={1067}
                sizes="(max-width: 1024px) 100vw, 46vw"
                priority
                className="aspect-[4/3] w-full rounded-2xl"
              />
              <div className="absolute -bottom-5 -left-4 hidden max-w-[16rem] rounded-xl border border-line bg-paper p-4 shadow-lg sm:block">
                <p className="text-[11px] uppercase tracking-wider text-muted">Le principe</p>
                <p className="mt-1 text-sm font-medium leading-snug">
                  Pas de maquette qui ne fonctionne pas. Ce qui est livré tourne.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- piliers */}
      <section className="border-b border-line/70">
        <div className="mx-auto max-w-[1240px] px-5 py-16 lg:py-20">
          <Reveal>
            <p className="eyebrow">Quatre pôles</p>
            <h2 className="display-2 mt-3 max-w-[24ch]">Une équipe, quatre métiers complémentaires.</h2>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isPending
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)
              : categories.map((c, i) => {
                  const Icon = PILIER_ICONS[i % PILIER_ICONS.length] ?? Code2;
                  return (
                    <Reveal key={c.id} delay={i * 70}>
                      <TiltCard className="h-full">
                        <Link
                          to={`/services#${c.slug}`}
                          className="card card-hover flex h-full flex-col justify-between p-5"
                        >
                          <Icon className="size-5 text-brand" aria-hidden />
                          <div className="mt-8">
                            <h3 className="font-semibold leading-tight">{c.name}</h3>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.description ?? c.tagline ?? ''}</p>
                          </div>
                        </Link>
                      </TiltCard>
                    </Reveal>
                  );
                })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ services */}
      <section className="border-b border-line/70 bg-wash/60">
        <div className="mx-auto max-w-[1240px] px-5 py-16 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Reveal>
              <p className="eyebrow">Catalogue</p>
              <h2 className="display-2 mt-3">Ce que nous prenons en charge.</h2>
            </Reveal>
            <Reveal delay={80}>
              <Link to="/services" className="nav-link text-sm font-medium">
                Tous les services <ArrowUpRight className="ml-1 inline size-3.5" aria-hidden />
              </Link>
            </Reveal>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isPending
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)
              : services
                  .slice(0, 6)
                  .map((s, i) => (
                    <Reveal key={s.id} delay={i * 50}>
                      <article className="card card-hover h-full p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold leading-snug">{s.title}</h3>
                          <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                        </div>
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{s.summary}</p>
                        <p className="mt-4 text-[11px] uppercase tracking-wider text-muted">
                          {s.price_note ?? 'Sur devis'}
                          {s.duration_label ? ` · ${s.duration_label}` : ''}
                        </p>
                      </article>
                    </Reveal>
                  ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- réalisations */}
      <section className="border-b border-line/70">
        <div className="mx-auto max-w-[1240px] px-5 py-16 lg:py-20">
          <Reveal>
            <p className="eyebrow">Réalisations</p>
            <h2 className="display-2 mt-3 max-w-[26ch]">Des projets en ligne, vérifiables.</h2>
            <p className="lead mt-4 max-w-[58ch]">
              Chaque projet publié ici est un site réellement livré, avec son adresse. Nous
              n’affichons pas de maquettes en guise de références.
            </p>
          </Reveal>

          {published.length === 0 ? (
            <Reveal delay={80} className="mt-10">
              <EmptyState
                title="Les premières réalisations arrivent"
                description="Le portfolio public se remplit au fur et à mesure des livraisons et des accords clients. En attendant, le catalogue de services décrit précisément ce qui est réalisable."
                action={
                  <Link to="/services" className="btn-ghost">
                    Voir le catalogue
                  </Link>
                }
              />
            </Reveal>
          ) : (
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {published.slice(0, 6).map((p, i) => (
                <Reveal key={p.id} delay={i * 60}>
                  <Link to={`/realisations/${p.slug}`} className="card card-hover block h-full overflow-hidden">
                    {p.cover_url ? (
                      <div className="media aspect-[16/10] w-full is-loaded">
                        <img src={p.cover_url} alt={p.title} loading="lazy" decoding="async" width={800} height={500} />
                      </div>
                    ) : (
                      <div className="flex aspect-[16/10] items-center justify-center bg-wash">
                        <span className="text-xs uppercase tracking-widest text-muted">{p.category}</span>
                      </div>
                    )}
                    <div className="p-5">
                      <p className="text-[11px] uppercase tracking-wider text-brand">{p.category}</p>
                      <h3 className="mt-1 font-semibold">{p.title}</h3>
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted">{p.summary}</p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------- photographie */}
      <section className="relative overflow-hidden border-b border-line/70 bg-ink text-white">
        <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <Reveal>
            <MediaImage
              slug="photographe-en-action"
              alt="Photographe en pleine prise de vue dans une lumière de fin de journée"
              width={1600}
              height={1067}
              sizes="(max-width: 1024px) 100vw, 48vw"
              className="aspect-[4/3] w-full rounded-2xl"
            />
          </Reveal>
          <div>
            <Reveal>
              <p className="eyebrow text-white/50">Pôle photographie</p>
              <h2 className="display-2 mt-3 text-white">
                Ce que la lumière
                <br />
                ne pardonne pas.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p className="lead mt-5 max-w-[46ch] text-white/70">
                Un portrait, un événement, un produit : la photographie n’est pas un décor, c’est
                une manière de rendre une activité crédible. Nous préparons la séance (lieu, heure,
                lumière, liste de prises) avant de déclencher.
              </p>
            </Reveal>
            <Reveal delay={140}>
              <ul className="mt-6 space-y-2.5">
                {['Portraits et portraits d’activité', 'Événements et cérémonies', 'Produits et intérieurs', 'Retouche et livraison de fichiers prêts à publier'].map(
                  (item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-white/80">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </Reveal>
            <Reveal delay={200}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/reservation" className="btn-primary">
                  Réserver une séance <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link to="/services#creative-photography" className="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:border-brand hover:text-brand">
                  Détail du pôle
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- méthode */}
      <section className="border-b border-line/70">
        <div className="mx-auto max-w-[1240px] px-5 py-16 lg:py-20">
          <Reveal>
            <p className="eyebrow">Méthode</p>
            <h2 className="display-2 mt-3 max-w-[22ch]">Quatre étapes, aucune zone d’ombre.</h2>
          </Reveal>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {METHODE.map((m, i) => (
              <Reveal key={m.step} delay={i * 80}>
                <div className="relative">
                  <span className="font-mono text-xs text-brand">{m.step}</span>
                  <div className="mt-3 h-px w-full bg-line" />
                  <h3 className="mt-4 font-semibold">{m.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{m.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- engagements */}
      <section className="border-b border-line/70 bg-wash/60">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-20">
          <div>
            <Reveal>
              <p className="eyebrow">Engagements</p>
              <h2 className="display-2 mt-3">Ce que vous pouvez exiger de nous.</h2>
              <p className="lead mt-4 max-w-[40ch]">
                Ces engagements ne sont pas des slogans : chacun correspond à une pratique vérifiable
                dans nos livraisons.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <MediaImage
                slug="atelier-client"
                alt="Deux personnes de l’équipe échangeant sur un projet"
                width={1600}
                height={1067}
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="mt-8 aspect-[5/4] w-full rounded-2xl"
              />
            </Reveal>
          </div>

          <ul className="space-y-4">
            {ENGAGEMENTS.map((e, i) => (
              <Reveal as="li" key={e} delay={i * 60}>
                <div className="flex items-start gap-3 border-b border-line/70 pb-4">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/12">
                    <Check className="size-3 text-brand" aria-hidden />
                  </span>
                  <p className="text-sm leading-relaxed">{e}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ FAQ */}
      <section className="border-b border-line/70">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:py-20">
          <Reveal>
            <p className="eyebrow">Questions fréquentes</p>
            <h2 className="display-2 mt-3">Avant de nous écrire.</h2>
            <p className="lead mt-4 max-w-[34ch]">
              Si votre question n’est pas là, posez-la directement — nous répondons en général dans
              la journée.
            </p>
            <Link to="/contact" className="btn-ghost mt-6">
              Poser une question
            </Link>
          </Reveal>
          <Reveal delay={80}>
            <Accordion items={FAQ} />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section>
        <div className="mx-auto max-w-[1240px] px-5 py-16 lg:py-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-12 text-center sm:px-12 lg:py-16">
              <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-brand/20 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-brand/10 blur-3xl" aria-hidden />
              <p className="eyebrow relative text-white/50">Parlons de votre projet</p>
              <h2 className="display-2 relative mx-auto mt-4 max-w-[24ch] text-white">
                Un besoin clair, un devis précis, un calendrier tenu.
              </h2>
              <p className="relative mx-auto mt-5 max-w-[52ch] text-white/70">
                Décrivez votre activité et ce que vous voulez obtenir. Nous répondons avec un
                périmètre, un prix et une date — pas avec une plaquette.
              </p>
              <div className="relative mt-8 flex flex-wrap justify-center gap-3">
                <Link to="/devis" className="btn-primary">
                  Demander un devis <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  to="/contact"
                  className="rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:border-brand hover:text-brand"
                >
                  Écrire à l’agence
                </Link>
              </div>
              <p className="relative mt-6 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/40">
                <Sparkles className="size-3" aria-hidden /> BUILD. INNOVATE. GROW.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
