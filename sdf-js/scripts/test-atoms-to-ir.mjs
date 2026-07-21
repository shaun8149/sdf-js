// sdf-js/scripts/test-atoms-to-ir.mjs — atoms→IR bridge (Sprint 27)
// Per-structure atom mappings, parseMagnitude numeric parsing, slotToIR
// richest-subject selection, and deckToIR on a REAL baked eval deck, closed
// with the full loop: deckToIR → assembleDeck → compile.
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  atomToIR,
  slotToIR,
  deckToIR,
  parseMagnitude,
  funnelSlotToIR,
} from '../src/scene/scaffold-to-ir.js';
import { validateIR } from '../src/scene/ir.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';
import { compile } from '../src/scene/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== atoms-to-ir (Sprint 27 bridge) ===\n');

// ---- parseMagnitude ----------------------------------------------------------
ok(parseMagnitude('$3.4M') === 3400000, 'parseMagnitude: "$3.4M" → 3400000');
ok(parseMagnitude('12,450') === 12450, 'parseMagnitude: "12,450" → 12450');
ok(parseMagnitude('92%') === 92, 'parseMagnitude: "92%" → 92');
ok(parseMagnitude('abc') === null, 'parseMagnitude: "abc" → null');
ok(parseMagnitude(42) === 42, 'parseMagnitude: passthrough number');
ok(parseMagnitude('-8') === -8, 'parseMagnitude: negative string');

// ---- sequence family ----------------------------------------------------------
{
  const ir = atomToIR({
    type: 'funnel',
    args: {
      title: 'F',
      stages: [
        { label: 'A', value: 100 },
        { label: 'B', value: 40 },
      ],
    },
  });
  ok(ir && ir.structure === 'sequence', 'funnel → sequence');
  ok(validateIR(ir).ok, 'funnel IR validates');
}
{
  const ir = atomToIR({
    type: 'process-arrows',
    args: { steps: [{ label: 'Discover' }, { label: 'Design' }, { label: 'Deploy' }] },
  });
  ok(ir && ir.structure === 'sequence' && ir.nodes.length === 3, 'process-arrows → sequence (3)');
  ok(validateIR(ir).ok, 'process-arrows IR validates');
}
{
  const ir = atomToIR({
    type: 'timeline',
    args: {
      events: [
        { date: 'Q1', label: 'Seed' },
        { date: 'Q4', label: 'Launch' },
      ],
    },
  });
  ok(
    ir &&
      ir.structure === 'roadmap' &&
      ir.climb === false &&
      ir.milestones[1].date === 'Q4',
    'timeline → flat roadmap with dated milestones',
  );
}
{
  const ir = atomToIR({
    type: 'vertical-timeline',
    args: {
      events: [
        { date: 'Q1', label: 'Seed' },
        { date: 'Q4', label: 'Launch' },
      ],
    },
  });
  ok(
    ir && ir.structure === 'roadmap' && ir.climb === true && ir.milestones.length === 2,
    'vertical-timeline → climbing roadmap',
  );
}
{
  const ir = atomToIR({
    type: 'kanban-board',
    args: {
      columns: [
        { label: 'Backlog', cards: [{ label: 'a' }] },
        { label: 'Done', cards: [{ label: 'b' }, { label: 'c' }] },
      ],
    },
  });
  ok(
    ir && ir.structure === 'sequence' && JSON.stringify(ir.magnitude) === JSON.stringify([1, 2]),
    'kanban-board → sequence, magnitude = card counts',
  );
}
{
  const ir = atomToIR({
    type: 'maturity-model',
    args: { stages: [{ label: 'A' }, { label: 'B' }, { label: 'C' }], currentLevel: 2 },
  });
  ok(ir && ir.emphasis && ir.emphasis[0] === 1, 'maturity-model emphasis = currentLevel-1');
}

