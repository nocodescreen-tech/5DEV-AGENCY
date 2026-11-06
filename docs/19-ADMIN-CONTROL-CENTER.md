# 19 — ADMIN CONTROL CENTER

État : socle réel en place (identité, catalogue, réalisations, demandes, réservations,
emails, newsletter, IA, automatisations, préférences). Ce qui reste à construire est listé
sans détour en fin de document.

## Modules opérationnels

| Module | Écran | Écrit en base | Remarque |
|---|---|---|---|
| Identité / contacts / devises | `/admin/reglages` | `settings` | alimente l’en-tête, le pied de page et la page contact |
| Services | `/admin/services` | `services`, `service_categories` | brouillon/publié, livrables, durée, mention de prix |
| Réalisations | `/admin/realisations` | `projects` | publication contrôlée, visuel par URL, lien vers le site livré |
| Demandes | `/admin/demandes` | `leads` | statuts, filtre, note interne, référence |
| Réservations | `/admin/reservations` | `bookings` | créneaux réellement uniques (index partiel) |
| Emails | `/admin/emails` | `email_outbox` | envoi réel Brevo, test au studio, journal |
| Newsletter | `/admin/newsletter` | `subscribers`, `campaigns`, `campaign_sends` | double opt-in, envoi aux confirmés |
| IA | `/admin/ia` | `ai_usage`, `ai_prompts` | état fournisseur, test de tâche, journal |
| Automatisations | `/admin/automatisations` | `automations`, `automation_runs` | activation, test réel, historique |
| Utilisateurs / permissions | — | `users`, `sessions` | 1 rôle `owner` actif ; `admin`/`editor` acceptés en base |
| Notifications | cloche | `notifications` | créées par les automatisations |
| Audit | — | `audit_logs` | connexions, envois, campagnes, réglages |
| File de tâches | — | `jobs` | worker en processus, retry avec backoff |

## Principe de personnalisation contrôlée

Toute donnée éditable passe par un schéma zod (serveur) : un champ manquant est refusé avec
un code 422 et la liste des champs fautifs. Aucune configuration libre (ex. HTML arbitraire
dans une page publiée) n’est exposée tant qu’un assainissement n’est pas en place.

## Écarts assumés — à planifier

| Module demandé | État | Raison |
|---|---|---|
| Gestionnaire de fichiers / médias | non fait | dépend d’un stockage média (Cloudinary prêt, upload retiré avec les galeries) |
| Éditeur de pages | non fait | risque XSS élevé, nécessite assainissement + versionnement |
| Constructeur de menus | non fait | les menus sont fixes (5 entrées) |
| Gestionnaire de formulaires | non fait | un seul formulaire dynamique (devis) aujourd’hui |
| Rôles & permissions granulaires | partiel | colonnes prêtes, interface et vérification par module à ajouter |
| Thème : édition des couleurs | partiel | 3 accents prédéfinis (bornés à l’identité), pas de sélecteur libre |
| Langues FR/EN | non fait | français uniquement ; aucune coquille i18n posée |
| Sauvegardes depuis l’interface | non fait | `pg_dump` documenté, pas d’UI |
| Journal système / logs applicatifs | partiel | `audit_logs` oui, pas de flux de logs applicatifs |
| Fonctionnalités activables (flags) | non fait | pas encore de table dédiée |
