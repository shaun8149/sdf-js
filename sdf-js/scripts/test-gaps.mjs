// =============================================================================
// L1 unit tests for the W13 gap-fill toolkit (deferred ★★★ IQ items).
// -----------------------------------------------------------------------------
// Recipe-only ports / applications of Inigo Quilez:
//   2D bounding boxes        https://iquilezles.org/articles/diskbbox/
//   multi-resolution AO      https://iquilezles.org/articles/multiresaocc/
//   distance to implicits    https://iquilezles.org/articles/distance/
//   box occlusion (approx)   https://iquilezles.org/articles/boxocclusion/
//   simple global illum.     https://iquilezles.org/articles/simplegi/
// =============================================================================

import {
  bbox2FromSDF,
  multiresAO,
  approxDistImplicit,
  boxAO,
  simpleGI,
  GAPS_GLSL,
} from '../src/sdf/gaps.js';

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

console.log('=== W13 gap-fill toolkit ===\n');

console.log('2D bbox from SDF');
{
  const circle = (p) => Math.hypot(p[0], p[1]) - 1; // unit circle
  const bb = bbox2FromSDF(circle, { radius: 3, res: 48 });
  ok(near(bb.min[0], -1) && near(bb.max[0], 1), 'unit circle x-extent ≈ ±1');
  ok(near(bb.min[1], -1) && near(bb.max[1], 1), 'unit circle y-extent ≈ ±1');
  ok(near(bb.center[0], 0) && near(bb.size[0], 2), 'centre 0, size ≈ 2');
}

console.log('\nmulti-resolution SDF AO');
{
  const scene = (p) => Math.min(p[1], Math.hypot(p[0], p[1] - 0.3, p[2]) - 0.25);
  const under = multiresAO(scene, [0, 0, 0], [0, 1, 0]);
  const open = multiresAO(scene, [3, 0, 0], [0, 1, 0]);
  ok(under < open, 'point under an occluder is darker');
  ok(open > 0.9, 'open ground ≈ unoccluded');
  ok(under >= 0 && under <= 1, 'AO in [0,1]');
}

console.log('\napprox distance to implicit (Lipschitz)');
{
  ok(near(approxDistImplicit(2, 4), 0.5, 1e-9), 'value/|grad| = 2/4 = 0.5');
  ok(approxDistImplicit(1, 0) > 1e5, 'zero gradient → huge (guarded, finite)');
  ok(Number.isFinite(approxDistImplicit(1, 0)), 'guarded result is finite');
}

console.log('\nbox AO (bounding-sphere approximation)');
{
  const pos = [0, 0, 0],
    n = [0, 0, 1];
  const aoNear = boxAO(pos, n, [0, 0, 1.3], [0.5, 0.5, 0.5]);
  const aoFar = boxAO(pos, n, [0, 0, 20], [0.5, 0.5, 0.5]);
  ok(aoNear < aoFar, 'near box occludes more than far');
  ok(aoFar > 0.97, 'distant box ≈ unoccluded');
  ok(near(boxAO(pos, n, [0, 0, -2], [0.5, 0.5, 0.5]), 1, 1e-3), 'box behind → no occlusion');
}

console.log('\nsimple GI (hemispheric sky/ground)');
{
  const sky = [0.4, 0.6, 1.0],
    ground = [0.3, 0.25, 0.2];
  const up = simpleGI([0, 1, 0], sky, ground, 1);
  const down = simpleGI([0, -1, 0], sky, ground, 1);
  ok(near(up[2], sky[2]) && up[2] > down[2], 'up-facing picks up sky (more blue)');
  ok(near(down[0], ground[0]), 'down-facing picks up ground bounce');
  const dim = simpleGI([0, 1, 0], sky, ground, 0.5);
  ok(dim[2] < up[2], 'AO scales the GI down');
}

console.log('\nGLSL mirror present');
ok(typeof GAPS_GLSL === 'string' && GAPS_GLSL.length > 150, 'GAPS_GLSL exported');
for (const fn of ['boxAO', 'simpleGI', 'approxDistImplicit']) {
  ok(GAPS_GLSL.includes(fn), `GAPS_GLSL defines ${fn}`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
