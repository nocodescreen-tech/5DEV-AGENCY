# AGENTS.md — 5DEV

Source de vérité du projet : `docs/01-CAHIER-DES-CHARGES.md`.
Ce fichier décrit **comment** on travaille, pas ce qu'on construit.

## Rôles

| Agent | Responsabilité | Sortie attendue |
|---|---|---|
| **Hermes** | chef de projet, orchestration, qualité, livraison | plan à jour, revues, décisions écrites (ADR), commits |
| **Nebula** | UI/UX, direction artistique, design system | `docs/02-BRAND-IDENTITY.md`, `docs/03-DESIGN-SYSTEM.md`, maquettes avant code |
| **Dev** | architecture, API, base de données, sécurité | `docs/04-ARCHITECTURE.md`, `docs/05-DATABASE.md`, `docs/06-API.md` |
| **Work** | exécution, fichiers, terminal, automatisation, tests | code + preuves d'exécution (commandes, captures, sortie non redirigée) |
| **Searcher** | ressources, documentation, licences | notes de veille, versions vérifiées, licences compatibles |

Workflow imposé : `Searcher → Dev → Nebula → Work → Hermes` (audit final avant livraison).
Aucun agent ne modifie un fichier qu'un autre tient ouvert sans coordination explicite.

## ECC — usage réel, pas déclaratif

ECC (Everything Claude Code) est un **écosystème de compétences** : sa présence ne garantit
aucune qualité. Règle : on ne cite que ce qui est installé et réellement exécuté.

Compétences ECC effectivement disponibles dans l'environnement Hermes de ce poste
(vérifié par `skills_list(category="ecc")`) :

| Compétence | Usage prévu sur 5DEV | Statut |
|---|---|---|
| `brownfield-retrospective` | audit du dépôt et registre d'écarts | **utilisée** (audit du 05/11) |
| `architecture-decision-records` | format des ADR de `docs/13-DECISIONS.md` | utilisé |
| `browser-qa` | QA navigateur après déploiement (console, CWV, 3 breakpoints, axe-core) | prévue (lot QA) |
| `ai-regression-testing` | tests de non-régression sur les parcours critiques | prévue |
| `agent-security-hardening` | revue du durcissement (sessions, RBAC, secrets) | prévue (revue sécurité) |
| `agent-harness-construction` | définition des outils/observations si agents internes | non requise à ce stade |
| `agent-eval`, `agent-introspection-debugging`, `continuous-agent-loop` | hors périmètre produit | non utilisées |

Ce tableau doit être mis à jour à chaque lot : une compétence marquée « prévue » qui n'a pas
tourné à la fin du lot passe en « non utilisée » avec la raison.

## Règles de conception

1. **Pas de code avant validation** : architecture, modèle de données et direction artistique
   validés avant la première ligne d'implémentation (`docs/13-DECISIONS.md`).
2. **Aucune invention** : pas de faux témoignages, pas de faux chiffres, pas de service
   non rendu. Les données de démonstration sont marquées comme telles.
3. **Sécurité par défaut** : validation aux frontières, secrets en environnement,
   RBAC sur chaque route admin, journalisation des actions sensibles.
4. **Preuve avant affirmation** : une fonctionnalité est « finie » quand une commande ou
   une capture le démontre, pas quand le code compile.
5. **Fichiers courts** : un module = une responsabilité, sous 400 lignes.

## Conventions

- Commits : `type(scope): description` (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`).
- Branches : `lot/<n>-<slug>` ; merge sur `main` après `npm run verify`.
- Un lot = un périmètre annoncé dans `docs/12-ROADMAP.md`, avec critères d'acceptation.
- Toute décision structurante non triviale → ADR dans `docs/13-DECISIONS.md`.

## Interdits

- Installer deux systèmes d'agents/règles concurrents : ECC + `.claude/` doivent rester cohérents.
- Commiter un `.env`, une clé, un dump de base ou une photo client.
- Modifier `main` directement sans passage par la vérification.
