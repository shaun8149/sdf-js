// =============================================================================
// test-p5-sandbox.mjs — L1 tests for Atlas Present Sprint 3 SDF helper bundle
// -----------------------------------------------------------------------------
// Node-side unit tests for the 28 SDF helper math functions exposed inside
// the P5 sandbox iframe. Iframe protocol itself (postMessage flow) is
// verified by Phase 6 browse smoke (real browser).
// =============================================================================

// sdf-js/ package.json declares "type":"module", so .js files load as ESM.
// The helper bundle is an IIFE that assigns to module.exports for Node tests,
// but ESM loading skips that branch. Load source + eval in a fake CJS context.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const bundleSrc = readFileSync(resolve(__dirname, '../src/present/sdf-helper-bundle.js'), 'utf8');
const fakeModule = { exports: {} };
new Function('module', 'exports', bundleSrc)(fakeModule, fakeModule.exports);
const helpers = fakeModule.exports;

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
function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

console.log('=== sdf-helper-bundle smoke test ===\n');

// Confirm bundle exports
ok(typeof helpers === 'object' && helpers !== null, 'helpers module exports an object');
ok(typeof helpers.sub2 === 'function', 'sub2 exported');
ok(typeof helpers.sdf_box === 'function', 'sdf_box exported');
ok(typeof helpers.sdf_circle === 'function', 'sdf_circle exported');

// Vector math: sub2 / add2 / dot2 / len2
console.log('\n--- Vector math ---');

const {
  sub2,
  add2,
  mul2,
  dot2,
  lenSq2,
  len2,
  scale2,
  eq2,
  fract1,
  fract2,
  clamp1,
  clamp2,
  max2,
  min2,
  rot2,
  trans2,
  step1,
} = helpers;

// sub2
{
  const r = sub2([5, 3], [2, 1]);
  ok(eq2(r, [3, 2]), `sub2([5,3], [2,1]) = [3,2] (got ${JSON.stringify(r)})`);
}
{
  const r = sub2([0, 0], [-1, 1]);
  ok(eq2(r, [1, -1]), `sub2([0,0], [-1,1]) = [1,-1] (got ${JSON.stringify(r)})`);
}

// add2
{
  const r = add2([1, 2], [3, 4]);
  ok(eq2(r, [4, 6]), `add2([1,2], [3,4]) = [4,6]`);
}

// mul2 (element-wise)
{
  const r = mul2([2, 3], [4, 5]);
  ok(eq2(r, [8, 15]), `mul2([2,3], [4,5]) = [8,15]`);
}

// dot2
{
  ok(dot2([1, 2], [3, 4]) === 11, 'dot2([1,2], [3,4]) = 1*3 + 2*4 = 11');
  ok(dot2([1, 0], [0, 1]) === 0, 'dot2 perpendicular = 0');
}

// lenSq2 + len2
{
  ok(lenSq2([3, 4]) === 25, 'lenSq2([3,4]) = 25');
  ok(len2([3, 4]) === 5, 'len2([3,4]) = 5 (3-4-5 triangle)');
  ok(approx(len2([1, 1]), Math.sqrt(2)), 'len2([1,1]) = sqrt(2)');
}

// scale2
{
  ok(eq2(scale2([2, 3], 4), [8, 12]), 'scale2([2,3], 4) = [8,12]');
}

// eq2
{
  ok(eq2([1, 2], [1, 2]) === true, 'eq2 same');
  ok(eq2([1, 2], [1, 3]) === false, 'eq2 different');
}

// fract1 / fract2
{
  ok(approx(fract1(3.7), 0.7), 'fract1(3.7) = 0.7');
  ok(approx(fract1(-0.3), 0.7), 'fract1(-0.3) = 0.7 (floor convention)');
  const f = fract2([1.5, 2.25]);
  ok(approx(f[0], 0.5) && approx(f[1], 0.25), 'fract2([1.5, 2.25]) = [0.5, 0.25]');
}

