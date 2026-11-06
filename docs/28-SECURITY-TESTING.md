# 28 — TESTS DE SÉCURITÉ

État : suite automatisée **réelle** (Vitest + supertest), exécutée à chaque `npm test`.
Les outils externes (ZAP, Semgrep, Trivy, Snyk) ne sont pas installés — voir plus bas.

## Ce que la suite vérifie (fichiers concernés)

### `apps/api/tests/security.test.ts` — 16 tests

| Contrôle | Assertion |
|---|---|
| En-têtes durcis | `nosniff`, `DENY`, `Referrer-Policy`, CSP `default-src 'none'`, `X-Powered-By` absent |
| Cache | `Cache-Control: no-store` sur les réponses API |
| CORS autorisé | origine `http://localhost:5173` → en-tête posé + `credentials: true` |
| CORS refusé | origine inconnue → **aucun** en-tête `Access-Control-Allow-Origin` |
| Pré-vol | `OPTIONS` → 204, sans corps |
| Refus par défaut | 8 routes `/api/v1/admin/*` → 401 `UNAUTHENTICATED` sans session |
| 404 propre | route inconnue → 404 normalisée, aucune trace de pile ni chemin |
| Pas de secret | `/healthz` ne contient ni `nvapi-`, ni `postgres://`, ni `password` |

### `apps/api/tests/ecosystem.test.ts` — 16 tests

- 10 routes d'administration refusent l'accès sans session.
- Validation stricte : email invalide, tâche IA inconnue, envoi email sans destinataire,
  thème inconnu, déclencheur d'automatisation inconnu → 422 (ou 401 avant validation).
- Désinscription avec jeton inconnu → page explicite, jamais 500.

### `apps/api/tests/workspace.test.ts` — 10 tests

- Isolation : toutes les routes `/admin/pm/*` exigent une session.
- Dépendance d'une tâche vers elle-même refusée.
- Temps négatif refusé.
- Vérifie aussi qu'il n'y a **pas de collision de routeur** entre les réalisations du site
  (`/admin/projects`) et les projets du workspace (`/admin/pm/projects`).

### `apps/api/tests/intake.test.ts` — 8 tests

- Identifiants invalides → 401 sans révéler l'existence du compte.
- Corps invalides → 422 avec liste des champs.
- Date de réservation impossible (mois 13) → 422.

## Vérifications manuelles horodatées (hors suite)

| Vérification | Résultat |
|---|---|
| Clé NVIDIA jamais renvoyée | réponse = `nvap…WmbO (70 car.)` uniquement |
| Conversation d'un autre id | 404, pas 403 |
| Chat sans clé | `stubbed: true`, jamais présenté comme une génération |
| Fichier avatar `.svg` | refusé (signature binaire) — vérifié par code, **test automatisé à ajouter** |
| `git grep "nvapi-"` | zéro résultat dans le dépôt |

## Ce qui n'est pas fait

1. **Aucun pipeline CI** : les tests tournent en local sur `npm test`.
2. **Pas de SAST** (Semgrep), **pas de DAST** (OWASP ZAP), **pas de SCA** (Snyk/Trivy).
   Installation possible, non réalisée à ce stade.
3. **Pas de tests de charge** (k6/autocannon) : les limites de débit ne sont pas éprouvées
   sous charge réelle.
4. **Pas de test de la restauration de sauvegarde** : aucun `pg_dump` / `pg_restore` exécuté.
5. **Pas de test d'upload malveillant** automatisé (fichier tronqué, bombe de décompression).
6. **ASVS** : aucune matrice de conformité remplie niveau par niveau.

## Comment lancer

```bash
cd C:/Users/rene/5dev
npm test                 # suite complète (API + web)
npm test --workspace=@5dev/api   # sécurité incluse
```

Résultat de référence au dernier passage : **56 tests API + 3 tests web, 0 échec**.
