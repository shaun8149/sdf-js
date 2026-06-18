// =============================================================================
// test-slide-mapper.mjs — smoke test for M1.5 SlideData → SceneData mapper
// =============================================================================

import { mapSlideToScene } from '../src/mapping/slide-to-scene.js';
import { emptySlideData } from '../src/parser/slidedata.js';
import { compile } from '../src/scene/compile.js';

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

console.log('=== slide-to-scene mapper smoke test ===\n');

// -----------------------------------------------------------------------------
// Test group 1: Percent-list pattern (slide 18 of test deck)
// -----------------------------------------------------------------------------
console.log('Test group 1: percent-list pattern');
const slide18 = emptySlideData(17, 'pdf');
slide18.title = '3D SPHERES';
slide18.pageSize = { width: 959.76, height: 540 };
slide18.body = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v, i) => ({
  kind: 'paragraph',
  text: String(v),
  level: 0,
  bbox: {
    x: 125 + (i % 5) * 169,
    y: i < 5 ? 188 : 430,
    w: 30,
    h: 28,
  },
  fontSize: 28.1,
  fontFamily: null,
}));

const { scene: scene18, pattern: pat18, confidence: conf18 } = mapSlideToScene(slide18);
ok(pat18 === 'percent-list', `detected percent-list (got ${pat18}, conf=${conf18.toFixed(2)})`);
ok(scene18.subjects.length === 2, '2 subjects (bar-3d + cover stage)');
const bar = scene18.subjects.find((s) => s.type === 'bar-3d');
ok(bar !== undefined, 'has bar-3d subject');
ok(bar.args.values.length === 10, `10 values (got ${bar.args.values.length})`);
ok(
  Math.abs(bar.args.values[0] - 0.1) < 1e-9 && Math.abs(bar.args.values[9] - 1.0) < 1e-9,
  `values normalized 0.1..1.0 (got [${bar.args.values.slice(0, 3).join(', ')}, ..., ${bar.args.values.slice(-1)}])`,
);

// -----------------------------------------------------------------------------
// Test group 2: Cover pattern (title-only slide)
// -----------------------------------------------------------------------------
console.log('\nTest group 2: cover pattern');
const slideCover = emptySlideData(0, 'pdf');
slideCover.title = 'My Deck Title';
slideCover.layout = 'cover';
slideCover.body = [
  {
    kind: 'paragraph',
    text: 'A subheadline',
    level: 0,
    bbox: { x: 100, y: 200, w: 200, h: 24 },
    fontSize: 22,
    fontFamily: null,
  },
];
slideCover.pageSize = { width: 960, height: 540 };

const { scene: sceneCover, pattern: patCover } = mapSlideToScene(slideCover);
ok(patCover === 'cover', `detected cover (got ${patCover})`);
ok(sceneCover.subjects[0].type === 'cover-3d', 'cover-3d subject');
ok(sceneCover.subjects[0].args.title === 'My Deck Title', 'title passed through');
ok(sceneCover.subjects[0].args.subtitle === 'A subheadline', 'subtitle extracted');

// -----------------------------------------------------------------------------
// Test group 3: Fallback for unrecognized slide
// -----------------------------------------------------------------------------
console.log('\nTest group 3: fallback');
const slideUnknown = emptySlideData(5, 'pdf');
slideUnknown.title = null;
slideUnknown.body = []; // no clues
slideUnknown.pageSize = { width: 960, height: 540 };

const { pattern: patFb } = mapSlideToScene(slideUnknown);
ok(patFb === 'fallback', `fallback pattern (got ${patFb})`);

// -----------------------------------------------------------------------------
// Test group 4: Scene end-to-end compiles
// -----------------------------------------------------------------------------
console.log('\nTest group 4: mapped scene compiles');
const compiled18 = compile(scene18);
ok(compiled18.sdf !== undefined, 'percent-list scene compiles to SDF');
// Bar centers for 10 values (barWidth 0.4, gap 0.15, pitch 0.55, total 5.5):
// x = -2.475, -1.925, -1.375, -0.825, -0.275, +0.275, +0.825, +1.375, +1.925, +2.475
// Bar 5 (val 0.5) at x = -0.275, height 1.25. Probe at y=0.3 → inside.
ok(compiled18.sdf.f([-0.275, 0.3, 0]) < 0, 'SDF inside bar 5 (x=-0.275, y=0.3) returns negative');

const compiledCover = compile(sceneCover);
ok(compiledCover.sdf !== undefined, 'cover scene compiles to SDF');

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
