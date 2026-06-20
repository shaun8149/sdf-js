// =============================================================================
// L1 unit tests for the procedural-effects toolkit (IQ "simple oldschool
// effects" articles). Wave 9 of the IQ-shader program.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   2D dynamic clouds   https://iquilezles.org/articles/dynclouds/
//   plane deformations  https://iquilezles.org/articles/deform/
//   feedback effect     https://iquilezles.org/articles/feedbackeffect/
//   Game of Life        https://iquilezles.org/articles/gameoflife/
// =============================================================================

import {
  clouds2D,
  planeDeformPolar,
  planeDeformTwist,
  feedbackBlend,
  lifeRule,
  lifeStep,
  EFFECTS_GLSL,
} from '../src/sdf/effects.js';

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
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const inRange = (v, lo, hi) => v >= lo - 1e-9 && v <= hi + 1e-9;

console.log('=== procedural-effects toolkit ===\n');

console.log('2D dynamic clouds');
{
  ok(clouds2D(1.3, 2.7, 0) === clouds2D(1.3, 2.7, 0), 'deterministic for fixed (x,y,t)');
  let mn = Infinity,
    mx = -Infinity;
  for (let i = 0; i < 300; i++) {
    const v = clouds2D(i * 0.31, i * 0.57, 0);
    mn = Math.min(mn, v);
    mx = Math.max(mx, v);
  }
  ok(
    inRange(mn, 0, 1) && inRange(mx, 0, 1) && mx - mn > 0.3,
    `clouds in [0,1], varied (${mn.toFixed(2)}..${mx.toFixed(2)})`,
  );
  ok(clouds2D(1.3, 2.7, 0) !== clouds2D(1.3, 2.7, 5), 'animates with time');
}

console.log('\nplane deformations');
{
  ok(planeDeformPolar(1, 0).every(Number.isFinite), 'polar deform finite');
  // twist with k=0 is the identity
  const id = planeDeformTwist(1.3, 0.7, 0);
  ok(near(id[0], 1.3, 1e-9) && near(id[1], 0.7, 1e-9), 'twist k=0 → identity');
  // twist preserves radius
  const tw = planeDeformTwist(1.3, 0.7, 0.9);
  ok(near(Math.hypot(tw[0], tw[1]), Math.hypot(1.3, 0.7), 1e-6), 'twist preserves radius');
}

console.log('\nfeedback blend');
{
  ok(near(feedbackBlend(0.2, 0.8, 0), 0.8), 'decay 0 → current frame');
  ok(near(feedbackBlend(0.2, 0.8, 1), 0.2), 'decay 1 → previous frame (full trail)');
  ok(near(feedbackBlend(0.2, 0.8, 0.5), 0.5), 'decay 0.5 → average');
}

console.log('\nConway rule');
{
  ok(lifeRule(1, 2) === 1 && lifeRule(1, 3) === 1, 'live cell with 2–3 neighbours survives');
  ok(lifeRule(1, 1) === 0 && lifeRule(1, 4) === 0, 'live cell dies (under/over-population)');
  ok(lifeRule(0, 3) === 1, 'dead cell with exactly 3 neighbours is born');
  ok(lifeRule(0, 2) === 0, 'dead cell with 2 neighbours stays dead');
}

console.log('\nGame of Life step (toroidal)');
{
  // 3x3 blinker: horizontal row → vertical column after one step
  // grid 5x5, blinker centred at (2,2)
  const w = 5,
    h = 5;
  const g = new Array(w * h).fill(0);
  g[2 * w + 1] = g[2 * w + 2] = g[2 * w + 3] = 1; // row (1,2),(2,2),(3,2)
  const n = lifeStep(g, w, h);
  // after one step it should be a vertical bar: (2,1),(2,2),(2,3)
  ok(n[1 * w + 2] === 1 && n[2 * w + 2] === 1 && n[3 * w + 2] === 1, 'blinker → vertical');
  ok(n[2 * w + 1] === 0 && n[2 * w + 3] === 0, 'blinker arms cleared');
  // block (still life) is stable
  const b = new Array(w * h).fill(0);
  b[1 * w + 1] = b[1 * w + 2] = b[2 * w + 1] = b[2 * w + 2] = 1;
  const nb = lifeStep(b, w, h);
  ok(nb.join('') === b.join(''), 'block still-life is stable');
}

console.log('\nGLSL mirror present');
ok(typeof EFFECTS_GLSL === 'string' && EFFECTS_GLSL.length > 200, 'EFFECTS_GLSL exported');
for (const fn of ['clouds2D', 'planeDeformTwist', 'feedbackBlend', 'lifeRule']) {
  ok(EFFECTS_GLSL.includes(fn), `EFFECTS_GLSL defines ${fn}`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
