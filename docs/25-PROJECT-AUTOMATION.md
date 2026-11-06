# 25 — PROJECT AUTOMATION

État : les briques existent et tournent (file `jobs`, worker, notifications, moteur de
règles), mais **les automatisations propres au Workspace ne sont pas encore branchées**.
Ce document dit exactement ce qui marche et ce qui reste.

## Ce qui est déjà opérationnel

| Brique | Fichier | État |
|---|---|---|
| File de tâches en base | `jobs` (migration écosystème) | ✅ |
| Worker en processus (5 s, retry backoff) | `src/lib/worker.ts` | ✅ vérifié (tâche exécutée en < 7 s) |
| Journal d’activité projet | `project_activities` | ✅ alimenté par création/édition/temps |
| Notifications en console | `notifications` + cloche | ✅ créées par les règles existantes |
| Moteur de règles (déclencheur / conditions / actions) | `modules/automation.ts` | ✅ opérationnel sur `lead.created` et `booking.created` |
| Actions réelles | `ai_classify`, `notify_admin`, `email_client`, `set_lead_status` | ✅ |
| Garde anti-doublon 60 s | `automation_runs` | ✅ |

## Ce qui n’est PAS encore branché (assumé)

| Automatisation demandée | État | Ce qu’il manque |
|---|---|---|
| Nouveau projet → étapes depuis un modèle | **déjà fait, mais en synchrone** à la création (pas une règle) | rien — c’est le comportement de `POST /projects` |
| Échéance proche → rappel | ❌ | un déclencheur planifié (scan quotidien) qui enfile des jobs |
| Tâche en retard → alerte | ❌ | idem |
| Étape terminée → débloquer les tâches dépendantes | ❌ | dépendances **entre étapes** non modélisées (doc 22) |
| Projet bloqué → notification + analyse | ❌ | règle sur changement de statut projet |
| Projet terminé → rapport final | ❌ | génération de rapport non implémentée |
| Nouvelle commande → proposition de projet | ❌ | module commandes non construit |

## Pourquoi ce n’est pas fait

Le moteur de règles actuel raisonne sur deux déclencheurs (`lead.created`,
`booking.created`). Le Workspace demande des déclencheurs **temporels** (échéances) et
**d’état** (projet bloqué, étape terminée). Les ajouter proprement suppose :

1. d’étendre `Trigger` à `task.due_soon`, `task.overdue`, `stage.completed`, `project.blocked` ;
2. d’émettre ces événements depuis `workspace.ts` (statut de tâche, statut d’étape) ;
3. d’ajouter un planificateur qui enfile les scans quotidiens.

C’est un lot identifiable, pas un oubli : l’infrastructure (file + worker + journal) est
prête à le recevoir sans réécriture.

## Ce qu’il ne faut pas attendre

Aucune de ces automatisations n’existe « pour de faux » : il n’y a pas de règle fantôme
affichée dans l’interface. Ce qui apparaît dans `/admin/automatisations` correspond à des
règles réellement exécutables et exécutées.
