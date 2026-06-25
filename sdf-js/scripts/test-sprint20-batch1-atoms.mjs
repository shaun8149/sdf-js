#!/usr/bin/env node
// Smoke test for Sprint 20 Batch 1 atoms:
// process-arrows, stat-grid-large, number-list, call-to-action

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

console.log('=== Sprint 20 Batch 1 atom smoke ===');

// ──────────────────────────────────────────────────────────────────────────────
// 1. Registration checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Registration --');
ok('process-arrows registered', isAtom2DType('process-arrows'));
ok('stat-grid-large registered', isAtom2DType('stat-grid-large'));
ok('number-list registered', isAtom2DType('number-list'));
ok('call-to-action registered', isAtom2DType('call-to-action'));

// ──────────────────────────────────────────────────────────────────────────────
// 2. Spec checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Specs --');

const paSpec = await getAtomSpec('process-arrows');
ok('process-arrows spec exists', Boolean(paSpec));
ok('process-arrows spec.type correct', paSpec?.type === 'process-arrows');
ok('process-arrows spec has steps (required)', paSpec?.args?.steps?.required === true);
ok('process-arrows spec has optional title', 'title' in (paSpec?.args ?? {}));
ok('process-arrows spec has optional color', 'color' in (paSpec?.args ?? {}));

const sglSpec = await getAtomSpec('stat-grid-large');
ok('stat-grid-large spec exists', Boolean(sglSpec));
ok('stat-grid-large spec.type correct', sglSpec?.type === 'stat-grid-large');
ok('stat-grid-large spec has stats (required)', sglSpec?.args?.stats?.required === true);
ok('stat-grid-large spec has optional title', 'title' in (sglSpec?.args ?? {}));

const nlSpec = await getAtomSpec('number-list');
ok('number-list spec exists', Boolean(nlSpec));
ok('number-list spec.type correct', nlSpec?.type === 'number-list');
ok('number-list spec has items (required)', nlSpec?.args?.items?.required === true);
ok('number-list spec has optional numberStyle', 'numberStyle' in (nlSpec?.args ?? {}));
ok('number-list spec has optional title', 'title' in (nlSpec?.args ?? {}));

const ctaSpec = await getAtomSpec('call-to-action');
ok('call-to-action spec exists', Boolean(ctaSpec));
ok('call-to-action spec.type correct', ctaSpec?.type === 'call-to-action');
ok('call-to-action spec has heading (required)', ctaSpec?.args?.heading?.required === true);
ok('call-to-action spec has optional subheading', 'subheading' in (ctaSpec?.args ?? {}));
ok('call-to-action spec has optional buttonText', 'buttonText' in (ctaSpec?.args ?? {}));
ok('call-to-action spec has optional bg', 'bg' in (ctaSpec?.args ?? {}));

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
  'process-arrows',
  {
    title: 'Our Process',
    steps: [
      { label: 'Discover', sublabel: 'Research' },
      { label: 'Define', sublabel: 'Scope' },
      { label: 'Design', sublabel: 'Prototype' },
      { label: 'Develop', sublabel: 'Build' },
      { label: 'Deploy', sublabel: 'Launch' },
    ],
    color: 'gradient',
  },
  'pseudo3d',
  renderOpts,
);
ok('process-arrows render returns Promise', r1 instanceof Promise);
await r1;
ok('process-arrows render resolves without throw', true);

const r2 = renderAtom(
  stubCtx,
  'stat-grid-large',
  {
    title: 'Q3 Highlights',
    stats: [
      { value: '$24M', label: 'ARR', trend: '↑117% YoY', trendDirection: 'up' },
      { value: '12.5K', label: 'DAU' },
      { value: '92%', label: 'Retention D30' },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('stat-grid-large render returns Promise', r2 instanceof Promise);
await r2;
ok('stat-grid-large render resolves without throw', true);

const r3 = renderAtom(
  stubCtx,
  'number-list',
  {
    title: 'Top Priorities',
    items: [
      { label: 'Define the problem space', sublabel: 'Research & discovery' },
      { label: 'Prototype rapidly', sublabel: 'Build-measure-learn' },
      { label: 'Ship and iterate', sublabel: 'Continuous delivery' },
      { label: 'Measure impact', sublabel: 'Analytics & OKRs' },
    ],
    numberStyle: 'circle',
  },
  'pseudo3d',
  renderOpts,
);
ok('number-list render returns Promise', r3 instanceof Promise);
await r3;
ok('number-list render resolves without throw', true);

// Test outline style too
const r3b = renderAtom(
  stubCtx,
  'number-list',
  {
    items: [{ label: 'Item A' }, { label: 'Item B' }, { label: 'Item C' }],
    numberStyle: 'outline',
  },
  'pseudo3d',
  renderOpts,
);
ok('number-list outline style render resolves without throw', r3b instanceof Promise);
await r3b;

const r4 = renderAtom(
  stubCtx,
  'call-to-action',
  {
    heading: 'Ready to transform?',
    subheading: "Let's talk.",
    buttonText: 'Get Started',
    buttonStyle: 'solid',
    contact: 'hello@acme.com · acme.com',
    bg: 'accent',
  },
  'pseudo3d',
  renderOpts,
);
ok('call-to-action render returns Promise', r4 instanceof Promise);
await r4;
ok('call-to-action render resolves without throw', true);

// Test dark bg variant
const r4b = renderAtom(
  stubCtx,
  'call-to-action',
  { heading: 'Connect with us', bg: 'dark', buttonStyle: 'outline' },
  'pseudo3d',
  renderOpts,
);
ok('call-to-action dark bg render resolves without throw', r4b instanceof Promise);
await r4b;

// ──────────────────────────────────────────────────────────────────────────────
// 4. Catalog auto-pickup
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Catalog --');
_resetCatalogCache();
const catalog = await buildAtomCatalogString();
ok('catalog includes process-arrows', catalog.includes('`process-arrows`'));
ok('catalog includes stat-grid-large', catalog.includes('`stat-grid-large`'));
ok('catalog includes number-list', catalog.includes('`number-list`'));
ok('catalog includes call-to-action', catalog.includes('`call-to-action`'));

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
