// =============================================================================
// L1 unit tests for the lighting toolkit (IQ lighting articles). Wave 4 of the
// IQ-shader program.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   outdoors lighting     https://iquilezles.org/articles/outdoorslighting/
//   better fog            https://iquilezles.org/articles/fog/
//   sphere occlusion (AO) https://iquilezles.org/articles/sphereao/
//   sphere soft shadow    https://iquilezles.org/articles/sphereshadow/
//   (+ Schlick fresnel, hemisphere sky term)
//
// Analytic occlusion / shadow are closed-form → directly testable against the
// physical expectation (near occluder darkens; behind/away does nothing).
// =============================================================================

import {
  sphereAO,
  sphereSoftShadow,
  fresnelSchlick,
  hemisphereLight,
  outdoorLighting,
  betterFog,
  LIGHTING_GLSL,
} from '../src/sdf/lighting.js';

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
const near = (a, b, eps = 2e-3) => Math.abs(a - b) < eps;

console.log('=== lighting toolkit ===\n');

console.log('sphere analytic AO (1 = unoccluded)');
{
  const pos = [0, 0, 0],
    nor = [0, 0, 1];
  const aoNear = sphereAO(pos, nor, [0, 0, 1.2], 1);
  const aoFar = sphereAO(pos, nor, [0, 0, 20], 1);
  const aoBehind = sphereAO(pos, nor, [0, 0, -2], 1);
  ok(aoNear < aoFar, 'near occluder darkens more than far');
  ok(aoFar > 0.98, 'distant sphere ≈ unoccluded');
  ok(near(aoBehind, 1, 1e-3), 'sphere behind the surface causes no occlusion');
  ok(aoNear >= 0 && aoNear <= 1, 'AO in [0,1]');
}

console.log('\nsphere soft shadow (1 = lit, 0 = shadowed)');
{
  const toward = sphereSoftShadow([0, 0, 0], [0, 0, 1], [0, 0, 5], 1, 8);
  const away = sphereSoftShadow([0, 0, 0], [0, 0, -1], [0, 0, 5], 1, 8);
  ok(toward < 0.05, 'ray straight at the sphere → shadowed');
  ok(near(away, 1, 1e-6), 'ray away from the sphere → fully lit');
}

console.log('\nSchlick fresnel');
ok(near(fresnelSchlick(1, 0.04), 0.04), 'fresnel at normal incidence → F0');
ok(near(fresnelSchlick(0, 0.04), 1), 'fresnel at grazing → 1');
ok(fresnelSchlick(0.5, 0.04) > 0.04, 'fresnel rises off-axis');

console.log('\nhemisphere sky term');
ok(
  near(hemisphereLight(1), 1) && near(hemisphereLight(-1), 0) && near(hemisphereLight(0), 0.5),
  'hemisphere 0.5+0.5·n.y',
);

console.log('\noutdoor lighting composition');
{
  const nor = [0, 1, 0],
    sun = [0, 1, 0],
    alb = [1, 1, 1];
  const sunCol = [1, 1, 1],
    skyCol = [0.4, 0.6, 1],
    bnc = [0.3, 0.25, 0.2];
  const lit = outdoorLighting(nor, sun, 1, 1, alb, sunCol, skyCol, bnc);
  const shadowed = outdoorLighting(nor, sun, 0, 1, alb, sunCol, skyCol, bnc);
  ok(lit[0] > shadowed[0], 'sun visibility brightens');
  const noAO = outdoorLighting(nor, sun, 1, 0, alb, sunCol, skyCol, bnc);
  // with ao=0 only the sun term survives → exactly albedo*sunCol*ndotl*vis
  ok(near(noAO[2], 1 * 1 * 1 * 1, 1e-6), 'ao=0 kills sky+bounce, leaves sun term');
  ok(lit[2] > noAO[2], 'ambient (sky+bounce) adds light on top of sun');
}

console.log('\nbetter fog');
{
  const col = [0.2, 0.5, 0.8],
    rd = [0, 0, 1],
    sun = [1, 0, 0];
  const fogCol = [0.7, 0.8, 0.9],
    sunFog = [1, 0.9, 0.7];
  const near0 = betterFog(col, 0, rd, sun, fogCol, sunFog, 0.02);
  ok(
    near(near0[0], col[0]) && near(near0[1], col[1]) && near(near0[2], col[2]),
    'no fog at distance 0',
  );
  const far = betterFog(col, 1000, rd, sun, fogCol, sunFog, 0.02);
  ok(
    near(far[0], fogCol[0], 1e-2) && near(far[2], fogCol[2], 1e-2),
    'fully fogged far → fog colour',
  );
  // sun-aligned ray gets the warm in-scatter colour
  const alignedFar = betterFog(col, 1000, [1, 0, 0], [1, 0, 0], fogCol, sunFog, 0.02);
  ok(alignedFar[0] > far[0], 'sun-aligned fog is warmer (more red)');
}

console.log('\nGLSL mirror present');
ok(typeof LIGHTING_GLSL === 'string' && LIGHTING_GLSL.length > 300, 'LIGHTING_GLSL exported');
for (const fn of [
  'sphereAO',
  'sphereSoftShadow',
  'outdoorLighting',
  'betterFog',
  'fresnelSchlick',
]) {
  ok(LIGHTING_GLSL.includes(fn), `LIGHTING_GLSL defines ${fn}`);
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
