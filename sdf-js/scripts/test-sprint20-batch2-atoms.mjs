#!/usr/bin/env node
// Smoke test for Sprint 20 Batch 2 atoms:
// vertical-timeline, segmented-bar, pull-quote-banner, circle-process-cycle

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
  rect() {},
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

console.log('=== Sprint 20 Batch 2 atom smoke ===');

// ──────────────────────────────────────────────────────────────────────────────
// 1. Registration checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Registration --');
ok('vertical-timeline registered', isAtom2DType('vertical-timeline'));
ok('segmented-bar registered', isAtom2DType('segmented-bar'));
ok('pull-quote-banner registered', isAtom2DType('pull-quote-banner'));
ok('circle-process-cycle registered', isAtom2DType('circle-process-cycle'));

// ──────────────────────────────────────────────────────────────────────────────
// 2. Spec checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Specs --');

const vtSpec = await getAtomSpec('vertical-timeline');
ok('vertical-timeline spec exists', Boolean(vtSpec));
ok('vertical-timeline spec.type correct', vtSpec?.type === 'vertical-timeline');
ok('vertical-timeline spec has events (required)', vtSpec?.args?.events?.required === true);
ok('vertical-timeline spec has optional title', 'title' in (vtSpec?.args ?? {}));
ok('vertical-timeline spec has optional axisLabel', 'axisLabel' in (vtSpec?.args ?? {}));

const sbSpec = await getAtomSpec('segmented-bar');
ok('segmented-bar spec exists', Boolean(sbSpec));
ok('segmented-bar spec.type correct', sbSpec?.type === 'segmented-bar');
ok('segmented-bar spec has segments (required)', sbSpec?.args?.segments?.required === true);
ok('segmented-bar spec has optional title', 'title' in (sbSpec?.args ?? {}));
ok('segmented-bar spec has optional showPct', 'showPct' in (sbSpec?.args ?? {}));
ok('segmented-bar spec has optional format', 'format' in (sbSpec?.args ?? {}));

const pqbSpec = await getAtomSpec('pull-quote-banner');
ok('pull-quote-banner spec exists', Boolean(pqbSpec));
ok('pull-quote-banner spec.type correct', pqbSpec?.type === 'pull-quote-banner');
ok('pull-quote-banner spec has quote (required)', pqbSpec?.args?.quote?.required === true);
ok('pull-quote-banner spec has optional author', 'author' in (pqbSpec?.args ?? {}));
ok('pull-quote-banner spec has optional attribution', 'attribution' in (pqbSpec?.args ?? {}));
ok('pull-quote-banner spec has optional bg', 'bg' in (pqbSpec?.args ?? {}));

const cpcSpec = await getAtomSpec('circle-process-cycle');
ok('circle-process-cycle spec exists', Boolean(cpcSpec));
ok('circle-process-cycle spec.type correct', cpcSpec?.type === 'circle-process-cycle');
ok('circle-process-cycle spec has steps (required)', cpcSpec?.args?.steps?.required === true);
ok('circle-process-cycle spec has optional title', 'title' in (cpcSpec?.args ?? {}));
ok('circle-process-cycle spec has optional centerLabel', 'centerLabel' in (cpcSpec?.args ?? {}));

// ──────────────────────────────────────────────────────────────────────────────
// 3. Render checks — no throw
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Render (no-throw) --');

const palette = {
  bg: [248, 246, 240],
  silhouetteColor: [30, 27, 30],
  accent: [42, 130, 200],
  colors: [
    [42, 130, 200],
    [60, 180, 140],
    [200, 120, 60],
    [180, 80, 160],
  ],
};
const renderOpts = { x: 0, y: 0, w: 720, h: 480, palette };

// vertical-timeline
const r1 = renderAtom(
  stubCtx,
  'vertical-timeline',
  {
    title: 'Company Milestones',
    events: [
      { date: 'Q1 2026', label: 'Product Launch', sublabel: 'MVP shipped' },
      { date: 'Q2 2026', label: 'Series A', sublabel: '$8M raised' },
      { date: 'Q3 2026', label: '10K Users' },
      { date: 'Q4 2026', label: 'Profitability' },
    ],
    axisLabel: '2026 Roadmap',
  },
  'pseudo3d',
  renderOpts,
);
ok('vertical-timeline render returns Promise', r1 instanceof Promise);
await r1;
ok('vertical-timeline render resolves without throw', true);

