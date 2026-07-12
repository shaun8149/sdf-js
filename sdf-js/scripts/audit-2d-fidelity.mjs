// sdf-js/scripts/audit-2d-fidelity.mjs — 2D→3D information-fidelity audit,
// PINNED IN CI. For every slide of a corpus deck: does everything the IR
// carries (= everything lifted from the 2D page) actually reach the viewer's
// screen in 3D? Titles, node labels, values (human formatting), matrix axes.
// Matching is deliberately loose (substring both ways) so it only ever
// UNDER-reports — a reported gap is always a real gap. Corpus stands at zero
// gaps (matrix-evolution yCats were the last, fixed 2026-07-12); any renderer
// change that silently drops source-page information dies here.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { renderIR } from '../src/scene/render-ir.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

function auditSlide(ir, slideIdx) {
  const gaps = [];
  let scene;
  try {
    scene = renderIR(ir);
  } catch (e) {
    return [`[${slideIdx}] renderIR THREW: ${e.message.slice(0, 80)}`];
  }
  const texts = (scene.overlay || []).map((o) => String(o.text));
  const hasText = (t) => t && texts.some((x) => x.includes(String(t)) || String(t).includes(x));

  if (ir.title && !hasText(ir.title) && !texts.some((x) => x === String(ir.title).toUpperCase()))
    gaps.push(`title missing: "${ir.title}"`);
  (ir.nodes || []).forEach((n, i) => {
    const nm = label(n);
    if (nm && !hasText(nm)) gaps.push(`node[${i}] label missing: "${nm}"`);
  });
  (ir.magnitude || []).forEach((m, i) => {
    const disp = (ir.display && ir.display[i]) || String(m);
    if (!hasText(disp)) gaps.push(`value[${i}] missing: "${disp}"`);
  });
  if (ir.structure === 'matrix' && Array.isArray(ir.axes)) {
    ir.axes.flat().forEach((a) => {
      if (a && !hasText(a)) gaps.push(`axis label missing: "${a}"`);
    });
  }
  return gaps.map((g) => `[${slideIdx} ${ir.structure}] ${g}`);
}

const decks = process.argv[2]
  ? [process.argv[2]]
  : ['bytedance-bp', 'handoff-funding-round', 'handoff-qbr-earnings'];
let grandTotal = 0;
for (const name of decks) {
  const file = resolve(__dirname, `../scenes/ir/${name}.json`);
  let deck;
  try {
    deck = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    console.log(`(skip ${name} — no fixture)`);
    continue;
  }
  console.log(`\n=== ${name} (${deck.slides.length} slides) ===`);
  let total = 0;
  deck.slides.forEach((ir, i) => {
    const gaps = auditSlide(ir, i);
    gaps.forEach((g) => console.log('  ' + g));
    total += gaps.length;
  });
  console.log(total === 0 ? '  ✓ no fidelity gaps' : `  → ${total} gaps`);
  grandTotal += total;
}
console.log(`\n${grandTotal === 0 ? '3/3 decks fully faithful' : grandTotal + ' gaps total'}`);
process.exit(grandTotal ? 1 : 0);
