/** Streaming direct auprès du fournisseur, sans passer par Express. */
import { streamChat } from '../src/modules/ai/providers/nvidia.ts';

const model = process.argv[2] ?? 'nvidia/nemotron-3.5-bolt-e4b';
const t0 = Date.now();
let premier = null;
let texte = '';
try {
  for await (const d of streamChat(
    model,
    [
      { role: 'system', content: 'Réponds en français, une phrase.' },
      { role: 'user', content: 'Dis bonjour à un client de 5DEV.' },
    ],
    { maxTokens: 120, timeoutMs: 45_000 },
  )) {
    if (premier === null) premier = Date.now() - t0;
    texte += d;
  }
  console.log(`${model} — premier ${premier} ms, total ${Date.now() - t0} ms, ${texte.length} car.`);
  console.log('texte:', texte.replace(/\s+/g, ' ').slice(0, 160));
} catch (e) {
  console.log(`${model} — ECHEC après ${Date.now() - t0} ms : ${e.message}`);
  console.log('cause:', e.cause?.code ?? e.cause?.message ?? '(aucune)');
}
