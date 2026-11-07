import { Link } from 'react-router-dom';
import { useSettings } from '../components/SiteLayout';

import { SplitText } from '../components/motion/SplitText';
import { TiltCard3D } from '../components/motion/TiltCard3D';
import { StaggerGroup, StaggerItem } from '../components/motion/RevealOnScroll';
const PRINCIPES = [
  {
    title: 'La même personne du début à la fin',
    text: 'Celui qui répond au premier message est aussi celui qui construit et met en ligne. Vous ne racontez pas votre projet à quelqu’un de nouveau à chaque étape.',
  },
  {
    title: 'Ce qui est écrit arrive',
    text: 'On liste noir sur blanc ce qui est inclus, avant de commencer. Ce qui n’y est pas ne se retrouve jamais sur la facture sans vous avoir demandé.',
  },
  {
    title: 'Le prix ne bouge pas en route',
    text: 'Devis en dollars ou en francs congolais, taux affiché. Si le travail change vraiment, on refait un devis ensemble — on ne glisse pas la différence à la fin.',
  },
  {
    title: 'On dit non quand il faut',
    text: 'Si ce n’est pas dans notre métier, on le dit tout de suite. Mieux vaut vous envoyer ailleurs que prendre un projet qu’on ferait mal.',
  },
];

export default function APropos() {
  const settings = useSettings();
  const studio = settings?.studio;

  return (
    <div className="container-x py-14 sm:py-20">
      <p className="eyebrow rule-in">À propos</p>
      <SplitText
        as="h1"
        text="Une petite équipe, basée à Matadi, qui aime les choses bien faites."
        step={0.05}
        className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl"
      />
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/70">
        5DEV est né d’un constat simple : beaucoup d’entreprises d’ici ont besoin de compétences
        numériques qu’on ne trouve pas facilement au coin de la rue. Alors on a réuni le
        développement, l’infrastructure, la croissance et la photographie sous un même toit. On
        travaille en français, on explique ce qu’on fait, et on répond quand vous appelez.
      </p>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_0.8fr]">
        <div>
          <h2 className="text-2xl font-black">Comment nous travaillons</h2>
          <StaggerGroup className="mt-6 grid gap-6 sm:grid-cols-2" as="div">
            {PRINCIPES.map((p) => (
              <StaggerItem key={p.title}>
                <TiltCard3D className="h-full rounded-xl border-t border-line bg-paper p-4" lift={5}>
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/65">{p.text}</p>
                </TiltCard3D>
              </StaggerItem>
            ))}
          </StaggerGroup>
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
