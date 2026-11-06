# 03 — DESIGN SYSTEM

Implémenté dans `apps/web/src/index.css` (couche `@layer components`) et
`apps/web/tailwind.config.js`. Toute nouvelle interface réutilise ces primitives.

## Jetons

```
--brand      #F47721    --ink        #171717    --paper      #FFFFFF
--brand-600  #D9610F    --ink-soft   #2A2A2A    --line       #E6E2DD
--muted      #6B6B6B    --wash       #FAF8F5
```

Classes utilitaires maison : `.container-x` (largeur max 6xl + gouttières),
`.eyebrow` (étiquette monospace orange), `.card` (bordure + rayon 2xl),
`.field` / `.label` (champs de formulaire), `.btn`, `.btn-primary`, `.btn-ghost`.

## Composants

| Composant | Fichier | Notes |
|---|---|---|
| Structure de site (en-tête, nav, pied) | `components/SiteLayout.tsx` | nav responsive, menu mobile, réglages dynamiques |
| Apparition | `components/Reveal.tsx` | animé au montage (jamais dépendant du défilement) |
| Badge d’état | pages admin | vert = publié, gris = brouillon |
| Tableau de données | `pages/admin/AdminBookings.tsx` | défilement horizontal sur mobile |
| Formulaire multi-étapes | `pages/Devis.tsx` | progression visible, validation par étape |

## Règles d’interface

1. **Mobile d’abord** : testé à 390 px et 1440 px ; aucun tableau sans défilement horizontal.
2. **États explicites** : chargement, vide, erreur — jamais d’écran blanc silencieux.
3. **Erreurs de formulaire** : message sous le champ concerné + résumé en haut du bloc.
4. **Accessibilité** : `:focus-visible` orange, `aria-current` sur la progression,
   `aria-pressed` sur les créneaux, libellés associés à chaque champ, contraste AA.
5. **Animations** : 0,5 s maximum, courbe `[0.22, 1, 0.36, 1]`, coupées si
   `prefers-reduced-motion`.
6. **Icônes** : Lucide uniquement, taille 16 px (texte) ou 24 px (titres de section).

## À faire au lot suivant

- Extraire les composants répétés (`StatCard`, `DataTable`, `FormField`).
- Ajouter un mode sombre optionnel (décision non demandée à ce stade).
- Vérifier les contrastes sur les états désactivés (boutons `disabled`).