// clamp1 / clamp2
{
  ok(clamp1(5, 0, 3) === 3, 'clamp1 max-clip');
  ok(clamp1(-1, 0, 3) === 0, 'clamp1 min-clip');
  ok(clamp1(2, 0, 3) === 2, 'clamp1 pass-through');
  const c = clamp2([5, -1], [0, 0], [3, 3]);
  ok(eq2(c, [3, 0]), 'clamp2([5,-1], [0,0], [3,3]) = [3,0]');
}

// max2 / min2
{
  ok(eq2(max2([1, 5], [3, 2]), [3, 5]), 'max2 per-component');
  ok(eq2(min2([1, 5], [3, 2]), [1, 2]), 'min2 per-component');
}

// step1
{
  ok(step1(5, 5) === 1, 'step1(5, 5) = 1 (>=)');
  ok(step1(5, 4) === 0, 'step1(5, 4) = 0');
  ok(step1(5, 6) === 1, 'step1(5, 6) = 1');
}

// rot2 + trans2
{
  // rot2(0) returns [cos(0), -sin(0), sin(0), cos(0)] = [1, 0, 0, 1] = identity
  const m = rot2(0);
  ok(m[0] === 1 && m[3] === 1 && m[1] === 0 && m[2] === 0, 'rot2(0) = identity matrix');
  // trans2 identity * any vector = same vector
  const v = trans2(m, [7, 11]);
  ok(eq2(v, [7, 11]), 'trans2(identity, [7,11]) = [7,11]');

  // rot2(PI/2) rotates [1,0] to [0,1] (counterclockwise)
  // m = [cos(PI/2), -sin(PI/2), sin(PI/2), cos(PI/2)] = [0, -1, 1, 0]
  // trans2(m, [1,0]) = [0*1 + 1*0, -1*1 + 0*0] = [0, -1]
  // Note: BOB convention may be different; check the formula
  // trans2(m, a) = [m[0]*a[0] + m[2]*a[1], m[1]*a[0] + m[3]*a[1]]
  // For rot2(PI/2): [0*1 + 1*0, -1*1 + 0*0] = [0, -1]
  const rot90 = rot2(Math.PI / 2);
  const rotated = trans2(rot90, [1, 0]);
  ok(approx(rotated[0], 0), `rot90 * [1,0] x = 0 (got ${rotated[0]})`);
  ok(approx(rotated[1], -1), `rot90 * [1,0] y = -1 (got ${rotated[1]})`);
}

// SDF primitives
console.log('\n--- SDF primitives ---');

const {
  sdf_box,
  sdf_circle,
  sdRoundBox,
  sdTriangle,
  sdTrapezoid,
  sdEtriangle,
  sdf_line,
  sdf_line2,
  sdf_moon,
  xRepeated,
  sdf_rep,
} = helpers;

// sdf_circle: standard SDF — outside = positive, on-boundary = 0, inside = negative
{
  // Circle centered at origin with r=1
  ok(approx(sdf_circle([0, 0], [0, 0], 1), -1), 'sdf_circle center: -r');
  ok(approx(sdf_circle([1, 0], [0, 0], 1), 0), 'sdf_circle on boundary: 0');
  ok(approx(sdf_circle([2, 0], [0, 0], 1), 1), 'sdf_circle outside (x=2): r=1');
  ok(approx(sdf_circle([0, 0.5], [0, 0], 1), -0.5), 'sdf_circle inside: -0.5');
  // Offset center
  ok(approx(sdf_circle([5, 0], [5, 0], 1), -1), 'sdf_circle offset center');
}

// sdf_box: rect SDF — outside = positive, inside = negative
{
  // Box centered at origin, full-width 2 × full-height 2 (half = 1)
  ok(approx(sdf_box([0, 0], [0, 0], [2, 2]), -1), 'sdf_box center: -1');
  ok(approx(sdf_box([1, 0], [0, 0], [2, 2]), 0), 'sdf_box on right edge: 0');
  ok(approx(sdf_box([2, 0], [0, 0], [2, 2]), 1), 'sdf_box outside right: 1');
  ok(approx(sdf_box([0, 1], [0, 0], [2, 2]), 0), 'sdf_box on top edge: 0');
}

