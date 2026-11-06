# 31 — VOIX DE MARQUE ET COPYWRITING

Ce document fixe la voix de 5DEV. Tous les textes du site, de la console et des emails
doivent pouvoir être lus à voix haute sans qu'on entende une brochure.

## 1. Qui parle

Une équipe de Matadi qui fait du développement, de l'infrastructure, de la croissance et de
la photographie. Elle connaît le terrain : connexions lentes, clients qui paient par Mobile
Money, entreprises qui n'ont personne pour gérer un site. Elle parle français, simplement.

Ce qu'on est : précis, direct, disponible.
Ce qu'on n'est pas : une agence qui promet des « solutions innovantes ».

## 2. Les cinq règles

1. **Commencer par le problème du lecteur**, pas par nous. « Un formulaire qui n'envoie plus
   rien » avant « nous proposons des services de maintenance ».
2. **Du concret, jamais d'adjectif creux.** « Un site de 5 pages, livré en trois semaines »
   vaut mieux que « des solutions sur mesure et performantes ».
3. **Varier le rythme.** Une phrase courte après une phrase longue. Le texte doit respirer.
4. **Dire ce qu'on ne fait pas.** « Le prix se discute au devis » est plus crédible qu'un
   faux tarif affiché.
5. **Ne rien inventer.** Pas de chiffre, pas de client, pas de témoignage, pas de délai qui
   n'a pas été validé. Un trou assumé vaut mieux qu'une phrase fausse.

## 3. Interdits

Ces formulations sont bannies (elles reviennent toutes seules dès qu'on écrit vite) :

- « Nous proposons des solutions innovantes »
- « Votre partenaire de transformation digitale »
- « Optimisez votre présence numérique »
- « Des solutions sur mesure adaptées à vos besoins »
- « L'excellence au service de votre réussite »
- « Propulsez votre activité vers de nouveaux horizons »
- « Nous mettons la technologie au cœur de votre réussite »

## 4. Avant / après (référence)

| Robotique | Voix 5DEV |
|---|---|
| Nous proposons des solutions digitales innovantes. | Vous avez une idée ? On peut lui donner vie. |
| Optimisez votre présence digitale. | Votre activité mérite d'être vue. Faisons en sorte qu'on vous remarque. |
| Nous développons des applications web modernes. | Des applications pensées pour votre quotidien et vos vrais besoins. |
| Contactez-nous pour vos projets. | Parlons de ce que vous aimeriez construire. |
| Nos services répondent à vos besoins. | Un problème à résoudre ? Commençons par en discuter. |

## 5. Où vivent les textes

| Contenu | Emplacement | Modifiable depuis la console |
|---|---|---|
| Titres et accroches de l'accueil | `apps/web/src/pages/Home.tsx` | non (code) |
| Textes des 15 services (résumé, description, livrables) | base `services` + `apps/api/scripts/content-services.mjs` | oui — Services |
| Catégories (nom, accroche) | base `service_categories` | oui — Services |
| Réalisations | base `projects` + `apps/web/src/pages/Realisations.tsx` | oui — Réalisations |
| FAQ | `apps/web/src/pages/Home.tsx` (`const FAQ`) | non (code) |
| Coordonnées, horaires, devises | table `settings`, onglet studio | oui — Règles |
| Emails transactionnels | `apps/api/src/lib/email.ts` (`emailLayout`) + modules | non (code) |
| Messages d'interface, états vides, erreurs | composants concernés | non (code) |

Centraliser davantage suppose de déplacer titres et FAQ en base. C'est faisable, mais tant que
le volume reste faible, le code est plus simple à relire. Les textes qui changent souvent
(services, réalisations, coordonnées) sont déjà en base.

## 6. Ton par contexte

- **Site public** : chaleureux, direct, jamais insistant. Le lecteur décide.
- **Devis / formulaire** : rassurant, précis sur ce qui se passe ensuite.
- **Console** : neutre et utile. Pas de « Super ! » ni de félicitations inutiles.
- **Emails** : une phrase de contexte, l'information, une action claire. Pas de pavé.
- **Erreurs** : ce qui s'est passé, ce qu'il faut faire, et rien d'autre.

## 7. Relire avant de publier

1. Lire à voix haute : si ça s'essouffle, réécrire.
2. Chercher les mots « solutions », « innovant », « sur mesure », « excellence ».
3. Vérifier qu'aucun chiffre n'est inventé.
4. Vérifier qu'un CTA dit ce qui se passe après le clic.
5. Traquer les doublons de structure entre deux paragraphes voisins.

## 8. État réel

- Accueil, Services, À propos, Contact : réécrits (06/11/2026).
- 15 fiches services : textes réels en base, livrables listés, aucun prix inventé.
- Messagerie, notifications, emails : gabarits revus, ton neutre et direct.
- Reste à faire : FAQ en base, pages blog (module non construit), messages d'erreur des
  formulaires longs.
