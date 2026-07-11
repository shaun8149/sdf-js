// test-render-matrix.mjs — structure renderer #5: matrix → quadrant wall.
import { renderMatrix } from '../src/scene/render-matrix.js';
import { renderIR, RENDERER_STRUCTURES } from '../src/scene/render-ir.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';
import { compile } from '../src/scene/index.js';
import { expandStage } from '../src/scene/stage.js';

let pass = 0, fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== render-matrix (quadrant wall) ===\n');

const swot = {
  structure: 'matrix',
  nodes: ['Strong team', 'High burn', 'AI wave', 'Incumbents'],
  axes: [['Internal', 'External'], ['Helpful', 'Harmful']],
  cells: [[0, 0], [0, 1], [1, 0], [1, 1]],
  emphasis: [2],
  title: 'SWOT',
};

ok(RENDERER_STRUCTURES.includes('matrix'), 'matrix registered in RENDERER_STRUCTURES');

const scene = renderMatrix(swot);
const cells = scene.subjects.filter((s) => s.id.startsWith('cell-'));
const items = scene.subjects.filter((s) => s.id.startsWith('item-'));
ok(cells.length === 4, '2×2 axes → 4 board tiles');
ok(items.length === 4, 'one item per node');

// each item sits on its cell (same XY as the tile it belongs to)
const tileAt = (xi, yi) => cells.find((c) => c.id === `cell-${xi}-${yi}`);
ok(
  swot.cells.every(([xi, yi], i) => {
    const t = tileAt(xi, yi).transform.translate;
    const it = items.find((s) => s.id === `item-${i}`).transform.translate;
    return Math.abs(t[0] - it[0]) < 1e-9 && Math.abs(t[1] - it[1]) < 1e-9;
  }),
  'items land exactly on their cells',
);

// build-in: items slam in along z with a smoothstep window, staggered
ok(items.every((s) => s.animation && s.animation[0].channel === 'transform.translate.z'), 'items animate along z');
ok(items.every((s) => /smoothstep\(/.test(s.animation[0].expr)), 'slam uses smoothstep');

// emphasis item gets the gold treatment + a value label; camera has cut super + payoff
ok(items.find((s) => s.id === 'item-2').material.glow > 0, 'emphasis item glows (gold)');
ok(scene.cameraSequence.shots.some((s) => s.transition === 'cut'), 'has the punch-in super');
ok(scene.overlay.filter((o) => o.role === 'card').length >= 2 + 2, 'axis labels stay ANCHORED (they define the space)');
ok(scene.overlay.filter((o) => o.role === 'screen').length >= 3, 'cell texts ride the subtitle column');
ok(scene.subjects.every((s) => !/text/.test(s.type)), 'no baked SDF text');

// compiles; renderIR dispatch reaches it; staged deck with a matrix slide assembles
try {
  compile(expandStage(scene), {});
  ok(true, 'matrix scene compiles');
} catch (e) {
  ok(false, `compile failed: ${e.message}`);
}
ok(renderIR(swot).subjects.length === scene.subjects.length, 'renderIR dispatches matrix');
{
  const deck = assembleDeck({ title: 't', slides: [swot] }, { stage: true });
  ok(deck.subjects.some((s) => s.id.includes('stage-platform')), 'staged deck with matrix slide assembles');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