// ---- hierarchy family -----------------------------------------------------
{
  const ir = atomToIR({
    type: 'org-chart',
    args: {
      root: {
        name: 'CEO',
        children: [{ name: 'CTO', children: [{ name: 'Eng' }] }, { name: 'CFO' }],
      },
    },
  });
  ok(ir && ir.structure === 'hierarchy', 'org-chart → hierarchy');
  const v = validateIR(ir);
  ok(v.ok, `org-chart IR validates (${v.errors.join(';')})`);
  ok(ir.nodes.length === 4 && ir.relations.length === 3, 'org-chart flattens 4 nodes / 3 edges');
  const hasParent = new Set(ir.relations.map((r) => r[1]));
  const roots = ir.nodes.map((_, i) => i).filter((i) => !hasParent.has(i));
  ok(roots.length === 1, 'org-chart has exactly one root');
}
{
  const ir = atomToIR({
    type: 'okr-tree',
    args: {
      objective: 'Grow ARR',
      keyResults: [
        { label: 'KR1', progress: 0.5 },
        { label: 'KR2', progress: 0.2 },
      ],
    },
  });
  ok(
    ir && ir.structure === 'hierarchy' && ir.nodes[0] === 'Grow ARR',
    'okr-tree → hierarchy, objective = root',
  );
}
{
  const ir = atomToIR({
    type: 'decision-tree-3-arm',
    args: { question: 'Which path?', arms: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] },
  });
  ok(ir && ir.structure === 'hierarchy', 'decision-tree-3-arm → hierarchy');
}
{
  const ir = atomToIR({
    type: 'pyramid',
    args: {
      layers: [
        { label: 'Base', value: 48 },
        { label: 'Mid', value: 4.8 },
        { label: 'Apex', value: 2.1 },
      ],
    },
  });
  ok(ir && ir.structure === 'magnitude', 'pyramid with values → magnitude');
}
{
  const ir = atomToIR({
    type: 'pyramid',
    args: { layers: [{ label: 'Base' }, { label: 'Mid' }, { label: 'Apex' }] },
  });
  ok(ir && ir.structure === 'sequence', 'pyramid without values → sequence');
}

// ---- network family -------------------------------------------------------
{
  const ir = atomToIR({
    type: 'relationship-graph',
    args: {
      nodes: [
        { id: 'a', label: 'Team A' },
        { id: 'b', label: 'Team B' },
        { id: 'c', label: 'Tool X' },
      ],
      edges: [
        { from: 'a', to: 'c' },
        { from: 'b', to: 'c' },
      ],
    },
  });
  ok(ir && ir.structure === 'network', 'relationship-graph → network');
  ok(validateIR(ir).ok, 'relationship-graph IR validates');
  ok(!ir.relations.some((r) => r[0] === r[1]), 'network has no self-loops');
}
{
  const ir = atomToIR({
    type: 'sphere-network',
    args: {
      hub: { label: 'Platform' },
      satellites: [{ label: 'API' }, { label: 'Web' }, { label: 'CLI' }],
    },
  });
  ok(
    ir && ir.structure === 'network' && ir.nodes[0] === 'Platform',
    'sphere-network → network, hub = root node',
  );
}
{
  const ir = atomToIR({
    type: 'circle-image-hub-spoke',
    args: { center: { label: 'Atlas' }, satellites: [{ label: 'Sketch' }, { label: 'Figma' }] },
  });
  ok(ir && ir.structure === 'network', 'circle-image-hub-spoke → network');
}
{
  const ir = atomToIR({
    type: 'radial-wheel-segmented',
    args: {
      hub: 'HR Core',
      segments: [{ label: 'Recruit' }, { label: 'Retain' }, { label: 'Reward' }],
    },
  });
  ok(ir && ir.structure === 'network', 'radial-wheel-segmented → network');
}

// ---- magnitude family -------------------------------------------------------
{
  const ir = atomToIR({
    type: 'bar',
    args: { values: [1.2, 1.8, 2.4], labels: ['Q1', 'Q2', 'Q3'] },
  });
  ok(
    ir && ir.structure === 'magnitude' && ir.orientation === 'horizontal' && ir.emphasis[0] === 2,
    'bar → horizontal magnitude, emphasis = max index',
  );
}
{
  const ir = atomToIR({ type: 'pie', args: { values: [32, 23, 45], labels: ['A', 'B', 'C'] } });
  ok(
    ir &&
      ir.structure === 'proportion' &&
      ir.groups[0].values[2] === 45 &&
      ir.groups[0].sliceLabels[0] === 'A',
    'pie → proportion with slice labels',
  );
}
{
  const ir = atomToIR({
    type: 'dashboard-multi-kpi-composite',
    args: {
      kpis: [
        { value: '$3.4M', label: 'Revenue' },
        { value: '12,450', label: 'MAU' },
      ],
    },
  });
  ok(
    ir &&
      ir.structure === 'magnitude' &&
      JSON.stringify(ir.magnitude) === JSON.stringify([3400000, 12450]),
    'dashboard-multi-kpi-composite → magnitude, values parsed',
  );
}
{
  const ir = atomToIR({
    type: 'dashboard-multi-kpi-composite',
    args: {
      kpis: [
        { value: 'Week 8', label: 'Unparseable' },
        { value: '10', label: 'OK' },
      ],
    },
  });
  ok(ir === null, 'dashboard-multi-kpi-composite skips atom on unparseable value');
}
{
  const ir = atomToIR({
    type: 'stat-grid-large',
    args: {
      stats: [
        { value: '$24M', label: 'ARR' },
        { value: '92%', label: 'Retention' },
      ],
    },
  });
  ok(ir && ir.structure === 'magnitude', 'stat-grid-large → magnitude');
}
{
  const ir = atomToIR({
    type: 'waterfall',
    args: {
      bars: [
        { label: 'Q1', value: 100, kind: 'start' },
        { label: 'New', value: 30, kind: 'positive' },
        { label: 'Q2', value: 130, kind: 'end' },
      ],
    },
  });
  ok(
    ir && ir.structure === 'magnitude' && ir.emphasis[0] === 2,
    'waterfall → magnitude, emphasis = end bar',
  );
}
{
  const ir = atomToIR({
    type: 'radar-chart',
    args: {
      axes: ['Speed', 'Quality', 'Cost'],
      series: [{ label: 'Current', values: [0.7, 0.4, 0.6] }],
    },
  });
  ok(
    ir && ir.structure === 'magnitude' && ir.nodes.length === 3,
    'radar-chart → magnitude, nodes = axes',
  );
}

