// =============================================================================
// L1 unit tests for the sphere-fill-3d atom.
// -----------------------------------------------------------------------------
// sphere-fill-3d renders a row of "fill level" spheres: each sphere is a glass
// container (3-ring wireframe cage) holding a liquid fill cap (cutSphere) whose
// height encodes a 0..1 fill fraction. Pure geometry — readable without color.
//
// PresentationLoad reference: "3D Spheres Fill Levels" (deck use case, P0).
// =============================================================================

import { sphereFill3dSDF } from '../src/scene/components/shapes/sphere-fill-3d.js';
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

console.log('=== sphere-fill-3d unit test ===\n');

// ---- Test group 1: defaults --------------------------------------------------
console.log('Test group 1: defaults (4 spheres, last fully filled)');
{
  const sdf = sphereFill3dSDF();
  ok(sdf != null, 'default sdf is non-null');
  // Defaults: levels=[0.25,0.5,0.75,1.0], radius=0.6, spacing=0.3.
  // stride = 2*0.6 + 0.3 = 1.5; offset = (4-1)/2*1.5 = 2.25.
  // Sphere index 3 (fill 1.0) center x = 3*1.5 - 2.25 = 2.25.
  ok(sdf.f([2.25, 0, 0]) < 0, 'last sphere (fill=1.0) center is inside');
  ok(sdf.f([100, 0, 0]) > 0, 'far point is outside');
}

// ---- Test group 2: fill fraction discrimination ------------------------------
console.log('\nTest group 2: fill fraction (cage off, isolate liquid)');
{
  // Two spheres: empty + full. stride=1.5, offset=0.75 → x = -0.75, +0.75.
  const sdf = sphereFill3dSDF({ levels: [0.0, 1.0], cage: false });
  ok(sdf.f([0.75, 0, 0]) < 0, 'full sphere (fill=1.0) center inside');
  ok(sdf.f([-0.75, 0, 0]) > 0, 'empty sphere (fill=0.0) center outside (no liquid, no cage)');
}
{
  // Single half-full sphere at origin, cage off. Liquid fills bottom half.
  const sdf = sphereFill3dSDF({ levels: [0.5], cage: false });
  ok(sdf.f([0, -0.3, 0]) < 0, 'half-fill: point below waterline is inside (liquid)');
  ok(sdf.f([0, 0.3, 0]) > 0, 'half-fill: point above waterline is outside (air)');
}

// ---- Test group 3: cage container -------------------------------------------
console.log('\nTest group 3: wireframe cage container');
{
  // Empty sphere with cage on: center hollow, but equator ring present.
  const sdf = sphereFill3dSDF({ levels: [0.0], radius: 0.6, cage: true, cageThickness: 0.06 });
  ok(sdf.f([0, 0, 0]) > 0, 'empty+cage: center is hollow (outside)');
  ok(sdf.f([0.6, 0, 0]) < 0, 'empty+cage: equator ring at radius is inside');
}

// ---- Test group 4: edge cases -----------------------------------------------
console.log('\nTest group 4: edge cases');
{
  ok(sphereFill3dSDF({ count: 0 }) === null, 'count=0 returns null');
  ok(sphereFill3dSDF({ levels: [], count: 0 }) === null, 'no spheres returns null');
  const single = sphereFill3dSDF({ levels: [1.0], cage: false });
  ok(single != null && single.f([0, 0, 0]) < 0, 'single full sphere at origin inside');
}

// ---- Test group 5: scene compile + GLSL emit ---------------------------------
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
        type: 'sphere-fill-3d',
        id: 'test-fill',
        args: { levels: [0.5, 1.0], radius: 0.6, spacing: 0.3 },
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
    // Full sphere (index 1) center x = 1*1.5 - 0.75 = 0.75.
    ok(compiled.sdf.f([0.75, 0, 0]) < 0, 'compiled SDF: full sphere center inside');
    let glsl;
    try {
      glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
      ok(true, 'compileSDF3ToGLSL succeeded');
    } catch (e) {
      ok(false, `GLSL emit failed: ${e.message}`);
    }
    if (glsl) {
      const exprStr = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
      ok(exprStr.includes('sdCutSphere'), 'GLSL emit contains sdCutSphere (liquid fill)');
      ok(exprStr.includes('sdTorus'), 'GLSL emit contains sdTorus (cage rings)');
    }
  }
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
