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

## 5 bis. Cartes 3D et transitions de route (ajout)

- `TiltCard` : perspective 1100 px, inclinaison jusqu'à 12°, reflet radial qui suit le
  pointeur, contenu en `translateZ(28→46px)`, retour amorti en 520 ms. Désactivée au
  toucher et en `prefers-reduced-motion`. Appliquée aux pôles, au catalogue d'accueil et
  aux cartes de la page Services.
- `.lift` + `.zoom-img` : élévation et zoom d'image au survol (résultats, services).
- `.page-transition` : chaque changement de route rejoue une entrée de 320 ms
  (`opacity` + `translateY(10px)`), côté public comme côté console.
- `.field:focus` : anneau orange progressif ; `.shake` pour un envoi invalide.
- Vérifié au navigateur : `getComputedStyle` renvoie bien une `matrix3d` pendant le survol,
  l'animation de page vaut `page-in`, et les icônes de suppression sont présentes sur
  chaque ligne des listes admin.

## 6. Ce qui reste à faire

- Transition de route : entrée seule (pas encore de sortie orchestrée avant navigation).
- Parallaxe sur le hero — volontairement écartée (coût CLS).
- Graphiques du tableau de bord : apparition progressive des barres (prévue, non faite).
- Micro-interactions sur les lignes de tableaux admin (survol) — partielles.

---

## 9. Couche Motion v2 (refonte du 2026-11-07)

Le système CSS de la V1 était perçu comme « quelques effets ». La V2 ajoute une couche
`motion/react` (déjà présent, `motion@11.15.0`) avec des jetons typés et des composants
mesurables. Aucun paquet supplémentaire n'a été installé.

### 9.1 Jetons et garde-fous

- `apps/web/src/lib/motion-tokens.ts` — durées (`instant` → `crawl`), courbes, distances,
  échelles, `tilt: 14`, `perspective: 1100`, ressorts nommés (`snappy`, `gentle`, `bouncy`,
  `instant`, `release`), cascade `0.05 / 0.07 / 0.10 s`.
- `apps/web/src/lib/use-safe-motion.ts` — `useSafeMotion`, `useMounted`, `usePointerEffects`.
  Les effets de pointeur ne sont coupés que par `prefers-reduced-motion` ou l'absence de
  survol (tactile) : un appareil à 4 cœurs garde l'inclinaison, qui coûte peu.
- `apps/web/src/motion.css` — couche CSS de la V2 (titres, cartes 3D, boutons, progression,
  parallaxe, section épinglée, tableaux, modales, squelettes). Tout est neutralisé en
  `prefers-reduced-motion` et sur `hover: none`.

### 9.2 Composants (`apps/web/src/components/motion/`)

| Composant | Effet réel | Où |
|---|---|---|
| `PageTransition` | `AnimatePresence mode="wait"` : sortie fondu + recul, entrée `clip-path` + flou, 600 ms | `SiteLayout`, `AdminLayout` |
| `SplitText` | mots ou caractères, entrée `translateY + rotateX(-55°) + blur`, cascade, mode `scramble` sur titre court | accueil, services, réalisations, agence, contact, devis, réservation |
| `TiltCard3D` / `TiltLayer` | perspective 1100 px, ±14°, ressorts, reflet radial + projecteur qui suivent le pointeur, couches `translateZ(26/42 px)` | accueil (10), services (15), agence (4), réalisations, dashboard (4), projets Workspace |
| `Magnetic` / `MagneticButton` | attraction du pointeur (ressort), ondulation au clic, reflet balayant, enfoncement, état chargement/succès | CTA d'en-tête, bouton d'envoi du contact |
| `ScrollProgress` | barre 3 px pilotée par `useScroll` + ressort, pourcentage au survol | toutes les pages publiques |
| `Parallax` | translation liée au défilement + échelle 1,14 → 1,06 sur les photos | accueil (3 images) |
| `StickyStory` | section épinglée 62 vh/étape, étape active selon la progression, points animés | accueil (méthode) |
| `RevealOnScroll` / `StaggerGroup` / `StaggerItem` | entrées `opacity + y + blur`, une seule fois, cascade 0,07 s | pages publiques, principes de l'agence |
| `AnimatedCounter` | compteur à ressort sur données réelles, `tabular-nums` | accueil |

`ui.tsx` (`TiltCard`) délègue désormais à `TiltCard3D` : toutes les cartes existantes en
bénéficient sans réécriture des pages.

### 9.3 Preuves mesurées (Playwright, Edge headless, 1440×900)

| Contrôle | Avant | Après |
|---|---|---|
| Cartes 3D au survol | `matrix3d` sur 65 % des pages | `matrix3d` + reflet + projecteur sur accueil/services/agence/console |
| Titres découpés | 1 page | 7 pages, 10–12 fragments en vol |
| Boutons au survol | `transform: none → none` | `none → matrix(1.015, …)` + ombre |
| Progressions de lecture | 2 px statique | barre 3 px pilotée au ressort |
| Parallaxe | 0 couche | 3 couches sur l'accueil |
| Transition de route | `page-in` CSS 320 ms | `AnimatePresence` avec sortie + `clip-path` |
| Lignes de tableau (console) | aucune | `row-in 0,36 s` avec cascade |
| LCP / CLS | 1 180 ms / 0 | 1 272–1 296 ms / 0 |

Scripts de vérification : `C:\Users\rene\clover\scripts\qa-motion-overhaul.mjs`
(public, avant/après) et `qa-motion-admin.mjs` (console, connexion TOTP réelle).
Captures : `C:\tmp\motion\{avant,apres,admin}`.
