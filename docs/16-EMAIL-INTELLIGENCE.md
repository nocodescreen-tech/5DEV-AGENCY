# 16 — EMAIL INTELLIGENCE

État : **transport réel + journal + génération assistée**. La réception IMAP n’est pas
implémentée (voir « écarts ») — la boîte centralisée s’appuie sur les demandes du site.

## Séparation stricte IA / transport

| Couche | Fichier | Responsabilité |
|---|---|---|
| Transport | `apps/api/src/lib/email.ts` | envoi via **Brevo API**, journalisation `email_outbox` |
| Génération | `apps/api/src/modules/ai/gateway.ts` | rédaction (`draft_reply`, `draft_email`) |
| Console | `apps/web/src/pages/admin/AdminEmails.tsx` | envoi manuel, test, lecture du journal |

L’IA ne peut pas envoyer : aucune fonction d’envoi n’existe dans la passerelle IA.
Un brouillon généré doit être copié dans le formulaire d’envoi par un humain.

## Flux d’un email

```
Console / automatisation
   └── sendEmail({to, subject, html})
         ├── insertion email_outbox (status=queued)
         ├── POST api.brevo.com/v3/smtp/email
         ├── succès → status=sent + provider_id + sent_at
         └── échec  → status=failed + error (jamais de faux succès)
```

`email_outbox` conserve destinataire, objet, HTML, état, tentatives, erreur et identifiant
fournisseur. La console affiche les 100 derniers envois.

## Classification des messages

Deux niveaux, tous deux réels :

1. **Déterministe** (toujours actif) : le formulaire du site qualifie la demande (`kind`,
   service, budget) et l’automatisation `lead.created` applique des conditions.
2. **IA** (`ai_classify` dans une automatisation) : produit `pole`, `priorite`, `resume`
   et l’écrit dans la note interne de la demande. Sans clé NVIDIA, le repli déterministe
   est utilisé et **marqué comme tel**.

Aucune détection de spam par IA : le formulaire utilise un honeypot + limitation de débit
(6 demandes / 10 min / IP), ce qui est vérifiable et suffisant à ce stade.

## Modèles d’email

`emailLayout()` produit un HTML sobre (identité orange/blanc/noir), avec pied de mention et
lien de désabonnement injecté pour les newsletters (`{{unsubscribe_url}}`).

## Écarts assumés

1. **Réception IMAP non implémentée** : aucune boîte `contact@5dev.com` n’existe encore
   (les adresses du domaine ne sont pas créées). La « boîte de réception » du produit est la
   liste des demandes du site, qui est réelle et alimentée par les formulaires.
2. Pas de pièces jointes entrantes (dépend de la réception).
3. Pas de réponse en fil (threading) : chaque envoi est indépendant.
4. Statistiques d’ouverture : non faites pour les emails transactionnels (non pertinent) ;
   pour les campagnes, l’ouverture n’est pas encore suivie (pas de pixel). Voir doc 17.
