// =============================================================================
// L1 unit tests for the SDF-with-gradient toolkit (IQ sdg articles). Wave 5 of
// the IQ-shader program.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   2D SDFs and gradients  https://iquilezles.org/articles/distgradfunctions2d/
//   3D SDFs and gradients  https://iquilezles.org/articles/distgradfunctions/
//
// Each sdg* returns [distance, ...gradient]. A true signed-distance field has a
// UNIT gradient that points away from the surface, so the two invariants are:
//   (1) the gradient ≈ central finite-difference of the distance channel
//   (2) |gradient| ≈ 1 (away from the medial axis / surface)
// =============================================================================

import {
  sdgCircle,
  sdgBox,
  sdgSegment,
  sdgSphere,
  sdgBox3,
  sdgTorus,
  SDG_GLSL,
} from '../src/sdf/sdg.js';

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
const near = (a, b, eps = 3e-3) => Math.abs(a - b) < eps;
const len2 = (x, y) => Math.hypot(x, y);
const len3 = (x, y, z) => Math.hypot(x, y, z);

// Finite-difference gradient of the distance channel (index 0) of an sdg fn.
function fd2(f, px, py, h = 1e-4) {
  return [
    (f(px + h, py)[0] - f(px - h, py)[0]) / (2 * h),
    (f(px, py + h)[0] - f(px, py - h)[0]) / (2 * h),
  ];
}
function fd3(f, px, py, pz, h = 1e-4) {
  return [
    (f(px + h, py, pz)[0] - f(px - h, py, pz)[0]) / (2 * h),
    (f(px, py + h, pz)[0] - f(px, py - h, pz)[0]) / (2 * h),
    (f(px, py, pz + h)[0] - f(px, py, pz - h)[0]) / (2 * h),
  ];
}

console.log('=== SDF + gradient toolkit ===\n');

console.log('2D circle');
{
  const f = (x, y) => sdgCircle(x, y, 1);
  ok(f(2, 0)[0] > 0 && f(0, 0)[0] < 0, 'circle distance sign (outside>0, center<0)');
  for (const [x, y] of [
    [2, 0],
    [1.5, 1.5],
    [-2, 1],
  ]) {
    const g = f(x, y);
    const d = fd2(f, x, y);
    ok(near(g[1], d[0]) && near(g[2], d[1]), `sdgCircle grad ≈ FD at (${x},${y})`);
    ok(near(len2(g[1], g[2]), 1, 1e-3), `sdgCircle |grad| ≈ 1 at (${x},${y})`);
  }
}

console.log('\n2D box');
{
  const f = (x, y) => sdgBox(x, y, 1, 0.6);
  ok(f(3, 0)[0] > 0 && f(0, 0)[0] < 0, 'box distance sign');
  for (const [x, y] of [
    [2, 0],
    [1.4, 1.1],
    [-2, -1.5],
  ]) {
    const g = f(x, y);
    const d = fd2(f, x, y);
    ok(near(g[1], d[0]) && near(g[2], d[1]), `sdgBox grad ≈ FD at (${x},${y})`);
    ok(near(len2(g[1], g[2]), 1, 1e-3), `sdgBox |grad| ≈ 1 at (${x},${y})`);
  }
}

console.log('\n2D segment');
{
  const f = (x, y) => sdgSegment(x, y, -1, 0, 1, 0);
  for (const [x, y] of [
    [0, 1],
    [1.5, 0.5],
    [-1.5, -0.7],
  ]) {
    const g = f(x, y);
    const d = fd2(f, x, y);
    ok(near(g[1], d[0]) && near(g[2], d[1]), `sdgSegment grad ≈ FD at (${x},${y})`);
    ok(near(len2(g[1], g[2]), 1, 1e-3), `sdgSegment |grad| ≈ 1 at (${x},${y})`);
  }
}

console.log('\n3D sphere');
{
  const f = (x, y, z) => sdgSphere(x, y, z, 1);
  ok(f(2, 0, 0)[0] > 0 && f(0, 0, 0)[0] < 0, 'sphere distance sign');
  for (const [x, y, z] of [
    [2, 0, 0],
    [1, 1, 1],
    [-1.5, 0.5, 1],
  ]) {
    const g = f(x, y, z);
    const d = fd3(f, x, y, z);
    ok(
      near(g[1], d[0]) && near(g[2], d[1]) && near(g[3], d[2]),
      `sdgSphere grad ≈ FD at (${x},${y},${z})`,
    );
    ok(near(len3(g[1], g[2], g[3]), 1, 1e-3), `sdgSphere |grad| ≈ 1`);
  }
}

console.log('\n3D box');
{
  const f = (x, y, z) => sdgBox3(x, y, z, 1, 0.7, 0.5);
  ok(f(3, 0, 0)[0] > 0 && f(0, 0, 0)[0] < 0, 'box3 distance sign');
  for (const [x, y, z] of [
    [2, 0, 0],
    [1.4, 1.1, 0.9],
    [-2, -1.5, 1.2],
  ]) {
    const g = f(x, y, z);
    const d = fd3(f, x, y, z);
    ok(
      near(g[1], d[0]) && near(g[2], d[1]) && near(g[3], d[2]),
      `sdgBox3 grad ≈ FD at (${x},${y},${z})`,
    );
    ok(near(len3(g[1], g[2], g[3]), 1, 1e-3), `sdgBox3 |grad| ≈ 1`);
  }
}

console.log('\n3D torus');
{
  const f = (x, y, z) => sdgTorus(x, y, z, 1, 0.3);
  for (const [x, y, z] of [
    [2, 0, 0],
    [1.2, 0.4, 0.3],
    [0, 0.6, 1.3],
  ]) {
    const g = f(x, y, z);
    const d = fd3(f, x, y, z);
    ok(
      near(g[1], d[0]) && near(g[2], d[1]) && near(g[3], d[2]),
      `sdgTorus grad ≈ FD at (${x},${y},${z})`,
    );
    ok(near(len3(g[1], g[2], g[3]), 1, 1e-3), `sdgTorus |grad| ≈ 1`);
  }
}

console.log('\nGLSL mirror present');
ok(typeof SDG_GLSL === 'string' && SDG_GLSL.length > 300, 'SDG_GLSL exported');
for (const fn of ['sdgCircle', 'sdgBox', 'sdgSegment', 'sdgSphere', 'sdgTorus']) {
  ok(SDG_GLSL.includes(fn), `SDG_GLSL defines ${fn}`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
