# 20 — OBSERVABILITÉ

État : socle en place (journal d’audit, journal IA, journal email, journal d’exécution,
sonde de santé). Pas encore de métriques exposées ni d’alerting.

## Ce qui est mesuré aujourd’hui

| Source | Table / endpoint | Contenu |
|---|---|---|
| Santé | `GET /healthz` | version, uptime, état base (`up` / `down` / `not_configured`) |
| Audit | `audit_logs` | connexion, envoi d’email, campagne, modification de réglages (acteur, IP, cible) |
| IA | `ai_usage` | tâche, modèle, tokens, latence, succès/échec, erreur |
| Emails | `email_outbox` | destinataire, état, tentatives, erreur, identifiant fournisseur |
| Automatisations | `automation_runs` | déclencheur, charge utile, étapes, durée, erreur |
| File de tâches | `jobs` | état, tentatives, `last_error`, prochaine exécution |
| Console | `/admin` | cartes temps réel, série 14 jours, activité récente, notifications |

## Ce qui n’existe pas encore (assumé)

1. **Métriques Prometheus / OpenTelemetry** : aucun export. Les données sont en base, pas
   scrapables. À ajouter en phase 5 (industrialisation).
2. **Alerting** : aucune alerte automatique (ni email, ni Slack) si l’API tombe ou si un
   job échoue définitivement. Aujourd’hui il faut consulter la console.
3. **Logs applicatifs structurés** : `console.log` / `console.error` uniquement. Pas de
   collecteur, pas de corrélation par requête (`request-id`).
4. **Traces** : aucune.
5. **Tableau de bord d’erreurs** : les échecs IA et email sont visibles module par module,
   pas agrégés.

## Plan recommandé (phase 5)

1. `request-id` par requête + logs JSON (un événement par ligne).
2. Endpoint `/metrics` (compteurs HTTP, latence p95, jobs en échec, appels IA par tâche).
3. Alerte : `jobs` en échec définitif → email au studio ; `/healthz` en échec → supervision
   externe (UptimeRobot gratuit ou équivalent).
4. Rétention : purger `ai_usage`, `email_outbox`, `automation_runs` au-delà de 90 jours.

## Règle de vérité

Aucun chiffre affiché dans la console n’est calculé côté frontend à partir de valeurs
codées : tout provient de requêtes SQL. Les captures de ce dossier ont été prises sur la
base locale réelle, avec les données de test produites par les vérifications.
