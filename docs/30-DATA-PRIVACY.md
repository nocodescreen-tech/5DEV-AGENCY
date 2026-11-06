# 30 — DONNÉES PERSONNELLES ET CONFIDENTIALITÉ

État : inventaire réel des données stockées, finalités et durées. Aucune politique de
rétention automatisée n'est encore appliquée.

## 1. Ce que la base contient réellement

| Table | Données personnelles | Finalité | Sensibilité |
|---|---|---|---|
| `users` | email, nom, nom affiché, fonction, téléphone, avatar, mot de passe haché | comptes d'administration | élevée |
| `sessions` | hash de token, user-agent, IP, expiration | maintien de connexion | moyenne |
| `leads` | nom, email, téléphone, message, service, budget | traiter une demande commerciale | élevée |
| `bookings` | nom, email, téléphone, date de séance, lieu, notes | organiser une séance photo | élevée |
| `subscribers` | email, nom, statut, jeton, segments | newsletter avec consentement | moyenne |
| `campaign_sends` | email du destinataire, statut d'envoi | preuve d'envoi et désinscription | moyenne |
| `email_outbox` | destinataire, objet, contenu envoyé | journal d'envoi | moyenne |
| `time_entries` | auteur, minutes travaillées, note | suivi d'activité interne | faible |
| `ai_conversations` / `ai_messages` | contenu des échanges avec le modèle | historique de l'assistant | **élevée** (peut contenir des éléments commerciaux) |
| `ai_usage` | tâche, modèle, tokens, latence | suivi de coût et de panne | faible |
| `audit_logs` | acteur, action, IP, cible | sécurité et traçabilité | moyenne |
| `project_documents` | URL fournie par l'admin | documentation projet | variable (l'URL peut pointer vers du contenu sensible chez un tiers) |

Aucune donnée bancaire, aucun numéro de carte, aucune pièce d'identité n'est stockée.

## 2. Finalités et bases légales (formulation simple)

- **Demandes et réservations** : exécution d'une demande précontractuelle. Conservées tant
  que la relation commerciale existe, puis 12 mois.
- **Newsletter** : consentement explicite (double opt-in), retirable à tout moment via le
  lien de désinscription de chaque email.
- **Comptes administrateurs** : intérêt légitime (exploitation du service).
- **Journaux** : sécurité (détection d'abus).
- **Conversations IA** : usage interne de l'assistant, jamais publiées.

## 3. Sous-traitants (données qui sortent de la machine)

| Destinataire | Données transmises | Quand | Remarque |
|---|---|---|---|
| **NVIDIA** (via AI Gateway) | le texte du message + l'historique de la conversation (40 derniers messages) + le prompt système | à chaque envoi dans le chat ou appel de tâche | aucune donnée client n'est envoyée sans action humaine |
| **Brevo** | email, prénom/nom éventuel, contenu de l'email | envoi d'un email transactionnel ou d'une campagne | consentement requis pour la newsletter |
| **Cloudinary** | (prévu, non utilisé) | — | identifiants présents dans `.env`, aucun appel actif |

Point d'attention : **envoyer un message dans le chat transmet son contenu à NVIDIA**. Il ne
faut donc pas y coller de données client sensibles sans nécessité.

## 4. Durées de conservation

| Catégorie | Durée prévue | Appliquée automatiquement ? |
|---|---|---|
| Demandes perdues | 12 mois | ❌ (aucune purge) |
| Réservations passées | 24 mois | ❌ |
| Conversations IA | 6 mois | ❌ |
| `ai_usage`, `email_outbox` | 90 jours | ❌ |
| Sessions | expiration (14 jours) | ✅ à la lecture |
| Journaux d'audit | 12 mois | ❌ |

Aucun script de purge n'existe. **C'est un écart réel** par rapport à une politique de
confidentialité opposable.

## 5. Droits des personnes

| Droit | Comment il est assuré aujourd'hui |
|---|---|
| Accès | demande par email au studio ; extraction manuelle en base |
| Rectification | même canal |
| Effacement | suppression manuelle des lignes (`leads`, `bookings`, `subscribers`) |
| Opposition / retrait du consentement | lien de désinscription automatique (newsletter) |
| Portabilité | export markdown d'une conversation IA ; pas d'export de demande client |

Il n'existe **pas** d'interface « supprimer mes données » côté client. C'est un manque assumé
à ce stade (aucun espace client public n'est ouvert).

## 6. Mesures techniques associées

- Mots de passe hachés (scrypt), jamais stockés en clair, jamais journalisés.
- Clé NVIDIA chiffrée au repos (AES-256-GCM) et jamais renvoyée par l'API.
- Cookies de session `HttpOnly` + `SameSite=Lax`.
- Avatars : nom de fichier généré, type binaire vérifié, 400 Ko maximum.
- Aucune réponse d'erreur ne contient de requête SQL ni de chemin de fichier.
- `git grep "nvapi-"` : aucun secret dans le dépôt ; `.env` ignoré.

## 7. À faire avant d'ouvrir au public

1. Écrire une politique de confidentialité publiée sur le site (mentions + droits).
2. Purges automatiques (tâche planifiée) pour les durées du tableau §4.
3. Interface de suppression/export pour les demandes clients.
4. Chiffrement des colonnes les plus sensibles (`leads.message`, `ai_messages.content`) ou
   décision documentée de ne pas le faire.
5. Vérifier la politique de rétention de NVIDIA sur le compte utilisé.
