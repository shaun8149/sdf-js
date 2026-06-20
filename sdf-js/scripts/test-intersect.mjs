// =============================================================================
// L1 unit tests for the intersector / sphere-math toolkit (IQ articles). Wave 7.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   ray-surface intersectors   https://iquilezles.org/articles/intersectors/
//   sphere density             https://iquilezles.org/articles/spheredensity/
//   inverse bilinear           https://iquilezles.org/articles/ibilinear/
//
// Analytic intersectors are exact → tested against known ray/geometry setups.
// =============================================================================

import {
  iSphere,
  iBox,
  iPlane,
  iTriangle,
  sphereDensity,
  invBilinear,
  INTERSECT_GLSL,
} from '../src/sdf/intersect.js';

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
const near = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;

console.log('=== intersector / sphere-math toolkit ===\n');

console.log('ray-sphere');
{
  ok(near(iSphere([0, 0, -5], [0, 0, 1], [0, 0, 0], 1), 4), 'hits front surface at t=4');
  ok(iSphere([3, 0, -5], [0, 0, 1], [0, 0, 0], 1) < 0, 'offset ray misses (<0)');
}

console.log('\nray-box');
{
  const hit = iBox([0, 0, -5], [0, 0, 1], [0, 0, 0], [1, 1, 1]);
  ok(hit && near(hit[0], 4), 'enters box front face at t=4');
  ok(hit && near(hit[1], 6), 'exits box back face at t=6');
  ok(iBox([5, 0, -5], [0, 0, 1], [0, 0, 0], [1, 1, 1]) === null, 'offset ray misses box');
}

console.log('\nray-plane');
{
  // plane y=0 (normal +Y, offset 0); ray from above going down → hits at t=2
  ok(near(iPlane([0, 2, 0], [0, -1, 0], [0, 1, 0], 0), 2), 'hits ground plane at t=2');
}

console.log('\nray-triangle (Möller–Trumbore)');
{
  const v0 = [-1, -1, 0],
    v1 = [1, -1, 0],
    v2 = [0, 1, 0];
  ok(near(iTriangle([0, 0, -1], [0, 0, 1], v0, v1, v2), 1), 'ray through interior hits at t=1');
  ok(iTriangle([3, 3, -1], [0, 0, 1], v0, v1, v2) < 0, 'ray outside triangle misses');
}

console.log('\nsphere density');
{
  const thru = sphereDensity([0, 0, -5], [0, 0, 1], [0, 0, 0], 1, 1e9);
  const miss = sphereDensity([3, 0, -5], [0, 0, 1], [0, 0, 0], 1, 1e9);
  ok(thru > 0.9, 'ray through centre → high density');
  ok(near(miss, 0), 'missing ray → zero density');
  const grazing = sphereDensity([0.9, 0, -5], [0, 0, 1], [0, 0, 0], 1, 1e9);
  ok(grazing < thru && grazing > 0, 'grazing ray → partial density');
}

console.log('\ninverse bilinear (round-trip)');
{
  const a = [0, 0],
    b = [2, 0.2],
    c = [2.3, 1.8],
    d = [0.1, 2];
  const fwd = (u, v) => [
    a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v + (a[0] - b[0] + c[0] - d[0]) * u * v,
    a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v + (a[1] - b[1] + c[1] - d[1]) * u * v,
  ];
  for (const [u, v] of [
    [0.3, 0.7],
    [0.8, 0.2],
    [0.5, 0.5],
  ]) {
    const p = fwd(u, v);
    const uv = invBilinear(p, a, b, c, d);
    ok(near(uv[0], u, 2e-3) && near(uv[1], v, 2e-3), `invBilinear round-trip (${u},${v})`);
  }
}

console.log('\nGLSL mirror present');
ok(typeof INTERSECT_GLSL === 'string' && INTERSECT_GLSL.length > 300, 'INTERSECT_GLSL exported');
for (const fn of ['iSphere', 'iBox', 'iPlane', 'iTriangle', 'sphereDensity', 'invBilinear']) {
  ok(INTERSECT_GLSL.includes(fn), `INTERSECT_GLSL defines ${fn}`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
