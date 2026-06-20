// =============================================================================
// L1 unit tests for the math / rotation toolkit (IQ "useful maths" articles).
// Wave 10 of the IQ-shader program.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   quaternions             https://iquilezles.org/articles/quaternions/
//   Fourier series          https://iquilezles.org/articles/fourier/
//   distance to triangle    https://iquilezles.org/articles/triangledistance/
//   area of a triangle      https://iquilezles.org/articles/trianglearea/
//   normals/areas polygons  https://iquilezles.org/articles/polygonnormals/
//   patched sphere          https://iquilezles.org/articles/patchedsphere/
// =============================================================================

import {
  qFromAxisAngle,
  qMul,
  qConj,
  qRotate,
  fourierSquare,
  triangleArea,
  polygonAreaNormal,
  distToTriangle,
  sphereUV,
  MATHX_GLSL,
} from '../src/sdf/mathx.js';

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
const near = (a, b, eps = 1e-4) => Math.abs(a - b) < eps;
const inRange = (v, lo, hi) => v >= lo - 1e-9 && v <= hi + 1e-9;

console.log('=== math / rotation toolkit ===\n');

console.log('quaternions');
{
  const q = qFromAxisAngle([0, 0, 1], Math.PI / 2); // 90° about +Z
  const r = qRotate(q, [1, 0, 0]);
  ok(near(r[0], 0) && near(r[1], 1) && near(r[2], 0), '90° about Z maps +X → +Y');
  const r2 = qRotate(qFromAxisAngle([1, 0, 0], Math.PI / 2), [0, 1, 0]);
  ok(near(r2[0], 0) && near(r2[1], 0) && near(r2[2], 1), '90° about X maps +Y → +Z');
  // identity quaternion leaves vectors unchanged
  const id = [0, 0, 0, 1];
  const ri = qRotate(id, [0.3, 0.5, 0.7]);
  ok(near(ri[0], 0.3) && near(ri[1], 0.5) && near(ri[2], 0.7), 'identity quaternion = no rotation');
  // q * conj(q) = identity (w=1, xyz=0)
  const p = qMul(q, qConj(q));
  ok(near(p[0], 0) && near(p[1], 0) && near(p[2], 0) && near(p[3], 1), 'q·conj(q) = identity');
  // composing two 45° Z rotations == one 90°
  const h = qFromAxisAngle([0, 0, 1], Math.PI / 4);
  const hh = qMul(h, h);
  const rc = qRotate(hh, [1, 0, 0]);
  ok(near(rc[0], 0, 1e-4) && near(rc[1], 1, 1e-4), 'two 45° rotations compose to 90°');
}

console.log('\nFourier square wave');
{
  const coarse = fourierSquare(0.25, 3);
  const fine = fourierSquare(0.25, 80);
  ok(Math.abs(fine - 1) < Math.abs(coarse - 1), 'more terms → closer to +1 on the plateau');
  ok(near(fourierSquare(0.25, 200), 1, 0.02), 'converges to +1 at x=0.25');
  ok(near(fourierSquare(0.75, 200), -1, 0.02), 'converges to −1 at x=0.75');
}

console.log('\ntriangle area + polygon normal/area');
{
  ok(near(triangleArea([0, 0, 0], [1, 0, 0], [0, 1, 0]), 0.5), 'unit right triangle area = 0.5');
  const sq = polygonAreaNormal([
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
  ]);
  ok(near(sq.area, 1), 'unit square polygon area = 1');
  ok(
    near(Math.abs(sq.normal[2]), 1) && near(sq.normal[0], 0) && near(sq.normal[1], 0),
    'XY square normal is ±Z',
  );
}

console.log('\npoint-to-triangle distance');
{
  const a = [0, 0, 0],
    b = [1, 0, 0],
    c = [0, 1, 0];
  ok(near(distToTriangle([0.3, 0.3, 1], a, b, c), 1), 'point 1 above interior → distance 1');
  ok(near(distToTriangle([0.25, 0.25, 0], a, b, c), 0), 'point on the triangle → 0');
  ok(distToTriangle([5, 5, 0], a, b, c) > 1, 'far in-plane point → large distance');
}

console.log('\nsphere UV (patched / equirectangular)');
{
  for (const d of [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ]) {
    const uv = sphereUV(d);
    ok(inRange(uv[0], 0, 1) && inRange(uv[1], 0, 1), `sphereUV(${d}) in [0,1]²`);
  }
  ok(sphereUV([1, 0, 0])[0] === sphereUV([1, 0, 0])[0], 'deterministic');
}

console.log('\nGLSL mirror present');
ok(typeof MATHX_GLSL === 'string' && MATHX_GLSL.length > 300, 'MATHX_GLSL exported');
for (const fn of ['qMul', 'qRotate', 'fourierSquare', 'triangleArea', 'distToTriangle']) {
  ok(MATHX_GLSL.includes(fn), `MATHX_GLSL defines ${fn}`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
