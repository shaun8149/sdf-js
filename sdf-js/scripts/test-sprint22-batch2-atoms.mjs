#!/usr/bin/env node
// Smoke test for Sprint 22 Batch 2 atoms:
// decision-tree-3-arm, maturity-model, cost-benefit-matrix, journey-flow-curve

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

console.log('=== Sprint 22 Batch 2 atom smoke ===');

// ──────────────────────────────────────────────────────────────────────────────
// 1. Registration checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Registration --');
ok('decision-tree-3-arm registered', isAtom2DType('decision-tree-3-arm'));
ok('maturity-model registered', isAtom2DType('maturity-model'));
ok('cost-benefit-matrix registered', isAtom2DType('cost-benefit-matrix'));
ok('journey-flow-curve registered', isAtom2DType('journey-flow-curve'));

// ──────────────────────────────────────────────────────────────────────────────
// 2. Spec checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Specs --');

const dtSpec = await getAtomSpec('decision-tree-3-arm');
ok('decision-tree-3-arm spec exists', Boolean(dtSpec));
ok('decision-tree-3-arm spec.type correct', dtSpec?.type === 'decision-tree-3-arm');
ok('decision-tree-3-arm spec has question (required)', dtSpec?.args?.question?.required === true);
ok('decision-tree-3-arm spec has arms (required)', dtSpec?.args?.arms?.required === true);
ok('decision-tree-3-arm spec has optional title', 'title' in (dtSpec?.args ?? {}));

const mmSpec = await getAtomSpec('maturity-model');
ok('maturity-model spec exists', Boolean(mmSpec));
ok('maturity-model spec.type correct', mmSpec?.type === 'maturity-model');
ok('maturity-model spec has stages (required)', mmSpec?.args?.stages?.required === true);
ok('maturity-model spec has optional currentLevel', 'currentLevel' in (mmSpec?.args ?? {}));
ok('maturity-model spec has optional title', 'title' in (mmSpec?.args ?? {}));

const cbSpec = await getAtomSpec('cost-benefit-matrix');
ok('cost-benefit-matrix spec exists', Boolean(cbSpec));
ok('cost-benefit-matrix spec.type correct', cbSpec?.type === 'cost-benefit-matrix');
ok('cost-benefit-matrix spec has items (required)', cbSpec?.args?.items?.required === true);
ok('cost-benefit-matrix spec has optional title', 'title' in (cbSpec?.args ?? {}));

const jfSpec = await getAtomSpec('journey-flow-curve');
ok('journey-flow-curve spec exists', Boolean(jfSpec));
ok('journey-flow-curve spec.type correct', jfSpec?.type === 'journey-flow-curve');
ok(
  'journey-flow-curve spec has touchpoints (required)',
  jfSpec?.args?.touchpoints?.required === true,
);
ok('journey-flow-curve spec has optional title', 'title' in (jfSpec?.args ?? {}));

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

