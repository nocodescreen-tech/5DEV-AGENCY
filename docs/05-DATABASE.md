# 05 — BASE DE DONNÉES

PostgreSQL. Convention : `snake_case`, clés primaires `uuid` (`gen_random_uuid()`),
`created_at`/`updated_at` en `timestamptz`, suppression logique (`deleted_at`) sur les
objets commerciaux — jamais de suppression physique d'une facture ou d'un paiement.

## Entités et relations (V1)

```
users ─┬─< user_roles >─ roles ─< role_permissions >─ permissions
       └─< audit_logs

clients ─┬─< leads
         ├─< quotes ─< quote_items
         ├─< orders ─< order_items
         ├─< invoices ─< invoice_items ─< payments
         ├─< bookings
         └─< album_permissions >─ albums

service_categories ─< services ─┬─< projects
                                ├─< bookings
                                └─< quote_items (référence tarifaire)

projects ─< project_media >─ media
albums ─< photographs >─ media
blog_categories ─< blog_posts
testimonials · notifications · settings · currencies
```

## Tables clés — contraintes

### `users`
`email` unique, `password_hash` (argon2id), `status` (`active|disabled`),
`last_login_at`. Un utilisateur `client` est relié à un `client_id` unique.

### `roles` / `permissions`
`roles.slug` unique (`owner|admin|editor|photographer|client`).
`permissions.code` unique (`leads.read`, `quotes.write`, `albums.publish`…).
`user_roles(user_id, role_id)` PK composite ; `role_permissions(role_id, permission_id)`.

### `clients`
`first_name`, `middle_name`, `last_name` (le triplet utilisé pour le code d'accès),
`email`, `phone`, `access_code_hash`. Index sur `(lower(last_name), lower(first_name))`.

### `services`
`category_id` FK, `slug` unique, `title`, `summary`, `description` (rich text),
`price_from_usd` numeric(12,2), `price_from_cdf` numeric(14,2), `billing_unit`,
`duration_days`, `is_published`, `position`.

**Règle devise** : `price_from_usd` et `price_from_cdf` sont saisis ensemble ; un prix
CDF n'est jamais recalculé silencieusement à l'affichage — la conversion affichée est datée.

### `leads`
`source` (`contact|quote|booking|whatsapp`), `status` (`new|in_progress|quoted|won|lost`),
`service_id` nullable, `budget_currency` (`USD|CDF`), `budget_amount`, `message`,
`contact_name`, `contact_email`, `contact_phone`, `assigned_to` (users.id),
`deleted_at`. Index `(status, created_at desc)`.

### `quotes` / `invoices`
`number` unique et lisible (`DEV-2026-0001`, `FAC-2026-0001`), `client_id`,
`currency` (`USD|CDF`), `fx_rate` numeric(14,6) — **taux figé à l'émission**,
`fx_rate_date`, `subtotal`, `tax`, `total`, `status`, `issued_at`, `valid_until`, `pdf_key`.

`quote_items` : `quote_id`, `service_id` nullable, `label`, `quantity`, `unit_price`,
`line_total`. Interdiction de supprimer une ligne d'un devis déjà accepté (remplacement
par une nouvelle version).

### `payments`
`invoice_id`, `amount`, `currency`, `method` (`cash|mobile_money|transfer|card`),
`reference`, `paid_at`, `recorded_by`. Un paiement ne se modifie pas : on annule
(`voided_at` + motif) et on enregistre le remboursement.

### `bookings`
`client_id` nullable (réservation sans compte autorisée), `service_id`, `shoot_date`,
`slot` (`morning|afternoon|evening`), `location`, `status`
(`pending|confirmed|done|cancelled`), `deposit_amount`, `deposit_currency`.
Contrainte d'unicité fonctionnelle : `unique(service_id, shoot_date, slot)` sur les
statuts actifs (index partiel).

### `albums` / `photographs`
`albums` : `client_id`, `slug` unique, `visibility` (`private|code|public`),
`access_code_hash`, `expires_at`, `cover_media_id`.
`photographs` : `album_id`, `media_id`, `position`, `deleted_at`.
`album_permissions` : `album_id`, `client_id`, `can_download`.

### `media`
`storage_key` unique, `kind` (`original|thumb|preview`), `width`, `height`, `bytes`,
`mime`, `sha256` (déduplication), `storage` (`r2|local`), `variants` jsonb
(chemins des dérivés 400/900/1600).

### `settings`
`key` unique, `value` jsonb, `updated_by`. Clés sensibles jamais exposées côté public
(liste blanche explicite dans l'API, comme sur Clover).

### `currencies`
`code` (`USD|CDF`), `label`, `symbol`, `is_base`, `rate_to_base` numeric(14,6),
`effective_from`, `source`. Historique append-only : un nouveau taux = une nouvelle ligne.

### `audit_logs`
`actor_type` (`user|client|system`), `actor_id`, `action`, `target_type`, `target_id`,
`ip`, `user_agent`, `meta` jsonb, `created_at`. Aucune route ne permet de supprimer.

## Règles de suppression

| Objet | Règle |
|---|---|
| `invoices`, `payments`, `quotes` acceptés | jamais supprimés (statut `voided`/`cancelled`) |
| `clients` | supprimés logiquement ; anonymisation sur demande (RGPD-like) |
| `media` | suppression physique uniquement si aucun document ne le référence |
| `albums` | expiration = accès coupé, fichiers purgés après délai de grâce |
| `users` | désactivation, jamais suppression si `audit_logs` liés |

## Index à créer dès la V1

`leads(status, created_at desc)` · `bookings(shoot_date, slot)` · `photographs(album_id, position)`
· `media(sha256)` · `invoices(client_id, issued_at desc)` · `audit_logs(created_at desc)`
· `services(category_id, position)` · `blog_posts(slug)` · `settings(key)`.
