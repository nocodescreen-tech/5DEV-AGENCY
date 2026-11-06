# 32 — MOTION ENGINEERING

Système de mouvement de 5DEV. Il ne s'agit pas d'une collection d'effets : les durées, les
courbes et les composants sont communs, et chaque animation a une fonction.

## 1. Jetons de mouvement

Déclarés une seule fois dans `apps/web/src/design.css` (`:root`), utilisés partout.

| Jeton | Valeur | Usage |
|---|---|---|
| `--dur-fast` | 140 ms | survol, pression, changement de couleur |
| `--dur-base` | 240 ms | ouverture de menu, toast, bascule |
| `--dur-slow` | 420 ms | cascade de cartes, révélation de section |
| `--dur-enter` | 520 ms | entrée de page, modale |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | sorties rapides, entrées douces (défaut) |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | déplacements continus (barre indéterminée) |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | apparitions à ressort (pop) |

Règle : jamais de durée écrite en dur dans un composant. Si une valeur manque, on ajoute un
jeton.

## 2. Primitives réutilisables

| Classe / composant | Effet | Où |
|---|---|---|
| `.reveal` + `Reveal` | entrée au scroll, `translateY(18px)` + opacité | toutes les pages publiques |
| `.anim-rise` | entrée simple au montage | formulaires, panneaux |
| `.anim-fade` | fondu | overlays |
| `.anim-pop` | apparition à ressort | badges, pastilles |
| `.stagger > *` + `--i` | cascade de 55 ms | listes, grilles |
| `.tilt` | inclinaison 3D au pointeur (CSS only) | cartes de pôles, services |
| `.press` / `:active` | `translateY(1px) scale(.985)` | tous les boutons |
| `.progress-indeterminate` | barre de chargement réelle (sans faux pourcentage) | soumissions longues |
| `.pulse-soft` | respiration discrète | états « en cours » |
| `Counter` | compteur animé branché sur des données réelles | statistiques d'accueil |

Tout passe par `transform` et `opacity`. Aucune animation ne touche `width`, `top` ou
`box-shadow` en boucle.

## 3. Politique de réduction

`prefers-reduced-motion: reduce` neutralise **toutes** les primitives : `animation: none`,
`opacity: 1`, `transform: none`. Le contenu est immédiatement lisible, sans exception.

Filet de sécurité en plus : `Reveal` déclenche 25 % avant l'entrée dans l'écran, retombe à
l'état visible après 700 ms, et `main.tsx` ajoute la classe `reveal-fallback` sur `<html>`
après 2,5 s si un observateur n'a pas tourné. Un contenu ne reste jamais invisible.

## 4. Décisions d'outillage

| Outil | Décision | Raison |
|---|---|---|
| CSS transforms/transitions | **utilisé** | suffisant pour 95 % des cas, zéro dépendance, 60 fps |
| Motion (framer-motion) | **retiré du layout public** | bundle lourd pour des transitions faisables en CSS ; conservé sur les écrans où il apporte une orchestration réelle |
| GSAP | **non installé** | aucun besoin qui ne soit couvert par CSS + IntersectionObserver ; à reconsidérer si un scroll narratif complexe est demandé |
| Three.js / React Three Fiber | **non installé** | les cartes 3D demandées sont faisables en CSS 3D (`tilt`, `perspective`) ; ajouter WebGL maintenant pénaliserait les Android modestes |
| Lucide | **utilisé** | jeu unique et cohérent |

Contrainte assumée : si une scène 3D réelle devient nécessaire, elle sera chargée à la
demande (`lazy` + `Suspense`) et jamais sur mobile en réseau lent.

## 5. Transitions de route

Routes publiques en `lazy()` avec `Suspense` et un squelette de page. La navigation ne bloque
jamais : le contenu précédent reste affiché pendant le chargement du chunk suivant.

## 6. Ce qui reste à faire

- Transition de route animée entre pages (sortie/entrée) — aujourd'hui simple fondu de chargement.
- Parallaxe sur le hero — volontairement écartée (coût CLS).
- Graphiques du tableau de bord : apparition progressive des barres (prévue, non faite).
- Micro-interactions sur les lignes de tableaux admin (survol) — partielles.
