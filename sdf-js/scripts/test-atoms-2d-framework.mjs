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
    calls.some((c) => c === 'fill'),
    'icon fill drawn (Sprint 18: resolveIcon path)',
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

// ----- shape atoms (Phase 3 — split from `shape` enum to 4 atoms aligned with 3D) -----
console.log('\n--- shape atoms (arrow/cube/diamond/gear) ---');
{
  const types = ['arrow', 'cube', 'diamond', 'gear'];
  for (const type of types) {
    const spec = await getAtomSpec(type);
    ok(spec.type === type, `${type} spec.type`);
    ok(spec.category === 'shapes', `${type} category = ${spec.category}`);

    const recorded = [];
    const c = stubCtxWithEllipse(recorded);
    let crashed = false;
    try {
      await renderAtom(c, type, { label: `Test ${type}` }, 'pseudo3d', {
        x: 0,
        y: 0,
        w: 240,
        h: 240,
        palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 100, 200]] },
      });
    } catch (e) {
      crashed = true;
      console.error(`  ${type} error: ${e.message}`);
    }
    ok(!crashed, `${type} renders without crash`);
    ok(recorded.includes(`Test ${type}`), `${type} label rendered`);
  }

  // Arrow direction param
  const recA = [];
  await renderAtom(
    stubCtxWithEllipse(recA),
    'arrow',
    { direction: 'up', label: 'Up' },
    'pseudo3d',
    { w: 240, h: 240, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recA.includes('Up'), 'arrow direction param works');
}

