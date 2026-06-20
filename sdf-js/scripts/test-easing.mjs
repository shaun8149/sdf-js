// =============================================================================
// L1 unit tests for the easing / remapping math toolkit (IQ "useful little
// functions" + smoothstep family + sigmoid). Wave 1 of the IQ-shader program.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez's functions (iquilezles.org/articles/
// functions, smoothstep, sigmoid, smoothstepintegral, inverse smoothstep).
// Tested by mathematical PROPERTY (endpoints / monotonicity / inverse), not by
// magic-constant equality, so the assertions stay meaningful + robust.
// =============================================================================

import {
  clamp01,
  remap,
  remapClamp,
  smoothstep01,
  smootherstep,
  invSmoothstep,
  smoothstepInteg,
  parabola,
  pcurve,
  cubicPulse,
  expImpulse,
  expStep,
  gain,
  sinc,
  sigmoid,
  almostIdentity,
  EASING_GLSL,
} from '../src/sdf/easing.js';

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
const monotonicInc = (f, lo = 0, hi = 1, n = 50) => {
  let prev = -Infinity;
  for (let i = 0; i <= n; i++) {
    const v = f(lo + ((hi - lo) * i) / n);
    if (v < prev - 1e-9) return false;
    prev = v;
  }
  return true;
};

console.log('=== easing / remapping toolkit ===\n');

console.log('clamp01 / remap');
ok(clamp01(-1) === 0 && clamp01(2) === 1 && clamp01(0.3) === 0.3, 'clamp01 clamps to [0,1]');
ok(near(remap(5, 0, 10, 0, 100), 50), 'remap midpoint maps linearly');
ok(near(remap(0, 0, 10, 20, 40), 20) && near(remap(10, 0, 10, 20, 40), 40), 'remap endpoints');
ok(near(remap(15, 0, 10, 0, 100), 150), 'remap extrapolates (no clamp)');
ok(near(remapClamp(15, 0, 10, 0, 100), 100), 'remapClamp clamps to output range');

console.log('\nsmoothstep family');
ok(near(smoothstep01(0), 0) && near(smoothstep01(1), 1), 'smoothstep01 endpoints');
ok(near(smoothstep01(0.5), 0.5), 'smoothstep01 symmetric midpoint');
ok(near(smootherstep(0), 0) && near(smootherstep(1), 1), 'smootherstep endpoints');
ok(near(smootherstep(0.5), 0.5), 'smootherstep symmetric midpoint');
ok(monotonicInc(smootherstep), 'smootherstep monotonic increasing');
// smootherstep has zero 1st+2nd derivative at ends → slope near 0 just inside
ok(smootherstep(0.02) < 0.01, 'smootherstep flat near 0 (quintic ease)');

console.log('\ninverse smoothstep (round-trip)');
for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
  ok(near(invSmoothstep(smoothstep01(x)), x, 1e-3), `invSmoothstep∘smoothstep(${x}) ≈ ${x}`);
}

console.log('\nsmoothstep integral');
ok(near(smoothstepInteg(0), 0), 'integral at 0 is 0');
ok(near(smoothstepInteg(1), 0.5), 'integral over [0,1] = 0.5 (∫ 3t²-2t³)');
ok(near(smoothstepInteg(2), 1.5), 'integral past 1 grows linearly (x-0.5)');
ok(
  monotonicInc((x) => smoothstepInteg(x), 0, 3),
  'integral monotonic',
);

console.log('\nimpulse / pulse / parabola / pcurve');
ok(
  near(parabola(0.5, 1), 1) && near(parabola(0, 1), 0) && near(parabola(1, 1), 0),
  'parabola peaks mid',
);
ok(near(pcurve(0, 2, 2), 0) && near(pcurve(1, 2, 2), 0), 'pcurve zero at ends');
ok(pcurve(0.5, 2, 2) > 0.99, 'pcurve(a=b) peaks ~1 at center');
ok(near(cubicPulse(0.5, 0.2, 0.5), 1), 'cubicPulse =1 at center');
ok(near(cubicPulse(0.5, 0.2, 0.9), 0), 'cubicPulse =0 outside width');
ok(near(expImpulse(0, 8), 0) && expImpulse(1 / 8, 8) > 0.99, 'expImpulse peaks ~1 at x=1/k');
ok(near(expStep(0, 5, 2), 1) && expStep(2, 5, 2) < 0.01, 'expStep starts 1, decays');

console.log('\ngain / sinc / sigmoid / almostIdentity');
ok(near(gain(0.5, 3), 0.5) && near(gain(0, 3), 0) && near(gain(1, 3), 1), 'gain fixes 0/.5/1');
ok(near(gain(0.3, 1), 0.3), 'gain(x,1) is identity');
ok(near(sinc(0, 1), 1), 'sinc(0)=1 (removable singularity)');
ok(near(sigmoid(0), 0.5) && sigmoid(10) > 0.99 && sigmoid(-10) < 0.01, 'sigmoid S-curve');
ok(near(almostIdentity(5, 1, 0.2), 5), 'almostIdentity identity above m');
ok(near(almostIdentity(0, 1, 0.2), 0.2), 'almostIdentity lifts 0 to n');

console.log('\nGLSL mirror present');
ok(typeof EASING_GLSL === 'string' && EASING_GLSL.length > 200, 'EASING_GLSL string exported');
for (const fn of ['smootherstep', 'parabola', 'gain', 'cubicPulse', 'smoothstepInteg']) {
  ok(EASING_GLSL.includes(fn), `EASING_GLSL defines ${fn}`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
