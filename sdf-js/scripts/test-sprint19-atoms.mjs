#!/usr/bin/env node
// Smoke test for Sprint 19 Batch 1 atoms: quote-pull, swot, value-chain-diagram, change-curve-chart
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

// Minimal Canvas2D context mock (same pattern as test-atoms-image.mjs)
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

console.log('=== Sprint 19 Batch 1 atom smoke ===');

// ──────────────────────────────────────────────────────────────────────────────
// 1. Registration checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Registration --');
ok('quote-pull registered', isAtom2DType('quote-pull'));
ok('swot registered', isAtom2DType('swot'));
ok('value-chain-diagram registered', isAtom2DType('value-chain-diagram'));
ok('change-curve-chart registered', isAtom2DType('change-curve-chart'));

// ──────────────────────────────────────────────────────────────────────────────
// 2. Spec checks
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Specs --');

const qpSpec = await getAtomSpec('quote-pull');
ok('quote-pull spec exists', Boolean(qpSpec));
ok('quote-pull spec.type correct', qpSpec?.type === 'quote-pull');
ok('quote-pull spec has required quote arg', qpSpec?.args?.quote?.required === true);
ok('quote-pull spec has author arg', 'author' in (qpSpec?.args ?? {}));
ok('quote-pull spec has attribution arg', 'attribution' in (qpSpec?.args ?? {}));
ok('quote-pull spec has align arg', 'align' in (qpSpec?.args ?? {}));

const swotSpec = await getAtomSpec('swot');
ok('swot spec exists', Boolean(swotSpec));
ok('swot spec.type correct', swotSpec?.type === 'swot');
ok('swot spec has strengths (required)', swotSpec?.args?.strengths?.required === true);
ok('swot spec has weaknesses (required)', swotSpec?.args?.weaknesses?.required === true);
ok('swot spec has opportunities (required)', swotSpec?.args?.opportunities?.required === true);
ok('swot spec has threats (required)', swotSpec?.args?.threats?.required === true);

const vcSpec = await getAtomSpec('value-chain-diagram');
ok('value-chain-diagram spec exists', Boolean(vcSpec));
ok('value-chain-diagram spec.type correct', vcSpec?.type === 'value-chain-diagram');
ok('value-chain-diagram spec has primary (required)', vcSpec?.args?.primary?.required === true);
ok('value-chain-diagram spec has support (required)', vcSpec?.args?.support?.required === true);

const ccSpec = await getAtomSpec('change-curve-chart');
ok('change-curve-chart spec exists', Boolean(ccSpec));
ok('change-curve-chart spec.type correct', ccSpec?.type === 'change-curve-chart');
ok('change-curve-chart spec has phases (required)', ccSpec?.args?.phases?.required === true);

// ──────────────────────────────────────────────────────────────────────────────
// 3. Render checks — no throw
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Render (no-throw) --');

const palette = {
  bg: [248, 246, 240],
  silhouetteColor: [30, 27, 30],
  accent: [60, 100, 200],
  colors: [[60, 100, 200]],
};
const renderOpts = { x: 0, y: 0, w: 720, h: 380, palette };

const r1 = renderAtom(
  stubCtx,
  'quote-pull',
  {
    quote: 'Culture eats strategy for breakfast.',
    author: 'Peter Drucker',
    attribution: 'Management Consultant',
  },
  'pseudo3d',
  renderOpts,
);
ok('quote-pull render returns Promise', r1 instanceof Promise);
await r1;
ok('quote-pull render resolves without throw', true);

const r2 = renderAtom(
  stubCtx,
  'swot',
  {
    title: 'SWOT Analysis',
    strengths: ['Strong brand', 'High retention'],
    weaknesses: ['Limited distribution'],
    opportunities: ['New market entry'],
    threats: ['Well-funded competitor'],
  },
  'pseudo3d',
  renderOpts,
);
ok('swot render returns Promise', r2 instanceof Promise);
await r2;
ok('swot render resolves without throw', true);

const r3 = renderAtom(
  stubCtx,
  'value-chain-diagram',
  {
    title: 'Value Chain',
    primary: ['Inbound Logistics', 'Operations', 'Outbound', 'Marketing', 'Service'],
    support: ['Firm Infrastructure', 'HR Management', 'Technology'],
    outcome: 'Margin',
  },
  'pseudo3d',
  renderOpts,
);
ok('value-chain-diagram render returns Promise', r3 instanceof Promise);
await r3;
ok('value-chain-diagram render resolves without throw', true);

const r4 = renderAtom(
  stubCtx,
  'change-curve-chart',
  {
    title: 'Change Adoption Curve',
    xAxis: 'Time',
    yAxis: 'Morale',
    phases: [
      { label: 'Shock' },
      { label: 'Denial' },
      { label: 'Anger' },
      { label: 'Depression' },
      { label: 'Acceptance' },
      { label: 'Integration' },
    ],
  },
  'pseudo3d',
  renderOpts,
);
ok('change-curve-chart render returns Promise', r4 instanceof Promise);
await r4;
ok('change-curve-chart render resolves without throw', true);

// ──────────────────────────────────────────────────────────────────────────────
// 4. Catalog auto-pickup
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n-- Catalog --');
_resetCatalogCache();
const catalog = await buildAtomCatalogString();
ok('catalog includes quote-pull', catalog.includes('`quote-pull`'));
ok('catalog includes swot', catalog.includes('`swot`'));
ok('catalog includes value-chain-diagram', catalog.includes('`value-chain-diagram`'));
ok('catalog includes change-curve-chart', catalog.includes('`change-curve-chart`'));

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
