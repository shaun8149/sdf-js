// =============================================================================
// L1 unit tests for the bounds / auto-framing toolkit (IQ bounding articles).
// Wave 6 of the IQ-shader program.
// -----------------------------------------------------------------------------
// Recipe-only ports / applications of Inigo Quilez:
//   3D / 2D bounding boxes   https://iquilezles.org/articles/diskbbox/ (family)
//   sphere projection        https://iquilezles.org/articles/sphereproj/
//   SDF bounding volumes     https://iquilezles.org/articles/sdfbounding/
//   L∞-norm SDFs             https://iquilezles.org/articles/distfunctions2dlinf/
//
// Headline: bbox(SDF) → camera-fit, so any atom/deck auto-frames (no more
// hand-scaling subjects to suit a fixed studio camera).
// =============================================================================

import {
  bbox3FromSDF,
  cameraFitFromBBox,
  sphereProjRadius,
  boundedSDF,
  sdBoxLinf,
  BOUNDS_GLSL,
} from '../src/sdf/bounds.js';

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
const near = (a, b, eps = 0.2) => Math.abs(a - b) < eps;

// Test SDFs (p = [x,y,z]).
const sphere =
  (r, c = [0, 0, 0]) =>
  (p) =>
    Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r;
const box =
  (b, c = [0, 0, 0]) =>
  (p) => {
    const q = [
      Math.abs(p[0] - c[0]) - b[0],
      Math.abs(p[1] - c[1]) - b[1],
      Math.abs(p[2] - c[2]) - b[2],
    ];
    const o = Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0));
    return o + Math.min(Math.max(q[0], q[1], q[2]), 0);
  };

console.log('=== bounds / auto-framing toolkit ===\n');

console.log('bbox3FromSDF');
{
  const bb = bbox3FromSDF(sphere(1), { radius: 3, res: 48 });
  ok(
    near(bb.min[0], -1) && near(bb.max[0], 1),
    `unit sphere x-extent ≈ ±1 (${bb.min[0].toFixed(2)}..${bb.max[0].toFixed(2)})`,
  );
  ok(near(bb.min[1], -1) && near(bb.max[1], 1), 'unit sphere y-extent ≈ ±1');
  ok(near(bb.min[2], -1) && near(bb.max[2], 1), 'unit sphere z-extent ≈ ±1');
}
{
  const bb = bbox3FromSDF(box([0.5, 0.8, 0.3], [1, 0, 0]), { radius: 3, res: 48 });
  ok(
    near(bb.center[0], 1) && near(bb.center[1], 0) && near(bb.center[2], 0),
    'translated box center ≈ [1,0,0]',
  );
  ok(
    near(bb.size[0], 1.0) && near(bb.size[1], 1.6) && near(bb.size[2], 0.6),
    `box size ≈ [1,1.6,0.6]`,
  );
}

console.log('\ncameraFitFromBBox');
{
  const small = cameraFitFromBBox([-1, -1, -1], [1, 1, 1], 1.0);
  const big = cameraFitFromBBox([-3, -3, -3], [3, 3, 3], 1.0);
  ok(near(small.target[0], 0) && near(small.target[1], 0), 'camera target = bbox center');
  ok(big.distance > small.distance, 'bigger bbox → larger fit distance');
  ok(near(big.distance / small.distance, 3, 0.2), 'fit distance scales with bbox size');
  const wider = cameraFitFromBBox([-1, -1, -1], [1, 1, 1], 0.5); // narrower FOV
  ok(wider.distance > small.distance, 'narrower FOV → larger fit distance');
}

console.log('\nsphereProjRadius');
{
  const close = sphereProjRadius(3, 1, 1.5);
  const far = sphereProjRadius(10, 1, 1.5);
  ok(close > far, 'closer sphere projects larger');
  ok(close > 0 && far > 0, 'projected radius positive');
}

console.log('\nboundedSDF (bounding-volume acceleration)');
{
  const bmin = [-1.5, -1.5, -1.5],
    bmax = [1.5, 1.5, 1.5];
  const f = boundedSDF(sphere(1), bmin, bmax);
  ok(near(f([0, 0, 0]), sphere(1)([0, 0, 0]), 1e-9), 'inside bbox → exact SDF');
  const farP = [5, 0, 0];
  ok(f(farP) <= sphere(1)(farP) + 1e-9, 'outside bbox → conservative lower bound (≤ true SDF)');
  ok(f(farP) > 0, 'outside bbox → positive distance');
}

console.log('\nL∞ box (Chebyshev)');
{
  ok(sdBoxLinf(0, 0, 0, 1, 1, 1) < 0, 'center inside');
  ok(near(sdBoxLinf(1, 1, 1, 1, 1, 1), 0, 1e-9), 'corner on surface');
  ok(sdBoxLinf(2, 0, 0, 1, 1, 1) > 0, 'outside positive');
}

console.log('\nGLSL mirror present');
ok(typeof BOUNDS_GLSL === 'string' && BOUNDS_GLSL.length > 100, 'BOUNDS_GLSL exported');
for (const fn of ['sphereProjRadius', 'sdBoxLinf', 'sdBoundingBox']) {
  ok(BOUNDS_GLSL.includes(fn), `BOUNDS_GLSL defines ${fn}`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
