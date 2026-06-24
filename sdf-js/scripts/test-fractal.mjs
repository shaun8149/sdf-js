// =============================================================================
// L1 unit tests for the fractal toolkit (IQ fractal-rendering articles). Wave 8.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   continuous iteration count  https://iquilezles.org/articles/msetsmooth/
//   Mandelbulb                  https://iquilezles.org/articles/mandelbulb/
//   3D Julia (quaternion)       https://iquilezles.org/articles/juliasets/
//   Menger fractal SDF          https://iquilezles.org/articles/menger/
//   orbit traps                 https://iquilezles.org/articles/orbittraps/
//   (+ Sierpinski IFS folding tetrahedron)
//
// Escape-time fractals: inside-set points never escape (→ maxIter); the SDF
// fractals are distance estimators (finite, positive outside, no NaN).
// =============================================================================

import {
  mandelbrot2,
  julia2,
  mandelbrotTrap,
  mandelbulbDE,
  juliaQuatDE,
  mengerSDF,
  sierpinskiSDF,
  FRACTAL_GLSL,
} from '../src/sdf/fractal.js';

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
const finite = (x) => Number.isFinite(x);

console.log('=== fractal toolkit ===\n');

console.log('Mandelbrot (continuous iteration count)');
{
  ok(mandelbrot2(0, 0, 256) === 256, 'origin is in the set → maxIter');
  ok(mandelbrot2(-0.5, 0, 256) === 256, 'main-cardioid point in set → maxIter');
  const out = mandelbrot2(2, 2, 256);
  ok(out < 256 && finite(out), `far point escapes (smooth count ${out.toFixed(2)})`);
  ok(mandelbrot2(2, 2, 256) === mandelbrot2(2, 2, 256), 'deterministic');
}

console.log('\n2D Julia');
{
  const inSet = julia2(0, 0, -0.8, 0.156, 256);
  const outSet = julia2(2, 2, -0.8, 0.156, 256);
  ok(finite(inSet) && finite(outSet), 'julia2 finite');
  ok(outSet < inSet, 'far point escapes sooner than near-origin');
}

console.log('\nMandelbrot orbit trap');
{
  const t = mandelbrotTrap(-0.75, 0.1, 64);
  ok(finite(t) && t >= 0, 'orbit trap distance ≥ 0, finite');
  ok(mandelbrotTrap(-0.75, 0.1, 64) === mandelbrotTrap(-0.75, 0.1, 64), 'deterministic');
}

console.log('\nMandelbulb distance estimator');
{
  const far = mandelbulbDE(3, 0, 0, 8, 8);
  ok(finite(far) && far > 0, `far point → positive finite DE (${far.toFixed(3)})`);
  ok(finite(mandelbulbDE(0, 0, 0, 8, 8)), 'origin DE finite (no NaN/Inf)');
  ok(mandelbulbDE(1.1, 0.3, 0.2, 8, 8) === mandelbulbDE(1.1, 0.3, 0.2, 8, 8), 'deterministic');
}

console.log('\nQuaternion Julia distance estimator');
{
  const far = juliaQuatDE(3, 0, 0, [-0.2, 0.6, 0.2, 0.2], 10);
  ok(finite(far) && far > 0, `far point → positive finite DE (${far.toFixed(3)})`);
  ok(finite(juliaQuatDE(0, 0, 0, [-0.2, 0.6, 0.2, 0.2], 10)), 'origin DE finite');
}

console.log('\nMenger sponge SDF');
{
  ok(mengerSDF(0, 0, 0, 3) > 0, 'center is carved out (hole) → outside');
  ok(mengerSDF(0.5, 0.5, 0.5, 3) < 0, 'corner block is solid → inside');
  ok(mengerSDF(5, 5, 5, 3) > 0, 'far outside the unit box → outside');
}

console.log('\nSierpinski (IFS folding tetrahedron) SDF');
{
  ok(finite(sierpinskiSDF(0, 0, 0, 6)), 'near origin finite (no NaN/Inf)');
  ok(sierpinskiSDF(5, 5, 5, 6) > 0, 'far point outside');
  ok(sierpinskiSDF(0.1, 0.1, 0.1, 6) === sierpinskiSDF(0.1, 0.1, 0.1, 6), 'deterministic');
}

console.log('\nGLSL mirror present');
ok(typeof FRACTAL_GLSL === 'string' && FRACTAL_GLSL.length > 400, 'FRACTAL_GLSL exported');
for (const fn of ['mandelbrot2', 'mandelbulbDE', 'juliaQuatDE', 'mengerSDF', 'sierpinskiSDF']) {
  ok(FRACTAL_GLSL.includes(fn), `FRACTAL_GLSL defines ${fn}`);
}
ok(
  FRACTAL_GLSL.includes('bool escaped = false') &&
    FRACTAL_GLSL.includes('if (!escaped) return float(maxIter);'),
  'GLSL mandelbrot2 treats capped, non-escaped orbits as inside (no NaN smoothing)',
);

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