// decision-tree-3-arm — 3 arms with title
const r1 = renderAtom(
  stubCtx,
  'decision-tree-3-arm',
  {
    title: 'Which Growth Strategy?',
    question: 'What is the best path forward for Q4?',
    arms: [
      { label: 'Expand Market', sublabel: 'New geographies' },
      { label: 'Deepen Product', sublabel: 'Add features' },
      { label: 'Grow Team', sublabel: 'Scale headcount' },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('decision-tree-3-arm render returns Promise', r1 instanceof Promise);
await r1;
ok('decision-tree-3-arm 3-arm render resolves without throw', true);

// decision-tree-3-arm — 5 arms, no title
const r1b = renderAtom(
  stubCtx,
  'decision-tree-3-arm',
  {
    question: 'Which option?',
    arms: [
      { label: 'Yes' },
      { label: 'No' },
      { label: 'Maybe' },
      { label: 'Later' },
      { label: 'Escalate' },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('decision-tree-3-arm 5-arm no-title resolves without throw', r1b instanceof Promise);
await r1b;

// decision-tree-3-arm — empty arms edge case
const r1c = renderAtom(
  stubCtx,
  'decision-tree-3-arm',
  { question: 'Decide?', arms: [] },
  'pseudo3d',
  renderOpts,
);
ok('decision-tree-3-arm empty arms resolves without throw', r1c instanceof Promise);
await r1c;

// maturity-model — 5 stages with currentLevel
const r2 = renderAtom(
  stubCtx,
  'maturity-model',
  {
    title: 'AI Maturity Assessment',
    stages: [
      { label: 'Initial', description: 'Ad hoc processes' },
      { label: 'Managed', description: 'Basic tracking' },
      { label: 'Defined', description: 'Standardized' },
      { label: 'Quantitative', description: 'Data-driven' },
      { label: 'Optimizing', description: 'Continuous improvement' },
    ],
    currentLevel: 3,
    label: 'Current: Level 3 — Defined',
  },
  'pseudo3d',
  renderOpts,
);
ok('maturity-model render returns Promise', r2 instanceof Promise);
await r2;
ok('maturity-model 5-stage render resolves without throw', true);

// maturity-model — 3 stages, no currentLevel, no label
const r2b = renderAtom(
  stubCtx,
  'maturity-model',
  {
    stages: [{ label: 'Beginner' }, { label: 'Intermediate' }, { label: 'Advanced' }],
  },
  'pseudo3d',
  renderOpts,
);
ok('maturity-model 3-stage no-level resolves without throw', r2b instanceof Promise);
await r2b;

// maturity-model — empty stages edge case
const r2c = renderAtom(stubCtx, 'maturity-model', { stages: [] }, 'pseudo3d', renderOpts);
ok('maturity-model empty stages resolves without throw', r2c instanceof Promise);
await r2c;

// cost-benefit-matrix — full 4-item example with quadrantLabels
const r3 = renderAtom(
  stubCtx,
  'cost-benefit-matrix',
  {
    title: 'Initiative Prioritization',
    xAxis: 'Cost',
    yAxis: 'Benefit',
    items: [
      { label: 'AI Chatbot', cost: 'low', benefit: 'high' },
      { label: 'ERP Upgrade', cost: 'high', benefit: 'high' },
      { label: 'Email Campaign', cost: 'low', benefit: 'low' },
      { label: 'Rebrand', cost: 'high', benefit: 'low' },
    ],
    quadrantLabels: { tl: 'Quick Wins', tr: 'Major Projects', bl: 'Fill-ins', br: 'Hard Sells' },
  },
  'pseudo3d',
  renderOpts,
);
ok('cost-benefit-matrix render returns Promise', r3 instanceof Promise);
await r3;
ok('cost-benefit-matrix render resolves without throw', true);

// cost-benefit-matrix — no title, no quadrant labels, no items
const r3b = renderAtom(stubCtx, 'cost-benefit-matrix', { items: [] }, 'pseudo3d', renderOpts);
ok('cost-benefit-matrix empty items resolves without throw', r3b instanceof Promise);
await r3b;

// journey-flow-curve — 5 touchpoints with title
const r4 = renderAtom(
  stubCtx,
  'journey-flow-curve',
  {
    title: 'Customer Onboarding Journey',
    touchpoints: [
      { label: 'Discovery', sublabel: 'Sees ad', emotion: 0.3 },
      { label: 'Sign-up', sublabel: 'Free trial', emotion: 0.6 },
      { label: 'Onboarding', sublabel: 'Setup wizard', emotion: -0.2 },
      { label: 'First Value', sublabel: 'Aha moment', emotion: 0.9 },
      { label: 'Renewal', sublabel: 'Converts to paid', emotion: 0.8 },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('journey-flow-curve render returns Promise', r4 instanceof Promise);
await r4;
ok('journey-flow-curve 5-touchpoint render resolves without throw', true);

// journey-flow-curve — no title, all negative emotions
const r4b = renderAtom(
  stubCtx,
  'journey-flow-curve',
  {
    touchpoints: [
      { label: 'Pain Point A', emotion: -0.8 },
      { label: 'Pain Point B', emotion: -0.5 },
      { label: 'Pain Point C', emotion: -0.9 },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('journey-flow-curve all-negative no-title resolves without throw', r4b instanceof Promise);
await r4b;

// journey-flow-curve — empty touchpoints edge case
const r4c = renderAtom(stubCtx, 'journey-flow-curve', { touchpoints: [] }, 'pseudo3d', renderOpts);
ok('journey-flow-curve empty touchpoints resolves without throw', r4c instanceof Promise);
await r4c;

// ──────────────────────────────────────────────────────────────────────────────
// 4. Catalog auto-pickup
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Catalog --');
_resetCatalogCache();
const catalog = await buildAtomCatalogString();
ok('catalog includes decision-tree-3-arm', catalog.includes('`decision-tree-3-arm`'));
ok('catalog includes maturity-model', catalog.includes('`maturity-model`'));
ok('catalog includes cost-benefit-matrix', catalog.includes('`cost-benefit-matrix`'));
ok('catalog includes journey-flow-curve', catalog.includes('`journey-flow-curve`'));

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
