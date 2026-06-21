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

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
