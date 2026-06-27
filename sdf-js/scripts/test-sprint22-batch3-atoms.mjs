#!/usr/bin/env node
// Smoke test for Sprint 22 Batch 3 atoms:
// risk-heatmap, org-vs-org-matrix, kanban-board, donut-with-center

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

console.log('=== Sprint 22 Batch 3 atom smoke ===');

// ──────────────────────────────────────────────────────────────────────────────
// 1. Registration checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Registration --');
ok('risk-heatmap registered', isAtom2DType('risk-heatmap'));
ok('org-vs-org-matrix registered', isAtom2DType('org-vs-org-matrix'));
ok('kanban-board registered', isAtom2DType('kanban-board'));
ok('donut-with-center registered', isAtom2DType('donut-with-center'));

// ──────────────────────────────────────────────────────────────────────────────
// 2. Spec checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Specs --');

const rhSpec = await getAtomSpec('risk-heatmap');
ok('risk-heatmap spec exists', Boolean(rhSpec));
ok('risk-heatmap spec.type correct', rhSpec?.type === 'risk-heatmap');
ok('risk-heatmap spec has risks (required)', rhSpec?.args?.risks?.required === true);
ok('risk-heatmap spec has optional title', 'title' in (rhSpec?.args ?? {}));
ok('risk-heatmap spec has optional xAxis', 'xAxis' in (rhSpec?.args ?? {}));

const omSpec = await getAtomSpec('org-vs-org-matrix');
ok('org-vs-org-matrix spec exists', Boolean(omSpec));
ok('org-vs-org-matrix spec.type correct', omSpec?.type === 'org-vs-org-matrix');
ok('org-vs-org-matrix spec has orgs (required)', omSpec?.args?.orgs?.required === true);
ok('org-vs-org-matrix spec has xAxis (required)', omSpec?.args?.xAxis?.required === true);
ok('org-vs-org-matrix spec has optional title', 'title' in (omSpec?.args ?? {}));

const kbSpec = await getAtomSpec('kanban-board');
ok('kanban-board spec exists', Boolean(kbSpec));
ok('kanban-board spec.type correct', kbSpec?.type === 'kanban-board');
ok('kanban-board spec has columns (required)', kbSpec?.args?.columns?.required === true);
ok('kanban-board spec has optional title', 'title' in (kbSpec?.args ?? {}));

const dwcSpec = await getAtomSpec('donut-with-center');
ok('donut-with-center spec exists', Boolean(dwcSpec));
ok('donut-with-center spec.type correct', dwcSpec?.type === 'donut-with-center');
ok(
  'donut-with-center spec has centerValue (required)',
  dwcSpec?.args?.centerValue?.required === true,
);
ok('donut-with-center spec has segments (required)', dwcSpec?.args?.segments?.required === true);
ok('donut-with-center spec has optional title', 'title' in (dwcSpec?.args ?? {}));

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

