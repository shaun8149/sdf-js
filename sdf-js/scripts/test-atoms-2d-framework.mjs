#!/usr/bin/env node
// =============================================================================
// test-atoms-2d-framework.mjs — smoke test for atoms-2d Phase 0 framework
// -----------------------------------------------------------------------------
// Node-side test. Verifies:
//   1. Registry exports & dispatch
//   2. KPI card spec is well-formed
//   3. drawPseudo3D is callable with a stub ctx (records call sequence)
//
// Visual verify is in browser via /examples/atoms-2d-demo/.
// =============================================================================

import {
  isAtom2DType,
  listAtomTypes,
  getAtomSpec,
  renderAtom,
} from '../src/present/atoms-2d/registry.js';

let pass = 0,
  fail = 0;
function ok(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.log(`  ✗ ${msg}`);
  }
}

// ----- Registry -----
console.log('--- registry ---');
{
  const types = listAtomTypes();
  ok(Array.isArray(types), 'listAtomTypes returns array');
  ok(types.includes('kpi-card'), `kpi-card registered (types: ${types.join(', ')})`);
  ok(isAtom2DType('kpi-card'), 'isAtom2DType("kpi-card") true');
  ok(!isAtom2DType('p5-sketch'), 'isAtom2DType("p5-sketch") false (not in registry)');
  ok(!isAtom2DType('nonsense-foo'), 'isAtom2DType unknown type false');
}

// ----- KPI card spec -----
console.log('\n--- kpi-card spec ---');
{
  const spec = await getAtomSpec('kpi-card');
  ok(spec.type === 'kpi-card', 'spec.type matches');
  ok(spec.category === 'charts/data', `spec.category = "${spec.category}"`);
  ok(typeof spec.description === 'string', 'spec has description');
  ok(spec.args && spec.args.value && spec.args.label, 'spec declares value + label args');
  ok(spec.args.value.required === true, 'value is required');
  ok(spec.args.trend && spec.args.trend.type.includes('?'), 'trend is optional');
}

