# 26 — PROJECT AI ASSISTANT

État : **branché sur l’AI Gateway** (doc 15), avec deux tâches dédiées. Sans clé NVIDIA, le
repli est explicite et marqué — jamais présenté comme une réponse du modèle.

## Tâches disponibles

| Tâche | Route | Entrée | Sortie |
|---|---|---|---|
| `summarize` (résumé de projet) | `POST /api/v1/admin/pm/projects/:id/ai/summary` | projet + tâches réelles (statuts, échéances, retards) | texte de synthèse |
| `project_plan` (plan de projet) | `POST /api/v1/admin/pm/projects/:id/ai/plan` | cahier des charges libre | JSON `{etapes:[{nom, objectif, taches[]}]}` |

Le contexte envoyé est **construit côté serveur** à partir de la base : nom, référence,
statut, échéance, description, liste des tâches et statuts, nombre de retards. Aucune donnée
d’un autre projet n’est incluse.

## Garde-fous

1. **Lecture seule** : l’assistant ne crée, ne modifie et ne supprime rien. Il produit du
   texte que l’humain copie ou valide.
2. **Aucune action commerciale** : pas d’accès aux devis, factures ou paiements.
3. **Traçabilité** : chaque appel est journalisé dans `ai_usage` (tâche, modèle, tokens,
   latence, succès, erreur, acteur).
4. **Repli honnête** : sans clé, la réponse est préfixée `[repli sans fournisseur IA]` et
   `stubbed: true` est renvoyé dans la charge utile ; l’interface l’affiche tel quel.
5. **Pas de promesse chiffrée** : le prompt système interdit d’inventer prix ou délais.

## Ce que l’assistant ne fait pas (encore)

| Demande du cahier des charges | État |
|---|---|
| Résumer l’état d’un projet | ✅ |
| Identifier les retards | ✅ (comptés côté serveur, donnés au modèle) |
| Proposer un planning / des étapes | ✅ via `project_plan` (non appliqué automatiquement) |
| Transformer un cahier des charges en tâches | ✅ en texte/JSON — **création automatique des tâches non faite** |
| Générer une checklist | partiel (le plan contient des tâches, pas de checklist formelle) |
| Rédiger des comptes rendus de réunion | ❌ (aucune UI de réunion) |
| Préparer un rapport d’avancement exportable | ❌ |

## Validation avant modification

Règle appliquée dans le code : **aucune écriture déclenchée par l’IA**. Pour appliquer un
plan proposé, il faut créer les étapes/tâches manuellement (ou par API). C’est volontaire :
le brief exige une confirmation humaine sur toute modification importante, et la façon la
plus sûre de l’imposer est de ne pas donner de droit d’écriture au modèle.
