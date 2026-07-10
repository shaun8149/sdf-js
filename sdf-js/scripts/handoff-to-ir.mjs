// handoff-to-ir.mjs — convert 2D-end atlas-deck ammo into IR-deck fixtures the
// figure page plays directly (?deck=handoff-<name>&stage=1&present=1).
//   node sdf-js/scripts/handoff-to-ir.mjs [ammoName ...]   (default: qbr-earnings)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { atlasDeckToIR } from '../src/scene/scaffold-to-ir.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AMMO = resolve(__dirname, '../examples/deck-handoff/ammo');
const SCENES = resolve(__dirname, '../scenes/ir');

const names = process.argv.slice(2).length ? process.argv.slice(2) : ['eval-qbr-earnings'];
for (const n of names) {
  const raw = readFileSync(resolve(AMMO, `${n}.json`), 'utf8');
  const { title, slides, report } = atlasDeckToIR(raw);
  const short = n.replace(/^eval-/, '');
  writeFileSync(resolve(SCENES, `handoff-${short}.json`), `${JSON.stringify({ title, slides }, null, 2)}\n`);
  const kept = report.filter((r) => r.outcome.startsWith('ir:')).length;
  console.log(`  ✓ ${n}: ${kept}/${report.length} slots → scenes/ir/handoff-${short}.json`);
  report.filter((r) => !r.outcome.startsWith('ir:')).forEach((r) => console.log(`      · slot ${r.slot} ${r.outcome} (${r.title})`));
}
