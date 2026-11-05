# 10 — DÉPLOIEMENT & HÉBERGEMENT

> Prix indicatifs relevés le **05/11/2026**, en USD/€ hors taxes, **à revérifier avant tout
> engagement** (les grilles bougent). Aucun de ces chiffres n'est un devis.

## Contraintes réelles du projet

- Site **commercial** : les offres gratuites interdisant l'usage commercial (Vercel Hobby
  notamment) ne sont pas éligibles pour la production.
- Base PostgreSQL persistante + sauvegardes.
- Stockage photo avec originaux privés (accès signé) et volume qui grandit.
- Maintenance par une seule personne → pas de Kubernetes, pas d'auto-scaling complexe.
- Budget contraint : on privilégie les paliers gratuits là où c'est licite.

## Comparatif des trois options demandées

| Critère | **Option 1** — Railway (API + DB) + Vercel (front) | **Option 2** — VPS unique (front + API + DB) | **Option 3** — VPS (API + DB) + Vercel (front) |
|---|---|---|---|
| Coût mensuel indicatif | Railway Hobby ≈ 5 $ + usage ; Vercel Pro ≈ 20 $/siège ; DB incluse côté Railway | VPS 2 vCPU/4 Go ≈ 5–8 € ; tout inclus | VPS ≈ 5–8 € + Vercel Pro ≈ 20 $ |
| Mise en route | 30 min (déploiement git) | 2–4 h (nginx, certbot, pm2/systemd, pare-feu) | 3–5 h |
| Performance | bonne, latence edge pour le front | dépend de la région du VPS (Europe → RDC : ~150–250 ms) | front edge + API distante (double saut) |
| Disponibilité | plateforme gérée (SLA fournisseur) | dépend de toi (single point of failure) | mixte |
| Sauvegardes | incluses/option payante | **à ta charge** (cron pg_dump + copie hors site) | à ta charge côté VPS |
| Sécurité | patches gérés | **à ta charge** (OS, nginx, fail2ban, TLS) | à ta charge |
| Stockage photo | R2/Cloudinary externe (recommandé) | disque du VPS (limité, à sauvegarder) | idem option 2 |
| Maintenance | faible | élevée (tu es l'exploitant) | moyenne |
| Verrouillage | moyen (Railway/Vercel) | nul (tu peux migrer n'importe où) | partiel |
| Risque principal | facture à l'usage qui dérape | panne = site + DB + photos indisponibles | deux systèmes à surveiller |

## Recommandation

**V1 → Option 1, en version « free-first » :**
- Front : **Cloudflare Pages** (gratuit, usage commercial autorisé) plutôt que Vercel Hobby.
- API : **Render** ou **Koyeb** (palier gratuit, veille après inactivité assumée) ou Railway Hobby.
- DB : **Neon** (palier gratuit, branche de prévisualisation) — sauvegardes gérées.
- Médias : **Cloudflare R2** (10 Go gratuits, pas de frais de sortie) avec URLs signées.

**Migration vers l'Option 3** dès que le trafic ou les photos dépassent les paliers gratuits
(seuil de décision : > 8 Go de médias ou > 100 Go de bande passante/mois). L'Option 2 (tout
sur un VPS) n'est retenue que si le client exige une souveraineté totale des données.

## Variables d'environnement

Voir `.env.example`. Rappel : **aucun secret au dépôt**, tout en environnement serveur.

## Procédure de mise en ligne (cible)

1. Domaine `5dev.com` : vérifier l'enregistrement, pointer les DNS (front + API).
2. Créer la base Neon, jouer les migrations, créer le compte `owner` (seed).
3. Configurer R2 (bucket privé, clés API, CORS si nécessaire).
4. Renseigner les variables d'environnement côté hébergeur (une par une).
5. Déployer l'API, vérifier `/healthz` (200 + version + état base).
6. Déployer le front, vérifier les 3 pages critiques (accueil, services, devis).
7. Activer les emails transactionnels (domaine vérifié chez le fournisseur).
8. Poser la tâche de sauvegarde quotidienne et **tester une restauration**.

## Plan de sauvegarde

| Donnée | Fréquence | Rétention | Restauration |
|---|---|---|---|
| PostgreSQL | quotidien (02:00) | 30 jours | testée 1×/trimestre |
| Médias (R2) | réplication/versioning fournisseur | selon offre | procédure documentée |
| Code | git + tags de version | illimitée | clone |

## Critères de sortie du lot déploiement

- [ ] `5dev.com` répond en HTTPS avec certificat valide.
- [ ] `/healthz` renvoie 200 avec l'état de la base.
- [ ] Une demande de devis envoyée depuis la prod arrive en console.
- [ ] Une photo uploadée est servie par URL signée, miniature incluse.
- [ ] Une sauvegarde a été restaurée avec succès sur une base de test.
