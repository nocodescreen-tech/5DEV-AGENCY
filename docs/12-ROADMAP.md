# 12 — ROADMAP / PLAN D'EXÉCUTION

Règle : un lot = un périmètre livrable seul, avec des critères d'acceptation vérifiables.
Aucun lot ne démarre avant que le précédent soit vérifié (sauf fondations parallèles explicites).

## Lot 0 — Fondations documentaires (EN COURS)

Livrables : `README.md`, `AGENTS.md`, `docs/00`, `01`, `04`, `05`, `10`, `12`, `13`, `.env.example`.
Critères : [x] dépôt décrit · [x] stack arrêtée · [ ] hébergement (reporté à la demande du client) · [ ] direction artistique (lot 3).

## Lot 1 — Squelette exécutable — ✅ fait (05/11/2026)

Monorepo `apps/web` + `apps/api` + `packages/shared`, TypeScript strict, lint, format,
`npm run verify` (typecheck + lint + tests) qui échoue si une erreur apparaît.
API : `/healthz`, gestion d'erreurs centralisée, connexion Postgres, migrations vides.
Web : une page qui appelle `/healthz` et affiche le statut.
Critères : `npm run verify` vert sur une base neuve ; `/healthz` répond en prod.

## Lot 2 — Modèle de données & admin de base

Migrations des entités V1 (`docs/05-DATABASE.md`), seed des rôles/permissions/settings.
Auth : login, logout, session, RBAC, journal d'audit, création du compte owner.
Console : coquille (navigation, tableau de bord vide mais réel).
Critères : connexion owner OK ; une route admin sans permission renvoie 403 ; audit log écrit.

## Lot 3 — Site public statique habillé (design system)

Design tokens (couleurs, typo, espacements), composants de base, accueil + services +
à propos + contact branchés sur des données réelles en base (pas de contenu codé en dur).
Critères : LCP < 2,5 s mobile ; 0 erreur console ; contraste AA ; contenu éditable en admin.

## Lot 4 — Conversion : devis & messages

Formulaire de devis multi-étapes → `leads` + notification admin + accusé de réception.
Formulaire de contact. Anti-spam (rate limit + honeypot).
Critères : une demande apparaît en console < 5 s ; email reçu ; brouillon conservé.

## Lot 5 — Photographie

Upload multiple, dérivés 400/900/1600, albums publics/privés/code, réservation de créneau,
galerie client (favoris, téléchargement autorisé), expiration.
Critères : une photo privée n'est jamais servie sans signature ; miniature < 100 Ko ;
double réservation impossible.

## Lot 6 — Commercial

Devis (lignes, totaux, TVA, taux figé), commandes, factures PDF, paiements, statuts.
Devises USD/CDF avec taux administrable et historique.
Critères : un devis émis conserve son taux ; une facture payée ne peut pas être supprimée.

## Lot 7 — Contenus & SEO

Blog (éditeur, catégories), témoignages, pages légales, sitemap, métadonnées, données
structurées, redirections.
Critères : article publié indexable ; sitemap valide ; og:image par page.

## Lot 8 — Qualité, sécurité, déploiement

Tests (unitaires sur les services, intégration sur les parcours devis/réservation/auth),
audit sécurité (RBAC, rate limit, en-têtes, secrets), CI (lint + typecheck + tests),
déploiement prod, sauvegarde + restauration testée, guide admin.
Critères : CI verte ; restauration prouvée ; `docs/11-ADMIN-GUIDE.md` livré.

## Après V1

Paiement en ligne (carte/mobile money), anglais, application mobile, espace client enrichi,
facturation électronique certifiée.

## Suivi

Le tableau ci-dessous est la source de vérité de l'avancement (à tenir à jour à chaque lot).

| Lot | État | Date | Preuve |
|---|---|---|---|
| 0 Fondations | en cours | 05/11/2026 | ce dossier |
| 1 Squelette | **fait** | 05/11/2026 | `npm run verify` (7 tests), `/healthz` = base up, capture 1440 px, build prod 103 Ko gzip |
| 2 Données & admin | **fait** | 06/11/2026 | schéma SQL appliqué, owner créé, auth session + RBAC, console 6 écrans |
| 3 Site public | **fait** | 06/11/2026 | 8 pages publiques réelles, palette #F47721, captures 1440/390 px, 0 erreur console |
| 4 Devis & contact | **fait** | 06/11/2026 | devis 3 étapes → lead en base (référence renvoyée), contact, réservation avec créneaux |
| 5 Photographie | **retiré du périmètre** | 06/11/2026 | décision client : pas de galeries dans 5DEV (ADR-009) |
| 6 Commercial | partiel | 06/11/2026 | devis/factures non implémentés ; taux USD/CDF administrable en place |
| 7 Contenus & SEO | à faire | — | — |
| 8 Qualité & prod | à faire | — | — |

## Extension « écosystème intelligent » (06/11/2026)

| Phase | Périmètre | État réel | Preuve |
|---|---|---|---|
| 1 — Fondations & identité | site public, dashboard, thèmes, services, réalisations | **fait** | captures 1440/390, 8 pages, thème persistant |
| 2 — Administration complète | demandes, réservations, clients, devis/factures, utilisateurs, personnalisation | **partiel** : demandes, réservations, réglages, préférences, notifications ; devis/factures PDF et rôles granulaires à faire | console 8 écrans |
| 3 — Intelligence artificielle | AI Gateway, registre de tâches, prompts, journal d’usage, classification | **fait côté code** ; appel NVIDIA réel conditionné à `NVIDIA_API_KEY` | 20 contrôles fonctionnels, `ai_usage` alimenté |
| 4 — Marketing & automatisation | newsletter double opt-in, campagnes, workflows, notifications | **fait** (éditeur visuel, statistiques d’ouverture et programmation d’envoi restant) | envoi réel Brevo, `automation_runs` |
| 5 — Industrialisation | tests, sécurité, monitoring, sauvegardes, production | **à faire** : CI, métriques, alerting, sauvegarde automatisée | doc 20 |

Documents associés : `14` à `20`.

## Module 5DEV WORKSPACE (06/11/2026)

| Élément | État | Preuve |
|---|---|---|
| Projets clients et internes | **fait** | 23 contrôles fonctionnels, projet créé en base |
| Workflows par étapes + 7 modèles | **fait** | 5 étapes générées depuis « Site vitrine » |
| Tâches, statuts, Kanban (drag → base) | **fait** | PATCH vérifié, statut relu |
| Dépendances + refus de cycle | **fait** | cycle renvoyé en 409 |
| Progression pondérée calculée | **fait** | 1 tâche sur 5 étapes → 18 %, pas 100 % |
| Chronomètre + saisie manuelle + rapport | **fait** | session 1 min, total 91 min, une seule session ouverte |
| Documents, notes, activité | **fait** | 9 entrées d’activité sur un projet de test |
| Assistant IA (résumé, plan) | **fait côté code** | `stubbed: true` sans clé NVIDIA |
| Automatisations Workspace (échéances, blocages) | **non branché** | doc 25 : déclencheurs temporels à ajouter |
| Gantt, calendrier, upload fichiers, modèles éditables | **non fait** | docs 21 à 23, écarts listés |

Documents : `21` à `26`.