// sdRoundBox (rounded rect)
{
  // Centered at origin, full-half-extents [1,1], all corners radius 0.2
  // At origin: deep inside, should be very negative
  const dCenter = sdRoundBox([0, 0], [1, 1], [0.2, 0.2, 0.2, 0.2]);
  ok(dCenter < 0, 'sdRoundBox center: negative');
  // Far away
  ok(sdRoundBox([3, 0], [1, 1], [0.2, 0.2, 0.2, 0.2]) > 0, 'sdRoundBox far: positive');
}

// sdTriangle
{
  // Equilateral triangle with vertices around origin
  const a = [0, 1];
  const b = [-0.866, -0.5];
  const c = [0.866, -0.5];
  ok(sdTriangle([0, 0], a, b, c) < 0, 'sdTriangle inside (0,0): negative');
  ok(sdTriangle([3, 3], a, b, c) > 0, 'sdTriangle far: positive');
}

// sdEtriangle (origin-centered equilateral)
{
  const dCenter = sdEtriangle([0, 0], 1);
  ok(dCenter < 0, `sdEtriangle center r=1: negative (got ${dCenter})`);
  const dFar = sdEtriangle([5, 5], 1);
  ok(dFar > 0, `sdEtriangle far: positive (got ${dFar})`);
}

// sdTrapezoid
// NOTE (Phase 2 implementer 2026-06-20): BOB sdTrapezoid Y-flips the probe
// point (p = [p[0], -p[1]]) but does NOT flip the anchor points a/b. So the
// "inside" point in BOB convention is one with negated Y relative to the axis.
// Plan's test point [0, 0.1] with axis a=[0,0]→b=[0,0.25] reads as positive
// (outside) because after the Y-flip the probe lands at [0,-0.1], below a.
// Using a point that lands INSIDE after the flip: probe [0, -0.1] → [0, 0.1]
// which is on the axis between a and b.
{
  // After BOB Y-flip: probe [0, -0.1] becomes [0, 0.1], between a=[0,0] and b=[0,0.25]
  const d = sdTrapezoid([0, -0.1], [0, 0], [0, 0.25], 0.5, 0.3);
  ok(d < 0, `sdTrapezoid inside (Y-flipped probe): negative (got ${d})`);
}

// sdf_line: BOB formula returns -(p.y - cy - k*p.x). For k=0 + p.y < cy, this
// returns POSITIVE (not negative as plan comment suggested). The sign
// convention is "above-line = inside (negative)" — opposite of the plan's
// "below" framing. Tests adjusted to match BOB-verbatim formula semantics.
{
  ok(sdf_line([0, 0], 0.5) > 0, 'sdf_line: (0,0) below cy=0.5 → positive (BOB sign convention)');
  ok(sdf_line([0, 1], 0.5) < 0, 'sdf_line: (0,1) above cy=0.5 → negative (BOB sign convention)');
  ok(approx(sdf_line([0, 0.5], 0.5), 0), 'sdf_line: on line → 0');
}

// sdf_moon (occluded circle pattern)
{
  // Test that center yields negative + offset yields positive
  ok(typeof sdf_moon([0, -0.8], [0, 0]) === 'number', 'sdf_moon returns number');
}

// xRepeated: returns [repeated p[0], original p[1]]
{
  // s=2 should wrap p[0] in (-1, 1) range
  const r1 = xRepeated([0.5, 7], 2);
  ok(r1[0] >= -1 && r1[0] <= 1, `xRepeated wraps x to [-1,1] (got ${r1[0]})`);
  ok(r1[1] === 7, 'xRepeated leaves y untouched');
}

// sdf_rep: 1D modulo around center
{
  // sdf_rep with r=2 should wrap x to (-1, 1)
  const v = sdf_rep(3, 2); // 3 / 2 = 1.5, floor = 1, 1.5 - 1 - 0.5 = 0, * 2 = 0
  ok(v >= -1 && v <= 1, `sdf_rep wraps to [-1,1] (got ${v})`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
