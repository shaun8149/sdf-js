#!/usr/bin/env node
// Smoke test for Sprint 22 Batch 1 atoms:
// mountain-path, strategy-map, radar-chart, okr-tree

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

console.log('=== Sprint 22 Batch 1 atom smoke ===');

// ──────────────────────────────────────────────────────────────────────────────
// 1. Registration checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Registration --');
ok('mountain-path registered', isAtom2DType('mountain-path'));
ok('strategy-map registered', isAtom2DType('strategy-map'));
ok('radar-chart registered', isAtom2DType('radar-chart'));
ok('okr-tree registered', isAtom2DType('okr-tree'));

// ──────────────────────────────────────────────────────────────────────────────
// 2. Spec checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Specs --');

const mpSpec = await getAtomSpec('mountain-path');
ok('mountain-path spec exists', Boolean(mpSpec));
ok('mountain-path spec.type correct', mpSpec?.type === 'mountain-path');
ok('mountain-path spec has summit (required)', mpSpec?.args?.summit?.required === true);
ok('mountain-path spec has milestones (required)', mpSpec?.args?.milestones?.required === true);
ok('mountain-path spec has optional title', 'title' in (mpSpec?.args ?? {}));

const smSpec = await getAtomSpec('strategy-map');
ok('strategy-map spec exists', Boolean(smSpec));
ok('strategy-map spec.type correct', smSpec?.type === 'strategy-map');
ok('strategy-map spec has perspectives (required)', smSpec?.args?.perspectives?.required === true);
ok('strategy-map spec has optional title', 'title' in (smSpec?.args ?? {}));

const rcSpec = await getAtomSpec('radar-chart');
ok('radar-chart spec exists', Boolean(rcSpec));
ok('radar-chart spec.type correct', rcSpec?.type === 'radar-chart');
ok('radar-chart spec has axes (required)', rcSpec?.args?.axes?.required === true);
ok('radar-chart spec has series (required)', rcSpec?.args?.series?.required === true);
ok('radar-chart spec has optional showGrid', 'showGrid' in (rcSpec?.args ?? {}));

const okrSpec = await getAtomSpec('okr-tree');
ok('okr-tree spec exists', Boolean(okrSpec));
ok('okr-tree spec.type correct', okrSpec?.type === 'okr-tree');
ok('okr-tree spec has objective (required)', okrSpec?.args?.objective?.required === true);
ok('okr-tree spec has keyResults (required)', okrSpec?.args?.keyResults?.required === true);
ok('okr-tree spec has optional quarter', 'quarter' in (okrSpec?.args ?? {}));

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

