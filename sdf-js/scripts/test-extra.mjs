// =============================================================================
// L1 unit tests for the W11 cleanup toolkit (deferred IQ items). Final wave of
// the IQ-shader program.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   distance to ellipse        https://iquilezles.org/articles/ellipsedist/
//   directional derivative     https://iquilezles.org/articles/derivative/
//   (generic SDF AO; box hard shadow via the W7 box intersector)
//   Lyapunov exponent (logistic map) https://iquilezles.org/articles/lyapunov/
//
// Explicitly OUT OF SCOPE as pure functions (accumulation-buffer / depth-buffer
// renderer techniques, not library helpers): SSAO, Budhabrot, popcorn, bitmap
// orbit traps, IFS point clouds, full analytic box/multires AO.
// =============================================================================

import {
  distToEllipse,
  directionalDerivative,
  sdfAO,
  boxShadow,
  lyapunovLogistic,
  EXTRA_GLSL,
} from '../src/sdf/extra.js';

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
const near = (a, b, eps = 5e-3) => Math.abs(a - b) < eps;

console.log('=== W11 cleanup toolkit ===\n');

console.log('exact ellipse distance');
{
  const ab = [2, 1];
  ok(near(distToEllipse(2, 0, ab[0], ab[1]), 0), 'point on ellipse (major axis) → 0');
  ok(near(distToEllipse(0, 1, ab[0], ab[1]), 0), 'point on ellipse (minor axis) → 0');
  ok(near(distToEllipse(3, 0, ab[0], ab[1]), 1, 0.02), 'point outside on major axis → ≈1');
  ok(distToEllipse(0, 0, ab[0], ab[1]) < 0, 'centre is inside (negative)');
  ok(distToEllipse(4, 4, ab[0], ab[1]) > 0, 'far point outside (positive)');
}

console.log('\ndirectional derivative of an SDF');
{
  const sphere = (p) => Math.hypot(p[0], p[1], p[2]) - 1; // unit sphere SDF
  ok(
    near(directionalDerivative(sphere, [2, 0, 0], [1, 0, 0]), 1, 1e-2),
    'radial dir → +1 (distance grows)',
  );
  ok(near(directionalDerivative(sphere, [2, 0, 0], [0, 1, 0]), 0, 1e-2), 'tangential dir → ~0');
}

console.log('\ngeneric SDF ambient occlusion');
{
  // ground plane y=0 with a small sphere bump just above it
  const scene = (p) => Math.min(p[1], Math.hypot(p[0], p[1] - 0.3, p[2]) - 0.25);
  const aoUnder = sdfAO(scene, [0, 0, 0], [0, 1, 0]); // directly under the bump
  const aoFar = sdfAO(scene, [3, 0, 0], [0, 1, 0]); // open ground
  ok(aoUnder < aoFar, 'point under an occluder is darker than open ground');
  ok(aoFar > 0.9, 'open ground ≈ unoccluded');
  ok(aoUnder >= 0 && aoUnder <= 1, 'AO in [0,1]');
}

console.log('\nbox hard shadow (via intersector)');
{
  ok(
    boxShadow([0, 0, -5], [0, 0, 1], [0, 0, 0], [1, 1, 1], 100) === 0,
    'ray toward box → shadowed',
  );
  ok(boxShadow([0, 0, -5], [0, 0, -1], [0, 0, 0], [1, 1, 1], 100) === 1, 'ray away from box → lit');
}

console.log('\nLyapunov exponent (logistic map)');
{
  const chaotic = lyapunovLogistic(3.9, 500);
  const stable = lyapunovLogistic(2.5, 500);
  ok(chaotic > 0, 'r=3.9 (chaos) → positive Lyapunov exponent');
  ok(stable < 0, 'r=2.5 (stable fixed point) → negative exponent');
}

console.log('\nGLSL mirror present');
ok(typeof EXTRA_GLSL === 'string' && EXTRA_GLSL.length > 150, 'EXTRA_GLSL exported');
for (const fn of ['distToEllipse', 'boxShadow']) {
  ok(EXTRA_GLSL.includes(fn), `EXTRA_GLSL defines ${fn}`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
