// =============================================================================
// test-slide-to-2d-code.mjs — smoke test for the SlideData → 2D code emitter
// -----------------------------------------------------------------------------
// This test replaces the deleted test-slide-mapper.mjs. New architecture:
// emitter produces 2D JS code (consumed by compositor's silhouette renderer
// and by callLiftLLM); no direct 3D mapping anymore.
// =============================================================================

import { emitSlide2dCode } from '../src/mapping/slide-to-2d-code.js';
import { emptySlideData } from '../src/parser/slidedata.js';
import vm from 'node:vm';

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

/**
 * Verify the emitted code2d is syntactically valid JS. We can't fully execute
 * it in Node (it does `document.getElementById('c')`), but we can parse it as
 * a module via Node's vm to catch syntax errors.
 */
function isParseable(code2d) {
  // Strip ES-module imports (single- and multi-line) since vm.Script can't
  // handle them — we only want syntactic validation of the rest of the body.
  // Also stub `document` since the emitted tail does document.getElementById.
  const stripped = code2d.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?$/gm, '/* import */');
  try {
    new vm.Script(
      `(async () => { const document = { getElementById: () => ({ getContext: () => ({}) }) }; ${stripped} })()`,
    );
    return true;
  } catch (e) {
    console.log(`    parse error: ${e.message}`);
    return false;
  }
}

console.log('=== slide-to-2d-code smoke test ===\n');

// -----------------------------------------------------------------------------
console.log('Test group 1: percent-list (10 fill levels — test-deck slide 18)');
const slide18 = emptySlideData(18, 'pdf');
slide18.title = '3D SPHERES';
slide18.pageSize = { width: 959.76, height: 540 };
slide18.body = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v, i) => ({
  kind: 'paragraph',
  text: String(v),
  level: 0,
  bbox: { x: 125 + (i % 5) * 169, y: i < 5 ? 188 : 430, w: 30, h: 28 },
  fontSize: 28.1,
  fontFamily: null,
}));

const r18 = emitSlide2dCode(slide18);
ok(r18.pattern === 'percent-list', `detected percent-list (got ${r18.pattern})`);
ok(r18.code2d.includes('rectangle('), 'code uses rectangle primitive for bars');
ok(r18.code2d.includes('text2dSDF'), 'code uses text2dSDF for labels');
ok(r18.code2d.includes('render.silhouette'), 'code calls render.silhouette');
ok(r18.code2d.includes('PRESENTATION SCENE'), 'header carries semantic hint to lift LLM');
ok(r18.prompt.includes('10 percentage'), 'prompt mentions 10 percent values');
ok(isParseable(r18.code2d), 'percent-list code2d parses as valid JS');

// -----------------------------------------------------------------------------
console.log('\nTest group 2: kpi-feature (single big % — test-deck slide 12)');
const slideKpi = emptySlideData(12, 'pdf');
slideKpi.title = '2D SPHERES';
slideKpi.pageSize = { width: 959.76, height: 540 };
slideKpi.body = [
  {
    kind: 'paragraph',
    text: 'FILL LEVELS',
    bbox: { x: 245, y: 30, w: 200, h: 36 },
    fontSize: 36.0,
    level: 0,
    fontFamily: null,
  },
  {
    kind: 'paragraph',
    text: '90',
    bbox: { x: 450, y: 230, w: 100, h: 80 },
    fontSize: 80.0,
    level: 0,
    fontFamily: null,
  },
  {
    kind: 'paragraph',
    text: 'Description 1',
    bbox: { x: 100, y: 412, w: 200, h: 16 },
    fontSize: 15.9,
    level: 0,
    fontFamily: null,
  },
];

const rKpi = emitSlide2dCode(slideKpi);
ok(rKpi.pattern === 'kpi-feature', `detected kpi-feature (got ${rKpi.pattern})`);
ok(rKpi.code2d.includes("text: '90%'"), 'big value rendered as text2dSDF "90%"');
ok(rKpi.prompt.includes('90%'), 'prompt mentions 90%');
ok(isParseable(rKpi.code2d), 'kpi-feature code2d parses as valid JS');

// -----------------------------------------------------------------------------
console.log('\nTest group 3: cover (title + subtitle)');
const slideCover = emptySlideData(0, 'pdf');
slideCover.title = 'My Deck Title';
slideCover.layout = 'cover';
slideCover.body = [
  {
    kind: 'paragraph',
    text: 'A subheadline',
    bbox: { x: 100, y: 200, w: 200, h: 24 },
    fontSize: 22,
    level: 0,
    fontFamily: null,
  },
];
slideCover.pageSize = { width: 960, height: 540 };

const rCover = emitSlide2dCode(slideCover);
ok(rCover.pattern === 'cover', `detected cover (got ${rCover.pattern})`);
ok(rCover.code2d.includes('My Deck Title'), 'title in code');
ok(rCover.code2d.includes('A subheadline'), 'subtitle in code');
ok(isParseable(rCover.code2d), 'cover code2d parses as valid JS');

// -----------------------------------------------------------------------------
console.log('\nTest group 4: fallback (no clues)');
const slideFb = emptySlideData(5, 'pdf');
slideFb.title = null;
slideFb.body = [];
slideFb.pageSize = { width: 960, height: 540 };

const rFb = emitSlide2dCode(slideFb);
ok(rFb.pattern === 'fallback', `falls back (got ${rFb.pattern})`);
ok(rFb.code2d.includes('(untitled)'), 'fallback uses "(untitled)" placeholder');
ok(isParseable(rFb.code2d), 'fallback code2d parses as valid JS');

// -----------------------------------------------------------------------------
console.log('\nTest group 5: special-char escaping (apostrophe in title)');
const slideEsc = emptySlideData(7, 'pdf');
slideEsc.title = "We're #1";
slideEsc.layout = 'cover';
slideEsc.body = [];
slideEsc.pageSize = { width: 960, height: 540 };

const rEsc = emitSlide2dCode(slideEsc);
ok(rEsc.code2d.includes("\\'"), 'apostrophe escaped in emitted string');
ok(isParseable(rEsc.code2d), 'escaped string parses correctly');

// -----------------------------------------------------------------------------
console.log('\nTest group 6: priority — percent-list beats cover when both detected');
const slideBoth = emptySlideData(2, 'pdf');
slideBoth.title = 'Some Title';
slideBoth.layout = 'cover';
slideBoth.body = [
  {
    kind: 'paragraph',
    text: '50',
    bbox: { x: 100, y: 200, w: 30, h: 28 },
    fontSize: 28,
    level: 0,
    fontFamily: null,
  },
  {
    kind: 'paragraph',
    text: '75',
    bbox: { x: 200, y: 200, w: 30, h: 28 },
    fontSize: 28,
    level: 0,
    fontFamily: null,
  },
  {
    kind: 'paragraph',
    text: '90',
    bbox: { x: 300, y: 200, w: 30, h: 28 },
    fontSize: 28,
    level: 0,
    fontFamily: null,
  },
];
slideBoth.pageSize = { width: 960, height: 540 };
const rBoth = emitSlide2dCode(slideBoth);
ok(rBoth.pattern === 'percent-list', `chose percent-list over cover (got ${rBoth.pattern})`);

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
