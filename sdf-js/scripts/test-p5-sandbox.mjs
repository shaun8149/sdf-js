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

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
