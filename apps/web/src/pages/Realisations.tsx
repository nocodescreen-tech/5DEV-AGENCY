import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { apiGet } from '../lib/api';
import type { Project } from '../lib/types';

import { SplitText } from '../components/motion/SplitText';
import { TiltCard3D, TiltLayer } from '../components/motion/TiltCard3D';
import { StaggerGroup, StaggerItem } from '../components/motion/RevealOnScroll';
export function Realisations() {
  const { data, isPending } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiGet<Project[]>('/api/v1/projects'),
  });

  return (
    <div className="container-x py-14 sm:py-20">
      <p className="eyebrow rule-in">Réalisations</p>
      <SplitText
        as="h1"
        text="Ce qui a été livré, et pour qui."
        step={0.07}
        className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl"
      />
      <p className="mt-5 max-w-2xl text-lg text-ink/65">
        Seuls les projets terminés et autorisés par le client sont publiés ici.
      </p>

      {isPending && <p className="mt-12 text-sm text-muted">Chargement…</p>}

      {data && data.length === 0 && (
        <div className="mt-12 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">Aucune réalisation publiée pour l’instant.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">
            Les projets livrés apparaîtront ici dès leur publication depuis la console.
            Aucun exemple fictif n’est affiché.
          </p>
          <Link to="/devis" className="btn-ghost mt-6">
            Parler de votre projet
          </Link>
        </div>
      )}

      <StaggerGroup className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((p) => (
          <StaggerItem key={p.id} className="h-full">
            <TiltCard3D className="h-full overflow-hidden rounded-2xl">
          <Link to={`/realisations/${p.slug}`} className="card group block h-full overflow-hidden">
            <div className="aspect-[4/3] bg-wash">
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
            <TiltLayer depth={22} className="p-5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-widest text-brand">
                  {p.category ?? 'Projet'}
                </p>
                {p.year && <span className="text-xs text-muted">{p.year}</span>}
              </div>
              <h2 className="mt-2 font-semibold">{p.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-ink/60">{p.summary}</p>
            </TiltLayer>
          </Link>
            </TiltCard3D>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </div>
  );
}

export function RealisationDetail() {
  const { slug = '' } = useParams();
  const { data, isPending, isError } = useQuery({
    queryKey: ['project', slug],
    queryFn: () => apiGet<Project>(`/api/v1/projects/${slug}`),
    retry: 0,
  });

  if (isPending) return <div className="container-x py-20 text-sm text-muted">Chargement…</div>;
  if (isError || !data)
    return (
      <div className="container-x py-20">
        <h1 className="text-2xl font-black">Réalisation introuvable</h1>
        <Link to="/realisations" className="btn-ghost mt-6">
          Retour aux réalisations
        </Link>
      </div>
    );

  return (
    <article className="container-x py-14 sm:py-20">
      <Link to="/realisations" className="inline-flex items-center gap-2 text-sm text-muted hover:text-brand">
        <ArrowLeft className="size-4" /> Réalisations
      </Link>

      <p className="eyebrow mt-8">{data.category ?? 'Projet'}</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">{data.title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/65">{data.summary}</p>

      {data.cover_url && (
        <img
          src={data.cover_url}
          alt={data.title}
          className="mt-10 w-full rounded-2xl border border-line object-cover"
        />
      )}

      {data.body && (
        <div className="mt-10 max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-ink/80">
          {data.body}
        </div>
      )}

      <dl className="mt-12 grid gap-6 border-t border-line pt-6 sm:grid-cols-3">
        {data.client_name && (
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Client</dt>
            <dd className="mt-1 text-sm">{data.client_name}</dd>
          </div>
        )}
        {data.year && (
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">Année</dt>
            <dd className="mt-1 text-sm">{data.year}</dd>
          </div>
        )}
        {data.live_url && (
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">En ligne</dt>
            <dd className="mt-1 text-sm">
              <a
                href={data.live_url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-brand hover:underline"
              >
                Voir le site <ArrowUpRight className="size-3.5" />
              </a>
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}
