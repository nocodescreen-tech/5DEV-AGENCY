# 21 — PROJECT MANAGEMENT (5DEV WORKSPACE)

État : **opérationnel** — création de projets, étapes générées depuis un modèle, tâches,
Kanban, dépendances, temps, documents, notes, activité, progression calculée.

## Deux niveaux distincts, un seul environnement

| Niveau | Contenu | Où |
|---|---|---|
| **5DEV Business** | clients, demandes, devis, réalisations, emails, newsletter | `/admin/demandes`, `/admin/services`, … |
| **5DEV Workspace** | projets, étapes, tâches, temps, livrables | `/admin/workspace`, `/admin/projets` |

Les deux partagent la même base, la même session et la même console. Un projet peut être
**client** (`client_name` renseigné) ou **interne** (aucun client, aucune commande).

## Modèle de données (réel)

```
project_templates (name, category, stages jsonb)
projects_pm       (reference auto PRJ-AAAA-NNN, name, category, client_name, owner_id,
                   status, priority, start_date, due_date, budget_*, technologies[],
                   objectives, deliverables[], deleted_at)
project_stages    (project_id, name, position, weight 1..10, status todo|doing|done,
                   validation_criteria, due_date, completed_at)
tasks             (project_id, stage_id, parent_id, title, status todo|doing|review|blocked|done,
                   priority, assignee_id, dates, estimate_minutes, checklist jsonb, deleted_at)
task_dependencies (task_id, depends_on_id)  -- PK composite, cycle refusé
time_entries      (project_id, task_id, started_at, ended_at, minutes, note, billable)
project_documents (name, url, kind link|file|spec|design|delivery, is_shared)
project_notes     (kind note|journal|decision|meeting|issue, title, body)
project_activities(kind, label, meta, actor_id)
```

## Catégories de projets

`dev-web · app-web · photo · marketing · infra · interne · recherche`
(choix libre à la création, aucun workflow imposé).

## Progression : calculée, jamais saisie

Moyenne pondérée par étape :

```
progression = Σ(poids_étape × ratio_étape) / Σ(poids_étape)
ratio_étape = tâches terminées de l'étape / tâches de l'étape (0 si aucune tâche)
```

Les tâches sans étape comptent comme une étape de poids 1. Conséquence vérifiée : une seule
tâche terminée sur un projet de 5 étapes donne **18 %**, pas 100 % — la pondération empêche
un projet « artificiellement fini ».

## API (préfixe `/api/v1/admin/pm`)

| Route | Rôle |
|---|---|
| `GET /overview` | compteurs, tâches urgentes, fil d’activité, temps de la semaine |
| `GET/POST /projects` | liste avec progression, création (génère les étapes du modèle) |
| `GET/PATCH/DELETE /projects/:id` | fiche complète, modification, archivage logique |
| `GET/POST /templates` | modèles d’étapes réutilisables |
| `POST /projects/:id/stages`, `PATCH/DELETE /stages/:id` | workflow par projet |
| `GET/POST /tasks`, `PATCH/DELETE /tasks/:id` | tâches (statut = Kanban) |
| `POST/DELETE /tasks/:id/dependencies[/:dep]` | dépendances, cycles refusés |
| `GET/POST /tasks/:id/comments` | commentaires |
| `POST /projects/:id/documents`, `DELETE /documents/:id` | documents (URL, interne ou partagé) |
| `POST /projects/:id/notes` | notes, journal, décisions, réunions, incidents |
| `POST /time/start`, `/time/stop`, `/time/manual`, `GET /time/report` | temps de travail |
| `POST /projects/:id/ai/summary`, `/ai/plan` | assistant IA (projet) |

## Ajouts du 06/11 (après le premier jet)

| Fonction | État | Détail |
|---|---|---|
| Jalons | **fait** | table `milestones`, création, validation horodatée, affichage dans le calendrier |
| Planning | **fait** | page `/admin/planning` : calendrier mensuel (tâches, jalons, séances photo) + chronologie |
| Chronologie (Gantt) | **fait (simple)** | barres proportionnelles aux dates réelles, retard en orange ; pas de dépendances dessinées |
| Affectation | **fait** | `/admin/pm/team` renvoie membres réels + charge (tâches ouvertes, minutes estimées) ; sélecteur sur chaque carte Kanban |
| Modèles gérables | **fait** | page `/admin/modeles` : création, duplication, archivage, réactivation |
| Rappels d'échéance | **fait** | scan horaire idempotent (clé `reminder_log` par tâche et par jour) → notifications ciblées |
| Sous-tâches | **partiel** | `parent_id` en base et index, interface encore à plat |
| Pièces jointes de tâche | **partiel** | colonne `task_id` sur `project_documents`, interface projet seulement |

## Écarts assumés

1. **Gantt et calendrier graphiques** : non faits. Les dates existent, les vues sont la liste
   filtrée et le Kanban. Un Gantt demande une librairie de timeline — lot dédié.
2. **Sous-tâches** : le champ `parent_id` existe, l’interface n’affiche qu’un niveau.
3. **Upload de fichiers** : les documents sont des **liens** (URL). L’upload réel dépend d’un
   stockage média, retiré avec les galeries (ADR-009).
4. **Membres/charge de travail** : `assignee_id` et `owner_id` existent ; l’interface
   d’affectation multi-utilisateurs viendra avec les rôles granulaires.
5. **Modèles éditables en UI** : les 7 modèles sont seedés par `npm run setup` et créables
   par API ; pas encore de formulaire de modèle dans la console.
