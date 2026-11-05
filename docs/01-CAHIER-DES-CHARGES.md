# 01 — CAHIER DES CHARGES (périmètre fonctionnel)

Document de référence. Toute fonctionnalité livrée doit figurer ici ; toute ligne ici doit
finir livrée ou être retirée explicitement (pas de zone grise).

## 1. Pages publiques

| # | Page | Contenu attendu | Critère d'acceptation |
|---|---|---|---|
| 1 | **Accueil** | hero (promesse + 2 CTA), 4 pôles, preuves (réalisations), services phares, témoignages réels, journal, contact | on comprend l'offre en 5 s ; 2 CTA visibles sans scroll ; LCP < 2,5 s mobile |
| 2 | **Services** | 4 pôles → services détaillés (livrables, durée, à partir de quel prix), FAQ | chaque service a un prix de départ ou une mention « sur devis » assumée |
| 3 | **Réalisations** | grille filtrable (pôle, année), fiche projet (contexte, ce qui a été fait, résultat) | aucune réalisation sans visuel et sans accord client |
| 4 | **Photographie** | galeries publiques, tarifs de séance, réservation en ligne | réservation aboutit sans email préalable |
| 5 | **À propos** | l'entité, la méthode, les outils, la zone d'intervention | pas de faux effectif, pas de fausse ancienneté |
| 6 | **Journal (blog)** | articles, catégories, lecture | éditeur admin fonctionnel, SEO par article |
| 7 | **Contact** | formulaire, WhatsApp, email, adresse, horaires | message arrive en console < 5 s |
| 8 | **Légal** | mentions, confidentialité, conditions | pages réelles, pas de lorem |

## 2. Parcours de conversion

### 2.1 Demande de devis
Formulaire multi-étapes : type de besoin (pôle/service) → description + budget indicatif →
coordonnées → récapitulatif. Sans compte obligatoire. Génère un `lead` en base, notifie
l'admin, envoie un accusé de réception au client.

Critères : ≤ 4 étapes, sauvegarde locale du brouillon, anti-spam (rate limit + honeypot),
statuts `nouveau → en cours → devis envoyé → gagné/perdu`.

### 2.2 Réservation photographique
Choix de la prestation → date/créneau (créneaux réellement disponibles) → lieu → coordonnées
→ confirmation. Génère un `booking` lié à un `service` du pôle photographie.

Critères : pas de double réservation d'un créneau, acompte mentionné si applicable,
confirmation email + WhatsApp au studio.

## 3. Espace client

Connexion par code de dossier (nom + date de séance + code) — pas de mot de passe à retenir.
Contenu : devis et factures du client, statut des commandes, galeries photo privées
(consultation, favoris, téléchargement selon autorisation), historique.

## 4. Console d'administration (RBAC)

| Module | Fonctions minimales |
|---|---|
| Tableau de bord | demandes du jour, réservations, chiffre en attente, activité récente |
| Services & catégories | CRUD, ordre, publication, prix USD/CDF |
| Réalisations | CRUD projets, médias, mise en avant |
| Photographie | albums, upload multiple, couvertures, droits d'accès, expiration |
| Clients | fiches, historique, codes d'accès, accès galeries |
| Commercial | leads, devis (lignes, totaux, taux appliqué), commandes, factures, paiements |
| Contenus | articles, catégories, témoignages, pages légales |
| Paramètres | identité, contacts, réseaux, devises et taux, emails, sauvegardes |
| Journal d'audit | qui a fait quoi, quand, depuis quelle IP |

## 5. Devises (exigence explicite)

- Affichage **USD et CDF** ; devise de référence configurable.
- **Conversion réelle** via un taux administrable — jamais un simple changement de symbole.
- **Historique du taux** appliqué à chaque devis/facture (le taux est figé sur le document).
- Chaque transaction conserve sa **devise d'origine**.
- Le taux est saisi par un admin (source et fréquence définies en `docs/13-DECISIONS.md`).

## 6. Photographie et médias

- Originaux privés (stockage objet), jamais servis sans URL signée.
- Miniatures générées (grille ~900 px, aperçu 1600 px), cache long.
- Droits par album : public / privé avec code / expiré.
- Suppression d'une photo = original + dérivés.
- Aucune photo client utilisée en démonstration sans autorisation écrite.

## 7. Exigences transverses

- **Sécurité** : validation aux frontières, RBAC serveur, sessions httpOnly, rate limit sur
  auth et formulaires, secrets hors dépôt, journal d'audit.
- **SEO** : URLs lisibles, métadonnées par page, sitemap, données structurées `LocalBusiness`.
- **Performance** : images responsive, lazy loading, budget JS < 200 Ko sur l'accueil.
- **Accessibilité** : contraste AA, navigation clavier, focus visible, `prefers-reduced-motion`.
- **Mobile first** : 360 px → 1440 px, testés sur les deux extrêmes.

## 8. Hors périmètre V1

Paiement en ligne par carte, application mobile native, multi-langue complet, place de marché,
facturation électronique certifiée. Ces sujets sont notés en `docs/12-ROADMAP.md` (après V1).
