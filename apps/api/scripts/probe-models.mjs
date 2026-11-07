/**
 * Quel modèle NVIDIA répond réellement sur ce compte ?
 * Liste le catalogue puis teste chaque candidat par un vrai appel court.
 * usage: node --import tsx apps/api/scripts/probe-models.mjs
 */
import { listModels, chat } from '../src/modules/ai/providers/nvidia.ts';
import { nvidiaReady } from '../src/modules/ai/providers/nvidia.ts';

if (!(await nvidiaReady())) {
  console.error('Aucune clé NVIDIA disponible (ni .env, ni table secrets).');
  process.exit(2);
}

const models = await listModels();
console.log('catalogue:', models.length, 'identifiants');

const CANDIDATS = [
  'meta/llama-3.1-8b-instruct',
  'mistralai/mistral-nemo-12b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'stepfun-ai/step-5-preview',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  'nvidia/nemotron-3.5-bolt-e4b',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'nvidia/nemotron-3.5-super-vl-120b-a12b',
];

const presents = CANDIDATS.filter((m) => models.includes(m));
const absents = CANDIDATS.filter((m) => !models.includes(m));
console.log('présents au catalogue :', presents.join(', ') || 'aucun');
console.log('absents du catalogue  :', absents.join(', ') || 'aucun');

for (const model of presents) {
  const t0 = Date.now();
  try {
    const r = await chat({
      model,
      messages: [
        { role: 'system', content: 'Réponds en français, une phrase.' },
        { role: 'user', content: 'Dis simplement : le modèle répond.' },
      ],
      maxTokens: 40,
      temperature: 0.2,
    });
    console.log(`OK    ${model.padEnd(52)} ${Date.now() - t0} ms — ${String(r.text).slice(0, 60).replace(/\s+/g, ' ')}`);
  } catch (e) {
    console.log(`ECHEC ${model.padEnd(52)} ${Date.now() - t0} ms — ${String(e.message).slice(0, 90)}`);
  }
}
