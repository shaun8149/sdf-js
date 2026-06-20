// =============================================================================
// L1 unit tests for the sphere-segmented-3d atom.
// -----------------------------------------------------------------------------
// A sphere split into N longitudinal "orange wedges" with angular gaps, each
// wedge optionally exploded radially outward. Covers PresentationLoad "3D
// Spheres Divisions". Composite atom: sphere ∩ two half-planes, union of wedges.
// =============================================================================

import { sphereSegmented3dSDF } from '../src/scene/components/shapes/sphere-segmented-3d.js';
import { compile } from '../src/scene/compile.js';
import { compileSDF3ToGLSL } from '../src/sdf/sdf3.compile.js';

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

// Wedge i center direction (sinθ, 0, cosθ), matching the atom's convention.
function dir(theta) {
  return [Math.sin(theta), 0, Math.cos(theta)];
}

console.log('=== sphere-segmented-3d unit test ===\n');

// ---- Test group 1: defaults --------------------------------------------------
console.log('Test group 1: defaults (6 wedges)');
{
  const sdf = sphereSegmented3dSDF();
  ok(sdf != null, 'default sdf is non-null');
  // Wedge 0 centered along +Z. A point along +Z at mid radius is inside.
  ok(sdf.f([0, 0, 0.5]) < 0, 'point inside wedge 0 (+Z) is inside');
  ok(sdf.f([3, 0, 0]) > 0, 'far point is outside');
}

// ---- Test group 2: angular gaps ---------------------------------------------
console.log('\nTest group 2: angular gaps between wedges');
{
  // 4 wedges centered at θ = 0, 90, 180, 270. Big gap → the 45° direction
  // (between wedge 0 and 1) falls in the empty slit.
  const sdf = sphereSegmented3dSDF({ segments: 4, radius: 0.7, explode: 0, gapAngle: 0.3 });
  const inWedge = dir(0).map((c) => c * 0.5); // +Z, inside wedge 0
  ok(sdf.f(inWedge) < 0, 'wedge-0 center direction is inside');
  const inGap = dir(Math.PI / 4).map((c) => c * 0.5); // 45°, between wedges
  ok(sdf.f(inGap) > 0, '45° gap direction is outside (slit between wedges)');
}

// ---- Test group 3: segment count --------------------------------------------
console.log('\nTest group 3: segment count');
{
  const sdf = sphereSegmented3dSDF({ segments: 3, radius: 0.6, explode: 0, gapAngle: 0.05 });
  let hits = 0;
  for (let i = 0; i < 3; i++) {
    const theta = (i / 3) * Math.PI * 2;
    const p = dir(theta).map((c) => c * 0.4);
    if (sdf.f(p) < 0) hits++;
  }
  ok(hits === 3, `all 3 wedge centers inside (got ${hits})`);
}

// ---- Test group 4: edge cases -----------------------------------------------
console.log('\nTest group 4: edge cases');
{
  ok(sphereSegmented3dSDF({ radius: 0 }) === null, 'radius=0 returns null');
  // segments clamps up to a minimum of 2 (a single >180° sector is undefined).
  const clamped = sphereSegmented3dSDF({ segments: 1, radius: 0.6 });
  ok(clamped != null && clamped.f([0, 0, 0.4]) < 0, 'segments<2 clamps to valid geometry');
}

// ---- Test group 5: scene compile + GLSL emit --------------------------------
console.log('\nTest group 5: SceneData → compile → GLSL emit');
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
    },
    subjects: [
      {
        type: 'sphere-segmented-3d',
        id: 'test-seg',
        args: { segments: 6, radius: 0.7, explode: 0.1 },
        region: 'object',
      },
    ],
  };

  let compiled;
  try {
    compiled = compile(scene);
    ok(true, 'compile(scene) succeeded');
  } catch (e) {
    ok(false, `compile(scene) failed: ${e.message}`);
  }

  if (compiled && compiled.sdf) {
    ok(compiled.sdf.f([0, 0, 0.5]) < 0, 'compiled SDF: wedge-0 interior inside');
    let glsl;
    try {
      glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
      ok(true, 'compileSDF3ToGLSL succeeded');
    } catch (e) {
      ok(false, `GLSL emit failed: ${e.message}`);
    }
    if (glsl) {
      const exprStr = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
      ok(exprStr.includes('sdSphere'), 'GLSL emit contains sdSphere (wedge body)');
      ok(exprStr.includes('opIntersect'), 'GLSL emit contains opIntersect (angular cut)');
    }
  }
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
