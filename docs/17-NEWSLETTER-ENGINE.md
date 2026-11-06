# 17 — NEWSLETTER ENGINE

État : **fonctionnel de bout en bout** — inscription, double opt-in, confirmation,
désinscription, campagne, envoi réel, journal par destinataire.

## Modèle

```
subscribers (email unique, token, status: pending|confirmed|unsubscribed|bounced, segments[])
campaigns   (name, subject, html, status: draft|scheduled|sending|sent|failed, sent_at)
campaign_sends (campaign_id + subscriber_id uniques → pas de double envoi, statut, provider_id)
```

## Parcours réel (vérifié en exécution)

1. `POST /api/v1/newsletter/subscribe` → crée `pending`, génère un jeton, envoie l’email de
   confirmation. En développement, l’URL de confirmation est renvoyée dans la réponse pour
   pouvoir tester sans boîte mail.
2. `GET /api/v1/newsletter/confirm?token=…` → passe en `confirmed` (+ `consented_at`).
3. `POST /api/v1/admin/campaigns` → brouillon (aucun envoi).
4. `POST /api/v1/admin/campaigns/:id/send` → envoie **uniquement aux `confirmed`**,
   par lot de 500 maximum, en remplaçant `{{unsubscribe_url}}` par un lien propre à chaque
   abonné, et journalise chaque destinataire dans `campaign_sends`.
5. `GET /api/v1/newsletter/unsubscribe?token=…` → `unsubscribed`, plus aucun envoi.

## Consentement

- Aucun envoi à un `pending` : le double opt-in est une barrière technique, pas une promesse.
- Un `unsubscribed` est exclu de toutes les requêtes d’envoi.
- Le lien de désinscription est injecté dans chaque message de campagne.
- Le statut `bounced` existe en base (alimentation par webhook Brevo à brancher — non fait).

## IA

`draft_newsletter` produit `{sujet, intro, sections[]}`. Utilisable pour préparer une
campagne, jamais pour l’envoyer : la création reste manuelle (formulaire), l’envoi exige un
clic de confirmation avec le nombre de destinataires affiché.

## Écarts assumés

1. **Éditeur visuel** : non fait. On édite du HTML dans une zone de texte, avec
   `{{unsubscribe_url}}` documenté. Un éditeur WYSIWYG est un lot à part.
2. **Programmation d’envoi** : le champ `scheduled_at` existe, le planificateur ne le lit pas
   encore. Aujourd’hui l’envoi est immédiat sur action humaine.
3. **Statistiques d’ouverture / clics** : non implémentées (nécessite un pixel de suivi et
   une redirection d’URL). Les compteurs disponibles sont : destinataires, envoyés, échecs.
4. **Segmentation** : champ `segments[]` présent et filtrable, mais aucune interface de
   création de segment. Les segments s’ajoutent à l’inscription (`?segment=`).
5. Import CSV d’abonnés : non fait.
