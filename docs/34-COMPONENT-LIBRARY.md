# 34 — BIBLIOTHÈQUE DE COMPOSANTS ANIMÉS

Source unique des animations d'interface. Objectif : ne plus réinventer un effet au hasard
dans chaque page, et garantir que tout se comporte pareil partout (durées, courbes,
accessibilité, `prefers-reduced-motion`).

Tous les composants vivent dans `apps/web/src/components/`. Les jetons de mouvement sont
dans `design.css` (`--dur-*`, `--ease-*`).

---

## 1. Entrées de contenu

### `Reveal` — apparition au scroll
```tsx
<Reveal delay={80} className="...">
  <p>Contenu</p>
</Reveal>
```
- Anime `opacity` + `translateY(18px)` à l'entrée dans l'écran, une seule fois.
- Déclenche 25 % avant l'entrée (rootMargin) pour éviter le blanc au scroll rapide.
- Repli : visible après 700 ms, et `reveal-fallback` global après 2,5 s.
- `delay` sert la cascade entre blocs frères.

### `SplitHeadline` — titre mot par mot
```tsx
<SplitHeadline text="Les bonnes idées méritent mieux." accent="idées" step={55} />
```
- Chaque mot entre avec `translateY(105%) + rotateX(-52°)`, décalage 45–60 ms.
- `aria-label` sur le titre, fragments `aria-hidden` : le lecteur d'écran lit une phrase.
- Réservé aux titres courts (≤ 10 mots) : coût DOM d'un span par mot.
- Aucun mot n'est animé si `prefers-reduced-motion` est actif.

### `Stagger` — cascade d'enfants
```tsx
<Stagger step={40}><Card /><Card /><Card /></Stagger>
```
Ou, sans wrapper, `style={{ '--i': index }}` sur chaque enfant d'un `.stagger-group`.

### `MediaImage` — image responsive avec skeleton
- `srcSet` 900/1600, `width`/`height` fixes (CLS = 0), shimmer de chargement.
- `priority` : pas de fondu, `fetchpriority="high"` et aucun voile (l'image LCP ne doit
  jamais attendre une animation).
- Images secondaires : voile `clip-path` qui se lève au chargement (720 ms).

---

## 2. Surfaces interactives

### `TiltCard` — carte 3D
```tsx
<TiltCard max={10} className="h-full rounded-2xl">
  <article className="card lift p-6">…</article>
</TiltCard>
```
- Perspective 1100 px, rotation jusqu'à `max` degrés, reflet radial qui suit le pointeur.
- Contenu en profondeur : `.card3d-depth` (`translateZ(28px → 46px)`).
- `rAF` pour lisser le mouvement, retour amorti 520 ms.
- Ignoré au toucher et en mode réduit (aucune rotation appliquée).

### `.lift` — élévation au survol
`translateY(-4px)` + ombre portée + bordure orangée. À poser sur les cartes cliquables.
Combiné à `.zoom-parent` / `.zoom-img` pour un léger zoom d'image.

### `.press` / `:active` — retour tactile
Tous les boutons se compriment (`scale(.985)`, 1 px vers le bas). Jamais de `:active`
sans transition : l'appui doit se sentir.

---

## 3. Navigation et pages

### Indicateur de navigation glissant
Mesuré sur le lien réellement actif (`aria-current="page"`), déplacé par `transform`.
Aucune position devinée, aucun calcul d'index.

### `.page-transition` — entrée de route
Chaque changement de route rejoue `page-in` (320 ms). Combinée à `viewTransition` de React
Router, qui déclenche l'API View Transitions du navigateur (fondu/glissement natif entre
documents). Le chunk de route est chargé en `lazy` : l'écran précédent reste affiché.

### Indicateur de progression de lecture
`.scroll-progress`, piloté au `requestAnimationFrame`, `scaleX` selon la position.

---

## 4. Retour utilisateur (états réels)

| Composant | Rôle | États |
|---|---|---|
| `ConfirmDialog` | confirmation d'action destructive | idle → traitement → succès/erreur |
| `DeleteButton` | suppression complète (icône + dialogue + toast) | — |
| `useToast` / `ToastProvider` | notifications | success, error, entrée/sortie animées |
| `Skeleton` | contenu en chargement | pulsation douce |
| `EmptyState` | liste vide avec action | icône + titre + CTA |
| `ErrorState` | erreur avec solution | message + bouton « Réessayer » |
| `Progress` | avancement réel | valeur fournie par l'appelant |
| `.progress-indeterminate` | opération sans pourcentage connu | barre animée, aucune valeur inventée |

Règle : **aucun succès affiché avant la réponse du serveur**. Un toast vert n'apparaît
qu'après un `2xx`.

---

## 5. Contenu et données

| Composant | Détail |
|---|---|
| `Accordion` | FAQ, `grid-template-rows: 0fr → 1fr`, icône qui pivote à 45° |
| `Modal` | monté dans un **portail** sur `document.body` (sinon `position: fixed` casse sous un ancêtre transformé), Échap, verrou de scroll |
| `Tooltip` | info contextuelle au survol et au focus clavier |
| `Counter` | compteur animé, uniquement branché sur des données réelles |
| `Tabs` (page Services) | filtrage réel, `aria-selected`, compteur par catégorie |

---

## 6. Règles non négociables

1. Animer `transform` et `opacity` uniquement. Jamais `width`, `top`, `box-shadow` en boucle.
2. Durées : 140 ms (micro), 240 ms (base), 420 ms (section), 520 ms (entrée de page).
3. Une animation a une raison : elle indique un changement d'état, une direction, ou une
   hiérarchie. Pas d'effet décoratif permanent, sauf le badge flottant du hero (7 s, très
   faible amplitude).
4. `prefers-reduced-motion` neutralise **tout** : animations `none`, opacité 1, transforms
   annulés. Vérifié automatiquement.
5. Aucune animation ne bloque une interaction : les transitions de route utilisent un
   chunk en attente, jamais un `setTimeout` artificiel.
6. Pas de faux pourcentage, pas de faux délai de « traitement ».

---

## 7. Vérification automatisée

`npm run e2e` (voir docs/28) contrôle dans un vrai navigateur : carte 3D inclinée
(`matrix3d`), transition de route active, dialogue de confirmation, suppression réelle,
mode réduit sans contenu masqué, zéro erreur JavaScript.

Contrôles dédiés au mouvement (hors dépôt, `qa-5dev-motion.mjs`) : titre mot par mot,
filets de section dessinés, bouton qui s'élève au survol, badge animé, indicateur de nav,
accordéon, barre de progression.