// ----- icon-badge atom (Phase 4) -----
console.log('\n--- icon-badge atom ---');
{
  const spec = await getAtomSpec('icon-badge');
  ok(spec.type === 'icon-badge', 'icon-badge spec.type');
  ok(spec.category === 'icons', `category = ${spec.category}`);

  // Render with stub ctx + scale/translate (used for SVG path)
  const recorded = [];
  const c = stubCtxWithIcon(recorded);
  await renderAtom(c, 'icon-badge', { name: 'users', label: 'Engineering' }, 'pseudo3d', {
    x: 0,
    y: 0,
    w: 240,
    h: 240,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 100, 200]] },
  });
  ok(recorded.includes('Engineering'), 'label rendered');

  // Spot-check several icon names — mix of hardcoded fast path + Phosphor
  // fallback (Sprint 15c). The Phosphor names cover the resolver's second
  // branch, which would previously render at 10× size due to viewBox
  // mismatch (Phosphor uses 256, hardcoded uses 24).
  const knownNames = [
    'users', // hardcoded
    'lightning', // hardcoded
    'cloud', // hardcoded
    'shield', // hardcoded
    'chart-bar', // hardcoded
    'heart', // hardcoded
    'check', // hardcoded
    'arrow-up', // hardcoded
    'cpu', // Phosphor
    'briefcase', // Phosphor
    'chat-circle', // Phosphor
    'currency-eur', // Phosphor
  ];
  for (const name of knownNames) {
    const rec = [];
    let crashed = false;
    try {
      await renderAtom(stubCtxWithIcon(rec), 'icon-badge', { name, label: name }, 'pseudo3d', {
        w: 200,
        h: 200,
        palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
      });
    } catch (e) {
      crashed = true;
    }
    ok(!crashed, `icon "${name}" renders without crash`);
  }

  // Unknown icon name doesn't crash (silently warns)
  let crashed = false;
  try {
    await renderAtom(stubCtxWithIcon([]), 'icon-badge', { name: 'nonexistent-icon' }, 'pseudo3d', {
      w: 200,
      h: 200,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'unknown icon name no crash');
}

// ----- cover atom (Phase 4) -----
console.log('\n--- cover atom ---');
{
  const spec = await getAtomSpec('cover');
  ok(spec.type === 'cover', 'cover spec.type');
  ok(spec.category === 'presentation', `category = ${spec.category}`);
  ok(spec.args.title.required, 'title required');

  const recorded = [];
  const c = stubCtxWithIcon(recorded);
  await renderAtom(
    c,
    'cover',
    {
      title: 'Q3 2025 Board Review',
      subtitle: 'Acme Corp',
      author: 'Sarah Chen',
      date: 'Nov 2025',
      version: 'v1.0',
    },
    'pseudo3d',
    { x: 0, y: 0, w: 720, h: 400, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('Q3 2025 Board Review'), 'title rendered');
  ok(recorded.includes('Acme Corp'), 'subtitle rendered');
  ok(
    recorded.some((t) => String(t).includes('Sarah Chen')),
    'metadata strip includes author',
  );

  // Minimal cover (title only)
  recorded.length = 0;
  await renderAtom(c, 'cover', { title: 'Hello' }, 'pseudo3d', {
    x: 0,
    y: 0,
    w: 720,
    h: 400,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
  });
  ok(recorded.includes('Hello'), 'title-only cover renders');
}

// ----- B3 PR 1: charts/data new atoms (gauge / radial-spoke / scatter / traffic-light / venn) -----

console.log('\n--- gauge atom ---');
{
  const spec = await getAtomSpec('gauge');
  ok(spec.type === 'gauge', 'gauge spec.type');
  ok(spec.category === 'charts/data', `category = ${spec.category}`);
  ok(spec.args.value.required, 'value required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'gauge',
    { value: 0.7, label: 'Utilization', title: 'Server Load', min: '0', max: '100' },
    'pseudo3d',
    {
      w: 320,
      h: 240,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('70%'), 'percent value rendered');
  ok(recorded.includes('Utilization'), 'sub-label rendered');
  ok(recorded.includes('Server Load'), 'title rendered');
  ok(recorded.includes('0') && recorded.includes('100'), 'min/max ticks rendered');

  // Number format
  recorded.length = 0;
  await renderAtom(c, 'gauge', { value: 0.42, format: 'number' }, 'pseudo3d', {
    w: 240,
    h: 200,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
  });
  ok(
    recorded.some((t) => String(t).includes('0.42')),
    'number format renders raw value',
  );
}

console.log('\n--- radial-spoke atom ---');
{
  const spec = await getAtomSpec('radial-spoke');
  ok(spec.type === 'radial-spoke', 'radial-spoke spec.type');
  ok(spec.args.values.required, 'values required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'radial-spoke',
    {
      values: [0.6, 0.9, 0.3, 0.75, 0.5, 0.8],
      labels: ['Speed', 'Power', 'Range', 'Comfort', 'Safety', 'MPG'],
      title: 'Vehicle Profile',
    },
    'pseudo3d',
    {
      w: 420,
      h: 420,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Vehicle Profile'), 'title rendered');
  ok(recorded.includes('Speed') && recorded.includes('MPG'), 'all labels rendered');

  // Empty values — no crash
  let crashed = false;
  try {
    await renderAtom(c, 'radial-spoke', { values: [] }, 'pseudo3d', {
      w: 300,
      h: 300,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'empty values no crash');
}

console.log('\n--- scatter atom ---');
{
  const spec = await getAtomSpec('scatter');
  ok(spec.type === 'scatter', 'scatter spec.type');
  ok(spec.args.points.required, 'points required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'scatter',
    {
      points: [
        { x: 0.2, y: 0.3, label: 'A', group: 'g1' },
        { x: 0.5, y: 0.7, label: 'B', group: 'g2' },
        { x: 0.8, y: 0.4, label: 'C', group: 'g1' },
      ],
      xAxis: 'Cost',
      yAxis: 'Value',
      title: 'Cost vs Value',
    },
    'pseudo3d',
    {
      w: 500,
      h: 400,
      palette: {
        bg: [255, 255, 255],
        silhouetteColor: [0, 0, 0],
        colors: [
          [60, 130, 200],
          [200, 80, 80],
        ],
      },
    },
  );
  ok(recorded.includes('Cost vs Value'), 'title rendered');
  ok(recorded.includes('A') && recorded.includes('C'), 'point labels rendered');
  ok(recorded.includes('Cost'), 'xAxis label rendered');
  ok(recorded.includes('Value'), 'yAxis label rendered');
}

console.log('\n--- traffic-light atom ---');
{
  const spec = await getAtomSpec('traffic-light');
  ok(spec.type === 'traffic-light', 'traffic-light spec.type');
  ok(spec.args.lights.required, 'lights required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'traffic-light',
    {
      lights: [
        { color: 'red', active: false, label: 'Stop' },
        { color: 'amber', active: false, label: 'Slow' },
        { color: 'green', active: true, label: 'Go' },
      ],
      title: 'Project Status',
    },
    'pseudo3d',
    { w: 240, h: 480, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('Project Status'), 'title rendered');
  ok(recorded.includes('Stop') && recorded.includes('Go'), 'light labels rendered');

  // No labels variant
  recorded.length = 0;
  await renderAtom(
    c,
    'traffic-light',
    { lights: [{ color: 'red' }, { color: 'green', active: true }] },
    'pseudo3d',
    { w: 200, h: 360, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(true, 'no-labels variant renders without crash');
}

console.log('\n--- venn atom ---');
{
  const spec = await getAtomSpec('venn');
  ok(spec.type === 'venn', 'venn spec.type');
  ok(spec.args.sets.required, 'sets required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'venn',
    {
      sets: [{ label: 'Engineering' }, { label: 'Design' }, { label: 'Product' }],
      title: 'Cross-functional Work',
    },
    'pseudo3d',
    {
      w: 480,
      h: 420,
      palette: {
        bg: [255, 255, 255],
        silhouetteColor: [0, 0, 0],
        colors: [
          [60, 130, 200],
          [200, 80, 120],
          [70, 180, 100],
        ],
      },
    },
  );
  ok(recorded.includes('Cross-functional Work'), 'title rendered');
  ok(
    recorded.includes('Engineering') && recorded.includes('Design') && recorded.includes('Product'),
    'all set labels rendered',
  );

  // 2-set variant
  recorded.length = 0;
  await renderAtom(
    c,
    'venn',
    { sets: [{ label: 'A' }, { label: 'B' }], overlap: 0.5 },
    'pseudo3d',
    { w: 400, h: 300, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('A') && recorded.includes('B'), '2-set variant labels rendered');

  // Below minimum sets — silent no-op
  let crashed = false;
  try {
    await renderAtom(c, 'venn', { sets: [{ label: 'Only' }] }, 'pseudo3d', {
      w: 300,
      h: 300,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'single-set no crash');
}

// ----- B3 PR 2: shapes/circle-* atoms (frame / loop / segmented / stack) -----

console.log('\n--- circle-frame atom ---');
{
  const spec = await getAtomSpec('circle-frame');
  ok(spec.type === 'circle-frame', 'circle-frame spec.type');
  ok(spec.category === 'shapes', `category = ${spec.category}`);

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(c, 'circle-frame', { label: 'JC', title: 'Jane Chen' }, 'pseudo3d', {
    w: 280,
    h: 280,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
  });
  ok(recorded.includes('Jane Chen'), 'title rendered');
  ok(recorded.includes('JC'), 'center label rendered');

  // back=false (open ring only)
  recorded.length = 0;
  await renderAtom(c, 'circle-frame', { label: 'AB', back: false }, 'pseudo3d', {
    w: 240,
    h: 240,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
  });
  ok(recorded.includes('AB'), 'open-ring variant label rendered');
}

console.log('\n--- circle-loop atom ---');
{
  const spec = await getAtomSpec('circle-loop');
  ok(spec.type === 'circle-loop', 'circle-loop spec.type');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'circle-loop',
    { segments: 4, labels: ['Plan', 'Do', 'Check', 'Act'], title: 'PDCA Cycle' },
    'pseudo3d',
    {
      w: 360,
      h: 360,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('PDCA Cycle'), 'title rendered');
  ok(
    recorded.includes('Plan') &&
      recorded.includes('Do') &&
      recorded.includes('Check') &&
      recorded.includes('Act'),
    'all 4 segment labels rendered',
  );

  // No labels variant, default segments
  recorded.length = 0;
  await renderAtom(c, 'circle-loop', {}, 'pseudo3d', {
    w: 300,
    h: 300,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
  });
  ok(true, 'default segments no-labels renders without crash');

  // Segments clamped
  recorded.length = 0;
  await renderAtom(c, 'circle-loop', { segments: 99 }, 'pseudo3d', {
    w: 300,
    h: 300,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
  });
  ok(true, 'segments=99 clamps without crash');
}

console.log('\n--- circle-segmented atom ---');
{
  const spec = await getAtomSpec('circle-segmented');
  ok(spec.type === 'circle-segmented', 'circle-segmented spec.type');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'circle-segmented',
    {
      segments: 6,
      labels: ['Discover', 'Design', 'Build', 'Test', 'Launch', 'Scale'],
      title: 'Process Phases',
    },
    'pseudo3d',
    {
      w: 400,
      h: 400,
      palette: {
        bg: [255, 255, 255],
        silhouetteColor: [0, 0, 0],
        colors: [
          [60, 130, 200],
          [200, 80, 80],
        ],
      },
    },
  );
  ok(recorded.includes('Process Phases'), 'title rendered');
  ok(recorded.includes('Discover') && recorded.includes('Scale'), 'segment labels rendered');

  // No labels variant
  recorded.length = 0;
  await renderAtom(c, 'circle-segmented', { segments: 4, innerRatio: 0.4 }, 'pseudo3d', {
    w: 300,
    h: 300,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
  });
  ok(true, 'no-labels variant renders without crash');
}

console.log('\n--- circle-stack atom ---');
{
  const spec = await getAtomSpec('circle-stack');
  ok(spec.type === 'circle-stack', 'circle-stack spec.type');
  ok(spec.args.layers.required, 'layers required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'circle-stack',
    {
      title: 'Maturity Stack',
      layers: [
        { label: 'Foundation', sublabel: 'Year 1' },
        { label: 'Build', sublabel: 'Year 2' },
        { label: 'Scale', sublabel: 'Year 3' },
        { label: 'Optimize', sublabel: 'Year 4+' },
      ],
    },
    'pseudo3d',
    {
      w: 480,
      h: 380,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Maturity Stack'), 'title rendered');
  ok(recorded.includes('Foundation') && recorded.includes('Optimize'), 'layer labels rendered');
  ok(recorded.includes('Year 1') && recorded.includes('Year 4+'), 'sublabels rendered');

  // Empty layers — no crash
  let crashed = false;
  try {
    await renderAtom(c, 'circle-stack', { layers: [] }, 'pseudo3d', {
      w: 300,
      h: 300,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'empty layers no crash');
}

// ----- B3 PR 3: shapes/sphere-* + cube-segmented atoms -----

console.log('\n--- sphere-network atom ---');
{
  const spec = await getAtomSpec('sphere-network');
  ok(spec.type === 'sphere-network', 'sphere-network spec.type');
  ok(spec.args.satellites.required, 'satellites required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'sphere-network',
    {
      hub: { label: 'Platform' },
      satellites: [{ label: 'API' }, { label: 'Web' }, { label: 'Mobile' }, { label: 'CLI' }],
      title: 'Product Surface',
    },
    'pseudo3d',
    {
      w: 440,
      h: 440,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Product Surface'), 'title rendered');
  ok(recorded.includes('Platform'), 'hub label rendered');
  ok(recorded.includes('API') && recorded.includes('CLI'), 'satellite labels rendered');

  // Below minimum satellites — silent no-op
  let crashed = false;
  try {
    await renderAtom(c, 'sphere-network', { satellites: [{ label: 'Only' }] }, 'pseudo3d', {
      w: 300,
      h: 300,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'single satellite no crash');
}

console.log('\n--- sphere-segmented atom ---');
{
  const spec = await getAtomSpec('sphere-segmented');
  ok(spec.type === 'sphere-segmented', 'sphere-segmented spec.type');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'sphere-segmented',
    { segments: 4, labels: ['N', 'S', 'E', 'W'], title: 'Regions', explode: 0.06 },
    'pseudo3d',
    {
      w: 380,
      h: 380,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Regions'), 'title rendered');
  ok(recorded.includes('N') && recorded.includes('W'), 'segment labels rendered');

  // No labels variant
  recorded.length = 0;
  await renderAtom(c, 'sphere-segmented', { segments: 8 }, 'pseudo3d', {
    w: 300,
    h: 300,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
  });
  ok(true, 'no-labels 8-segment renders without crash');
}

console.log('\n--- sphere-tree atom ---');
{
  const spec = await getAtomSpec('sphere-tree');
  ok(spec.type === 'sphere-tree', 'sphere-tree spec.type');
  ok(spec.args.root.required, 'root required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'sphere-tree',
    {
      title: 'Decision Tree',
      root: {
        label: 'Start',
        children: [
          { label: 'Yes', children: [{ label: 'A' }, { label: 'B' }] },
          { label: 'No', children: [{ label: 'C' }, { label: 'D' }] },
        ],
      },
    },
    'pseudo3d',
    {
      w: 560,
      h: 400,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Decision Tree'), 'title rendered');
  ok(recorded.includes('Start'), 'root label rendered');
  ok(recorded.includes('Yes') && recorded.includes('No'), 'level-1 labels rendered');
  ok(recorded.includes('A') && recorded.includes('D'), 'leaf labels rendered');

  // Single-node tree (root only)
  recorded.length = 0;
  await renderAtom(c, 'sphere-tree', { root: { label: 'Alone' } }, 'pseudo3d', {
    w: 300,
    h: 200,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
  });
  ok(recorded.includes('Alone'), 'single-node tree renders');
}

console.log('\n--- cube-segmented atom ---');
{
  const spec = await getAtomSpec('cube-segmented');
  ok(spec.type === 'cube-segmented', 'cube-segmented spec.type');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'cube-segmented',
    { segments: 4, labels: ['Q1', 'Q2', 'Q3', 'Q4'], title: 'Quarterly Layers' },
    'pseudo3d',
    {
      w: 360,
      h: 360,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Quarterly Layers'), 'title rendered');
  ok(recorded.includes('Q1') && recorded.includes('Q4'), 'all slab labels rendered');

  // Horizontal axis
  recorded.length = 0;
  await renderAtom(c, 'cube-segmented', { segments: 3, axis: 'horizontal' }, 'pseudo3d', {
    w: 360,
    h: 280,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
  });
  ok(true, 'horizontal axis renders without crash');

  // Defaults
  recorded.length = 0;
  await renderAtom(c, 'cube-segmented', {}, 'pseudo3d', {
    w: 280,
    h: 280,
    palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
  });
  ok(true, 'defaults render without crash');
}

// ----- B3 PR 4: agenda-list / fishbone / layer-stack / bullet-list -----

console.log('\n--- agenda-list atom ---');
{
  const spec = await getAtomSpec('agenda-list');
  ok(spec.type === 'agenda-list', 'agenda-list spec.type');
  ok(spec.args.items.required, 'items required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'agenda-list',
    {
      title: 'Today’s Agenda',
      items: [
        { label: 'Recap last quarter', sublabel: '5 min' },
        { label: 'Goals review', sublabel: '15 min' },
        { label: 'Next-quarter plan', sublabel: '20 min' },
        { label: 'Q&A', sublabel: '10 min' },
      ],
    },
    'pseudo3d',
    {
      w: 520,
      h: 360,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Today’s Agenda'), 'title rendered');
  ok(recorded.includes('Recap last quarter'), 'first label rendered');
  ok(recorded.includes('5 min') && recorded.includes('10 min'), 'sublabels rendered');
  ok(recorded.includes('1') && recorded.includes('4'), 'chip numbers rendered');

  // Empty items — no crash
  let crashed = false;
  try {
    await renderAtom(c, 'agenda-list', { items: [] }, 'pseudo3d', {
      w: 300,
      h: 300,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'empty items no crash');
}

console.log('\n--- fishbone atom ---');
{
  const spec = await getAtomSpec('fishbone');
  ok(spec.type === 'fishbone', 'fishbone spec.type');
  ok(spec.args.effect.required, 'effect required');
  ok(spec.args.branches.required, 'branches required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'fishbone',
    {
      title: 'Q3 Conversion Drop',
      effect: 'Low Conversion',
      branches: [
        { label: 'Marketing', causes: ['Targeting', 'Channels'] },
        { label: 'Product', causes: ['Onboarding'] },
        { label: 'Pricing', causes: ['Tier confusion'] },
        { label: 'Support', causes: ['Slow response'] },
      ],
    },
    'pseudo3d',
    {
      w: 720,
      h: 380,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Q3 Conversion Drop'), 'title rendered');
  ok(recorded.includes('Low Conversion'), 'effect rendered (head box)');
  ok(recorded.includes('Marketing') && recorded.includes('Support'), 'branch labels rendered');
  ok(
    recorded.includes('Targeting') && recorded.includes('Slow response'),
    'sub-cause labels rendered',
  );
}

console.log('\n--- layer-stack atom ---');
{
  const spec = await getAtomSpec('layer-stack');
  ok(spec.type === 'layer-stack', 'layer-stack spec.type');
  ok(spec.args.layers.required, 'layers required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'layer-stack',
    {
      title: 'OSI Model',
      layers: [
        { label: 'Physical', sublabel: 'Layer 1' },
        { label: 'Data Link', sublabel: 'Layer 2' },
        { label: 'Network', sublabel: 'Layer 3' },
        { label: 'Application', sublabel: 'Layer 7' },
      ],
    },
    'pseudo3d',
    {
      w: 480,
      h: 440,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('OSI Model'), 'title rendered');
  ok(recorded.includes('Physical') && recorded.includes('Application'), 'layer labels rendered');
  ok(recorded.includes('Layer 1') && recorded.includes('Layer 7'), 'sublabels rendered');

  // top-down direction
  recorded.length = 0;
  await renderAtom(
    c,
    'layer-stack',
    {
      layers: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
      direction: 'top-down',
      taper: 0.85,
    },
    'pseudo3d',
    { w: 400, h: 360, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('A') && recorded.includes('C'), 'top-down + taper renders without crash');
}

console.log('\n--- bullet-list atom ---');
{
  const spec = await getAtomSpec('bullet-list');
  ok(spec.type === 'bullet-list', 'bullet-list spec.type');
  ok(spec.args.items.required, 'items required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'bullet-list',
    {
      title: 'Key Improvements',
      items: [
        { label: 'Faster onboarding', status: 'done' },
        { label: 'Better defaults' },
        { label: 'Edge-case fixes', status: 'highlight' },
        { label: 'Docs refresh', status: 'todo' },
      ],
    },
    'pseudo3d',
    {
      w: 520,
      h: 360,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Key Improvements'), 'title rendered');
  ok(
    recorded.includes('Faster onboarding') && recorded.includes('Docs refresh'),
    'all item labels rendered',
  );

  // Sublabels variant
  recorded.length = 0;
  await renderAtom(
    c,
    'bullet-list',
    {
      items: [
        { label: 'Speed', sublabel: '3× faster' },
        { label: 'Cost', sublabel: '40% reduction' },
      ],
    },
    'pseudo3d',
    { w: 400, h: 200, palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] } },
  );
  ok(recorded.includes('3× faster') && recorded.includes('40% reduction'), 'sublabels rendered');
}

// ----- Sprint 15b B3: isotype-people-grid -----
console.log('\n--- isotype-people-grid atom ---');
{
  const spec = await getAtomSpec('isotype-people-grid');
  ok(spec.type === 'isotype-people-grid', 'isotype-people-grid spec.type');
  ok(spec.category === 'charts/data', `category = ${spec.category}`);
  ok(spec.args.total.required, 'total required');
  ok(spec.args.highlighted.required, 'highlighted required');

  const recorded = [];
  const c = stubCtxWithIsotype(recorded);
  await renderAtom(
    c,
    'isotype-people-grid',
    {
      total: 100,
      highlighted: 73,
      personIcon: 'simple',
      title: 'Customer Satisfaction',
      label: '73 of 100 customers are highly satisfied',
    },
    'pseudo3d',
    {
      w: 480,
      h: 360,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Customer Satisfaction'), 'title rendered');
  ok(
    recorded.some((t) => String(t).includes('73') && String(t).includes('100')),
    'hero stat 73/100 rendered',
  );
  ok(
    recorded.some((t) => String(t).includes('satisfied')),
    'label text rendered',
  );

  // business variant
  recorded.length = 0;
  let crashed = false;
  try {
    await renderAtom(
      c,
      'isotype-people-grid',
      { total: 20, highlighted: 5, personIcon: 'business' },
      'pseudo3d',
      {
        w: 400,
        h: 300,
        palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
      },
    );
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'business variant renders without crash');

  // casual variant + minimal args
  recorded.length = 0;
  crashed = false;
  try {
    await renderAtom(
      c,
      'isotype-people-grid',
      { total: 10, highlighted: 3, personIcon: 'casual' },
      'pseudo3d',
      {
        w: 300,
        h: 240,
        palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[200, 80, 80]] },
      },
    );
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'casual variant renders without crash');

  // highlighted=0 edge case
  recorded.length = 0;
  crashed = false;
  try {
    await renderAtom(c, 'isotype-people-grid', { total: 50, highlighted: 0 }, 'pseudo3d', {
      w: 400,
      h: 280,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'highlighted=0 no crash');
}

// ----- Sprint 15b B3: isotype-prop-row -----
console.log('\n--- isotype-prop-row atom ---');
{
  const spec = await getAtomSpec('isotype-prop-row');
  ok(spec.type === 'isotype-prop-row', 'isotype-prop-row spec.type');
  ok(spec.category === 'charts/data', `category = ${spec.category}`);
  ok(spec.args.count.required, 'count required');
  ok(spec.args.fillRatios.required, 'fillRatios required');

  const recorded = [];
  const c = stubCtxWithIsotype(recorded);
  await renderAtom(
    c,
    'isotype-prop-row',
    {
      count: 5,
      fillRatios: [0.9, 0.7, 0.5, 0.3, 0.1],
      propShape: 'bottle',
      labels: ['North', 'East', 'South', 'West', 'Central'],
      title: 'Recycling Rate by Region',
    },
    'pseudo3d',
    {
      w: 480,
      h: 320,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Recycling Rate by Region'), 'title rendered');
  ok(recorded.includes('North') && recorded.includes('Central'), 'labels rendered');

  // bulb variant
  let crashed = false;
  try {
    await renderAtom(
      c,
      'isotype-prop-row',
      { count: 3, fillRatios: [1.0, 0.5, 0.1], propShape: 'bulb' },
      'pseudo3d',
      {
        w: 360,
        h: 280,
        palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
      },
    );
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'bulb variant renders without crash');

  // drop variant
  crashed = false;
  try {
    await renderAtom(
      c,
      'isotype-prop-row',
      {
        count: 4,
        fillRatios: [1.0, 0.72, 0.48, 0.21],
        propShape: 'drop',
        title: 'Water Conservation',
      },
      'pseudo3d',
      {
        w: 400,
        h: 300,
        palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
      },
    );
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'drop variant renders without crash');

  // circle default + fill=0 edge case
  crashed = false;
  try {
    await renderAtom(
      c,
      'isotype-prop-row',
      { count: 2, fillRatios: [0, 0], propShape: 'circle' },
      'pseudo3d',
      {
        w: 280,
        h: 200,
        palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
      },
    );
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'fill=0 no crash');
}

// ----- Sprint 15b B3: isotype-stat-comparison -----
console.log('\n--- isotype-stat-comparison atom ---');
{
  const spec = await getAtomSpec('isotype-stat-comparison');
  ok(spec.type === 'isotype-stat-comparison', 'isotype-stat-comparison spec.type');
  ok(spec.category === 'charts/data', `category = ${spec.category}`);
  ok(spec.args.stats.required, 'stats required');

  const recorded = [];
  const c = stubCtxWithIsotype(recorded);
  await renderAtom(
    c,
    'isotype-stat-comparison',
    {
      title: 'Hospital Staff Composition',
      stats: [
        { iconName: 'stethoscope', count: 100, label: 'Doctors', caption: 'Full-time' },
        { iconName: 'first-aid', count: 25, label: 'Nurses' },
        { iconName: 'briefcase', count: 12, label: 'Admin' },
      ],
    },
    'pseudo3d',
    {
      w: 560,
      h: 400,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Hospital Staff Composition'), 'title rendered');
  ok(recorded.includes('Doctors') && recorded.includes('Admin'), 'stat labels rendered');
  ok(recorded.includes('Full-time'), 'caption rendered');
  ok(
    recorded.some((t) => String(t) === '100') && recorded.some((t) => String(t) === '25'),
    'count numbers rendered',
  );

  // count > 30 — should show ellipsis or large number
  recorded.length = 0;
  let crashed = false;
  try {
    await renderAtom(
      c,
      'isotype-stat-comparison',
      {
        stats: [
          { iconName: 'users', count: 200, label: 'Total Users' },
          { count: 50, label: 'Admins' },
        ],
      },
      'pseudo3d',
      {
        w: 500,
        h: 300,
        palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
      },
    );
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'count > 30 (ellipsis mode) no crash');

  // No iconName (should not crash)
  recorded.length = 0;
  crashed = false;
  try {
    await renderAtom(
      c,
      'isotype-stat-comparison',
      {
        stats: [
          { count: 10, label: 'Items' },
          { count: 5, label: 'Boxes' },
        ],
      },
      'pseudo3d',
      {
        w: 400,
        h: 240,
        palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
      },
    );
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'no iconName no crash');

  // Empty stats no crash
  crashed = false;
  try {
    await renderAtom(c, 'isotype-stat-comparison', { stats: [] }, 'pseudo3d', {
      w: 400,
      h: 240,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'empty stats no crash');
}

function stubCtxWithIsotype(recorded) {
  const c = stubCtxWithIcon(recorded);
  // isotype atoms read ctx.globalAlpha (e.g. `ctx.globalAlpha * 0.6`).
  // stubCtxWithEllipse already defines globalAlpha as set-only. Redefine it
  // with a getter so reads return a number instead of undefined.
  let _globalAlpha = 1;
  try {
    Object.defineProperty(c, 'globalAlpha', {
      get() {
        return _globalAlpha;
      },
      set(v) {
        _globalAlpha = v;
      },
      configurable: true,
    });
  } catch (_) {
    // Already non-configurable — leave as-is; reads may return undefined but won't crash
  }
  return c;
}

function stubCtxWithIcon(recorded) {
  const c = stubCtxWithEllipse(recorded);
  // Path2D mock — returns dummy object so ctx.stroke(path) doesn't crash
  if (typeof globalThis.Path2D === 'undefined') {
    globalThis.Path2D = function (data) {
      this.data = data;
    };
  }
  // ctx.stroke must accept optional Path2D arg
  c.stroke = () => {};
  c.scale = () => {};
  return c;
}

function stubCtxWithEllipse(recorded) {
  const c = stubCtx(recorded);
  c.ellipse = () => {};
  c.translate = () => {};
  c.rotate = () => {};
  Object.defineProperty(c, 'globalAlpha', { set() {} });
  return c;
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
    'setLineDash',
    'clip',
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

// ----- Sprint 15b B4: infinity-loop-flow -----
console.log('\n--- infinity-loop-flow atom ---');
{
  const spec = await getAtomSpec('infinity-loop-flow');
  ok(spec.type === 'infinity-loop-flow', 'infinity-loop-flow spec.type');
  ok(spec.category === 'charts/diagrams', `category = ${spec.category}`);
  ok(spec.args.steps.required, 'steps required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'infinity-loop-flow',
    {
      steps: [{ label: 'Plan' }, { label: 'Build' }, { label: 'Measure' }, { label: 'Learn' }],
      title: 'Build-Measure-Learn Loop',
    },
    'pseudo3d',
    {
      w: 800,
      h: 480,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
    },
  );
  ok(recorded.includes('Build-Measure-Learn Loop'), 'title rendered');
  ok(recorded.includes('Plan') && recorded.includes('Learn'), 'step labels rendered');

  // 6-step variant (Double Diamond)
  recorded.length = 0;
  let crashed = false;
  try {
    await renderAtom(
      c,
      'infinity-loop-flow',
      {
        steps: [
          { label: 'Discover' },
          { label: 'Define' },
          { label: 'Develop' },
          { label: 'Deliver' },
          { label: 'Deploy' },
          { label: 'Monitor' },
        ],
        title: 'Double Diamond Process',
      },
      'pseudo3d',
      {
        w: 800,
        h: 480,
        palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[60, 130, 200]] },
      },
    );
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, '6-step variant renders without crash');

  // Empty steps — no crash
  crashed = false;
  try {
    await renderAtom(c, 'infinity-loop-flow', { steps: [] }, 'pseudo3d', {
      w: 600,
      h: 400,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'empty steps no crash');
}

// ----- Sprint 15b B4: kpi-water-drop -----
console.log('\n--- kpi-water-drop atom ---');
{
  const spec = await getAtomSpec('kpi-water-drop');
  ok(spec.type === 'kpi-water-drop', 'kpi-water-drop spec.type');
  ok(spec.category === 'charts/data', `category = ${spec.category}`);
  ok(spec.args.value.required, 'value required');
  ok(spec.args.label.required, 'label required');

  const recorded = [];
  const c = stubCtxWithEllipse(recorded);
  await renderAtom(
    c,
    'kpi-water-drop',
    { value: 0.72, label: 'Water Recycled', sublabel: 'Q3 2026', format: 'percent' },
    'pseudo3d',
    {
      w: 280,
      h: 360,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[0, 140, 200]] },
    },
  );
  ok(recorded.includes('Water Recycled'), 'label rendered');
  ok(recorded.includes('Q3 2026'), 'sublabel rendered');
  ok(
    recorded.some((t) => String(t).includes('72%')),
    'percent value rendered',
  );

  // displayValue override
  recorded.length = 0;
  await renderAtom(
    c,
    'kpi-water-drop',
    { value: 0.45, label: 'Green Energy', sublabel: 'Target 80%', displayValue: '45%' },
    'pseudo3d',
    {
      w: 280,
      h: 360,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0], colors: [[0, 140, 200]] },
    },
  );
  ok(recorded.includes('Green Energy'), 'second sample label rendered');
  ok(recorded.includes('45%'), 'displayValue override rendered');

  // value=0 (empty drop) — no crash
  recorded.length = 0;
  let crashed = false;
  try {
    await renderAtom(c, 'kpi-water-drop', { value: 0, label: 'Empty' }, 'pseudo3d', {
      w: 240,
      h: 320,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'value=0 empty drop no crash');

  // value=1 (full drop) — no crash
  crashed = false;
  try {
    await renderAtom(c, 'kpi-water-drop', { value: 1, label: 'Full' }, 'pseudo3d', {
      w: 240,
      h: 320,
      palette: { bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
    });
  } catch (e) {
    crashed = true;
  }
  ok(!crashed, 'value=1 full drop no crash');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
