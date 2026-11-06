# 24 — TIME TRACKING

État : **opérationnel** — chronomètre, saisie manuelle, rapport 30 jours, graphique 14 jours.

## Modèle

```
time_entries(id, project_id, task_id?, actor_id, started_at, ended_at, minutes, note, billable)
index unique partiel : (actor_id) where ended_at is null  → une seule session ouverte
```

La contrainte d’unicité est **en base** : deux onglets ouverts ne peuvent pas créer deux
sessions simultanées. La seconde tentative reçoit `409 ALREADY_RUNNING`.

## Parcours

1. `POST /admin/pm/time/start {project_id, task_id?}` → ouvre une session (`started_at=now()`).
2. `POST /admin/pm/time/stop` → calcule `minutes = max(1, round(elapsed/60))`, écrit
   `ended_at`, journalise l’activité du projet.
3. `POST /admin/pm/time/manual {project_id, minutes, date?, note?}` → session déjà terminée
   (utile quand on a oublié le chronomètre).
4. `GET /admin/pm/time/report` → agrégats :
   - par projet (30 jours),
   - par tâche (top 15),
   - par jour (14 jours, pour le graphique).

## Console (`/admin/temps`)

- Bandeau « session en cours » avec arrêt en un clic.
- Temps par projet avec barres proportionnelles.
- Tâches les plus consommatrices.
- Démarrage rapide sur un projet (liste).
- Saisie manuelle (projet, minutes, date, note).
- Histogramme des 14 derniers jours (barres CSS, valeur au survol).

## Règles

- Une session non arrêtée ne compte **pas** dans les totaux (seul `ended_at is not null`
  est agrégé) : aucun temps « fantôme » gonflé artificiellement.
- `minutes` minimum 1 par session (évite les 0 s qui polluent les rapports).
- `billable` existe (défaut `true`) mais n’est pas encore exposé dans l’UI.

## Écarts assumés

1. **Comparaison prévisionnel / réel** : `estimate_minutes` et le temps réel existent tous
   deux, mais aucune vue ne les confronte encore.
2. **Export** : pas d’export CSV/PDF des rapports.
3. **Rapports hebdomadaires automatiques** : non envoyés (le worker et l’email existent,
   l’agrégation planifiée n’est pas branchée).
4. **Facturation du temps** : `billable` + budget existent ; aucun lien automatique vers une
   facture (le module facturation n’est pas encore construit).
