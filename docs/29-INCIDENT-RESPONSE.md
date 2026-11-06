# 29 — RÉPONSE AUX INCIDENTS

État : **procédure écrite, non éprouvée**. Aucun incident réel n'a eu lieu ; aucune alerte
automatique n'existe. Ce document décrit ce qu'il faut faire, pas ce qui est outillé.

## 1. Détecter

Aujourd'hui, la détection est **manuelle** :

| Signal | Où regarder |
|---|---|
| Connexions anormales | `audit_logs` (événements `auth.login`) |
| Demandes en masse | compteurs de rate limiting (mémoire) + volume de `leads` |
| Clé NVIDIA compromise | consommation inhabituelle dans `ai_usage` / facturation NVIDIA |
| Erreur applicative | sortie du processus API (pas de collecteur) |
| Modification suspecte | `project_activities`, `audit_logs` |

Aucune alerte automatique (email/Slack) n'est configurée. **Point faible connu.**

## 2. Confiner

Dans l'ordre, sans discussion :

1. **Révoquer les sessions** :
   ```sql
   delete from sessions;            -- déconnecte tout le monde
   delete from sessions where user_id = '<id>';  -- un seul compte
   ```
2. **Supprimer la clé NVIDIA compromise** : console → IA et modèles → Supprimer, ou
   ```sql
   delete from secrets where name = 'nvidia_api_key';
   ```
   puis révoquer la clé côté NVIDIA (build.nvidia.com) — le code seul ne suffit pas.
3. **Couper l'API** si nécessaire : arrêter le processus Node.
4. **Changer le mot de passe** du compte concerné depuis le profil connecté (révoque les
   autres sessions automatiquement).

## 3. Constater

- `select * from audit_logs order by created_at desc limit 100;`
- `select * from ai_usage order by created_at desc limit 100;` (tokens, latence, erreurs)
- `select * from email_outbox order by created_at desc limit 50;`
- `select * from project_activities order by created_at desc limit 100;`
- Journaux du processus API (sortie standard, non persistée aujourd'hui).

## 4. Corriger

1. Identifier la faille (route, validation, permission).
2. Écrire un test qui échoue (reproduction), puis corriger, puis vérifier que le test passe.
3. Ajouter la règle manquante au doc 27 (threat modeling).

## 5. Communiquer

- Si des données clients ont pu être exposées : information factuelle aux personnes
  concernées, sans minimiser ni dramatiser.
- Si la clé NVIDIA est en cause : la révocation côté fournisseur précède toute explication.

## 6. Rotation des secrets

| Secret | Où il vit | Comment le changer |
|---|---|---|
| `SESSION_SECRET` | `.env` (hors dépôt) | changer la valeur, redémarrer → toutes les sessions et tous les secrets chiffrés deviennent illisibles (il faut reposer la clé NVIDIA) |
| Clé NVIDIA | base, chiffrée | console → IA et modèles → Enregistrer |
| Mot de passe admin | base, haché | profil → Mot de passe |
| Clé Brevo | `.env` | changer la valeur, redémarrer |

**Attention** : changer `SESSION_SECRET` rend les secrets stockés indéchiffrables. C'est
volontaire (rotation = re-saisie), mais il faut le savoir avant de le faire.

## 7. Ce qui manque pour une vraie capacité de réponse

1. Alertes automatiques (connexion depuis une nouvelle IP, échecs répétés, chute du service).
2. Journalisation structurée persistée avec identifiant de requête.
3. Sauvegardes automatiques + **test de restauration** (exigence explicite du brief).
4. Un plan de reprise avec objectifs RPO/RTO chiffrés.
