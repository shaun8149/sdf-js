#!/usr/bin/env node
// Smoke test for image + image-split atoms (Sprint 18 Tier 3 C).
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

console.log('=== atoms-image smoke ===');

// Registration
ok('image atom registered', isAtom2DType('image'));
ok('image-split atom registered', isAtom2DType('image-split'));

// Specs
const imgSpec = await getAtomSpec('image');
const splitSpec = await getAtomSpec('image-split');

ok('image spec has src as required', imgSpec.args.src?.required === true);
ok('image spec has fit arg', imgSpec.args.fit?.type?.includes('cover'));
ok('image spec has caption arg', 'caption' in imgSpec.args);
ok('image spec has borderRadius arg', 'borderRadius' in imgSpec.args);

ok('image-split spec has src as required', splitSpec.args.src?.required === true);
ok('image-split spec has title as required', splitSpec.args.title?.required === true);
ok('image-split spec has bullets arg', 'bullets' in splitSpec.args);
ok('image-split spec has imageSide arg', 'imageSide' in splitSpec.args);

// Catalog auto-pickup
_resetCatalogCache();
const catalog = await buildAtomCatalogString();
ok('atom catalog includes image entry', catalog.includes('`image`'));
ok('atom catalog includes image-split entry', catalog.includes('`image-split`'));
ok('atom catalog has media category', catalog.includes('### media'));

// Node-env render: doesn't throw, returns promise that resolves
const stubCtx = {
  save() {},
  restore() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  quadraticCurveTo() {},
  closePath() {},
  clip() {},
  fillRect() {},
  fillText() {},
  measureText() {
    return { width: 50 };
  },
  drawImage() {},
  createLinearGradient() {
    return { addColorStop() {} };
  },
  arc() {},
  fill() {},
  set fillStyle(_v) {},
  set font(_v) {},
  set textAlign(_v) {},
  set textBaseline(_v) {},
};

const r1 = renderAtom(
  stubCtx,
  'image',
  { src: 'https://picsum.photos/seed/test/640/360' },
  'pseudo3d',
  { x: 0, y: 0, w: 640, h: 360 },
);
ok('image render returns a Promise', r1 instanceof Promise);
await r1;
ok('image render resolves (Node placeholder path)', true);

const r2 = renderAtom(
  stubCtx,
  'image-split',
  {
    src: 'https://picsum.photos/seed/test/640/360',
    title: 'Hello',
    body: 'Test body',
    bullets: ['one', 'two'],
  },
  'pseudo3d',
  { x: 0, y: 0, w: 1280, h: 480, palette: { accent: [60, 100, 200] } },
);
ok('image-split render returns a Promise', r2 instanceof Promise);
await r2;
ok('image-split render resolves (Node placeholder path)', true);

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
