// =============================================================================
// L1 unit tests for the noise toolkit (IQ procedural-noise articles). Wave 2 of
// the IQ-shader program.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   - value/gradient noise derivatives  https://iquilezles.org/articles/morenoise/
//                                        https://iquilezles.org/articles/gradientnoise/
//   - fbm (with derivatives)            https://iquilezles.org/articles/fbm/
//   - domain warping                    https://iquilezles.org/articles/warp/
//   - voronoise                         https://iquilezles.org/articles/voronoise/
//   - smooth voronoi                    https://iquilezles.org/articles/smoothvoronoi/
//   - voronoi edges                     https://iquilezles.org/articles/voronoilines/
//
// Key correctness test for the *derivative*-returning functions: the analytic
// gradient must match a central finite-difference of the value channel.
// =============================================================================

import {
  valueNoise2,
  valueNoise3,
  valueNoiseD2,
  valueNoiseD3,
  gradientNoiseD2,
  fbmD2,
  domainWarp2,
  voronoise2,
  voronoiSmooth2,
  voronoiEdges2,
  NOISE_GLSL,
} from '../src/sdf/noise.js';

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
const inRange = (v, lo, hi) => v >= lo - 1e-6 && v <= hi + 1e-6;

// Central finite-difference gradient of a scalar field f(x,y[,z]).
function fdGrad2(f, x, y, h = 1e-4) {
  return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
}
function fdGrad3(f, x, y, z, h = 1e-4) {
  return [
    (f(x + h, y, z) - f(x - h, y, z)) / (2 * h),
    (f(x, y + h, z) - f(x, y - h, z)) / (2 * h),
    (f(x, y, z + h) - f(x, y, z - h)) / (2 * h),
  ];
}

console.log('=== noise toolkit ===\n');

console.log('determinism + range');
ok(valueNoise2(1.3, 2.7) === valueNoise2(1.3, 2.7), 'valueNoise2 deterministic');
ok(valueNoise3(1.3, 2.7, 0.5) === valueNoise3(1.3, 2.7, 0.5), 'valueNoise3 deterministic');
{
  let mn = Infinity,
    mx = -Infinity;
  for (let i = 0; i < 400; i++) {
    const v = valueNoise2(i * 0.37, i * 0.91);
    mn = Math.min(mn, v);
    mx = Math.max(mx, v);
  }
  ok(
    inRange(mn, 0, 1) && inRange(mx, 0, 1) && mx - mn > 0.4,
    `valueNoise2 in [0,1], varied (${mn.toFixed(2)}..${mx.toFixed(2)})`,
  );
}

console.log('\nvalue noise + analytic derivative ≈ finite difference');
for (const [x, y] of [
  [0.3, 1.7],
  [2.1, 0.4],
  [5.6, 3.2],
]) {
  const r = valueNoiseD2(x, y); // [v, dx, dy]
  const fd = fdGrad2((a, b) => valueNoiseD2(a, b)[0], x, y);
  ok(near(r[1], fd[0], 2e-3) && near(r[2], fd[1], 2e-3), `valueNoiseD2 grad ≈ FD at (${x},${y})`);
}
for (const [x, y, z] of [
  [0.3, 1.7, 0.9],
  [2.1, 0.4, 3.3],
]) {
  const r = valueNoiseD3(x, y, z); // [v, dx, dy, dz]
  const fd = fdGrad3((a, b, c) => valueNoiseD3(a, b, c)[0], x, y, z);
  ok(
    near(r[1], fd[0], 2e-3) && near(r[2], fd[1], 2e-3) && near(r[3], fd[2], 2e-3),
    `valueNoiseD3 grad ≈ FD at (${x},${y},${z})`,
  );
}

console.log('\ngradient noise + analytic derivative ≈ finite difference');
for (const [x, y] of [
  [0.35, 1.2],
  [3.8, 2.6],
]) {
  const r = gradientNoiseD2(x, y); // [v, dx, dy]
  const fd = fdGrad2((a, b) => gradientNoiseD2(a, b)[0], x, y);
  ok(
    near(r[1], fd[0], 3e-3) && near(r[2], fd[1], 3e-3),
    `gradientNoiseD2 grad ≈ FD at (${x},${y})`,
  );
}
// gradient noise is signed, ~[-1,1] and ~0-mean
ok(inRange(gradientNoiseD2(1.1, 2.2)[0], -1, 1), 'gradientNoiseD2 value in [-1,1]');

console.log('\nfbm with derivatives');
{
  const r = fbmD2(1.7, 0.9, 5); // [v, dx, dy]
  const fd = fdGrad2((a, b) => fbmD2(a, b, 5)[0], 1.7, 0.9);
  ok(near(r[1], fd[0], 5e-3) && near(r[2], fd[1], 5e-3), 'fbmD2 accumulated grad ≈ FD');
  ok(fbmD2(1.7, 0.9, 5)[0] === fbmD2(1.7, 0.9, 5)[0], 'fbmD2 deterministic');
}

console.log('\ndomain warping');
ok(domainWarp2(2.1, 3.4) === domainWarp2(2.1, 3.4), 'domainWarp2 deterministic');
{
  let mn = Infinity,
    mx = -Infinity;
  for (let i = 0; i < 300; i++) {
    const v = domainWarp2(i * 0.41, i * 0.77);
    mn = Math.min(mn, v);
    mx = Math.max(mx, v);
  }
  ok(inRange(mn, 0, 1) && inRange(mx, 0, 1) && mx - mn > 0.3, `domainWarp2 in [0,1], varied`);
}

console.log('\nvoronoise / smooth voronoi / voronoi edges');
ok(inRange(voronoise2(1.5, 2.5, 1, 1), 0, 1), 'voronoise2 (u=v=1) in [0,1]');
ok(inRange(voronoise2(1.5, 2.5, 0, 0), 0, 1), 'voronoise2 (u=v=0) in [0,1]');
ok(voronoise2(1.5, 2.5, 1, 0) === voronoise2(1.5, 2.5, 1, 0), 'voronoise2 deterministic');
ok(voronoiSmooth2(3.3, 1.1, 0.5) >= 0, 'voronoiSmooth2 returns non-negative distance');
{
  const e = voronoiEdges2(2.2, 4.4); // [cellDist, edgeDist]
  ok(e[0] >= 0 && e[1] >= 0, 'voronoiEdges2 distances non-negative');
  // edge distance should approach 0 somewhere near a border; sample a grid
  let minEdge = Infinity;
  for (let i = 0; i < 60; i++)
    for (let j = 0; j < 60; j++) minEdge = Math.min(minEdge, voronoiEdges2(i * 0.13, j * 0.13)[1]);
  ok(minEdge < 0.05, `voronoiEdges2 edge≈0 near borders (min ${minEdge.toFixed(3)})`);
}

console.log('\nGLSL mirror present');
ok(typeof NOISE_GLSL === 'string' && NOISE_GLSL.length > 400, 'NOISE_GLSL exported');
for (const fn of [
  'valueNoiseD3',
  'gradientNoiseD2',
  'voronoise2',
  'voronoiEdges2',
  'domainWarp2',
]) {
  ok(NOISE_GLSL.includes(fn), `NOISE_GLSL defines ${fn}`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
