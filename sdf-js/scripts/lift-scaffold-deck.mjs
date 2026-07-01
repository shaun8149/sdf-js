// lift-scaffold-deck.mjs — run a REAL 2D scaffold deck through the 3D lift, end to end.
//   node sdf-js/scripts/lift-scaffold-deck.mjs [deckDir]
// default deckDir = examples/scaffold-pipeline/vc-pitch

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { liftScaffoldSlot } from '../src/scene/lift-scaffold.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENES = resolve(__dirname, '../scenes');
const deckDir = resolve(__dirname, '..', process.argv[2] || 'examples/scaffold-pipeline/vc-pitch');

const deck = JSON.parse(readFileSync(join(deckDir, 'deck.json'), 'utf8'));
const slotDir = join(deckDir, 'slots');
const slotFiles = readdirSync(slotDir).filter((f) => f.endsWith('.json')).sort();

const segments = [];
const allSkipped = {};
for (const f of slotFiles) {
  const slot = JSON.parse(readFileSync(join(slotDir, f), 'utf8'));
  const sd = slot.sceneData;
  if (!sd || !Array.isArray(sd.subjects)) continue;
  const { scene, skipped } = liftScaffoldSlot(sd, { title: slot.slotTitle, theme: deck.theme });
  const outName = `scaffold-vc-${String(slot.slotIdx).padStart(2, '0')}.json`;
  writeFileSync(resolve(SCENES, outName), `${JSON.stringify(scene, null, 2)}\n`);
  segments.push({ file: outName, title: slot.slotTitle, kind: 'slide', durationSec: 7 });
  const placed = scene.subjects.length;
  const total = sd.subjects.length;
  skipped.forEach((t) => (allSkipped[t] = (allSkipped[t] || 0) + 1));
  console.log(`  ${f.padEnd(28)} placed ${placed}/${total}` + (skipped.length ? `  skipped: ${skipped.join(', ')}` : ''));
}

writeFileSync(
  resolve(SCENES, 'deck-scaffold-vc.json'),
  `${JSON.stringify({ id: 'deck-scaffold-vc', name: `${deck.deckName} (lifted 3D)`, segments }, null, 2)}\n`,
);

console.log(`\n${segments.length} slots lifted → ?deck=deck-scaffold-vc`);
console.log('skipped types (no 3D twin):', Object.keys(allSkipped).length ? JSON.stringify(allSkipped) : 'none');