// mountain-path — full args
const r1 = renderAtom(
  stubCtx,
  'mountain-path',
  {
    title: 'Q4 Climb to Series A',
    summit: 'Series A · $15M',
    milestones: [
      { label: '$1M ARR', sublabel: 'Mar 2026' },
      { label: '10K users', sublabel: 'Jun 2026' },
      { label: 'PMF validated', sublabel: 'Sep 2026' },
      { label: 'Term sheet', sublabel: 'Dec 2026' },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('mountain-path render returns Promise', r1 instanceof Promise);
await r1;
ok('mountain-path render resolves without throw', true);

// mountain-path — minimal (no title, no sublabels)
const r1b = renderAtom(
  stubCtx,
  'mountain-path',
  {
    summit: 'IPO',
    milestones: [{ label: 'Seed' }, { label: 'Series A' }, { label: 'Series B' }],
  },
  'pseudo3d',
  renderOpts,
);
ok('mountain-path minimal resolves without throw', r1b instanceof Promise);
await r1b;

// mountain-path — empty milestones edge case
const r1c = renderAtom(
  stubCtx,
  'mountain-path',
  { summit: 'Goal', milestones: [] },
  'pseudo3d',
  renderOpts,
);
ok('mountain-path empty milestones resolves without throw', r1c instanceof Promise);
await r1c;

// strategy-map — full 4-perspective
const r2 = renderAtom(
  stubCtx,
  'strategy-map',
  {
    title: 'Strategic Objectives 2026',
    perspectives: [
      { label: 'Financial', items: ['Revenue growth 30%', 'Margin expansion', 'ARR $50M'] },
      { label: 'Customer', items: ['NPS 50+', 'Retention 95%', 'Brand recognition'] },
      { label: 'Internal Process', items: ['Ops efficiency', 'Quality SLA'] },
      { label: 'Learning & Growth', items: ['Top talent', 'Skills roadmap', 'Culture'] },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('strategy-map render returns Promise', r2 instanceof Promise);
await r2;
ok('strategy-map render resolves without throw', true);

// strategy-map — no title, 3 perspectives
const r2b = renderAtom(
  stubCtx,
  'strategy-map',
  {
    perspectives: [
      { label: 'Revenue', items: ['ARR'] },
      { label: 'Users', items: ['DAU', 'NPS'] },
      { label: 'Infra', items: ['Uptime'] },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('strategy-map no-title 3 perspectives resolves without throw', r2b instanceof Promise);
await r2b;

// strategy-map — empty perspectives edge case
const r2c = renderAtom(stubCtx, 'strategy-map', { perspectives: [] }, 'pseudo3d', renderOpts);
ok('strategy-map empty perspectives resolves without throw', r2c instanceof Promise);
await r2c;

// radar-chart — full 2-series
const r3 = renderAtom(
  stubCtx,
  'radar-chart',
  {
    title: 'AI Capability Assessment',
    axes: ['Speed', 'Quality', 'Cost', 'Scalability', 'UX', 'Security'],
    series: [
      { label: 'Current', values: [0.7, 0.4, 0.6, 0.3, 0.8, 0.5] },
      { label: 'Target Q4', values: [0.9, 0.7, 0.8, 0.7, 0.9, 0.8] },
    ],
    showGrid: true,
  },
  'pseudo3d',
  renderOpts,
);
ok('radar-chart render returns Promise', r3 instanceof Promise);
await r3;
ok('radar-chart render resolves without throw', true);

// radar-chart — single series, no grid, no title
const r3b = renderAtom(
  stubCtx,
  'radar-chart',
  {
    axes: ['Design', 'Code', 'Ship'],
    series: [{ label: 'Me', values: [0.9, 0.7, 0.8] }],
    showGrid: false,
  },
  'pseudo3d',
  renderOpts,
);
ok('radar-chart single series no-grid resolves without throw', r3b instanceof Promise);
await r3b;

// okr-tree — full args with quarter
const r4 = renderAtom(
  stubCtx,
  'okr-tree',
  {
    objective: 'Become the market leader in self-custodial trading',
    quarter: 'Q3 2026',
    keyResults: [
      { label: 'Cross $50M ARR', progress: 0.48, sublabel: '$24M / $50M' },
      { label: 'NPS > 70', progress: 0.86, sublabel: 'Current: 68' },
      { label: '24/7 Support SLA', progress: 0.65, sublabel: '4h avg vs 2h target' },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('okr-tree render returns Promise', r4 instanceof Promise);
await r4;
ok('okr-tree render resolves without throw', true);

// okr-tree — no quarter, no sublabels, progress at extremes
const r4b = renderAtom(
  stubCtx,
  'okr-tree',
  {
    objective: 'Ship v1',
    keyResults: [
      { label: 'Feature A', progress: 1.0 },
      { label: 'Feature B', progress: 0.0 },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('okr-tree no-quarter extremes resolves without throw', r4b instanceof Promise);
await r4b;

// okr-tree — empty keyResults edge case
const r4c = renderAtom(
  stubCtx,
  'okr-tree',
  { objective: 'TBD', keyResults: [] },
  'pseudo3d',
  renderOpts,
);
ok('okr-tree empty keyResults resolves without throw', r4c instanceof Promise);
await r4c;

// ──────────────────────────────────────────────────────────────────────────────
// 4. Catalog auto-pickup
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Catalog --');
_resetCatalogCache();
const catalog = await buildAtomCatalogString();
ok('catalog includes mountain-path', catalog.includes('`mountain-path`'));
ok('catalog includes strategy-map', catalog.includes('`strategy-map`'));
ok('catalog includes radar-chart', catalog.includes('`radar-chart`'));
ok('catalog includes okr-tree', catalog.includes('`okr-tree`'));

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
