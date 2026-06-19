// =============================================================================
// test-text-3d-pipe.mjs — L1 unit tests for Wave 1-pipe glyph SDFs
// =============================================================================

import '../src/sdf/index.js';
import {
  buildPipeGlyph,
  supportedPipeChars,
  pipeArcSpan,
} from '../src/scene/components/typography/glyphs-pipe.js';

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

console.log('=== text-3d-pipe smoke test ===\n');

console.log('Test group 1: pipeArcSpan helper');
// Full ring: a0=0, a1=2π → halfAp=π, mid=π → should approximate a full torus
const fullRing = pipeArcSpan(0, 0, 0.3, 0, 2 * Math.PI, 0.05);
ok(Number.isFinite(fullRing([0.3, 0, 0])), 'full-ring SDF finite at ring point');
ok(fullRing([0.3, 0, 0]) < 0, 'full-ring point on tube is inside');
ok(fullRing([0, 0, 0]) > 0, 'full-ring center (hole) is outside');

// Half ring opening down (a0=0, a1=π): arc covers upper half (y > 0)
const upperHalf = pipeArcSpan(0, 0, 0.3, 0, Math.PI, 0.05);
ok(upperHalf([0, 0.3, 0]) < 0, 'upper-half ring includes +Y point (inside)');
// Lower half should be FAR from arc (well past pipeRadius)
ok(upperHalf([0, -0.3, 0]) > 0.1, 'upper-half ring excludes -Y point (outside)');

console.log('\nTest group 2: Group A glyphs (sphere/capsule/torus only)');

// Each Group A glyph builds + has positive advance + has SDF (except space)
for (const ch of ['0', '1', '.', '-', '+', ' ']) {
  const g = buildPipeGlyph(ch);
  ok(g !== null, `'${ch}' builds`);
  ok(g.advance > 0, `'${ch}' positive advance (${g.advance})`);
  if (ch === ' ') {
    ok(g.sdf === null, `'${ch}' (space) has null SDF`);
    continue;
  }
  ok(g.sdf !== null, `'${ch}' has non-null SDF`);
  ok(Number.isFinite(g.sdf([0, 0.5, 0])), `'${ch}' SDF probe at (0,0.5,0) finite`);
}

// "0" specific probes
const zero = buildPipeGlyph('0', 0.06);
ok(zero.sdf([0, 0.5, 0]) > 0.1, '"0" center is hollow with margin > pipeRadius');
ok(zero.sdf([0.22, 0.5, 0]) < 0, '"0" on tube circle (+X side) is inside');
ok(zero.sdf([0, 0.72, 0]) < 0, '"0" on tube circle (+Y side, top of ring) is inside');
ok(zero.sdf([0, 0.5, 0.1]) > 0, '"0" 0.10 outside tube in Z direction is outside');

// "1" specific probes
const one = buildPipeGlyph('1', 0.06);
ok(one.sdf([0, 0.5, 0]) < 0, '"1" middle of vertical stem is inside');
ok(one.sdf([0, 0.0, 0]) < 0, '"1" baseline end (round cap) is inside');
ok(one.sdf([0, 1.0, 0]) < 0, '"1" top end (round cap) is inside');
ok(one.sdf([0.2, 0.5, 0]) > 0.1, '"1" 0.2 to the side is outside (no flag/serif in pipe)');

// "+" specific probes (2 capsules crossing at y=0.5)
const plus = buildPipeGlyph('+', 0.06);
ok(plus.sdf([0, 0.5, 0]) < 0, '"+" center is inside (both strokes overlap)');
ok(plus.sdf([0.2, 0.5, 0]) < 0, '"+" right end of horizontal stroke is inside');
ok(plus.sdf([0, 0.7, 0]) < 0, '"+" top end of vertical stroke is inside');

console.log('\nTest group 3: Group B glyphs (arc-based: 2 3 5 $)');

for (const ch of ['2', '3', '5', '$']) {
  const g = buildPipeGlyph(ch);
  ok(g !== null, `'${ch}' builds`);
  ok(g.advance > 0, `'${ch}' positive advance`);
  ok(g.sdf !== null, `'${ch}' has SDF`);
  ok(Number.isFinite(g.sdf([0, 0.5, 0])), `'${ch}' SDF probe finite`);
}

// "3" — two arcs opening LEFT (midpoint on RIGHT side):
// Top arc center (0, 0.75) radius 0.22, span (-π/2, +π/2) → +X midpoint
const three = buildPipeGlyph('3', 0.06);
// Probe on top-right arc rim (+X side of top arc center)
ok(three.sdf([0.22, 0.75, 0]) < 0, '"3" top arc right side (+X) is inside');
// Probe on LEFT of top arc (should be OUTSIDE because arc opens left)
ok(three.sdf([-0.22, 0.75, 0]) > 0.05, '"3" top arc LEFT side is outside (opening)');

// "$" — central vertical bar should be present
const dollar = buildPipeGlyph('$', 0.06);
ok(dollar.sdf([0, 0.5, 0]) < 0, '"$" central bar at midline is inside');
ok(dollar.sdf([0, 1.05, 0]) < 0, '"$" bar extends above cap (y=1.1) — probe at 1.05');
ok(dollar.sdf([0, -0.05, 0]) < 0, '"$" bar extends below baseline (y=-0.1) — probe at -0.05');

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
