/**
 * Vérifie le registre de tâches de bout en bout contre le vrai fournisseur.
 * usage: node --import tsx apps/api/scripts/probe-tasks.mjs
 */
import { TASKS, runTask } from '../src/modules/ai/gateway.ts';

const ECHANTILLON = {
  classify_lead: 'Bonjour, je cherche quelqu’un pour photographier mon mariage en décembre, budget limité.',
  summarize: 'Client : bonjour, je veux un site vitrine. Moi : quel budget ? Client : 400 dollars. Moi : ok pour 3 semaines.',
  draft_reply: 'Le client demande un site vitrine de 5 pages pour 400 dollars, livraison en trois semaines.',
  draft_email: 'Confirmer au client la réception de sa demande de devis pour un site vitrine.',
  draft_newsletter: 'Sujet : pourquoi un site lent fait perdre des clients à Matadi.',
  suggest_content: 'Idées de publications pour une boulangerie de Matadi.',
  project_plan: 'Site vitrine 5 pages pour une boulangerie : accueil, produits, histoire, contact, galerie.',
  extract_lead: 'Bonjour, je suis Marie, joignable sur WhatsApp, je veux refaire mon site avant mars, budget 600 USD.',
};

let ok = 0;
for (const [task, input] of Object.entries(ECHANTILLON)) {
  const t0 = Date.now();
  try {
    const r = await runTask(task, input, { actorId: null });
    const propre = r.text.replace(/\s+/g, ' ').slice(0, 110);
    const verdict = r.stubbed ? 'REPLI' : r.text.length > 10 ? 'OK' : 'VIDE';
    if (verdict === 'OK') ok++;
    console.log(`${verdict.padEnd(5)} ${task.padEnd(17)} ${String(r.model).padEnd(46)} ${Date.now() - t0} ms — ${propre}`);
  } catch (e) {
    console.log(`ECHEC ${task.padEnd(17)} ${String(e.message).slice(0, 120)}`);
  }
}
console.log(`\n${ok}/${Object.keys(ECHANTILLON).length} tâches ont répondu par un vrai modèle`);
console.log('registre :', Object.entries(TASKS).map(([k, v]) => `${k}=${v.models[0]}`).join(' · '));
