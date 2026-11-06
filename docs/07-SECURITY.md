# 07 — SÉCURITÉ (5DEV)

État : mesures **implémentées et testées** côté API, plus les limites connues. Aucune
affirmation de sécurité n'est faite sans un test qui la vérifie (voir 28-SECURITY-TESTING).

## Ce qui est en place aujourd'hui

| Mesure | Implémentation | Vérification |
|---|---|---|
| Mots de passe | scrypt (N=16384, r=8, p=1), sel aléatoire, format `scrypt$N$r$p$sel$hash`, comparaison `timingSafeEqual` | `lib/password.ts` |
| Sessions | token aléatoire 32 octets, **stocké haché SHA-256** en base, cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production | `lib/session.ts` |
| Révocation | suppression en base = déconnexion immédiate ; changement de mot de passe révoque toutes les sessions | `modules/profile.ts` |
| Autorisation | `requireAdmin` sur **toutes** les routes d'administration, vérifié côté serveur (masquer un bouton n'est pas une protection) | `middlewares/auth.ts` |
| Isolation des conversations IA | requête filtrée par `user_id` ; une conversation d'un autre compte renvoie **404** (pas 403, pour ne pas révéler son existence) | test + `modules/ai-chat.ts` |
| Injection SQL | 100 % de requêtes paramétrées (`$1…$n`), aucun SQL construit par concaténation | revue de code |
| Validation d'entrée | schémas zod sur chaque corps de requête (taille, type, énumérations) | `validate()` |
| En-têtes HTTP | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `COOP/CORP`, CSP `default-src 'none'` sur l'API, `Cache-Control: no-store`, `X-Robots-Tag: noindex`, HSTS en production | `middlewares/security.ts` + tests |
| CORS | liste blanche stricte (APP_URL, localhost dev/preview) ; origine inconnue → aucun en-tête CORS | tests |
| Secrets | clé NVIDIA **chiffrée AES-256-GCM** en base, clé de chiffrement dérivée de `SESSION_SECRET`, jamais renvoyée (seulement `nvap…WmbO (70 car.)`) | `lib/secrets.ts` + test |
| Rate limiting | formulaires publics (6 / 10 min / IP), chat IA (40 messages / 10 min / utilisateur) | `modules/intake.ts`, `ai-chat.ts` |
| Avatars | type MIME réel vérifié par signature binaire, 400 Ko max, nom de fichier généré serveur, service par route contrôlée (regex stricte) | `modules/profile.ts` |
| Journal d'audit | `audit_logs` : connexions, envois, campagnes, réglages | `modules/*` |
| Erreurs | handler centralisé : message générique + code, aucune pile ni chemin de fichier renvoyé | `middlewares/errors.ts` + test |

## Ce qui n'est PAS en place (à traiter avant production)

1. **Argon2id** : le brief l'exige. Le code utilise scrypt (solide, natif Node). Passer à
   Argon2id demande une dépendance (`@node-rs/argon2` ou `hash-wasm`) et une migration des
   hachages existants. **Non fait.**
2. **MFA** : aucun second facteur. **Non fait.**
3. **TLS** : assuré par l'hébergeur, pas par l'application. Aucun déploiement n'existe encore.
4. **Verrouillage après N échecs** : rate limiting par IP seulement, pas de compteur par
   compte, pas de délai progressif.
5. **Réinitialisation de mot de passe** : pas de flux « mot de passe oublié » (jeton à usage
   unique non implémenté). Aujourd'hui : changement depuis le profil connecté.
6. **CSRF** : les cookies sont `SameSite=Lax` et l'API n'accepte que du JSON avec
   `Content-Type` explicite. Pas de jeton CSRF dédié — suffisant pour un SameSite=Lax sur
   des mutations POST/PATCH/DELETE, **mais à revoir** si un jour des formulaires HTML
   same-site sont ajoutés.
7. **Antivirus sur upload** : avatars uniquement, contrôlés par signature + taille. Aucun
   scan antivirus (pas de moteur installé).
8. **Chiffrement au repos de la base** : dépend de l'hébergeur PostgreSQL.
9. **Sauvegardes testées** : script `pg_dump` documenté, aucune restauration prouvée.
10. **SAST/DAST/SCA** : `npm audit` manuel possible, aucun pipeline CI (Semgrep, ZAP, Trivy
    non installés).

## Règles appliquées dans le code

- Aucune clé, aucun mot de passe, aucun token dans les réponses HTTP ni dans les journaux.
- Aucun secret dans le dépôt : `.env` ignoré, `git grep "nvapi-"` renvoie zéro résultat.
- L'IA ne déclenche aucune action commerciale (devis, facture, paiement, envoi de masse).
- Le contenu des modèles est traité comme du texte, jamais injecté en HTML
  (`Markdown.tsx` construit des éléments React, pas de `dangerouslySetInnerHTML`).
