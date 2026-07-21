// test-render-matrix.mjs — structure renderer #5: matrix → quadrant wall.
import { renderMatrix } from '../src/scene/render-matrix.js';
import { renderIR, RENDERER_STRUCTURES } from '../src/scene/render-ir.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';
import { compile } from '../src/scene/index.js';
import { expandStage } from '../src/scene/stage.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== render-matrix (quadrant wall) ===\n');

const swot = {
  structure: 'matrix',
  nodes: ['Strong team', 'High burn', 'AI wave', 'Incumbents'],
  axes: [
    ['Internal', 'External'],
    ['Helpful', 'Harmful'],
  ],
  cells: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
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

// STATIC GEOMETRY (user-locked 2026-07-15): only the CAMERA animates — the
// board is fully filled from frame one, exactly like the source page.
ok(
  items.every((s) => !s.animation),
  'items carry NO build-in animation (camera owns all motion)',
);

// emphasis item gets the gold treatment + a value label; camera has cut super + payoff
ok(items.find((s) => s.id === 'item-2').material.glow > 0, 'emphasis item glows (gold)');
ok(
  scene.cameraSequence.shots.some((s) => s.transition === 'cut'),
  'has the punch-in super',
);
ok(
  scene.overlay.filter((o) => o.role === 'card').length >= 2 + 2,
  'axis labels stay ANCHORED (they define the space)',
);
ok(
  scene.overlay.filter((o) => o.role === 'screen').length >= 3,
  'cell texts ride the subtitle column',
);
ok(
  scene.subjects.every((s) => !/text/.test(s.type)),
  'no baked SDF text',
);

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
  ok(
    deck.subjects.some((s) => s.id.includes('stage-platform')),
    'staged deck with matrix slide assembles',
  );
}

// ---- versus form (2 contenders × ≥3 dimensions → the aisle) -------------------------
{
  const vs = {
    structure: 'matrix',
    title: '推荐引擎 VS. 搜索引擎',
    axes: [
      ['推荐引擎', '搜索引擎'],
      ['使用频次', '服务方式', '表达门槛', '表达精度'],
    ],
    nodes: ['高频', '低频', '主动', '被动', '低', '高', '中等', '高'],
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
      [0, 3],
      [1, 3],
    ],
    emphasis: [0],
  };
  const { renderMatrix: rm } = await import('../src/scene/render-matrix.js');
  const aisle = rm(vs);
  ok(aisle.name.startsWith('(matrix·versus)'), '2×N comparison renders as the aisle');
  const panels = aisle.subjects.filter((s) => s.id.startsWith('vs-panel-'));
  ok(panels.length === 8, 'one panel per cell, both walls');
  ok(
    panels.every((s) => Math.abs(Math.abs(s.transform.translate[0]) - 2.35) < 1e-9),
    'walls face each other across the aisle',
  );
  const a0 = panels.find((s) => s.id === 'vs-panel-0-0');
  const b0 = panels.find((s) => s.id === 'vs-panel-1-0');
  ok(
    a0.transform.translate[0] > 0 && b0.transform.translate[0] < 0,
    'contender 0 on +x (screen-left)',
  );
  // the walk: one blend beat per dimension between establishing and super
  const walk = aisle.cameraSequence.shots.filter((s) => s.transition === 'blend' && !s.beat);
  ok(walk.length >= vs.axes[1].length, 'camera walks one beat per dimension');
  const sup = aisle.cameraSequence.shots.find((s) => s.beat === 'super');
  ok(!!sup && sup.transition === 'cut', 'versus keeps the super punch-in');
  // text in two places (locked): left column for contender 0, right for 1
  const sides = aisle.overlay.filter((o) => o.role === 'screen').map((o) => o.side);
  ok(sides.includes('left') && sides.includes('right'), 'comparison text lives in two columns');
  try {
    compile(expandStage(aisle), {});
    ok(true, 'versus scene compiles');
  } catch (e) {
    ok(false, `versus compile failed: ${e.message}`);
  }
  // guards: SWOT (2×2) and explicit evolution stay off the aisle
  ok(!rm(swot).name.includes('versus'), 'SWOT 2×2 stays a quadrant wall');
  const era = {
    structure: 'matrix',
    title: '过去到现在',
    axes: [
      ['过去', '现在'],
      ['生产', '分发', '终端'],
    ],
    nodes: ['线下', '线上', '人工', '算法', 'PC', '移动'],
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
    emphasis: [3],
  };
  ok(
    rm(era).name.startsWith('(matrix·evolution)'),
    'implicit past/present 2×N matrix renders as evolution',
  );
  // era axis on the ROWS (the flagship p4 shape: axes = [3 dims, [过去,现在]])
  // transposes into the same evolution branch
  const eraRows = {
    structure: 'matrix',
    title: '推荐引擎开创者',
    axes: [
      ['产生和消费方式', '流动方式', '终端'],
      ['过去', '现在'],
    ],
    nodes: ['编辑挑选', '浏览搜索', 'PC', '个性化', '推荐关注', '移动终端'],
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    emphasis: [3],
  };
  const evo = rm(eraRows);
  ok(evo.name.startsWith('(matrix·evolution)'), 'era axis on rows transposes into evolution');
  // 编辑挑选 (过去) must land as a grounded PAST tablet, 个性化 as a PRESENT orb
  ok(
    evo.subjects.some((s) => s.id === 'past-0') && evo.subjects.some((s) => s.id === 'now-3'),
    'transposed cells keep their era assignment',
  );
  // reversed era listing ([现在, 过去]) is normalized, not rendered upside down
  const revved = {
    ...era,
    axes: [['现在', '过去'], era.axes[1]],
    cells: era.cells.map(([x, y]) => [1 - x, y]),
  };
  const evo2 = rm(revved);
  ok(
    evo2.name.startsWith('(matrix·evolution)') &&
      evo2.subjects.some((s) => s.id === 'past-0') ===
        rm(era).subjects.some((s) => s.id === 'past-0'),
    'reversed era order normalizes to the same layout',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
