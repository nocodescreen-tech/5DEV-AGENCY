# 04 — ARCHITECTURE

## Stack

| Couche | Choix | Justification |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind | écosystème mature, build rapide, SSR non requis en V1 |
| Routage | React Router | SPA simple, pas de framework lourd à maintenir |
| Données serveur | TanStack Query | cache, revalidation, états de chargement explicites |
| État local | Zustand (si besoin) | uniquement pour l'UI (panier de devis, filtres) |
| UI | shadcn/ui + Lucide + Motion | composants accessibles, icônes cohérentes, animations sobres |
| Backend | Node + Express + TypeScript | même langage que le front, déploiement simple |
| ORM | Sequelize | migrations versionnées, modèle explicite |
| Base | PostgreSQL | transactions, contraintes, requêtes analytiques |
| Stockage médias | S3-compatible (R2/Cloudflare en cible) | originaux privés + URLs signées, coût maîtrisé |
| Auth | sessions httpOnly + RBAC | pas de JWT en localStorage (XSS) |
| Hash | argon2id | recommandation OWASP 2024+ |

## Structure du dépôt (monorepo)

```
5dev/
├── apps/
│   ├── web/                 # React + Vite (site public + console)
│   └── api/                 # Express + Sequelize
│       ├── src/
│       │   ├── modules/     # un dossier par domaine (auth, leads, quotes, albums…)
│       │   ├── middlewares/ # auth, rbac, validation, rate limit, erreurs
│       │   ├── db/          # connexion, modèles, migrations, seed
│       │   └── server.ts
│       └── tests/
├── packages/
│   ├── shared/              # types partagés, schémas zod, constantes (devises)
│   └── ui/                  # composants réutilisables (si extraits)
├── docs/                    # ce dossier
├── scripts/                 # outils (seed, sauvegarde, QA, vérif)
└── .env.example
```

Un module backend = `router.ts` + `service.ts` + `model.ts` + `schema.ts` (validation).
Aucun module n'importe le modèle d'un autre : on passe par le service.

## API

- Préfixe **`/api/v1`**, REST, réponses normalisées :

```json
{ "ok": true, "data": { }, "meta": { "page": 1, "total": 42 } }
{ "ok": false, "error": { "code": "VALIDATION", "message": "…", "fields": { } } }
```

- Pagination `?page=&limit=` (limit plafonné à 100), tri `?sort=-created_at`, filtres en query.
- Erreurs centralisées : un seul middleware, jamais de stack trace au client.
- Validation zod à l'entrée de chaque route (body, query, params).
- Documentation OpenAPI générée depuis les schémas (`docs/06-API.md`).

Modules : `auth`, `users`, `roles`, `services`, `categories`, `projects`, `media`,
`photography` (albums, photographs), `leads`, `quotes`, `orders`, `invoices`, `payments`,
`bookings`, `blog`, `testimonials`, `notifications`, `settings`, `currencies`, `audit`.

## Sécurité

1. Sessions : cookie `httpOnly`, `sameSite=lax`, `secure` en prod, durée 7 j, révocation en base.
2. RBAC : rôles `owner`, `admin`, `editor`, `photographer`, `client` — permissions par route.
3. Rate limit sur `/auth/*`, formulaires publics et `/files/*`.
4. URLs signées pour les médias privés (HMAC + expiration), `inline=1` pour l'affichage.
5. Secrets uniquement en variables d'environnement ; `.env` interdit au dépôt.
6. Journal d'audit : acteur, action, cible, IP, horodatage — en base, non modifiable par l'admin.
7. Sauvegardes : dump quotidien + copie hors site ; restauration testée une fois par trimestre.

## Performance

- Images : dérivés 400/900/1600 px, `srcset`, lazy loading, cache `immutable`.
- Bundle : découpage par route, budget 200 Ko JS sur l'accueil.
- Base : index sur les colonnes filtrées (`status`, `created_at`, `client_id`), pas de N+1.
- Budget mesuré : LCP < 2,5 s sur mobile 4G, CLS < 0,1.

## Découpage en lots

Voir `docs/12-ROADMAP.md`. Règle : un lot livrable seul, testable, déployable.
