# 5DEV — Official Digital Platform

**BUILD. INNOVATE. GROW.**

Plateforme professionnelle de 5DEV : quatre pôles (développement web, solutions digitales,
croissance digitale, photographie créative), catalogue de services, demandes de devis,
réservations photo, espace client et console d'administration.

- Domaine cible : **5dev.com**
- Contact : **+243 891 755 172** (WhatsApp) · **mio.appservice@gmail.com**
- Marché : RDC, Afrique, international · Langue initiale : français
- Devises : **USD** et **CDF** (taux administrable, historique conservé)
- Dépôt : `nocodescreen-tech/5DEV-AGENCY`

## État du projet

| Élément | État |
|---|---|
| Dépôt | créé, vide (ce dossier documentaire est le premier contenu) |
| Code applicatif | non démarré — étape 0 du plan (`docs/12-ROADMAP.md`) |
| Hébergement | à décider — comparatif dans `docs/10-DEPLOYMENT.md` |
| Domaine 5dev.com | à vérifier (enregistrement + DNS) |

## Documentation de référence

| Fichier | Contenu |
|---|---|
| `docs/00-VISION.md` | positionnement, pôles, objectifs, ce que 5DEV n'est pas |
| `docs/01-CAHIER-DES-CHARGES.md` | périmètre fonctionnel : pages, services, admin, devises, photo |
| `docs/04-ARCHITECTURE.md` | stack, monorepo, modules, conventions API, sécurité |
| `docs/05-DATABASE.md` | entités, relations, contraintes, règles de suppression |
| `docs/10-DEPLOYMENT.md` | comparatif d'hébergement (3 options) + variables d'environnement |
| `docs/12-ROADMAP.md` | plan d'exécution par lots avec critères d'acceptation |
| `docs/13-DECISIONS.md` | journal des décisions (ADR) |
| `AGENTS.md` | rôles d'agents, workflow imposé, usage réel d'ECC |

## Démarrage (après le lot 0)

```bash
cp .env.example .env      # renseigner DATABASE_URL, JWT_SECRET, stockage
npm install               # workspaces apps/* + packages/*
npm run dev               # api + web en parallèle
npm run verify            # lint + typecheck + tests
```

## Règle de travail

Aucun service, aucune équipe, aucune capacité n'est inventé. Une fonctionnalité non
livrée n'apparaît pas sur le site. Les mentions « à venir » sont interdites dans
l'interface publique : on publie ce qui fonctionne, ou rien.

## Vérification

```bash
npm run verify      # typecheck + lint + tests (API et web)
npm run build       # build de production
npm run e2e         # parcours navigateur : connexion OTP, suppression confirmée, 3D, transitions
```

`npm run e2e` exige l'API (`npm run dev:api`) et le web (`npm run dev:web`) déjà lancés.
