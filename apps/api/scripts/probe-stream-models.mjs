/** Quels modèles streament réellement ? (écart entre le 1er et le dernier fragment) */
import { streamChat } from '../src/modules/ai/providers/nvidia.ts';

const MODELES = [
  'nvidia/nemotron-3.5-bolt-e4b',
  'nvidia/nemotron-3-ultra-550b-a55b',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  'stepfun-ai/step-5-preview',
  'nvidia/nemotron-3.5-super-vl-120b-a12b',
  'nvidia/nemotron-3.5-lightning-30b-a3b',
];

for (const model of MODELES) {
  const t0 = Date.now();
  const temps = [];
  let texte = '';
  try {
    for await (const d of streamChat(
      model,
      [
        { role: 'system', content: 'Réponds en français, sans expliquer ta méthode.' },
        { role: 'user', content: 'Liste trois avantages d’un site rapide, une ligne chacun.' },
      ],
      { maxTokens: 200, timeoutMs: 60_000 },
    )) {
      temps.push(Date.now() - t0);
      texte += d;
    }
    const etalement = temps.length > 1 ? temps[temps.length - 1] - temps[0] : 0;
    const verdict = temps.length > 5 && etalement > 800 ? 'FLUX REEL' : 'EN UN BLOC';
    console.log(
      `${verdict.padEnd(10)} ${model.padEnd(48)} 1er=${String(temps[0] ?? '-').padStart(6)} ms · frag=${String(temps.length).padStart(4)} · étalement=${String(etalement).padStart(5)} ms · ${texte.length} car.`,
    );
  } catch (e) {
    console.log(`ECHEC      ${model.padEnd(48)} ${e.message.slice(0, 60)}`);
  }
}