// ----- drawPseudo3D smoke (stub ctx recording call sequence) -----
console.log('\n--- drawPseudo3D smoke ---');
{
  const calls = [];
  function makeStubCtx() {
    const c = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      beginPath: () => calls.push('beginPath'),
      closePath: () => calls.push('closePath'),
      moveTo: (...a) => calls.push(['moveTo', ...a]),
      lineTo: (...a) => calls.push(['lineTo', ...a]),
      quadraticCurveTo: (...a) => calls.push(['quadraticCurveTo', ...a]),
      arc: (...a) => calls.push(['arc', ...a]),
      stroke: () => calls.push('stroke'),
      fill: () => calls.push('fill'),
      fillText: (...a) => calls.push(['fillText', ...a]),
      measureText: () => ({ width: 24 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      fillRect: (...a) => calls.push(['fillRect', ...a]),
      set fillStyle(v) {
        calls.push(['fillStyle=', v]);
      },
      set strokeStyle(v) {
        calls.push(['strokeStyle=', v]);
      },
      set lineWidth(v) {
        calls.push(['lineWidth=', v]);
      },
      set shadowColor(v) {
        calls.push(['shadowColor=', v]);
      },
      set shadowBlur(v) {
        calls.push(['shadowBlur=', v]);
      },
      set shadowOffsetY(v) {
        calls.push(['shadowOffsetY=', v]);
      },
      set font(v) {
        calls.push(['font=', v]);
      },
      set textAlign(v) {
        calls.push(['textAlign=', v]);
      },
      set textBaseline(v) {
        calls.push(['textBaseline=', v]);
      },
    };
    return c;
  }
  const ctx = makeStubCtx();
  await renderAtom(
    ctx,
    'kpi-card',
    { value: '$3.4M', label: 'Q3 Revenue', trend: 'up', trendValue: '+127%', icon: 'chart-bar' },
    'pseudo3d',
    { x: 0, y: 0, w: 280, h: 160, palette: { bg: [247, 244, 224], silhouetteColor: [30, 27, 30] } },
  );

  ok(calls.length > 10, `drawPseudo3D made many ctx calls (${calls.length})`);
  ok(
    calls.some((c) => Array.isArray(c) && c[0] === 'fillText' && String(c[1]).includes('3.4')),
    'value text "$3.4M" drawn',
  );
  ok(
    calls.some(
      (c) => Array.isArray(c) && c[0] === 'fillText' && String(c[1]).includes('Q3 Revenue'),
    ),
    'label text "Q3 Revenue" drawn',
  );
  ok(
    calls.some((c) => Array.isArray(c) && c[0] === 'fillText' && String(c[1]).includes('127%')),
    'trend value "+127%" drawn',
  );
  ok(
    calls.some((c) => Array.isArray(c) && c[0] === 'fillText' && String(c[1]).includes('↑')),
    'up arrow ↑ drawn',
  );
  ok(
    calls.some((c) => Array.isArray(c) && c[0] === 'arc'),
    'icon circle (stub) drawn',
  );
  ok(
    calls.filter((c) => c === 'save').length === calls.filter((c) => c === 'restore').length,
    `save/restore balanced (${calls.filter((c) => c === 'save').length} pairs)`,
  );
}

// ----- Unknown style throws -----
console.log('\n--- error paths ---');
{
  let threw = false;
  try {
    await renderAtom({}, 'kpi-card', {}, 'unknown-style');
  } catch (e) {
    threw = e.message.includes('style');
  }
  ok(threw, 'unknown style throws');

  threw = false;
  try {
    await renderAtom({}, 'nonsense-atom-foo', {}, 'pseudo3d');
  } catch (e) {
    threw = e.message.includes('unknown atom type');
  }
  ok(threw, 'unknown atom type throws');

  threw = false;
  try {
    await renderAtom({}, 'kpi-card', {}, 'flat');
  } catch (e) {
    threw = e.message.includes('does not implement');
  }
  ok(threw, 'unimplemented style (flat) throws clearly');
}

// ----- Trend variations: down + neutral -----
console.log('\n--- trend variants ---');
{
  const ctx = (() => {
    const c = {};
    const noop = () => {};
    for (const m of [
      'save',
      'restore',
      'beginPath',
      'closePath',
      'moveTo',
      'lineTo',
      'quadraticCurveTo',
      'arc',
      'stroke',
      'fill',
      'fillRect',
    ]) {
      c[m] = noop;
    }
    c.measureText = () => ({ width: 12 });
    c.createLinearGradient = () => ({ addColorStop: noop });
    const recorded = [];
    c.fillText = (t) => recorded.push(t);
    Object.defineProperty(c, 'fillStyle', { set() {} });
    Object.defineProperty(c, 'strokeStyle', { set() {} });
    Object.defineProperty(c, 'lineWidth', { set() {} });
    Object.defineProperty(c, 'shadowColor', { set() {} });
    Object.defineProperty(c, 'shadowBlur', { set() {} });
    Object.defineProperty(c, 'shadowOffsetY', { set() {} });
    Object.defineProperty(c, 'font', { set() {} });
    Object.defineProperty(c, 'textAlign', { set() {} });
    Object.defineProperty(c, 'textBaseline', { set() {} });
    c._recorded = recorded;
    return c;
  })();

  await renderAtom(
    ctx,
    'kpi-card',
    { value: '2.1%', label: 'Churn', trend: 'down', trendValue: '-1.3pt' },
    'pseudo3d',
    { palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(
    ctx._recorded.some((t) => String(t).includes('↓')),
    'down trend draws ↓',
  );

  ctx._recorded.length = 0;
  await renderAtom(
    ctx,
    'kpi-card',
    { value: '68', label: 'NPS', trend: 'neutral', trendValue: '0' },
    'pseudo3d',
    { palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(
    ctx._recorded.some((t) => String(t).includes('→')),
    'neutral trend draws →',
  );
}

// ----- bar atom (Phase 1a) -----
console.log('\n--- bar atom ---');
{
  const spec = await getAtomSpec('bar');
  ok(spec.type === 'bar', 'bar spec.type matches');
  ok(spec.category === 'charts/data', `bar spec.category = "${spec.category}"`);
  ok(spec.args.values.required === true, 'bar values required');
  ok(spec.args.labels.required === true, 'bar labels required');

  // Smoke render with stub ctx (record values + labels drawn as fillText)
  const recorded = [];
  const c = {};
  const noop = () => {};
  for (const m of [
    'save',
    'restore',
    'beginPath',
    'closePath',
    'moveTo',
    'lineTo',
    'quadraticCurveTo',
    'arc',
    'stroke',
    'fill',
    'fillRect',
  ]) {
    c[m] = noop;
  }
  c.measureText = (t) => ({ width: String(t).length * 7 });
  c.createLinearGradient = () => ({ addColorStop: noop });
  c.fillText = (t) => recorded.push(t);
  for (const p of [
    'fillStyle',
    'strokeStyle',
    'lineWidth',
    'shadowColor',
    'shadowBlur',
    'shadowOffsetY',
    'font',
    'textAlign',
    'textBaseline',
  ]) {
    Object.defineProperty(c, p, { set() {} });
  }

  await renderAtom(
    c,
    'bar',
    {
      values: [1.2, 1.8, 2.4, 3.1],
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      format: 'currency',
      title: 'Quarterly Revenue',
    },
    'pseudo3d',
    { x: 0, y: 0, w: 480, h: 280, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );

  ok(recorded.includes('Quarterly Revenue'), 'title rendered');
  ok(recorded.includes('Q1') && recorded.includes('Q4'), 'all labels rendered');
  ok(recorded.includes('$1.2') && recorded.includes('$3.1'), 'currency-formatted values rendered');

  // Empty input → no crash
  recorded.length = 0;
  let crashed = false;
  try {
    await renderAtom(c, 'bar', { values: [], labels: [] }, 'pseudo3d', {
      w: 100,
      h: 100,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'empty values+labels no crash');

  // Mismatched lengths use min count
  recorded.length = 0;
  await renderAtom(c, 'bar', { values: [10, 20, 30, 40, 50], labels: ['A', 'B'] }, 'pseudo3d', {
    w: 480,
    h: 280,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
  });
  ok(
    recorded.filter((t) => t === 'A' || t === 'B').length === 2,
    'mismatched labels/values → uses min (got 2 label draws)',
  );
}

// ----- line atom (Phase 1b) -----
console.log('\n--- line atom ---');
{
  const spec = await getAtomSpec('line');
  ok(spec.type === 'line', 'line spec.type');
  ok(spec.args.annotations.type.includes('index'), 'annotations spec describes shape');

  const recorded = [];
  const c = stubCtx(recorded);
  await renderAtom(
    c,
    'line',
    {
      values: [1.2, 1.8, 2.4, 3.1],
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      format: 'currency',
      title: 'Revenue Trajectory',
      annotations: [{ index: 2, text: '↑ launch' }],
      showValues: true,
    },
    'pseudo3d',
    { x: 0, y: 0, w: 480, h: 280, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('Revenue Trajectory'), 'title rendered');
  ok(recorded.includes('Q1') && recorded.includes('Q4'), 'x labels rendered');
  ok(
    recorded.includes('$1.2') && recorded.includes('$3.1'),
    'value labels rendered (showValues=true)',
  );
  ok(
    recorded.some((t) => String(t).includes('launch')),
    'annotation text rendered',
  );

  // n < 2 = no-op
  recorded.length = 0;
  let crashed = false;
  try {
    await renderAtom(c, 'line', { values: [1], labels: ['only'] }, 'pseudo3d', {
      w: 100,
      h: 100,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'n=1 no crash (silently no-op)');
}

// ----- pie atom (Phase 1b) -----
console.log('\n--- pie atom ---');
{
  const spec = await getAtomSpec('pie');
  ok(spec.type === 'pie', 'pie spec.type');
  ok(spec.args.donutRatio.default === 0, 'donutRatio defaults to 0 (solid pie)');

  const recorded = [];
  const c = stubCtx(recorded);
  await renderAtom(
    c,
    'pie',
    {
      values: [32, 23, 11, 8, 26],
      labels: ['AWS', 'Azure', 'GCP', 'Alibaba', 'Others'],
      format: 'percent',
      title: 'Cloud Market Share',
    },
    'pseudo3d',
    { x: 0, y: 0, w: 400, h: 300, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('Cloud Market Share'), 'title rendered');
  ok(
    recorded.some((t) => String(t).includes('AWS') && String(t).includes('32')),
    'AWS label + 32% rendered',
  );
  ok(
    recorded.some((t) => String(t).includes('Alibaba') && String(t).includes('8')),
    'Alibaba label + 8% rendered',
  );

  // Donut mode + center label
  recorded.length = 0;
  await renderAtom(
    c,
    'pie',
    {
      values: [45, 25, 15, 10, 5],
      labels: ['A', 'B', 'C', 'D', 'E'],
      donutRatio: 0.55,
      centerLabel: '120',
    },
    'pseudo3d',
    { x: 0, y: 0, w: 400, h: 300, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('120'), 'donut center label drawn');

  // Zero sum no crash
  recorded.length = 0;
  let crashed = false;
  try {
    await renderAtom(c, 'pie', { values: [0, 0, 0], labels: ['a', 'b', 'c'] }, 'pseudo3d', {
      w: 100,
      h: 100,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'zero-sum values → no crash');
}

// ----- column atom (Phase 1c) -----
console.log('\n--- column atom ---');
{
  const spec = await getAtomSpec('column');
  ok(spec.type === 'column', 'column spec.type');
  ok(spec.args.values.required && spec.args.labels.required, 'column requires values + labels');

  const recorded = [];
  const c = stubCtx(recorded);
  await renderAtom(
    c,
    'column',
    {
      values: [1.2, 1.8, 2.4, 3.1],
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      format: 'currency',
      title: 'Quarterly',
    },
    'pseudo3d',
    { x: 0, y: 0, w: 480, h: 280, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('Quarterly'), 'title rendered');
  ok(recorded.includes('Q1') && recorded.includes('Q4'), 'X labels rendered');
  ok(
    recorded.includes('$1.2') && recorded.includes('$3.1'),
    'values on top rendered (showValues default true)',
  );

  // showValues: false → no values drawn
  recorded.length = 0;
  await renderAtom(
    c,
    'column',
    { values: [10, 20], labels: ['A', 'B'], showValues: false },
    'pseudo3d',
    { x: 0, y: 0, w: 200, h: 200, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('A') && recorded.includes('B'), 'labels still drawn');
  ok(
    !recorded.includes('10') && !recorded.includes('20'),
    'values suppressed when showValues=false',
  );
}

// ----- flow-chart atom (Phase 2a) -----
console.log('\n--- flow-chart atom ---');
{
  const spec = await getAtomSpec('flow-chart');
  ok(spec.type === 'flow-chart', 'flow-chart spec.type');
  ok(spec.category === 'charts/diagrams', `category = ${spec.category}`);
  ok(spec.args.steps.required, 'steps required');

  const recorded = [];
  const c = stubCtx(recorded);
  await renderAtom(
    c,
    'flow-chart',
    {
      steps: ['Sign up', 'Verify', 'Onboard', 'Purchase'],
      sublabels: ['Day 0', 'Day 0', 'Day 1', 'Day 3'],
      highlight: 2,
      title: 'User Journey',
    },
    'pseudo3d',
    { x: 0, y: 0, w: 720, h: 200, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('User Journey'), 'title rendered');
  ok(recorded.includes('Sign up') && recorded.includes('Purchase'), 'all step labels rendered');
  ok(recorded.includes('Day 0') && recorded.includes('Day 3'), 'sublabels rendered');
  ok(
    ['1', '2', '3', '4'].every((d) => recorded.includes(d)),
    'index numbers 1-4 rendered',
  );

  // Vertical orientation
  recorded.length = 0;
  await renderAtom(
    c,
    'flow-chart',
    { steps: ['A', 'B', 'C'], orientation: 'vertical' },
    'pseudo3d',
    { x: 0, y: 0, w: 200, h: 400, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('A') && recorded.includes('C'), 'vertical labels rendered');

  // Empty steps no crash
  let crashed = false;
  try {
    await renderAtom(c, 'flow-chart', { steps: [] }, 'pseudo3d', {
      w: 200,
      h: 200,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'empty steps no crash');
}

// ----- tree-diagram + org-chart (Phase 2b) -----
console.log('\n--- tree-diagram atom ---');
{
  const spec = await getAtomSpec('tree-diagram');
  ok(spec.type === 'tree-diagram', 'tree-diagram spec.type');
  ok(spec.args.root.required, 'root required');

  const recorded = [];
  const c = stubCtx(recorded);
  await renderAtom(
    c,
    'tree-diagram',
    {
      title: 'Org Tree',
      root: {
        label: 'Product',
        children: [
          { label: 'Engineering', children: [{ label: 'Backend' }, { label: 'Frontend' }] },
          { label: 'Design' },
        ],
      },
    },
    'pseudo3d',
    { x: 0, y: 0, w: 600, h: 400, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('Org Tree'), 'title rendered');
  ok(recorded.includes('Product'), 'root label rendered');
  ok(recorded.includes('Engineering') && recorded.includes('Backend'), 'nested labels rendered');

  // Empty root no crash
  recorded.length = 0;
  let crashed = false;
  try {
    await renderAtom(c, 'tree-diagram', { root: null }, 'pseudo3d', {
      w: 200,
      h: 200,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'null root no crash');

  // Single root no children
  recorded.length = 0;
  await renderAtom(c, 'tree-diagram', { root: { label: 'Lonely' } }, 'pseudo3d', {
    w: 200,
    h: 200,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
  });
  ok(recorded.includes('Lonely'), 'single-node tree renders');
}

console.log('\n--- org-chart atom ---');
{
  const spec = await getAtomSpec('org-chart');
  ok(spec.type === 'org-chart', 'org-chart spec.type');
  ok(spec.args.root.required, 'root required');

  const recorded = [];
  const c = stubCtx(recorded);
  await renderAtom(
    c,
    'org-chart',
    {
      title: 'Executive Team',
      root: {
        name: 'Sarah Chen',
        title: 'CEO',
        children: [
          { name: 'Mike Park', title: 'CTO' },
          { name: 'Lisa Wang', title: 'CMO' },
        ],
      },
    },
    'pseudo3d',
    { x: 0, y: 0, w: 600, h: 400, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('Executive Team'), 'title rendered');
  ok(recorded.includes('Sarah Chen') && recorded.includes('CEO'), 'root name + title rendered');
  ok(recorded.includes('Mike Park') && recorded.includes('CTO'), 'child name + title rendered');
}

// ----- mindmap atom (Phase 2c) -----
console.log('\n--- mindmap atom ---');
{
  const spec = await getAtomSpec('mindmap');
  ok(spec.type === 'mindmap', 'mindmap spec.type');

  const recorded = [];
  const c = stubCtx(recorded);
  await renderAtom(
    c,
    'mindmap',
    {
      title: 'Atlas',
      root: {
        label: 'Atlas',
        children: [
          { label: 'Engine', children: [{ label: 'SDF' }, { label: 'Renderer' }] },
          { label: 'Present' },
        ],
      },
    },
    'pseudo3d',
    { x: 0, y: 0, w: 600, h: 400, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('Atlas'), 'root label rendered (also title)');
  // Branch labels render but may be truncated for tight node radius (Engin… / Prese…)
  ok(
    recorded.some((t) => String(t).startsWith('Engine') || String(t).startsWith('Engin')),
    'Engine branch label rendered (possibly truncated)',
  );
  ok(
    recorded.some((t) => String(t).startsWith('Pres')),
    'Present branch label rendered (possibly truncated)',
  );
  ok(
    recorded.some((t) => String(t).includes('SDF')) ||
      recorded.some((t) => String(t).includes('Render')),
    'leaf labels rendered',
  );

  // Empty no crash
  let crashed = false;
  try {
    await renderAtom(c, 'mindmap', { root: null }, 'pseudo3d', {
      w: 200,
      h: 200,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'null root no crash');
}

// ----- relationship-graph atom (Phase 2c) -----
console.log('\n--- relationship-graph atom ---');
{
  const spec = await getAtomSpec('relationship-graph');
  ok(spec.type === 'relationship-graph', 'relationship-graph spec.type');
  ok(spec.args.nodes.required && spec.args.edges.required, 'nodes + edges required');

  const recorded = [];
  const c = stubCtx(recorded);
  await renderAtom(
    c,
    'relationship-graph',
    {
      title: 'Team Deps',
      nodes: [
        { id: 'eng', label: 'Engineering', group: 0 },
        { id: 'design', label: 'Design', group: 0 },
        { id: 'figma', label: 'Figma', group: 1 },
      ],
      edges: [
        { from: 'eng', to: 'figma', label: 'uses' },
        { from: 'design', to: 'figma', label: 'uses' },
      ],
    },
    'pseudo3d',
    { x: 0, y: 0, w: 600, h: 400, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('Team Deps'), 'title rendered');
  // "Engineering" truncated for fixed node radius; check prefix only
  ok(
    recorded.some((t) => String(t).startsWith('Engin')) &&
      recorded.some((t) => String(t).startsWith('Figm')),
    'node labels rendered (possibly truncated)',
  );
  ok(recorded.filter((t) => t === 'uses').length === 2, 'edge labels rendered (2 "uses")');

  // Empty nodes no crash
  let crashed = false;
  try {
    await renderAtom(c, 'relationship-graph', { nodes: [], edges: [] }, 'pseudo3d', {
      w: 200,
      h: 200,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'empty nodes no crash');
}

// ----- timeline atom (Phase 2c part 2) -----
console.log('\n--- timeline atom ---');
{
  const spec = await getAtomSpec('timeline');
  ok(spec.type === 'timeline', 'timeline spec.type');
  ok(spec.args.events.required, 'events required');

  const recorded = [];
  const c = stubCtx(recorded);
  await renderAtom(
    c,
    'timeline',
    {
      title: 'Milestones',
      axisLabel: '2024-2026',
      events: [
        { date: '2024 Q1', label: 'Seed Round', sublabel: '$2M' },
        { date: '2025 Q3', label: 'Series A', sublabel: '$15M' },
      ],
    },
    'pseudo3d',
    { x: 0, y: 0, w: 800, h: 240, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('Milestones'), 'title rendered');
  ok(recorded.includes('2024-2026'), 'axis label rendered');
  ok(recorded.includes('2024 Q1') && recorded.includes('2025 Q3'), 'event dates rendered');
  ok(recorded.includes('Seed Round') && recorded.includes('Series A'), 'event labels rendered');
  ok(recorded.includes('$2M') && recorded.includes('$15M'), 'event sublabels rendered');

  let crashed = false;
  try {
    await renderAtom(c, 'timeline', { events: [] }, 'pseudo3d', {
      w: 200,
      h: 100,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'empty events no crash');
}

// ----- pyramid atom (Phase 2c part 2) -----
console.log('\n--- pyramid atom ---');
{
  const spec = await getAtomSpec('pyramid');
  ok(spec.type === 'pyramid', 'pyramid spec.type');
  ok(spec.category === 'charts/hierarchy', `pyramid category = ${spec.category}`);
  ok(spec.args.layers.required, 'layers required');

  const recorded = [];
  const c = stubCtx(recorded);
  await renderAtom(
    c,
    'pyramid',
    {
      title: 'Maslow',
      layers: [
        { label: 'Physiological', sublabel: 'food/water' },
        { label: 'Safety' },
        { label: 'Self-Actualization' },
      ],
    },
    'pseudo3d',
    { x: 0, y: 0, w: 480, h: 400, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('Maslow'), 'title rendered');
  ok(
    recorded.includes('Physiological') && recorded.includes('Self-Actualization'),
    'layer labels rendered',
  );
  ok(recorded.includes('food/water'), 'sublabel rendered');

  // Inverted + values
  recorded.length = 0;
  await renderAtom(
    c,
    'pyramid',
    {
      inverted: true,
      layers: [
        { label: 'Visitors', value: '10K' },
        { label: 'Customers', value: '120' },
      ],
    },
    'pseudo3d',
    { x: 0, y: 0, w: 480, h: 400, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('10K') && recorded.includes('120'), 'values rendered (inverted mode)');

  // Empty no crash
  let crashed = false;
  try {
    await renderAtom(c, 'pyramid', { layers: [] }, 'pseudo3d', {
      w: 200,
      h: 200,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'empty layers no crash');
}

function stubCtx(recorded) {
  const c = {};
  const noop = () => {};
  for (const m of [
    'save',
    'restore',
    'beginPath',
    'closePath',
    'moveTo',
    'lineTo',
    'quadraticCurveTo',
    'bezierCurveTo',
    'arc',
    'stroke',
    'fill',
    'fillRect',
  ]) {
    c[m] = noop;
  }
  c.measureText = (t) => ({ width: String(t).length * 7 });
  c.createLinearGradient = () => ({ addColorStop: noop });
  c.createRadialGradient = () => ({ addColorStop: noop });
  c.fillText = (t) => recorded.push(t);
  for (const p of [
    'fillStyle',
    'strokeStyle',
    'lineWidth',
    'lineCap',
    'lineJoin',
    'shadowColor',
    'shadowBlur',
    'shadowOffsetY',
    'font',
    'textAlign',
    'textBaseline',
  ]) {
    Object.defineProperty(c, p, { set() {} });
  }
  return c;
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
