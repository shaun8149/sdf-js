// sdf-js/scripts/test-ir-matrix.mjs — Sprint 28: matrix IR structure +
// ir-to-2d smart selection (magnitude bar/pie/donut, matrix atom picking).
// Covers: validateIR matrix rules, all 6 matrix-family atom→IR mappers,
// chooseMagnitudeAtom, chooseMatrixAtom, matrix IR→2D render smoke, and
// deckToIR's renderer-support filter (default excludes matrix, opts include).
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateIR } from '../src/scene/ir.js';
import { atomToIR, deckToIR } from '../src/scene/scaffold-to-ir.js';
import { irToSceneData, chooseMagnitudeAtom, chooseMatrixAtom } from '../src/scene/ir-to-2d.js';
import { renderAtom } from '../src/present/atoms-2d/registry.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== ir-matrix (Sprint 28: matrix structure + smart 2D selection) ===\n');

// ---- validateIR: matrix contract ---------------------------------------------
{
  const good = {
    structure: 'matrix',
    nodes: ['A', 'B', 'C', 'D'],
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
    title: 'T',
  };
  ok(validateIR(good).ok, 'well-formed matrix IR validates');

  ok(
    !validateIR({ ...good, axes: [['Internal', 'External']] }).ok,
    'matrix rejects axes with != 2 arrays',
  );
  ok(
    !validateIR({ ...good, axes: [[], ['Helpful', 'Harmful']] }).ok,
    'matrix rejects an empty axis',
  );
  ok(
    !validateIR({
      ...good,
      axes: [
        [1, 2],
        ['Helpful', 'Harmful'],
      ],
    }).ok,
    'matrix rejects non-string axis categories',
  );
  ok(!validateIR({ ...good, axes: undefined }).ok, 'matrix requires axes at all');
  ok(!validateIR({ ...good, cells: undefined }).ok, 'matrix requires cells at all');
  ok(
    !validateIR({
      ...good,
      cells: [
        [0, 0],
        [0, 1],
        [1, 0],
      ],
    }).ok,
    'matrix rejects cells.length != nodes.length',
  );
  ok(
    !validateIR({
      ...good,
      cells: [
        [0, 0],
        [0, 1],
        [1, 0],
        [5, 5],
      ],
    }).ok,
    'matrix rejects an out-of-range cell index',
  );
  ok(
    !validateIR({
      ...good,
      cells: [
        [0, 0],
        [0, 1],
        [1, 0],
        ['a', 0],
      ],
    }).ok,
    'matrix rejects a non-integer cell index',
  );
  ok(
    validateIR({ structure: 'sequence', nodes: ['A', 'B'], axes: 'garbage' }).ok,
    'non-matrix structures ignore axes/cells (permissive, per contract style)',
  );
}

// ---- bridge 1: each matrix-family atom → valid matrix IR ---------------------
{
  const ir = atomToIR({
    type: 'swot',
    args: {
      title: 'SWOT',
      strengths: ['Strong brand'],
      weaknesses: ['High burn'],
      opportunities: ['Asia entry'],
      threats: ['Competitor'],
    },
  });
  ok(ir && validateIR(ir).ok, 'swot → valid matrix IR');
  ok(ir?.structure === 'matrix', 'swot IR structure = matrix');
  ok(
    JSON.stringify(ir.axes) ===
      JSON.stringify([
        ['Internal', 'External'],
        ['Helpful', 'Harmful'],
      ]),
    'swot axes = Internal/External × Helpful/Harmful',
  );
  ok(
    ir.nodes.length === 4 && ir.cells.length === 4,
    'swot: one node+cell per item across 4 groups',
  );
}
{
  const ir = atomToIR({
    type: 'risk-heatmap',
    args: {
      title: 'Risk',
      risks: [
        { label: 'Data breach', likelihood: 4, impact: 5 },
        { label: 'Vendor delay', likelihood: 5, impact: 2 },
      ],
    },
  });
  ok(ir && validateIR(ir).ok, 'risk-heatmap → valid matrix IR');
  ok(
    JSON.stringify(ir.cells[0]) === JSON.stringify([3, 4]),
    'risk-heatmap cell = [likelihood-1,impact-1]',
  );
  ok(ir.magnitude[0] === 20, 'risk-heatmap magnitude = likelihood*impact severity');
}
{
  const ir = atomToIR({
    type: 'cost-benefit-matrix',
    args: {
      items: [
        { label: 'AI Chatbot', cost: 'low', benefit: 'high' },
        { label: 'ERP Upgrade', cost: 'high', benefit: 'high' },
      ],
    },
  });
  ok(ir && validateIR(ir).ok, 'cost-benefit-matrix → valid matrix IR');
  ok(
    JSON.stringify(ir.cells[0]) === JSON.stringify([0, 1]),
    'cost-benefit-matrix: low cost/high benefit → [0,1]',
  );
}
{
  const ir = atomToIR({
    type: 'org-vs-org-matrix',
    args: {
      xAxis: 'Vision',
      yAxis: 'Execution',
      orgs: [
        { name: 'Us', x: 0.7, y: 0.8, isUs: true },
        { name: 'Them', x: 0.3, y: 0.2 },
      ],
    },
  });
  ok(ir && validateIR(ir).ok, 'org-vs-org-matrix → valid matrix IR');
  ok(ir.emphasis?.[0] === 0, 'org-vs-org-matrix emphasis = isUs index');
}
{
  const ir = atomToIR({
    type: 'matrix-grid',
    args: {
      rows: 2,
      cols: 2,
      xAxis: { low: 'Low Effort', high: 'High Effort' },
      cells: [
        { label: 'Quick Wins' },
        { label: 'Major' },
        { label: 'Fill-in' },
        { label: 'Avoid' },
      ],
    },
  });
  ok(ir && validateIR(ir).ok, 'matrix-grid → valid matrix IR');
  ok(ir.axes[0][0] === 'Low Effort', 'matrix-grid uses named xAxis when 2-wide');
}
{
  const ir = atomToIR({
    type: 'nine-field-matrix',
    args: {
      cells: Array.from({ length: 9 }, (_, i) => ({ label: `C${i}` })),
    },
  });
  ok(ir && validateIR(ir).ok, 'nine-field-matrix → valid matrix IR');
  ok(ir.nodes.length === 9 && ir.axes[0].length === 3, 'nine-field-matrix: 3x3 = 9 nodes');
}

