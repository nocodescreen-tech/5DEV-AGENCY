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
import { SplitText } from '../components/motion/SplitText';
import { Parallax, StickyStory } from '../components/motion/Parallax';
import { TiltLayer } from '../components/motion/TiltCard3D';

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
    title: 'On se parle',
    body: 'Une conversation, pas un questionnaire. Votre métier, vos clients, ce qui vous fait perdre du temps.',
  },
  {
    step: '02',
    title: 'Vous recevez un devis court',
    body: 'Ce qu’on fait, ce que ça coûte, pour quand. Si une ligne ne vous va pas, on en discute avant de commencer.',
  },
  {
    step: '03',
    title: 'On construit devant vous',
    body: 'Le travail avance par petits morceaux. Vous voyez le résultat en cours de route, pas trois mois plus tard.',
  },
  {
    step: '04',
    title: 'On met en ligne ensemble',
    body: 'On teste sur un vrai téléphone, on vous montre comment changer vos textes, et on reste joignables.',
  },
];

const ENGAGEMENTS = [
  'Une seule personne à appeler, du premier message à la mise en ligne.',
  'Le prix est fixé avant le premier jour de travail. Il ne bouge pas en cours de route.',
  'Les délais sont donnés en jours travaillés. Si ça glisse, vous le savez avant, pas après.',
  'Le domaine, l’hébergement et le code sont à votre nom. Vous partez avec, si un jour vous voulez.',
  'Aucune photo ni réalisation qui ne soit pas la nôtre. Même si ça fait moins de choses à montrer.',
  'On regarde le résultat sur un téléphone, une tablette et un ordinateur avant de dire que c’est prêt.',
];

