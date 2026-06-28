#!/usr/bin/env node
// Smoke test for Sprint 22 Batch 4 atoms:
// funnel-with-conversion, pillar-3up, testimonial-wall, balance-scale

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

console.log('=== Sprint 22 Batch 4 atom smoke ===');

// ──────────────────────────────────────────────────────────────────────────────
// 1. Registration checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Registration --');
ok('funnel-with-conversion registered', isAtom2DType('funnel-with-conversion'));
ok('pillar-3up registered', isAtom2DType('pillar-3up'));
ok('testimonial-wall registered', isAtom2DType('testimonial-wall'));
ok('balance-scale registered', isAtom2DType('balance-scale'));

// ──────────────────────────────────────────────────────────────────────────────
// 2. Spec checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Specs --');

const fwcSpec = await getAtomSpec('funnel-with-conversion');
ok('funnel-with-conversion spec exists', Boolean(fwcSpec));
ok('funnel-with-conversion spec.type correct', fwcSpec?.type === 'funnel-with-conversion');
ok('funnel-with-conversion spec has stages (required)', fwcSpec?.args?.stages?.required === true);
ok('funnel-with-conversion spec has optional title', 'title' in (fwcSpec?.args ?? {}));
ok('funnel-with-conversion spec has showConversion', 'showConversion' in (fwcSpec?.args ?? {}));

const p3Spec = await getAtomSpec('pillar-3up');
ok('pillar-3up spec exists', Boolean(p3Spec));
ok('pillar-3up spec.type correct', p3Spec?.type === 'pillar-3up');
ok('pillar-3up spec has pillars (required)', p3Spec?.args?.pillars?.required === true);
ok('pillar-3up spec has optional title', 'title' in (p3Spec?.args ?? {}));

const twSpec = await getAtomSpec('testimonial-wall');
ok('testimonial-wall spec exists', Boolean(twSpec));
ok('testimonial-wall spec.type correct', twSpec?.type === 'testimonial-wall');
ok(
  'testimonial-wall spec has testimonials (required)',
  twSpec?.args?.testimonials?.required === true,
);
ok('testimonial-wall spec has optional title', 'title' in (twSpec?.args ?? {}));

const bsSpec = await getAtomSpec('balance-scale');
ok('balance-scale spec exists', Boolean(bsSpec));
ok('balance-scale spec.type correct', bsSpec?.type === 'balance-scale');
ok('balance-scale spec has leftLabel (required)', bsSpec?.args?.leftLabel?.required === true);
ok('balance-scale spec has rightLabel (required)', bsSpec?.args?.rightLabel?.required === true);
ok('balance-scale spec has leftItems (required)', bsSpec?.args?.leftItems?.required === true);
ok('balance-scale spec has rightItems (required)', bsSpec?.args?.rightItems?.required === true);

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
    [220, 160, 40],
  ],
};
const renderOpts = { x: 0, y: 0, w: 720, h: 480, palette };

// funnel-with-conversion — 4 stages with values
const r1 = renderAtom(
  stubCtx,
  'funnel-with-conversion',
  {
    title: 'SaaS Conversion Funnel',
    stages: [
      { label: 'Visitors', value: 100000 },
      { label: 'Signups', value: 12000 },
      { label: 'Trials', value: 4200 },
      { label: 'Paid', value: 760 },
    ],
    showAbsolute: true,
    showConversion: true,
  },
  'pseudo3d',
  renderOpts,
);
ok('funnel-with-conversion render returns Promise', r1 instanceof Promise);
await r1;
ok('funnel-with-conversion 4-stage render resolves without throw', true);

// funnel-with-conversion — no title, showConversion false
const r1b = renderAtom(
  stubCtx,
  'funnel-with-conversion',
  {
    stages: [
      { label: 'Top', value: 1000 },
      { label: 'Mid', value: 200 },
      { label: 'Bottom', value: 40 },
    ],
    showConversion: false,
  },
  'pseudo3d',
  renderOpts,
);
ok('funnel-with-conversion no-title no-conversion resolves without throw', r1b instanceof Promise);
await r1b;

// funnel-with-conversion — empty stages edge case
const r1c = renderAtom(stubCtx, 'funnel-with-conversion', { stages: [] }, 'pseudo3d', renderOpts);
ok('funnel-with-conversion empty stages resolves without throw', r1c instanceof Promise);
await r1c;

