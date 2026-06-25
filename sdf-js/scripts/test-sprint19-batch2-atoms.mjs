#!/usr/bin/env node
// Smoke test for Sprint 19 Batch 2 atoms:
// radial-wheel-segmented, section-number-divider, stat-banner, comparison-table

import { isAtom2DType, getAtomSpec, renderAtom } from '../src/present/atoms-2d/registry.js';
import { buildAtomCatalogString, _resetCatalogCache } from '../src/present/atoms-2d/catalog.js';

let pass = 0;
let fail = 0;

function ok(label, cond) {
  if (cond) {
    pass++;
    console.log('  ✓ ' + label);
  } else {
    fail++;
    console.log('  ✗ ' + label);
  }
}

// Minimal Canvas2D context mock
const stubCtx = {
  save() {},
  restore() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  quadraticCurveTo() {},
  bezierCurveTo() {},
  closePath() {},
  clip() {},
  fillRect() {},
  strokeRect() {},
  fillText() {},
  measureText() {
    return { width: 50 };
  },
  drawImage() {},
  createLinearGradient() {
    return { addColorStop() {} };
  },
  createRadialGradient() {
    return { addColorStop() {} };
  },
  arc() {},
  fill() {},
  stroke() {},
  rotate() {},
  translate() {},
  scale() {},
  setLineDash() {},
  set fillStyle(_v) {},
  set strokeStyle(_v) {},
  set lineWidth(_v) {},
  set lineCap(_v) {},
  set lineJoin(_v) {},
  set font(_v) {},
  set textAlign(_v) {},
  set textBaseline(_v) {},
  set shadowColor(_v) {},
  set shadowBlur(_v) {},
  set shadowOffsetY(_v) {},
};

console.log('=== Sprint 19 Batch 2 atom smoke ===');

// ──────────────────────────────────────────────────────────────────────────────
// 1. Registration checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Registration --');
ok('radial-wheel-segmented registered', isAtom2DType('radial-wheel-segmented'));
ok('section-number-divider registered', isAtom2DType('section-number-divider'));
ok('stat-banner registered', isAtom2DType('stat-banner'));
ok('comparison-table registered', isAtom2DType('comparison-table'));

// ──────────────────────────────────────────────────────────────────────────────
// 2. Spec checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Specs --');

const rwsSpec = await getAtomSpec('radial-wheel-segmented');
ok('radial-wheel-segmented spec exists', Boolean(rwsSpec));
ok('radial-wheel-segmented spec.type correct', rwsSpec?.type === 'radial-wheel-segmented');
ok('radial-wheel-segmented spec has hub (required)', rwsSpec?.args?.hub?.required === true);
ok(
  'radial-wheel-segmented spec has segments (required)',
  rwsSpec?.args?.segments?.required === true,
);
ok('radial-wheel-segmented spec has optional title', 'title' in (rwsSpec?.args ?? {}));

const sndSpec = await getAtomSpec('section-number-divider');
ok('section-number-divider spec exists', Boolean(sndSpec));
ok('section-number-divider spec.type correct', sndSpec?.type === 'section-number-divider');
ok('section-number-divider spec has number (required)', sndSpec?.args?.number?.required === true);
ok('section-number-divider spec has title (required)', sndSpec?.args?.title?.required === true);
ok('section-number-divider spec has optional subtitle', 'subtitle' in (sndSpec?.args ?? {}));

const sbSpec = await getAtomSpec('stat-banner');
ok('stat-banner spec exists', Boolean(sbSpec));
ok('stat-banner spec.type correct', sbSpec?.type === 'stat-banner');
ok('stat-banner spec has value (required)', sbSpec?.args?.value?.required === true);
ok('stat-banner spec has label (required)', sbSpec?.args?.label?.required === true);
ok('stat-banner spec has optional trend', 'trend' in (sbSpec?.args ?? {}));

const ctSpec = await getAtomSpec('comparison-table');
ok('comparison-table spec exists', Boolean(ctSpec));
ok('comparison-table spec.type correct', ctSpec?.type === 'comparison-table');
ok('comparison-table spec has columns (required)', ctSpec?.args?.columns?.required === true);
ok('comparison-table spec has features (required)', ctSpec?.args?.features?.required === true);

// ──────────────────────────────────────────────────────────────────────────────
// 3. Render checks — no throw
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Render (no-throw) --');

const palette = {
  bg: [248, 246, 240],
  silhouetteColor: [30, 27, 30],
  accent: [42, 184, 168],
  colors: [
    [42, 184, 168],
    [60, 140, 200],
    [80, 160, 80],
    [200, 120, 60],
  ],
};
const renderOpts = { x: 0, y: 0, w: 720, h: 480, palette };

const r1 = renderAtom(
  stubCtx,
  'radial-wheel-segmented',
  {
    hub: 'HR Core',
    segments: [
      { label: 'Recruit', sublabel: 'Talent acquisition' },
      { label: 'Develop', sublabel: 'L&D programs' },
      { label: 'Retain', sublabel: 'Engagement' },
      { label: 'Organize', sublabel: 'Structure' },
      { label: 'Reward', sublabel: 'Comp & benefits' },
      { label: 'Comply', sublabel: 'Policy & law' },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('radial-wheel-segmented render returns Promise', r1 instanceof Promise);
await r1;
ok('radial-wheel-segmented render resolves without throw', true);

const r2 = renderAtom(
  stubCtx,
  'section-number-divider',
  { number: '01', title: 'Financial Highlights', subtitle: 'Key metrics for the reporting period' },
  'pseudo3d',
  renderOpts,
);
ok('section-number-divider render returns Promise', r2 instanceof Promise);
await r2;
ok('section-number-divider render resolves without throw', true);

const r3 = renderAtom(
  stubCtx,
  'stat-banner',
  { value: '$24M', label: 'Annual Recurring Revenue', trend: '+117% YoY', trendDirection: 'up' },
  'pseudo3d',
  renderOpts,
);
ok('stat-banner render returns Promise', r3 instanceof Promise);
await r3;
ok('stat-banner render resolves without throw', true);

const r4 = renderAtom(
  stubCtx,
  'comparison-table',
  {
    title: 'Tier Comparison',
    columns: [{ label: 'Current' }, { label: 'Target', highlight: true }, { label: 'Future' }],
    features: [
      { label: 'Automation', values: [false, true, true] },
      { label: 'Real-time data', values: [false, false, true] },
      { label: 'Self-service', values: [false, true, true] },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('comparison-table render returns Promise', r4 instanceof Promise);
await r4;
ok('comparison-table render resolves without throw', true);

// ──────────────────────────────────────────────────────────────────────────────
// 4. Catalog auto-pickup
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Catalog --');
_resetCatalogCache();
const catalog = await buildAtomCatalogString();
ok('catalog includes radial-wheel-segmented', catalog.includes('`radial-wheel-segmented`'));
ok('catalog includes section-number-divider', catalog.includes('`section-number-divider`'));
ok('catalog includes stat-banner', catalog.includes('`stat-banner`'));
ok('catalog includes comparison-table', catalog.includes('`comparison-table`'));

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
