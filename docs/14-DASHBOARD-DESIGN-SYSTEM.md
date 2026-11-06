# 14 — DASHBOARD : DESIGN SYSTEM & EXPÉRIENCE

État : **implémenté dans le code** (pas une maquette). Fichiers de référence :
`apps/web/src/lib/theme.tsx`, `apps/web/src/index.css`, `apps/web/src/pages/admin/AdminLayout.tsx`,
`apps/web/src/pages/admin/AdminDashboard.tsx`.

## Thèmes

| Exigence | Implémentation | Preuve |
|---|---|---|
| Mode clair | palette officielle (orange #F47721, blanc, noir #171717) | `:root` dans `index.css` |
| Mode sombre | mêmes rôles inversés (`--paper #0b0b0d`, `--ink #f2f1ee`) | `[data-theme='dark']` |
| Détection système | `matchMedia('(prefers-color-scheme: dark)')` + écoute du changement | `theme.tsx` |
| Mémorisation | `localStorage` clé `five.theme` **et** table `user_prefs` | `PUT /api/v1/admin/prefs` |
| Couleur d’accent | orange / ambre / rose, appliquée via `--brand` | `theme.tsx` (`ACCENTS`) |
| Densité | `comfortable` / `compact` → `data-density` | `index.css` |
| Sidebar rétractable | bouton + état mémorisé (`five.sidebar.collapsed`) | `AdminLayout.tsx` |
| Widgets réorganisables | non implémenté (voir « écarts ») | — |
| Préférences de notifications | lues/écrites en base, panneau cloche opérationnel | `prefs.ts` |

Bascule : bouton unique clair → système → sombre, avec `aria-label` explicite.

## Animations

- Transitions de page : apparition `Reveal` (0,5 s, courbe `[0.22,1,0.36,1]`), basée sur
  `animate` et non `whileInView` — un contenu ne peut jamais rester invisible.
- Sidebar : animation de largeur (200 ms) sans reflow brutal.
- Modales / notifications : panneau déroulant, pas de librairie externe.
- Statistiques : apparition en cascade (délai 50 ms par carte).
- Graphiques : SVG natif, points avec `<title>` (infobulle native, accessible).
- Skeleton : `animate-pulse` pendant le chargement du tableau de bord.
- `prefers-reduced-motion` : toutes les durées ramenées à 0,01 ms ; `Reveal` désactive
  l’animation à l’entrée.

Aucune animation décorative en boucle. Aucune librairie de graphes ajoutée : le besoin
(une courbe 14 jours) ne justifiait pas ECharts.

## Navigation (groupes réels)

`Vue générale · Commercial · Services · Intelligence artificielle · Marketing ·
Communication · Automatisation · Système`

Le filtrage par permission n’est pas encore actif : un seul rôle (`owner`) existe aujourd’hui.
La structure est prête (rôles `admin`, `editor` déjà acceptés en base).

## Écarts assumés (à traiter)

1. Widgets déplaçables : non faits. Le modèle `user_prefs.widgets` existe, l’UI non.
2. GSAP : non installé — aucune animation actuelle ne le justifie.
3. Thème appliqué aussi au site public (effet de bord voulu) mais les pages publiques ne
   sont pas optimisées pour le sombre au pixel près.
