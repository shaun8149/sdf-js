#!/usr/bin/env node
// Smoke test for Sprint 20 Batch 3 atoms:
// feature-card-grid, stat-with-icon, callout-banner, numbered-grid

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
  ellipse() {},
  arcTo() {},
  fill() {},
  stroke() {},
  rotate() {},
  translate() {},
  scale() {},
  setLineDash() {},
  rect() {},
  roundRect() {},
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

console.log('=== Sprint 20 Batch 3 atom smoke ===');

// ──────────────────────────────────────────────────────────────────────────────
// 1. Registration checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Registration --');
ok('feature-card-grid registered', isAtom2DType('feature-card-grid'));
ok('stat-with-icon registered', isAtom2DType('stat-with-icon'));
ok('callout-banner registered', isAtom2DType('callout-banner'));
ok('numbered-grid registered', isAtom2DType('numbered-grid'));

// ──────────────────────────────────────────────────────────────────────────────
// 2. Spec checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Specs --');

const fcgSpec = await getAtomSpec('feature-card-grid');
ok('feature-card-grid spec exists', Boolean(fcgSpec));
ok('feature-card-grid spec.type correct', fcgSpec?.type === 'feature-card-grid');
ok('feature-card-grid spec has features (required)', fcgSpec?.args?.features?.required === true);
ok('feature-card-grid spec has optional title', 'title' in (fcgSpec?.args ?? {}));

const swiSpec = await getAtomSpec('stat-with-icon');
ok('stat-with-icon spec exists', Boolean(swiSpec));
ok('stat-with-icon spec.type correct', swiSpec?.type === 'stat-with-icon');
ok('stat-with-icon spec has value (required)', swiSpec?.args?.value?.required === true);
ok('stat-with-icon spec has label (required)', swiSpec?.args?.label?.required === true);
ok('stat-with-icon spec has optional icon', 'icon' in (swiSpec?.args ?? {}));
ok('stat-with-icon spec has optional trend', 'trend' in (swiSpec?.args ?? {}));

const cbSpec = await getAtomSpec('callout-banner');
ok('callout-banner spec exists', Boolean(cbSpec));
ok('callout-banner spec.type correct', cbSpec?.type === 'callout-banner');
ok('callout-banner spec has body (required)', cbSpec?.args?.body?.required === true);
ok('callout-banner spec has optional type_', 'type_' in (cbSpec?.args ?? {}));
ok('callout-banner spec has optional heading', 'heading' in (cbSpec?.args ?? {}));

const ngSpec = await getAtomSpec('numbered-grid');
ok('numbered-grid spec exists', Boolean(ngSpec));
ok('numbered-grid spec.type correct', ngSpec?.type === 'numbered-grid');
ok('numbered-grid spec has items (required)', ngSpec?.args?.items?.required === true);
ok('numbered-grid spec has optional numberStyle', 'numberStyle' in (ngSpec?.args ?? {}));
ok('numbered-grid spec has optional title', 'title' in (ngSpec?.args ?? {}));

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

// feature-card-grid — full args
const r1 = renderAtom(
  stubCtx,
  'feature-card-grid',
  {
    title: 'Platform Features',
    features: [
      {
        icon: 'shield',
        title: 'Security',
        body: 'End-to-end encryption with zero-knowledge architecture',
      },
      { icon: 'lightning', title: 'Performance', body: 'Sub-100ms response times globally' },
      { icon: 'globe', title: 'Global Reach', body: '150+ countries, 50+ languages supported' },
      { icon: 'heart', title: 'Support', body: '24/7 dedicated customer success team' },
      { icon: 'chart-bar', title: 'Analytics', body: 'Real-time dashboards and reporting' },
      { icon: 'lock', title: 'Compliance', body: 'SOC 2 Type II, GDPR, HIPAA ready' },
    ],
    cols: 3,
    bg: 'cards',
  },
  'pseudo3d',
  renderOpts,
);
ok('feature-card-grid render returns Promise', r1 instanceof Promise);
await r1;
ok('feature-card-grid render resolves without throw', true);

// feature-card-grid — plain bg, no title, no icons
const r1b = renderAtom(
  stubCtx,
  'feature-card-grid',
  {
    features: [
      { title: 'Speed', body: 'Fast delivery' },
      { title: 'Quality', body: 'Zero defects' },
      { title: 'Cost', body: 'Lean budget' },
    ],
    bg: 'plain',
  },
  'pseudo3d',
  renderOpts,
);
ok('feature-card-grid plain bg no-icon resolves without throw', r1b instanceof Promise);
await r1b;

// stat-with-icon — full args
const r2 = renderAtom(
  stubCtx,
  'stat-with-icon',
  {
    value: '$3.4M',
    label: 'Annual Revenue',
    sublabel: 'vs last year',
    icon: 'chart-bar',
    trend: '+22%',
    trendDirection: 'up',
  },
  'pseudo3d',
  renderOpts,
);
ok('stat-with-icon render returns Promise', r2 instanceof Promise);
await r2;
ok('stat-with-icon render resolves without throw', true);