// risk-heatmap — full 5-risk example
const r1 = renderAtom(
  stubCtx,
  'risk-heatmap',
  {
    title: 'Security Risk Assessment',
    xAxis: 'Likelihood',
    yAxis: 'Impact',
    risks: [
      { label: 'Data breach', likelihood: 4, impact: 5 },
      { label: 'Compliance fine', likelihood: 2, impact: 4 },
      { label: 'Vendor delay', likelihood: 5, impact: 2 },
      { label: 'DDoS attack', likelihood: 3, impact: 3 },
      { label: 'Key person', likelihood: 1, impact: 5 },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('risk-heatmap render returns Promise', r1 instanceof Promise);
await r1;
ok('risk-heatmap full render resolves without throw', true);

// risk-heatmap — no title, minimal risks
const r1b = renderAtom(
  stubCtx,
  'risk-heatmap',
  {
    risks: [{ label: 'Risk A', likelihood: 1, impact: 1 }],
  },
  'pseudo3d',
  renderOpts,
);
ok('risk-heatmap minimal no-title resolves without throw', r1b instanceof Promise);
await r1b;

// risk-heatmap — empty risks edge case
const r1c = renderAtom(stubCtx, 'risk-heatmap', { risks: [] }, 'pseudo3d', renderOpts);
ok('risk-heatmap empty risks resolves without throw', r1c instanceof Promise);
await r1c;

// org-vs-org-matrix — full example with quadrant labels
const r2 = renderAtom(
  stubCtx,
  'org-vs-org-matrix',
  {
    title: 'Competitive Positioning',
    xAxis: 'Completeness of Vision',
    yAxis: 'Ability to Execute',
    orgs: [
      { name: 'Acme (us)', x: 0.75, y: 0.82, isUs: true },
      { name: 'BigCorp', x: 0.55, y: 0.6 },
      { name: 'StartupX', x: 0.8, y: 0.25 },
      { name: 'OldVendor', x: 0.2, y: 0.4 },
    ],
    quadrantLabels: { tl: 'Visionaries', tr: 'Leaders', bl: 'Niche Players', br: 'Challengers' },
  },
  'pseudo3d',
  renderOpts,
);
ok('org-vs-org-matrix render returns Promise', r2 instanceof Promise);
await r2;
ok('org-vs-org-matrix full render resolves without throw', true);

// org-vs-org-matrix — no title, no quadrant labels
const r2b = renderAtom(
  stubCtx,
  'org-vs-org-matrix',
  {
    xAxis: 'X',
    yAxis: 'Y',
    orgs: [{ name: 'Us', x: 0.7, y: 0.8, isUs: true }],
  },
  'pseudo3d',
  renderOpts,
);
ok('org-vs-org-matrix minimal resolves without throw', r2b instanceof Promise);
await r2b;

// org-vs-org-matrix — empty orgs edge case
const r2c = renderAtom(
  stubCtx,
  'org-vs-org-matrix',
  {
    xAxis: 'X',
    yAxis: 'Y',
    orgs: [],
  },
  'pseudo3d',
  renderOpts,
);
ok('org-vs-org-matrix empty orgs resolves without throw', r2c instanceof Promise);
await r2c;

// kanban-board — 4 columns with mixed cards
const r3 = renderAtom(
  stubCtx,
  'kanban-board',
  {
    title: 'Sprint 22 Board',
    columns: [
      { label: 'Backlog', cards: [{ label: 'API design' }, { label: 'User research' }] },
      {
        label: 'In Progress',
        accent: 'warning',
        cards: [
          { label: 'Auth module', sublabel: 'Alice' },
          { label: 'Dashboard', sublabel: 'Bob' },
        ],
      },
      { label: 'Review', cards: [{ label: 'Onboarding flow' }] },
      {
        label: 'Done',
        accent: 'success',
        cards: [{ label: 'CI setup', sublabel: 'shipped' }, { label: 'Logo refresh' }],
      },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('kanban-board render returns Promise', r3 instanceof Promise);
await r3;
ok('kanban-board 4-column render resolves without throw', true);

// kanban-board — 2 columns, no title
const r3b = renderAtom(
  stubCtx,
  'kanban-board',
  {
    columns: [
      { label: 'To Do', cards: [{ label: 'Task A' }] },
      { label: 'Done', accent: 'success', cards: [] },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('kanban-board 2-column no-title resolves without throw', r3b instanceof Promise);
await r3b;

// kanban-board — empty columns edge case
const r3c = renderAtom(stubCtx, 'kanban-board', { columns: [] }, 'pseudo3d', renderOpts);
ok('kanban-board empty columns resolves without throw', r3c instanceof Promise);
await r3c;

// donut-with-center — 3 segments with title
const r4 = renderAtom(
  stubCtx,
  'donut-with-center',
  {
    title: 'Revenue Breakdown',
    centerValue: '$24M',
    centerLabel: 'Total ARR',
    segments: [
      { label: 'Enterprise', value: 12 },
      { label: 'Mid-market', value: 8 },
      { label: 'SMB', value: 4 },
    ],
    showPct: true,
  },
  'pseudo3d',
  renderOpts,
);
ok('donut-with-center render returns Promise', r4 instanceof Promise);
await r4;
ok('donut-with-center 3-segment render resolves without throw', true);

// donut-with-center — 5 segments, no title, no centerLabel
const r4b = renderAtom(
  stubCtx,
  'donut-with-center',
  {
    centerValue: '68%',
    segments: [
      { label: 'North America', value: 40 },
      { label: 'Europe', value: 28 },
      { label: 'APAC', value: 20 },
      { label: 'LATAM', value: 8 },
      { label: 'Other', value: 4 },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('donut-with-center 5-segment no-title resolves without throw', r4b instanceof Promise);
await r4b;

// donut-with-center — empty segments edge case
const r4c = renderAtom(
  stubCtx,
  'donut-with-center',
  {
    centerValue: '0',
    segments: [],
  },
  'pseudo3d',
  renderOpts,
);
ok('donut-with-center empty segments resolves without throw', r4c instanceof Promise);
await r4c;

// ──────────────────────────────────────────────────────────────────────────────
// 4. Catalog auto-pickup
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Catalog --');
_resetCatalogCache();
const catalog = await buildAtomCatalogString();
ok('catalog includes risk-heatmap', catalog.includes('`risk-heatmap`'));
ok('catalog includes org-vs-org-matrix', catalog.includes('`org-vs-org-matrix`'));
ok('catalog includes kanban-board', catalog.includes('`kanban-board`'));
ok('catalog includes donut-with-center', catalog.includes('`donut-with-center`'));

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