// vertical-timeline minimal (no title, no axisLabel, no sublabel)
const r1b = renderAtom(
  stubCtx,
  'vertical-timeline',
  {
    events: [
      { date: 'Jan', label: 'Start' },
      { date: 'Feb', label: 'End' },
      { date: 'Mar', label: 'Done' },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('vertical-timeline minimal render resolves without throw', r1b instanceof Promise);
await r1b;

// segmented-bar
const r2 = renderAtom(
  stubCtx,
  'segmented-bar',
  {
    title: 'Budget Allocation',
    segments: [
      { label: 'Engineering', value: 45 },
      { label: 'Sales', value: 30 },
      { label: 'Marketing', value: 15 },
      { label: 'Other', value: 10 },
    ],
    showPct: true,
    format: 'pct',
  },
  'pseudo3d',
  renderOpts,
);
ok('segmented-bar render returns Promise', r2 instanceof Promise);
await r2;
ok('segmented-bar render resolves without throw', true);

// segmented-bar value format
const r2b = renderAtom(
  stubCtx,
  'segmented-bar',
  {
    segments: [
      { label: 'A', value: 60 },
      { label: 'B', value: 40 },
    ],
    format: 'value',
    total: 100,
  },
  'pseudo3d',
  renderOpts,
);
ok('segmented-bar value format resolves without throw', r2b instanceof Promise);
await r2b;

// pull-quote-banner accent bg
const r3 = renderAtom(
  stubCtx,
  'pull-quote-banner',
  {
    quote: "We don't just sell software — we transform how teams work.",
    author: 'Sarah Chen',
    attribution: 'CEO, Meridian Analytics',
    bg: 'accent',
  },
  'pseudo3d',
  renderOpts,
);
ok('pull-quote-banner render returns Promise', r3 instanceof Promise);
await r3;
ok('pull-quote-banner render resolves without throw', true);

// pull-quote-banner dark bg
const r3b = renderAtom(
  stubCtx,
  'pull-quote-banner',
  { quote: 'Simple is hard.', bg: 'dark' },
  'pseudo3d',
  renderOpts,
);
ok('pull-quote-banner dark bg resolves without throw', r3b instanceof Promise);
await r3b;

// pull-quote-banner gradient bg
const r3c = renderAtom(
  stubCtx,
  'pull-quote-banner',
  { quote: 'Gradient quote.', bg: 'gradient', author: 'Someone' },
  'pseudo3d',
  renderOpts,
);
ok('pull-quote-banner gradient bg resolves without throw', r3c instanceof Promise);
await r3c;

// circle-process-cycle (4-step PDCA)
const r4 = renderAtom(
  stubCtx,
  'circle-process-cycle',
  {
    title: 'Continuous Improvement',
    steps: [{ label: 'Plan' }, { label: 'Do' }, { label: 'Check' }, { label: 'Act' }],
    centerLabel: 'PDCA',
  },
  'pseudo3d',
  renderOpts,
);
ok('circle-process-cycle render returns Promise', r4 instanceof Promise);
await r4;
ok('circle-process-cycle render resolves without throw', true);

// circle-process-cycle (3-step, no center)
const r4b = renderAtom(
  stubCtx,
  'circle-process-cycle',
  { steps: [{ label: 'Discover' }, { label: 'Build' }, { label: 'Ship' }] },
  'pseudo3d',
  renderOpts,
);
ok('circle-process-cycle 3-step no-center resolves without throw', r4b instanceof Promise);
await r4b;

// ──────────────────────────────────────────────────────────────────────────────
// 4. Catalog auto-pickup
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Catalog --');
_resetCatalogCache();
const catalog = await buildAtomCatalogString();
ok('catalog includes vertical-timeline', catalog.includes('`vertical-timeline`'));
ok('catalog includes segmented-bar', catalog.includes('`segmented-bar`'));
ok('catalog includes pull-quote-banner', catalog.includes('`pull-quote-banner`'));
ok('catalog includes circle-process-cycle', catalog.includes('`circle-process-cycle`'));

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
