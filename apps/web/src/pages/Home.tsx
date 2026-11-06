import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, Camera, Code2, LineChart, Server } from 'lucide-react';
import { apiGet } from '../lib/api';
import type { Category, Project, Service } from '../lib/types';
import Reveal from '../components/Reveal';

const ICONS: Record<string, typeof Code2> = {
  'web-development': Code2,
  'digital-solutions': Server,
  'digital-growth': LineChart,
  'creative-photography': Camera,
};

const METHOD = [
  { n: '01', title: 'Comprendre', text: 'Un échange court pour cerner le besoin réel, la cible et le budget.' },
  { n: '02', title: 'Cadrer', text: 'Périmètre écrit, étapes datées, ce qui est inclus et ce qui ne l’est pas.' },
  { n: '03', title: 'Construire', text: 'Réalisation par lots, démonstrations régulières, aucune surprise en fin de projet.' },
  { n: '04', title: 'Livrer et suivre', text: 'Mise en ligne, prise en main, puis maintenance si vous le souhaitez.' },
];

export default function Home() {
  const { data: catalog } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiGet<{ categories: Category[]; services: Service[] }>('/api/v1/services'),
  });
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiGet<Project[]>('/api/v1/projects'),
  });

  const categories = catalog?.categories ?? [];
  const services = catalog?.services ?? [];
  const featured = services.slice(0, 6);

  return (
    <>
      {/* ---------------------------------------------------------------- hero */}
      <section className="border-b border-line bg-wash">
        <div className="container-x grid gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div>
            <p className="eyebrow">Matadi · République démocratique du Congo</p>
            <h1 className="mt-5 text-4xl font-black leading-[0.98] sm:text-6xl lg:text-7xl">
              Nous construisons
              <br />
              ce qui fait
              <br />
              <span className="text-brand">avancer votre activité.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink/70">
              Sites web, applications, maintenance, croissance digitale et photographie :
              un seul interlocuteur pour tout ce qui touche à votre présence en ligne.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/devis" className="btn-primary">
                Décrire mon projet <ArrowRight className="size-4" />
              </Link>
              <Link to="/services" className="btn-ghost">
                Voir les services
              </Link>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-2 gap-6 border-t border-line pt-6 sm:grid-cols-4">
              {[
                { k: String(categories.length || 4), v: 'pôles' },
                { k: String(services.length || 0), v: 'services' },
                { k: 'USD · CDF', v: 'devis' },
                { k: '48 h', v: 'réponse' },
              ].map((item) => (
                <div key={item.v}>
                  <dt className="text-sm font-semibold">{item.k}</dt>
                  <dd className="text-xs uppercase tracking-wider text-muted">{item.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="grid grid-cols-2 content-start gap-3">
              {categories.slice(0, 4).map((cat, i) => {
                const Icon = ICONS[cat.slug] ?? Code2;
                return (
                  <Reveal
                    key={cat.id}
                    delay={i * 0.07}
                    className={`card flex flex-col justify-between p-5 ${i === 0 ? 'bg-ink text-white' : ''}`}
                  >
                    <Icon className={`size-6 ${i === 0 ? 'text-brand' : 'text-brand'}`} aria-hidden />
                    <div className="mt-8">
                      <p className="text-sm font-semibold">{cat.name}</p>
                      <p className={`mt-1 text-xs ${i === 0 ? 'text-white/60' : 'text-muted'}`}>
                        {cat.tagline}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- pôles */}
      <section className="container-x py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Ce que nous faisons</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Quatre pôles, un seul studio</h2>
          </div>
          <Link to="/services" className="text-sm font-medium text-brand hover:underline">
            Tous les services
          </Link>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {categories.map((cat, i) => {
            const Icon = ICONS[cat.slug] ?? Code2;
            const count = services.filter((s) => s.category_id === cat.id).length;
            return (
              <Reveal key={cat.id} delay={i * 0.06} className="card group p-6">
                <div className="flex items-start justify-between">
                  <Icon className="size-6 text-brand" aria-hidden />
                  <span className="font-mono text-xs text-muted">{String(count).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-6 text-xl font-bold">{cat.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{cat.tagline}</p>
                <Link
                  to="/services"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand"
                >
                  Détail du pôle <ArrowUpRight className="size-4" />
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------ services */}
      {featured.length > 0 && (
        <section className="border-y border-line bg-wash">
          <div className="container-x py-16 sm:py-20">
            <p className="eyebrow">Prestations</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Les demandes les plus fréquentes</h2>
            <ul className="mt-10 divide-y divide-line border-y border-line">
              {featured.map((s) => (
                <li key={s.id} className="grid gap-2 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1 max-w-2xl text-sm text-ink/60">{s.summary}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-medium">{s.price_note ?? 'Sur devis'}</p>
                    <p className="text-xs text-muted">{s.duration_label ?? ''}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- méthode */}
      <section className="container-x py-16 sm:py-20">
        <p className="eyebrow">Méthode</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-black sm:text-4xl">
          Un déroulé simple, sans zone d’ombre
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {METHOD.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.05}>
              <p className="font-mono text-xs text-brand">{step.n}</p>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">{step.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- réalisations */}
      {projects && projects.length > 0 && (
        <section className="border-t border-line bg-wash">
          <div className="container-x py-16 sm:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Réalisations</p>
                <h2 className="mt-3 text-3xl font-black sm:text-4xl">Projets livrés</h2>
              </div>
              <Link to="/realisations" className="text-sm font-medium text-brand hover:underline">
                Tout voir
              </Link>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 3).map((p) => (
                <Link key={p.id} to={`/realisations/${p.slug}`} className="card group overflow-hidden">
                  <div className="aspect-[4/3] bg-ink/5">
                    {p.cover_url ? (
                      <img
                        src={p.cover_url}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="grid h-full place-items-center font-mono text-xs text-muted">
                        visuel à ajouter
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-brand">
                      {p.category ?? 'Projet'}
                    </p>
                    <h3 className="mt-2 font-semibold">{p.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-ink/60">{p.summary}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------------- CTA */}
      <section className="bg-ink text-white">
        <div className="container-x grid gap-8 py-16 sm:grid-cols-[1.2fr_0.8fr] sm:items-center sm:py-20">
          <div>
            <h2 className="text-3xl font-black leading-tight sm:text-4xl">
              Un projet en tête ? Décrivez-le en deux minutes.
            </h2>
            <p className="mt-4 max-w-xl text-white/60">
              Vous recevez une réponse sous 48 heures ouvrées, avec une proposition claire :
              périmètre, délai et prix.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 sm:justify-end">
            <Link to="/devis" className="btn-primary">
              Demander un devis
            </Link>
            <Link
              to="/reservation"
              className="btn border border-white/25 text-white hover:border-white/60"
            >
              Réserver une séance
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
