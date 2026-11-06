# 23 — TASK MANAGEMENT (tâches, Kanban, dépendances)

État : **opérationnel** — création, statut, priorité, échéance, étape, checklist, dépendances,
commentaires, Kanban avec mise à jour réelle en base.

## Statuts

`todo` → `doing` → `review` → `blocked` → `done`
Les cinq colonnes du Kanban sont ces statuts, dans cet ordre. `done` pose `completed_at`,
tout autre statut l’efface (une tâche rouverte redevient comptable dans la progression).

## Champs

| Champ | Usage |
|---|---|
| `title` (2–200) | intitulé |
| `description` | détail libre |
| `project_id` | obligatoire |
| `stage_id` | rattachement à une étape (facultatif) — détermine le poids de progression |
| `parent_id` | sous-tâche (un niveau d’UI aujourd’hui) |
| `priority` | `low · normal · high · urgent` |
| `assignee_id` | utilisateur (nullable, prêt pour plusieurs collaborateurs) |
| `start_date` / `due_date` | planification |
| `estimate_minutes` | prévisionnel |
| `checklist` | jsonb `[{label, done}]` |
| `position` | ordre dans la colonne |

## Kanban (console)

- 5 colonnes, glisser-déposer natif (HTML5 `dragstart` / `drop`).
- Le drop appelle `PATCH /admin/pm/tasks/:id {status}` — **la base est mise à jour**, la carte
  ne bouge pas seulement à l’écran.
- Chaque carte affiche étape, priorité non normale, échéance (en orange si dépassée),
  nombre de commentaires.
- Création rapide en haut du board : titre + étape + priorité + échéance.

## Dépendances

`task_dependencies(task_id, depends_on_id)` en clé composite.
- `POST /admin/pm/tasks/:id/dependencies {depends_on_id}` ;
- refus si `task_id = depends_on_id` ;
- **refus des cycles** : si `B dépend de A`, alors `A dépend de B` renvoie `409 CYCLE` ;
- `DELETE` pour retirer.

## Commentaires

`GET/POST /admin/pm/tasks/:id/comments` — auteur = utilisateur connecté, tri chronologique.

## Vues

| Vue | État |
|---|---|
| Kanban | **fait** (board du projet) |
| Liste transversale | **fait** (`/admin/taches`, filtres projet + statut) |
| Tableau | fait sous forme de tableau HTML (mêmes filtres) |
| Calendrier | non fait (les échéances sont listées, pas placées sur une grille) |
| Gantt | non fait |

## Écarts assumés

1. Sous-tâches : modèle prêt, UI à un seul niveau (pas de rendu imbriqué).
2. Pièces jointes de tâche : le modèle utilisé est celui des documents projet (doc 21), pas
   de pièce jointe par tâche.
3. Modèles de checklist : la colonne `checklist` accepte des éléments, mais aucun éditeur
   n’est exposé dans la console (création par API).
4. Réordonnancement des cartes : `position` existe ; le drag ne change que le statut.
