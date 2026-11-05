# 13 — DÉCISIONS (ADR)

Format : contexte → options → décision → conséquences. Statuts : `proposed`, `accepted`,
`superseded`. Une décision n'est `accepted` qu'après validation du responsable du projet.

---

## ADR-001 — Repo unique en monorepo (apps/web + apps/api)

**Statut** : proposed · 05/11/2026
**Contexte** : le cahier des charges prévoit front, back, modules partagés et scripts. Deux dépôts
séparés multiplient les synchronisations pour une équipe d'une personne.
**Options** : (a) deux dépôts ; (b) monorepo npm workspaces.
**Décision proposée** : (b) monorepo. Types et schémas zod partagés dans `packages/shared`,
déploiements indépendants (front statique, API node).
**Conséquences** : un seul `npm install`, CI unique ; il faut veiller à ne pas coupler les
builds (chaque app garde son `package.json`).

## ADR-002 — Sessions httpOnly plutôt que JWT en localStorage

**Statut** : proposed · 05/11/2026
**Contexte** : console d'administration avec données commerciales et photos clients.
**Options** : (a) JWT en localStorage ; (b) session serveur + cookie `httpOnly`, `sameSite=lax`.
**Décision proposée** : (b). Révocation immédiate possible (déconnexion, bannissement),
pas de jeton lisible par un script.
**Conséquences** : table de sessions + purge périodique ; API et front sur le même domaine
ou configuration CORS/credentials explicite.

## ADR-003 — Stockage médias S3-compatible (R2) avec URLs signées

**Statut** : proposed · 05/11/2026
**Contexte** : photo de mariage/portrait = données personnelles ; le service doit pouvoir
afficher des miniatures sans rendre les originaux publics.
**Options** : (a) Cloudinary (transformation intégrée, coût à l'usage) ;
(b) S3-compatible (R2) + dérivés générés côté serveur.
**Décision proposée** : (b) — bucket privé, URLs signées HMAC, dérivés 400/900/1600 générés
à l'upload, cache `immutable`. Cloudinary reste possible plus tard pour la vidéo.
**Conséquences** : génération d'images côté serveur (sharp) à maintenir ; dépendance à R2.

## ADR-004 — Taux de change administrable, historisé, figé à l'émission

**Statut** : proposed · 05/11/2026
**Contexte** : exigence explicite — USD et CDF, jamais un simple changement de symbole.
**Options** : (a) taux live via API externe ; (b) taux saisi par un admin, historisé.
**Décision proposée** : (b) en V1 : table `currencies` append-only, saisie manuelle du taux
avec date d'effet. Le taux est **copié sur le devis/la facture** à l'émission.
**Conséquences** : une tâche de mise à jour régulière côté admin ; pas de dépendance à un
fournisseur de taux (coût et panne évités). Une API pourra alimenter la saisie plus tard.

## ADR-005 — Identité visuelle : direction à valider (Nebula)

**Statut** : proposed · 05/11/2026
**Contexte** : le brief fixe le positionnement (sérieux, exécution, proximité) mais pas la palette.
**Décision proposée** : attendre la proposition Nebula (`docs/02-BRAND-IDENTITY.md`) et la faire
valider avant toute implémentation d'interface. Deux pistes à comparer : (1) noir profond +
accent électrique, (2) papier clair + accent chaud.
**Conséquences** : le lot 3 ne démarre pas sans cette validation — c'est volontaire.

## ADR-006 — Périmètre V1 sans paiement en ligne

**Statut** : proposed · 05/11/2026
**Contexte** : encaisser par carte en RDC implique un prestataire, des frais et une conformité.
**Décision proposée** : V1 = enregistrement manuel des paiements (espèces, mobile money,
virement) avec reçus générés ; le paiement en ligne arrive après validation du volume.
**Conséquences** : la table `payments` est prévue pour un `provider_reference` afin de brancher
un PSP plus tard sans migration lourde.

---

## Décisions ouvertes à trancher avant le lot 1

| # | Question | Impact |
|---|---|---|
| 1 | Hébergement : free-first (Cloudflare Pages + Neon + R2) ou VPS | coût, maintenance, `docs/10` |
| 2 | Structure : monorepo (ADR-001) confirmé ? | arborescence |
| 3 | Direction artistique (ADR-005) | tout le lot 3 |
