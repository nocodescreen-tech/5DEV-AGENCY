# 15 — ARCHITECTURE NVIDIA AI

État : **passerelle implémentée et vérifiée en exécution** ; l’appel réel à NVIDIA reste
conditionné à la présence de `NVIDIA_API_KEY` (absente sur ce poste — voir « limites »).

## Chaîne

```
frontend (console)  →  POST /api/v1/admin/ai/run  →  AI GATEWAY
                                                      ├── registre de tâches (modèles)
                                                      ├── gestion des prompts (base)
                                                      ├── fournisseur NVIDIA NIM
                                                      └── journal d’usage (ai_usage)
```

Aucun appel fournisseur ne part du navigateur. Aucune clé n’est exposée : le front ne
connaît que des tâches (`classify_lead`, `summarize`, `draft_reply`, `draft_email`,
`draft_newsletter`, `suggest_content`, `extract_lead`).

## Registre (fichier `apps/api/src/modules/ai/gateway.ts`)

| Tâche | Modèles essayés dans l’ordre | Rôle |
|---|---|---|
| classify_lead | `meta/llama-3.1-8b-instruct` → `mistralai/mistral-nemo-12b-instruct` | classement + priorité |
| summarize | `meta/llama-3.1-8b-instruct` → `nvidia/llama-3.1-nemotron-70b-instruct` | résumé d’échange |
| draft_reply | `nvidia/llama-3.1-nemotron-70b-instruct` → `meta/llama-3.1-8b-instruct` | brouillon de réponse |
| draft_email | `meta/llama-3.1-8b-instruct` → nemotron | email transactionnel |
| draft_newsletter | nemotron → `meta/llama-3.1-8b-instruct` | sujet + sections |
| suggest_content | `meta/llama-3.1-8b-instruct` | idées marketing |
| extract_lead | `meta/llama-3.1-8b-instruct` | champs structurés |

Bascule automatique : si un modèle renvoie une erreur (404, quota, latence), le suivant est
essayé, et l’échec est journalisé. Changer de modèle = éditer ce registre, aucun module
métier ne change.

## Prompts

Table `ai_prompts` (clé `task.<nom>`), éditable via
`GET/PUT /api/v1/admin/ai/prompts`. À défaut, le prompt du registre est utilisé.
Ils interdisent explicitement d’inventer prix, délais, statistiques ou témoignages.

## Journal d’usage (`ai_usage`)

Colonnes : tâche, fournisseur, modèle, tokens entrée/sortie, latence, succès, erreur,
acteur, date. Affiché dans la console (50 derniers appels) avec compteurs 24 h et latence
moyenne. C’est la base du suivi de quotas et de coûts.

## Garde-fous

- L’IA ne modifie ni devis, ni facture, ni paiement : aucune action de ce type n’existe
  dans la passerelle.
- La classification enrichit une note interne (`leads.admin_note`), elle ne décide rien.
- Un email généré reste un **brouillon** : il faut passer par la console ou une
  automatisation validée pour l’envoyer.

## Limites connues

1. **Aucune clé NVIDIA sur ce poste** : `ready=false`. Les tâches renvoient un repli
   déterministe **explicitement marqué** (`stubbed: true`, modèle `repli-deterministe`),
   jamais présenté comme une réponse IA. En production, le repli lève une erreur.
2. Les identifiants de modèles doivent être confirmés contre le catalogue réel du compte :
   `GET /api/v1/admin/ai/status` liste les modèles effectivement accessibles, sans supposer
   qu’ils sont gratuits.
3. Tarification non modélisée : seuls les tokens et la latence sont mesurés.
4. Pas de file d’attente dédiée à l’IA : les appels sont synchrones (latence 0,5–3 s).
   Un passage en tâche de fond sera nécessaire pour les traitements par lot.