// ---- chooseMagnitudeAtom ------------------------------------------------------
{
  const shareIr = {
    structure: 'magnitude',
    nodes: ['Enterprise', 'Mid-market', 'SMB'],
    magnitude: [50, 30, 20],
    title: 'Revenue mix by segment',
  };
  ok(
    chooseMagnitudeAtom(shareIr) === 'donut-with-center',
    'share-language title → donut-with-center',
  );

  const balancedIr = {
    structure: 'magnitude',
    nodes: ['A', 'B', 'C'],
    magnitude: [40, 35, 25],
    title: 'Regional split',
  };
  ok(
    chooseMagnitudeAtom(balancedIr) === 'donut-with-center',
    'no-dominant-slice parts-of-whole (no share word needed) → donut-with-center',
  );

  const pieIr = {
    structure: 'magnitude',
    nodes: ['Dominant', 'Small', 'Tiny'],
    magnitude: [90, 5, 5],
    title: 'Comparison by segment',
  };
  ok(
    chooseMagnitudeAtom(pieIr) === 'pie',
    'small (≤5) parts-of-whole with a dominant slice, no share language → pie',
  );

  const genericIr = {
    structure: 'magnitude',
    nodes: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    magnitude: [10, 20, 30, 15, 5, 8, 12],
    title: 'Headcount by team',
  };
  ok(chooseMagnitudeAtom(genericIr) === 'bar', '>6 nodes, no share language → bar');

  const negativeIr = {
    structure: 'magnitude',
    nodes: ['A', 'B', 'C'],
    magnitude: [10, -5, 20],
    title: 'Change by region',
  };
  ok(
    chooseMagnitudeAtom(negativeIr) === 'bar',
    'non-positive magnitude (not parts-of-whole) → bar',
  );

  // Real-news regression (Sprint 28 Part C): growth-rate forecasts across
  // institutions are comparisons, not composition — a donut of them shows a
  // meaningless summed center value.
  const rateIrZh = {
    structure: 'magnitude',
    nodes: ['IMF预测', 'OECD预测', '世界银行预测', '中国', '欧元区', '低收入国家'],
    magnitude: [3.3, 2.9, 2.5, 5, 1.1, 5.4],
    title: '2026年全球GDP增长预测（%）',
  };
  ok(
    chooseMagnitudeAtom(rateIrZh) === 'bar',
    'Chinese growth-rate language (增长/预测) → bar, never donut',
  );

  const rateIrEn = {
    structure: 'magnitude',
    nodes: ['US', 'EU', 'China'],
    magnitude: [2.1, 1.1, 5.0],
    title: 'GDP growth forecast 2026',
  };
  ok(chooseMagnitudeAtom(rateIrEn) === 'bar', 'English rate language (growth/forecast) → bar');

  // Rate guard must not break genuine composition slides.
  ok(
    chooseMagnitudeAtom(shareIr) === 'donut-with-center',
    'rate guard leaves share-language slides untouched',
  );
}