// pillar-3up — 3 pillars with icons
const r2 = renderAtom(
  stubCtx,
  'pillar-3up',
  {
    title: 'Our Three Pillars',
    pillars: [
      { icon: 'lightning', heading: 'Speed', body: 'Sub-100ms response across all queries.' },
      {
        icon: 'shield-check',
        heading: 'Security',
        body: 'SOC 2 Type II + zero-trust architecture.',
      },
      { icon: 'globe', heading: 'Scale', body: '100+ regions, auto-scaling infrastructure.' },
    ],
    accentLine: true,
  },
  'pseudo3d',
  renderOpts,
);
ok('pillar-3up render returns Promise', r2 instanceof Promise);
await r2;
ok('pillar-3up 3-pillar render resolves without throw', true);

// pillar-3up — 2 pillars, no title, no icons
const r2b = renderAtom(
  stubCtx,
  'pillar-3up',
  {
    pillars: [
      { heading: 'Mission', body: 'We build great software.' },
      { heading: 'Vision', body: 'A world where shipping is effortless.' },
    ],
    accentLine: false,
  },
  'pseudo3d',
  renderOpts,
);
ok('pillar-3up 2-pillar no-title resolves without throw', r2b instanceof Promise);
await r2b;

// pillar-3up — empty pillars edge case
const r2c = renderAtom(stubCtx, 'pillar-3up', { pillars: [] }, 'pseudo3d', renderOpts);
ok('pillar-3up empty pillars resolves without throw', r2c instanceof Promise);
await r2c;

// testimonial-wall — 3 testimonials with title
const r3 = renderAtom(
  stubCtx,
  'testimonial-wall',
  {
    title: 'What Our Customers Say',
    testimonials: [
      {
        quote: 'Cut our deployment time from 2 weeks to 2 hours.',
        name: 'Sarah Chen',
        role: 'VP Engineering, Acme',
      },
      {
        quote: 'The dashboard is the first thing my team opens every morning.',
        name: 'Marcus Johnson',
        role: 'CFO, BrightWave',
      },
      {
        quote: "Onboarding was the easiest we've ever done. 3 days to value.",
        name: 'Priya Sharma',
        role: 'COO, Meridian',
      },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('testimonial-wall render returns Promise', r3 instanceof Promise);
await r3;
ok('testimonial-wall 3-card render resolves without throw', true);

// testimonial-wall — 2 testimonials, no title, no role
const r3b = renderAtom(
  stubCtx,
  'testimonial-wall',
  {
    testimonials: [
      { quote: 'Amazing product.', name: 'Alice' },
      { quote: 'Changed how we work.', name: 'Bob' },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('testimonial-wall 2-card no-title resolves without throw', r3b instanceof Promise);
await r3b;

// testimonial-wall — empty testimonials edge case
const r3c = renderAtom(stubCtx, 'testimonial-wall', { testimonials: [] }, 'pseudo3d', renderOpts);
ok('testimonial-wall empty testimonials resolves without throw', r3c instanceof Promise);
await r3c;

// balance-scale — full build vs buy with verdict
const r4 = renderAtom(
  stubCtx,
  'balance-scale',
  {
    title: 'Build vs Buy Analysis',
    leftLabel: 'BUILD',
    rightLabel: 'BUY',
    leftItems: ['Full control', 'IP retention', 'Custom fit', 'No vendor lock-in'],
    rightItems: ['Faster to market', 'Lower upfront cost', 'Vendor SLA', 'Proven reliability'],
    verdict: 'Recommend: Buy for v1',
  },
  'pseudo3d',
  renderOpts,
);
ok('balance-scale render returns Promise', r4 instanceof Promise);
await r4;
ok('balance-scale full render resolves without throw', true);

// balance-scale — no title, no verdict
const r4b = renderAtom(
  stubCtx,
  'balance-scale',
  {
    leftLabel: 'PROS',
    rightLabel: 'CONS',
    leftItems: ['Pro A', 'Pro B'],
    rightItems: ['Con A'],
  },
  'pseudo3d',
  renderOpts,
);
ok('balance-scale no-title no-verdict resolves without throw', r4b instanceof Promise);
await r4b;

// balance-scale — empty items edge case
const r4c = renderAtom(
  stubCtx,
  'balance-scale',
  { leftLabel: 'L', rightLabel: 'R', leftItems: [], rightItems: [] },
  'pseudo3d',
  renderOpts,
);
ok('balance-scale empty items resolves without throw', r4c instanceof Promise);
await r4c;

// ──────────────────────────────────────────────────────────────────────────────
// 4. Catalog auto-pickup
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Catalog --');
_resetCatalogCache();
const catalog = await buildAtomCatalogString();
ok('catalog includes funnel-with-conversion', catalog.includes('`funnel-with-conversion`'));
ok('catalog includes pillar-3up', catalog.includes('`pillar-3up`'));
ok('catalog includes testimonial-wall', catalog.includes('`testimonial-wall`'));
ok('catalog includes balance-scale', catalog.includes('`balance-scale`'));

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
