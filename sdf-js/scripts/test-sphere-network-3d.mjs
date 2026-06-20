// =============================================================================
// L1 unit tests for the sphere-network-3d atom.
// -----------------------------------------------------------------------------
// A central hub sphere connected to N satellite spheres by capsule links.
// Covers PresentationLoad "3D Spheres Network" (center + satellites). Composite
// atom: sphere + capsule + union, GLSL emit via leaf primitives.
// =============================================================================

import { sphereNetwork3dSDF } from '../src/scene/components/shapes/sphere-network-3d.js';
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

console.log('=== sphere-network-3d unit test ===\n');

// ---- Test group 1: defaults (ring) ------------------------------------------
console.log('Test group 1: defaults (hub + 6 satellites on XZ ring)');
{
  const sdf = sphereNetwork3dSDF();
  ok(sdf != null, 'default sdf is non-null');
  ok(sdf.f([0, 0, 0]) < 0, 'hub center is inside');
  // count=6, radius=1.5: satellite 0 at angle 0 → [1.5, 0, 0].
  ok(sdf.f([1.5, 0, 0]) < 0, 'satellite 0 center is inside');
  // link from hub to satellite 0 → midpoint inside.
  ok(sdf.f([0.75, 0, 0]) < 0, 'link midpoint (hub→satellite) is inside');
  ok(sdf.f([0, 3, 0]) > 0, 'empty space above is outside');
}

// ---- Test group 2: arrangement plane ----------------------------------------
console.log('\nTest group 2: ring-xy places satellites in the XY plane');
{
  const sdf = sphereNetwork3dSDF({ count: 4, arrangement: 'ring-xy', radius: 1.5 });
  // i=1 → angle 90° → [0, 1.5, 0] in XY plane.
  ok(sdf.f([0, 1.5, 0]) < 0, 'ring-xy: satellite at +Y is inside');
}
{
  const sdf = sphereNetwork3dSDF({ count: 4, arrangement: 'ring', radius: 1.5 });
  // Default ring is XZ → nothing at [0, 1.5, 0].
  ok(sdf.f([0, 1.5, 0]) > 0, 'ring (XZ): no satellite at +Y');
}

// ---- Test group 3: satellite count ------------------------------------------
console.log('\nTest group 3: satellite count scales');
{
  const sdf = sphereNetwork3dSDF({ count: 8, radius: 1.6, satelliteRadius: 0.25 });
  let hits = 0;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const p = [1.6 * Math.cos(a), 0, 1.6 * Math.sin(a)];
    if (sdf.f(p) < 0) hits++;
  }
  ok(hits === 8, `all 8 satellite centers inside (got ${hits})`);
}

// ---- Test group 4: edge cases -----------------------------------------------
console.log('\nTest group 4: edge cases');
{
  ok(sphereNetwork3dSDF({ count: -1 }) === null, 'negative count returns null');
  const hubOnly = sphereNetwork3dSDF({ count: 0 });
  ok(hubOnly != null && hubOnly.f([0, 0, 0]) < 0, 'count=0 → hub only, center inside');
  ok(hubOnly.f([1.5, 0, 0]) > 0, 'count=0 → no satellites');
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
        type: 'sphere-network-3d',
        id: 'test-net',
        args: { count: 5, radius: 1.5, hubRadius: 0.5 },
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
    ok(compiled.sdf.f([0, 0, 0]) < 0, 'compiled SDF: hub center inside');
    let glsl;
    try {
      glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
      ok(true, 'compileSDF3ToGLSL succeeded');
    } catch (e) {
      ok(false, `GLSL emit failed: ${e.message}`);
    }
    if (glsl) {
      const exprStr = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
      ok(exprStr.includes('sdSphere'), 'GLSL emit contains sdSphere (hub/satellites)');
      ok(exprStr.includes('sdCapsule'), 'GLSL emit contains sdCapsule (links)');
    }
  }
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
