# 22 — WORKFLOW ENGINE (étapes de projet)

État : **configurable par projet**, rien n’est codé en dur.

## Principe

Un projet ne « connaît » pas son cycle de vie : il reçoit des **étapes** (`project_stages`)
au moment de sa création, à partir d’un **modèle** (`project_templates.stages`). Changer de
métier = changer de modèle, pas de code.

```json
{
  "name": "Site vitrine",
  "category": "dev-web",
  "stages": [
    { "name": "Analyse", "weight": 2 },
    { "name": "Design", "weight": 2 },
    { "name": "Développement", "weight": 4 },
    { "name": "Tests", "weight": 2 },
    { "name": "Livraison", "weight": 1 }
  ]
}
```

## Modèles disponibles (seedés)

| Modèle | Étapes | Poids total |
|---|---|---|
| Site vitrine | Analyse, Design, Développement, Tests, Livraison | 11 |
| E-commerce | Analyse, Catalogue, Panier, Paiement, Tests, Lancement | 14 |
| Application web | Cahier des charges, Architecture, UI/UX, Développement, QA, Mise en production | 16 |
| Photographie | Réservation, Préparation, Shooting, Retouche, Livraison | 11 |
| Marketing | Audit, Stratégie, Préparation, Campagne, Analyse | 13 |
| Infrastructure | Audit, Configuration, Déploiement, Sécurisation, Validation | 13 |
| Projet interne | Recherche, Planification, Développement, Tests, Lancement | 11 |

## Opérations réellement disponibles

| Opération | Route | Effet |
|---|---|---|
| Ajouter une étape | `POST /admin/pm/projects/:id/stages` | insérée en fin (position calculée) |
| Renommer / repondérer | `PATCH /admin/pm/stages/:id` | mise à jour immédiate |
| Valider une étape | `PATCH … {status:'done'}` | `completed_at` posé, activité journalisée |
| Réouvrir une étape | `PATCH … {status:'todo'}` | `completed_at` effacé |
| Supprimer | `DELETE /admin/pm/stages/:id` | les tâches liées repassent « sans étape » (FK `set null`) |
| Réordonner | `PATCH … {position}` | tri par position |

Depuis la console : cliquer une étape la valide ou la réouvre (bascule `done ↔ todo`).

## Poids = pondération de la progression

Le `weight` (1 à 10) pèse dans le calcul de progression du projet (doc 21). Un projet
photographique peut donc valoriser le shooting à 4 et la livraison à 1, sans que la formule
change.

## Ce qui n’est pas fait

1. **Dépendances entre étapes** : seules les dépendances **entre tâches** existent
   (`task_dependencies`). Un graphe d’étapes (étape B après étape A) n’est pas modélisé.
2. **Critères de validation bloquants** : `validation_criteria` est stocké et affiché, mais
   ne bloque pas la validation d’une étape.
3. **Réordonnancement par glisser-déposer** : l’API accepte `position`, l’UI n’expose pas
   encore le drag.
4. **Édition des modèles en console** : création par API / seed uniquement.
