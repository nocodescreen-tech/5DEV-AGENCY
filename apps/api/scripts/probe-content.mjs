/**
 * Trouve les modèles qui rendent une réponse DIRECTE (content non vide),
 * pas seulement un raisonnement. usage: node --import tsx apps/api/scripts/probe-content.mjs
 */
import { listModels, chat } from '../src/modules/ai/providers/nvidia.ts';

const models = await listModels();
const candidats = models.filter((m) => /instruct|it$|chat|nemotron|qwen|mistral|gemma|phi|step/i.test(m)).slice(0, 40);
console.log('candidats testés :', candidats.length, 'sur', models.length);

const dire = async (model) => {
  const t0 = Date.now();
  try {
    const r = await chat(
      model,
      [
        { role: 'system', content: 'Tu réponds en français, sans expliquer ta méthode.' },
        { role: 'user', content: 'Écris une phrase de remerciement pour un client qui a demandé un devis.' },
      ],
      { maxTokens: 160, temperature: 0.3, timeoutMs: 25_000 },
    );
    const txt = r.text.replace(/\s+/g, ' ');
    const raisonnement = /^here'?s a thinking|^thinking|^we need to|^let me/i.test(txt);
    return { model, ms: Date.now() - t0, len: txt.length, raisonnement, extrait: txt.slice(0, 70) };
  } catch (e) {
    return { model, ms: Date.now() - t0, err: String(e.message).slice(0, 60) };
  }
};

const res = [];
for (const m of candidats) res.push(await dire(m));
const propres = res.filter((r) => !r.err && r.len > 20 && !r.raisonnement).sort((a, b) => a.ms - b.ms);
for (const r of propres) console.log(`PROPRE ${String(r.ms).padStart(5)} ms ${r.model.padEnd(52)} ${r.extrait}`);
console.log('\n--- écartés ---');
for (const r of res.filter((x) => !propres.includes(x))) console.log(`${r.err ? 'ERREUR' : 'NON'} ${r.model.padEnd(52)} ${r.err ?? r.extrait}`);