// ---- chooseMatrixAtom ----------------------------------------------------------
{
  const swotIr = {
    structure: 'matrix',
    nodes: ['a', 'b'],
    axes: [
      ['Internal', 'External'],
      ['Helpful', 'Harmful'],
    ],
    cells: [
      [0, 0],
      [1, 1],
    ],
  };
  ok(chooseMatrixAtom(swotIr) === 'swot', 'SWOT-shaped axes → swot');

  const cbIr = {
    structure: 'matrix',
    nodes: ['a', 'b'],
    axes: [
      ['Low Cost', 'High Cost'],
      ['Low Benefit', 'High Benefit'],
    ],
    cells: [
      [0, 0],
      [1, 1],
    ],
  };
  ok(
    chooseMatrixAtom(cbIr) === 'cost-benefit-matrix',
    'generic 2×2 (non-SWOT labels) → cost-benefit-matrix',
  );

  const riskIr = {
    structure: 'matrix',
    nodes: ['r1', 'r2'],
    axes: [
      ['Very Low', 'Low', 'Medium', 'High', 'Very High'],
      ['Very Low', 'Low', 'Medium', 'High', 'Very High'],
    ],
    cells: [
      [3, 4],
      [4, 1],
    ],
    magnitude: [20, 5],
  };
  ok(chooseMatrixAtom(riskIr) === 'risk-heatmap', '5×5 axes + magnitude → risk-heatmap');

  const gridIr = { ...riskIr, magnitude: undefined };
  ok(
    chooseMatrixAtom(gridIr) === 'matrix-grid',
    '5×5 axes without magnitude → matrix-grid fallback',
  );
}

// ---- matrix IR → 2D sceneData: shape + no-throw render -----------------------
function makeStubCtx() {
  return {
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    rect() {},
    fillRect() {},
    strokeRect() {},
    fillText() {},
    strokeText() {},
    measureText() {
      return { width: 40 };
    },
    arc() {},
    fill() {},
    stroke() {},
    setLineDash() {},
    drawImage() {},
    translate() {},
    rotate() {},
    scale() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
  };
}

{
  const irs = [
    {
      structure: 'matrix',
      title: 'SWOT',
      nodes: ['Strong brand', 'High burn'],
      axes: [
        ['Internal', 'External'],
        ['Helpful', 'Harmful'],
      ],
      cells: [
        [0, 0],
        [0, 1],
      ],
    },
    {
      structure: 'matrix',
      title: 'Cost-Benefit',
      nodes: ['Item A', 'Item B'],
      axes: [
        ['Low Cost', 'High Cost'],
        ['Low Benefit', 'High Benefit'],
      ],
      cells: [
        [0, 1],
        [1, 0],
      ],
    },
    {
      structure: 'matrix',
      title: 'Risk',
      nodes: ['Breach', 'Delay'],
      axes: [
        ['Very Low', 'Low', 'Medium', 'High', 'Very High'],
        ['Very Low', 'Low', 'Medium', 'High', 'Very High'],
      ],
      cells: [
        [3, 4],
        [4, 1],
      ],
      magnitude: [20, 5],
    },
    {
      structure: 'matrix',
      title: 'Grid',
      nodes: ['A', 'B', 'C'],
      axes: [['Col 1', 'Col 2', 'Col 3'], ['Row 1']],
      cells: [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    },
  ];
  const expectedTypes = ['swot', 'cost-benefit-matrix', 'risk-heatmap', 'matrix-grid'];
  let allShapeOk = true;
  let allRendered = true;
  for (let i = 0; i < irs.length; i++) {
    const sd = irToSceneData(irs[i]);
    const subj = sd.subjects[0];
    if (subj.type !== expectedTypes[i]) {
      allShapeOk = false;
      console.log(`    expected ${expectedTypes[i]}, got ${subj.type}`);
    }
    try {
      await renderAtom(makeStubCtx(), subj.type, subj.args, 'pseudo3d', {
        x: subj.x,
        y: subj.y,
        w: subj.w,
        h: subj.h,
      });
    } catch (e) {
      allRendered = false;
      console.log(`    render threw for ${subj.type}: ${e.message}`);
    }
  }
  ok(allShapeOk, 'matrix IR → 2D picks the expected atom type per shape');
  ok(allRendered, 'renderAtom does not throw for any matrix-derived subject');
}

// ---- deckToIR: filters matrix by default, includes with opts.structures -----
{
  const dir = mkdtempSync(join(tmpdir(), 'ir-matrix-deck-'));
  mkdirSync(join(dir, 'slots'));
  writeFileSync(
    join(dir, 'deck.json'),
    JSON.stringify({
      deckName: 'matrix-fixture',
      scaffold: { label: 'Matrix Fixture' },
      slots: [
        {
          liftFile: 'slots/slot-00-swot.json',
          error: null,
          mappingEmpty: false,
        },
      ],
    }),
  );
  writeFileSync(
    join(dir, 'slots', 'slot-00-swot.json'),
    JSON.stringify({
      sceneData: {
        subjects: [
          {
            type: 'swot',
            args: {
              title: 'SWOT',
              strengths: ['Strong brand'],
              weaknesses: ['High burn'],
              opportunities: [],
              threats: [],
            },
          },
        ],
      },
    }),
  );

  const filtered = deckToIR(dir);
  ok(filtered.slides.length === 0, 'deckToIR filters matrix slides by default (no 3D renderer)');

  const included = deckToIR(dir, { structures: ['matrix'] });
  ok(
    included.slides.length === 1 && included.slides[0].structure === 'matrix',
    'deckToIR includes matrix when opts.structures allows it',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
