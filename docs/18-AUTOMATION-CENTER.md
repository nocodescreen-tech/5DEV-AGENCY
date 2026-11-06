# 18 — AUTOMATION CENTER

État : **moteur fonctionnel** — déclencheurs, conditions, actions, journal, garde anti-boucle,
exécution manuelle de test. Interface de construction visuelle : non faite (voir écarts).

## Modèle

```
automations     (name, trigger, conditions jsonb, actions jsonb, is_active)
automation_runs (automation_id, trigger, payload, status, steps jsonb, error, duration_ms)
jobs            (kind, payload, status, attempts, max_attempts, run_at) → worker en processus
```

## Déclencheurs disponibles

| Déclencheur | Émis par |
|---|---|
| `lead.created` | formulaire de devis et de contact (`modules/intake.ts`) |
| `booking.created` | demande de réservation photo |

Le déclenchement se fait **hors du chemin de réponse** (`void runAutomations(...)`) : un
formulaire ne ralentit jamais à cause d’une automatisation.

## Conditions

`equals`, `contains`, `exists` sur n’importe quel champ de la charge utile
(ex. `budget_currency equals USD`, `message contains urgent`). Toutes les conditions doivent
être vraies. Un refus est journalisé en `skipped` avec la raison — on peut donc comprendre
pourquoi une règle n’a pas tourné.

## Actions (réelles)

| Action | Effet |
|---|---|
| `ai_classify` | appelle la passerelle IA et écrit pôle/priorité dans `leads.admin_note` |
| `notify_admin` | crée une notification visible dans la cloche de la console |
| `email_client` | envoie un email au demandeur via Brevo (journalisé) |
| `set_lead_status` | change le statut de la demande |

Chaque action est tracée : `{action, status, detail, ms}`. Une action qui échoue arrête la
règle et marque l’exécution `failed` avec le message — pas d’échec silencieux.

## Garde-fous

- **Anti-doublon** : une même règle ne se relance pas deux fois pour le même `id` de charge
  utile dans les 60 s (protège des doubles emails lors d’un double clic ou d’un retry).
- **Profondeur** : aucune action ne peut créer une demande, donc pas de boucle
  déclencheur → action → déclencheur.
- **Retry** : la file `jobs` réessaie avec backoff (30 s × tentative) jusqu’à `max_attempts`.
- **Traçabilité** : `automation_runs` conserve charge utile, étapes, erreur et durée.

## Vérifié en exécution

`POST /api/v1/admin/automations/test` sur `lead.created` :

```
Qualification des demandes → done
   · ai_classify: ok — classé web/haute (repli-deterministe)
   · notify_admin: ok — notification créée
```

## Écarts assumés

1. **Constructeur visuel** (glisser-déposer) : non fait. Les règles sont créées par API
   (`POST /api/v1/admin/automations`) avec un schéma zod strict ; la règle de qualification
   est seedée par `npm run setup`.
2. **Planificateur temporel** : pas de déclencheur « tous les lundis » ; uniquement des
   déclencheurs événementiels. Le champ `run_at` de `jobs` permet déjà un décalage.
3. **Worker unique** : un seul processus traite la file (pas de concurrence distribuée).
   Suffisant pour un studio, remplaçable par BullMQ sans toucher aux métiers.