// stat-with-icon — minimal (no icon, no trend)
const r2b = renderAtom(
  stubCtx,
  'stat-with-icon',
  { value: '127%', label: 'YoY Growth' },
  'pseudo3d',
  renderOpts,
);
ok('stat-with-icon minimal resolves without throw', r2b instanceof Promise);
await r2b;

// stat-with-icon — down trend
const r2c = renderAtom(
  stubCtx,
  'stat-with-icon',
  {
    value: '8.2%',
    label: 'Churn Rate',
    trend: '-1.4pt',
    trendDirection: 'down',
  },
  'pseudo3d',
  renderOpts,
);
ok('stat-with-icon down-trend resolves without throw', r2c instanceof Promise);
await r2c;

// callout-banner — insight (default)
const r3 = renderAtom(
  stubCtx,
  'callout-banner',
  {
    heading: 'Key Insight',
    body: 'Revenue grew 47% YoY driven by enterprise upsells and expansion into new markets.',
  },
  'pseudo3d',
  renderOpts,
);
ok('callout-banner render returns Promise', r3 instanceof Promise);
await r3;
ok('callout-banner insight resolves without throw', true);

// callout-banner — warning type
const r3b = renderAtom(
  stubCtx,
  'callout-banner',
  {
    type_: 'warning',
    heading: 'Risk Factor',
    body: 'Churn exceeded threshold in Q3. Immediate retention program required.',
  },
  'pseudo3d',
  renderOpts,
);
ok('callout-banner warning type resolves without throw', r3b instanceof Promise);
await r3b;

// callout-banner — tip, no heading
const r3c = renderAtom(
  stubCtx,
  'callout-banner',
  { type_: 'tip', body: 'Use the /lift command to generate slides automatically.' },
  'pseudo3d',
  renderOpts,
);
ok('callout-banner tip no-heading resolves without throw', r3c instanceof Promise);
await r3c;

// callout-banner — note type
const r3d = renderAtom(
  stubCtx,
  'callout-banner',
  { type_: 'note', body: 'Data sourced from Q4 2025 earnings call.' },
  'pseudo3d',
  renderOpts,
);
ok('callout-banner note type resolves without throw', r3d instanceof Promise);
await r3d;

// numbered-grid — huge style (default)
const r4 = renderAtom(
  stubCtx,
  'numbered-grid',
  {
    title: 'Growth Levers',
    items: [
      { label: 'Product-led growth', sublabel: 'Freemium → paid conversion' },
      { label: 'Partner channel', sublabel: '40+ resellers' },
      { label: 'Content marketing', sublabel: 'SEO-first blog' },
      { label: 'Enterprise sales', sublabel: 'Direct outbound' },
    ],
    cols: 2,
    numberStyle: 'huge',
  },
  'pseudo3d',
  renderOpts,
);
ok('numbered-grid render returns Promise', r4 instanceof Promise);
await r4;
ok('numbered-grid huge style resolves without throw', true);

// numbered-grid — circle style
const r4b = renderAtom(
  stubCtx,
  'numbered-grid',
  {
    items: [
      { label: 'Discover' },
      { label: 'Define' },
      { label: 'Develop' },
      { label: 'Deliver' },
      { label: 'Deploy' },
      { label: 'Delight' },
    ],
    numberStyle: 'circle',
  },
  'pseudo3d',
  renderOpts,
);
ok('numbered-grid circle style resolves without throw', r4b instanceof Promise);
await r4b;

// numbered-grid — corner style
const r4c = renderAtom(
  stubCtx,
  'numbered-grid',
  {
    title: 'Steps',
    items: [
      { label: 'Onboard', sublabel: 'Day 1 setup' },
      { label: 'Configure', sublabel: 'Week 1 integration' },
      { label: 'Launch', sublabel: 'Month 1 go-live' },
      { label: 'Scale', sublabel: 'Quarter 1 expansion' },
    ],
    numberStyle: 'corner',
    cols: 2,
  },
  'pseudo3d',
  renderOpts,
);
ok('numbered-grid corner style resolves without throw', r4c instanceof Promise);
await r4c;

// ──────────────────────────────────────────────────────────────────────────────
// 4. Catalog auto-pickup
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Catalog --');
_resetCatalogCache();
const catalog = await buildAtomCatalogString();
ok('catalog includes feature-card-grid', catalog.includes('`feature-card-grid`'));
ok('catalog includes stat-with-icon', catalog.includes('`stat-with-icon`'));
ok('catalog includes callout-banner', catalog.includes('`callout-banner`'));
ok('catalog includes numbered-grid', catalog.includes('`numbered-grid`'));

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
