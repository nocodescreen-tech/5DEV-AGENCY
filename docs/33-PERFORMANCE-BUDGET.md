# 33 — BUDGET DE PERFORMANCE

Objectifs du cahier des charges, puis ce qui a été **réellement mesuré** sur cette machine,
avec la méthode et les limites. Aucun chiffre n'est repris d'un audit externe.

## 1. Cibles

| Indicateur | Cible | Source |
|---|---|---|
| LCP | ≤ 2,5 s | cahier des charges 5DEV |
| INP | ≤ 200 ms | idem |
| CLS | ≤ 0,1 | idem |
| FPS | 60 visés | idem |
| Lighthouse Performance | ≥ 90 visés | idem |

## 2. Méthode de mesure

- Build de production (`npm run build`), servi par `vite preview` (port 4173).
- Playwright + Microsoft Edge headless, CDP pour le profil mobile :
  réseau 1,6 Mb/s descendant / 750 kb/s montant, latence 150 ms, CPU bridé ×4.
- LCP lu via `PerformanceObserver` (`largest-contentful-paint`, buffered) ; CLS cumulé sur
  les décalages sans interaction ; FCP via `first-contentful-paint`.
- Trois profils : bureau 1440×900, mobile 390×844 (tactile, DPR 2, bridé), et
  `prefers-reduced-motion: reduce`.

Script : `C:\Users\rene\clover\scripts\qa-5dev-budget.mjs` (hors dépôt, outil de mesure).

## 3. Résultats mesurés (06/11/2026)

| Profil | FCP | LCP | CLS | Transfert initial |
|---|---|---|---|---|
| Bureau 1440×900 | 400 ms | **2 116 ms** | 0 | 127 Ko |
| Mobile 390×844, CPU ×4, 1,6 Mb/s, 150 ms | 624 ms | **1 924 ms** | 0 | 127 Ko |
| `prefers-reduced-motion` | 104 ms | 368 ms | 0 | 165 Ko |

Élément LCP identifié : la photographie du hero (`IMG`). Les trois profils passent sous
2,5 s et sous 0,1 de CLS.

## 4. Ce qui a fait gagner du temps

1. **Aucun fondu sur l'image LCP.** Le conteneur `.media` animait son opacité à l'arrivée ;
   l'image n'était donc « peinte » qu'après la transition. Les images prioritaires
   (`data-priority`) sont désormais affichées sans animation : LCP passé de ~3,4 s à ~2,1 s
   sur bureau, et de ~3,1 s à ~1,9 s sur mobile bridé.
2. **Coque de démarrage dans `index.html`** : un fond et un repère 5DEV sont peints avant le
   bundle, plus d'écran blanc pendant l'hydratation.
3. **Préchargement du hero** (`<link rel="preload" as="image">` avec `imagesrcset`).
4. **Images en WebP, deux tailles** (900 et 1600 px) avec `srcSet`/`sizes`, `width`/`height`
   fixes → CLS à 0.
5. **Routes en `lazy()`** : le bundle d'entrée ne contient pas l'administration.

## 5. Poids du build

| Fichier | Brut | gzip |
|---|---|---|
| JS d'entrée | 256 Ko | 81 Ko |
| CSS | 43 Ko | 9 Ko |
| HTML | 0,9 Ko | 0,5 Ko |

Les chunks d'administration et de Workspace sont séparés et chargés à la demande.

## 6. Limites honnêtes

- **INP non mesuré** : il demande une interaction réelle et un échantillon suffisant. Les
  outils présents ici ne le fournissent pas de façon fiable. À relever avec Lighthouse ou
  les données de terrain (CrUX) une fois le site en ligne.
- **Lighthouse non exécuté** : l'outil n'est pas installé sur cette machine. Les chiffres
  ci-dessus viennent de l'API Performance du navigateur, pas d'un score Lighthouse.
- **Machine locale** : un premier passage alors que dix processus Node tournaient en
  parallèle donnait 3 s de FCP. Les mesures ci-dessus ont été refaites après nettoyage des
  processus, avec un seul serveur API et un seul serveur de prévisualisation.
- **Pas de test sur appareil physique** : le profil mobile est émulé (CPU ×4, réseau bridé),
  ce qui est plus sévère qu'un téléphone récent mais moins fiable qu'un vrai Android bas de
  gamme.

## 7. Prochaines optimisations possibles

- Variante 600 px pour les très petits écrans (gain marginal, le 900 px est déjà à 25 Ko).
- Découpage manuel du bundle admin (déjà partiel via `lazy`).
- Mesure INP réelle après mise en ligne, avec un vrai trafic.