// ---- no structural content / null cases -------------------------------------
ok(atomToIR({ type: 'cover', args: { title: 'Deck' } }) === null, 'cover → null (no structure)');
ok(atomToIR({ type: 'not-a-real-atom', args: {} }) === null, 'unknown atom type → null');
ok(atomToIR(null) === null, 'null subject → null');
ok(atomToIR({ type: 'org-chart', args: {} }) === null, 'org-chart with no root → null');

// ---- slotToIR: richest-subject selection ------------------------------------
{
  const ir = slotToIR({
    subjects: [
      { type: 'cover', args: { title: 'x' } },
      { type: 'bar', args: { values: [1, 2], labels: ['A', 'B'] } },
      {
        type: 'org-chart',
        args: { root: { name: 'CEO', children: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] } },
      },
    ],
  });
  ok(
    ir && ir.structure === 'hierarchy' && ir.nodes.length === 4,
    'slotToIR picks richest (4 nodes > 2)',
  );
}
{
  const ir = slotToIR({
    subjects: [
      { type: 'bar', args: { values: [1, 2], labels: ['A', 'B'] } },
      { type: 'pie', args: { values: [30, 20, 50], labels: ['A', 'B', 'C'] } },
    ],
  });
  ok(
    ir && ir.structure === 'proportion' && ir.groups[0].values.length === 3,
    'slotToIR scores node-less proportion IRs instead of throwing',
  );
}
ok(
  slotToIR({ subjects: [{ type: 'cover', args: { title: 'x' } }] }) === null,
  'slotToIR: cover-only slot → null',
);
ok(slotToIR({ subjects: [] }) === null, 'slotToIR: no subjects → null');

// ---- funnelSlotToIR back-compat ---------------------------------------------
{
  const ir = funnelSlotToIR({
    subjects: [{ type: 'funnel', args: { title: 'F', stages: [{ label: 'A', value: 10 }] } }],
  });
  ok(ir.structure === 'sequence', 'funnelSlotToIR back-compat still works');
}

// ---- deckToIR on a REAL baked eval deck -------------------------------------
const QBR_DIR = resolve(__dirname, '../examples/scaffold-pipeline/eval-qbr-q3-2026');
{
  const deck = deckToIR(QBR_DIR);
  ok(
    deck.slides.length > 0,
    `deckToIR(eval-qbr-q3-2026) → non-empty slides (${deck.slides.length})`,
  );
  ok(
    deck.slides.every((ir) => validateIR(ir).ok),
    'every slide from deckToIR passes validateIR',
  );
  ok(typeof deck.title === 'string' && deck.title.length > 0, 'deckToIR carries a title');
}

// ---- end-to-end: deckToIR → assembleDeck → compile ---------------------------
{
  const deck = deckToIR(QBR_DIR);
  const scene = assembleDeck(deck);
  ok(
    scene.subjects.length > 0 && scene.cameraSequence.shots.length > 0,
    'assembleDeck assembles the IR deck',
  );
  try {
    compile(scene, {});
    ok(true, 'scaffold deck → IR → assembled world → COMPILES (thesis loop closes)');
  } catch (e) {
    ok(false, `compile failed: ${e.message}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
