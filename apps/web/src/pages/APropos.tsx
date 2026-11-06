import { Link } from 'react-router-dom';
import { useSettings } from '../components/SiteLayout';
import { Reveal } from '../components/ui';

const PRINCIPES = [
  {
    title: 'Un interlocuteur unique',
    text: 'La même équipe conçoit, développe, met en ligne et photographie. Pas de chaîne d’intermédiaires.',
  },
  {
    title: 'Ce qui est écrit est livré',
    text: 'Le périmètre est écrit avant de commencer. Ce qui n’y figure pas fait l’objet d’un avenant, jamais d’une surprise.',
  },
  {
    title: 'Le prix annoncé est tenu',
    text: 'Devis en USD ou en CDF, taux indiqué, aucune ligne cachée. Le taux appliqué est celui du devis émis.',
  },
  {
    title: 'On dit non quand il faut',
    text: 'Si un besoin sort du périmètre de 5DEV, c’est dit immédiatement plutôt que facturé au rabais.',
  },
];

export default function APropos() {
  const settings = useSettings();
  const studio = settings?.studio;

  return (
    <div className="container-x py-14 sm:py-20">
      <p className="eyebrow">À propos</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
        5DEV, une agence numérique basée à Matadi.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/70">
        5DEV accompagne les entreprises, institutions et créateurs de la région sur tout ce qui
        touche à leur présence numérique : sites et applications, infrastructure, croissance et
        photographie. Le travail se fait en français, avec des livrables documentés et un
        interlocuteur qui répond.
      </p>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <h2 className="text-2xl font-black">Comment nous travaillons</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {PRINCIPES.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.05} className="border-t border-line pt-4">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{p.text}</p>
              </Reveal>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl bg-wash p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">En pratique</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Zone d’intervention</dt>
              <dd className="mt-1">{studio?.address ?? 'Matadi, RDC'} — et à distance.</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Langues</dt>
              <dd className="mt-1">Français (courant) · échanges écrits documentés</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">Devises</dt>
              <dd className="mt-1">USD et CDF, taux indiqué sur chaque document</dd>
            </div>
            {studio?.hours && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">Disponibilité</dt>
                <dd className="mt-1">{studio.hours}</dd>
              </div>
            )}
          </dl>
          <Link to="/contact" className="btn-primary mt-6 w-full">
            Prendre contact
          </Link>
        </aside>
      </div>

      <section className="mt-16 border-t border-line pt-10">
        <h2 className="text-2xl font-black">Ce que 5DEV n’affiche pas</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/65">
          Aucun témoignage inventé, aucun chiffre d’ancienneté non vérifiable, aucune réalisation
          qui n’a pas été livrée. Les pages Réalisations et Journal ne se remplissent que de
          contenus réels, publiés depuis la console.
        </p>
      </section>
    </div>
  );
}