const FAQ = [
  {
    q: 'Combien de temps prend un site vitrine ?',
    a: 'Ça dépend des pages et de ce que vous pouvez nous fournir. Un site de cinq pages avec vos textes et vos photos part beaucoup plus vite qu’un projet où tout reste à écrire. On vous donne une date après le premier échange, pas avant.',
  },
  {
    q: 'Quels sont les moyens de paiement ?',
    a: 'En dollars ou en francs congolais, comme vous préférez. Paiement par Mobile Money ou virement, en deux ou trois fois selon la taille du projet.',
  },
  {
    q: 'Travaillez-vous avec des clients hors de Matadi ?',
    a: 'Oui. On travaille par WhatsApp, par email et au téléphone. Pour la photo, on regarde ensemble si le déplacement est possible — et ce qu’il coûte.',
  },
  {
    q: 'Que se passe-t-il après la mise en ligne ?',
    a: 'Les corrections de ce qui était prévu sont couvertes pendant la garantie. Après, la maintenance reste optionnelle : mises à jour, sauvegardes, petites retouches.',
  },
  {
    q: 'Puis-je récupérer mes contenus et mes accès ?',
    a: 'Toujours. Le domaine, l’hébergement et les comptes sont à votre nom, et vous repartez avec le code.',
  },
  {
    q: 'Faites-vous de la photographie hors événementiel ?',
    a: 'Oui : portraits, produits, intérieurs, reportages. On prépare la séance avant (lieu, lumière, tenues, ce qu’il faut absolument avoir).',
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
          <div className="hero-seq">
            <div style={{ ['--i' as string]: 0 }}>
              <p className="eyebrow flex items-center gap-2 text-brand">
                <MapPin className="size-3.5" aria-hidden /> Matadi · République démocratique du Congo
              </p>
            </div>

            <div style={{ ['--i' as string]: 1 }}>
              <SplitText
                as="h1"
                text="Les bonnes idées méritent mieux que de rester des idées."
                accent="idées"
                step={0.05}
                className="mt-5 font-extrabold tracking-[-0.035em] text-[clamp(1.95rem,4.1vw,3.35rem)]"
              />
            </div>

            <div style={{ ['--i' as string]: 2 }}>
              <p className="lead mt-6 max-w-[46ch]">
                Un projet en tête ? Une activité à faire évoluer ? On réunit la technique, la
                créativité et le savoir-faire pour construire quelque chose qui vous ressemble — et
                qui fonctionne vraiment quand vous êtes devant.
              </p>
            </div>

            <div style={{ ['--i' as string]: 3 }}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/devis" className="btn-primary">
                  Parlons de votre projet <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link to="/services" className="btn-ghost">
                  Découvrir ce qu’on fait
                </Link>
              </div>
            </div>

            <div style={{ ['--i' as string]: 4 }}>
              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
                {[
                  { k: 'Pôles d’activité', v: categories.length || 4 },
                  { k: 'Services au catalogue', v: services.length || 0 },
                  { k: 'Projets publiés', v: published.length },
                ]
                  .filter((s) => s.v > 0)
                  .map((s) => (
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

          <div className="hero-visual relative">
            <div className="relative">
              <Parallax speed={34} scale className="overflow-hidden rounded-2xl">
                <MediaImage
                  slug="accueil-conseil"
                  alt="Consultante au travail devant son ordinateur dans un bureau lumineux"
                  width={1600}
                  height={1067}
                  sizes="(max-width: 1024px) 100vw, 46vw"
                  priority
                  className="aspect-[4/3] w-full"
                />
              </Parallax>
              <div className="float-soft absolute -bottom-5 -left-4 hidden max-w-[16rem] rounded-xl border border-line bg-paper p-4 shadow-lg sm:block">
                <p className="text-[11px] uppercase tracking-wider text-muted">Notre règle</p>
                <p className="mt-1 text-sm font-medium leading-snug">
                  Ce qu’on vous montre est déjà cliquable. Vous testez, puis on discute.
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
            <p className="eyebrow rule-in">Quatre pôles</p>
            <h2 className="display-2 mt-3 max-w-[26ch]">On ne fait pas du digital pour faire joli.</h2>
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
                          <TiltLayer depth={26}>
                            <Icon className="size-5 text-brand" aria-hidden />
                          </TiltLayer>
                          <TiltLayer depth={42} className="mt-8">
                            <h3 className="font-semibold leading-tight">{c.name}</h3>
                            <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.description ?? c.tagline ?? ''}</p>
                          </TiltLayer>
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
              <p className="eyebrow rule-in">Catalogue</p>
              <h2 className="display-2 mt-3">Ce qu’on peut construire ensemble.</h2>
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
                    <Reveal key={s.id} delay={i * 50} style={{ ['--i' as string]: i }}>
                      <TiltCard className="h-full rounded-xl" max={10}>
                        <Link
                          to="/services"
                          className="card lift flex h-full flex-col p-5"
                          style={{ transformStyle: 'preserve-3d' }}
                        >
                          <div className="card3d-depth flex items-start justify-between gap-3">
                            <h3 className="font-semibold leading-snug">{s.title}</h3>
                            <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                          </div>
                          <p className="card3d-depth mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                            {s.summary}
                          </p>
                          <p className="mt-auto pt-4 text-[11px] uppercase tracking-wider text-muted">
                            {s.price_note ?? 'Sur devis'}
                            {s.duration_label ? ` · ${s.duration_label}` : ''}
                          </p>
                        </Link>
                      </TiltCard>
                    </Reveal>
                  ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- réalisations */}
      <section className="border-b border-line/70">
        <div className="mx-auto max-w-[1240px] px-5 py-16 lg:py-20">
          <Reveal>
            <p className="eyebrow rule-in">Réalisations</p>
            <h2 className="display-2 mt-3 max-w-[26ch]">Des projets qu’on peut visiter.</h2>
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
                  <Link to={`/realisations/${p.slug}`} className="card lift zoom-parent block h-full overflow-hidden">
                    {p.cover_url ? (
                      <div className="media aspect-[16/10] w-full is-loaded">
                        <img
                          src={p.cover_url}
                          alt={p.title}
                          loading="lazy"
                          decoding="async"
                          width={800}
                          height={500}
                          className="zoom-img"
                        />
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
          <Parallax speed={52} scale className="overflow-hidden rounded-2xl">
            <MediaImage
              slug="photographe-en-action"
              alt="Photographe en pleine prise de vue dans une lumière de fin de journée"
              width={1600}
              height={1067}
              sizes="(max-width: 1024px) 100vw, 48vw"
              priority
              className="aspect-[4/3] w-full"
            />
          </Parallax>
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
      <section className="border-b border-line/70 bg-wash/40">
        <StickyStory
          title="Quatre étapes, aucune zone d’ombre."
          steps={METHODE.map((m) => ({ title: m.title, body: m.body }))}
        />
      </section>

      {/* ---------------------------------------------------- engagements */}
      <section className="border-b border-line/70 bg-wash/60">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-20">
          <div>
            <Reveal>
              <p className="eyebrow rule-in">Engagements</p>
              <h2 className="display-2 mt-3">Ce que vous pouvez exiger de nous.</h2>
              <p className="lead mt-4 max-w-[40ch]">
                Rien d’extraordinaire dans cette liste. C’est simplement notre façon de travailler —
                et vous pouvez nous la rappeler si un jour on l’oublie.
              </p>
            </Reveal>
            <Parallax speed={30} className="mt-8 overflow-hidden rounded-2xl">
              <MediaImage
                slug="atelier-client"
                alt="Deux personnes de l’équipe échangeant sur un projet"
                width={1600}
                height={1067}
                sizes="(max-width: 1024px) 100vw, 40vw"
                priority
                className="aspect-[5/4] w-full"
              />
            </Parallax>
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
            <p className="eyebrow rule-in">Questions fréquentes</p>
            <h2 className="display-2 mt-3">Ce qu’on nous demande souvent.</h2>
            <p className="lead mt-4 max-w-[34ch]">
              Votre question n’est pas dans la liste ? Posez-la quand même. On la lit et on vous
              répond — souvent le jour même.
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
                Racontez-nous ce qui coince. On vous dira franchement ce qu’on peut faire.
              </h2>
              <p className="relative mx-auto mt-5 max-w-[52ch] text-white/70">
                Deux paragraphes suffisent. En retour : un périmètre clair, un prix et une date —
                pas une plaquette commerciale.
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
