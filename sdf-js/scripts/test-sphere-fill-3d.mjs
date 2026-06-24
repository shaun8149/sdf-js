// =============================================================================
// L1 unit tests for the sphere-fill-3d atom.
// -----------------------------------------------------------------------------
// sphere-fill-3d renders a row of "fill level" gauge spheres. Each sphere is ONE
// SOLID sphere; the liquid/glass two-tone split happens in the studio 'fill'
// material kind (shader), driven by a per-sphere fill fraction carried in the
// pattern LUT slot [3] (leaf._subjectPattern.fill). So this unit test checks the
// geometry (solid spheres, correct layout) + that each sphere carries its fill.
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
console.log('Test group 1: defaults (4 solid spheres)');
{
  const sdf = sphereFill3dSDF();
  ok(sdf != null, 'default sdf is non-null');
  // Defaults: levels=[0.25,0.5,0.75,1.0], radius=0.6, spacing=0.3.
  // stride = 2*0.6 + 0.3 = 1.5; offset = (4-1)/2*1.5 = 2.25.
  // Sphere index 3 center x = 3*1.5 - 2.25 = 2.25.
  ok(sdf.f([2.25, 0, 0]) < 0, 'last sphere center is inside');
  ok(sdf.f([100, 0, 0]) > 0, 'far point is outside');
}

// ---- Test group 2: each sphere is solid (geometry independent of fill) -------
console.log('\nTest group 2: solid sphere (geometry independent of fill)');
{
  // Single sphere at origin, low fill. Geometry is still a full solid sphere;
  // the waterline is a shading effect, not a cut.
  const sdf = sphereFill3dSDF({ levels: [0.2], radius: 0.6 });
  ok(sdf.f([0, 0, 0]) < 0, 'center inside');
  ok(sdf.f([0, 0.4, 0]) < 0, 'above-waterline point inside (solid)');
  ok(sdf.f([0, -0.4, 0]) < 0, 'below-waterline point inside (solid)');
  ok(sdf.f([0, 0.9, 0]) > 0, 'point beyond radius outside');
}

// ---- Test group 3: per-sphere fill carried in pattern ------------------------
console.log('\nTest group 3: per-sphere fill in pattern slot');
{
  const sdf = sphereFill3dSDF({ levels: [0.3, 0.7] });
  const kids = sdf.ast?.children ?? [];
  ok(kids.length === 2, 'two sphere leaves');
  ok(kids[0]?._subjectPattern?.fill === 0.3, 'sphere 0 fill = 0.3');
  ok(kids[1]?._subjectPattern?.fill === 0.7, 'sphere 1 fill = 0.7');
}
{
  // Single sphere returns the leaf directly (no wrapping union).
  const single = sphereFill3dSDF({ levels: [0.5] });
  ok(single?._subjectPattern?.fill === 0.5, 'single sphere carries fill 0.5');
}
{
  // Fill fractions are clamped to 0..1.
  const sdf = sphereFill3dSDF({ levels: [-0.5, 1.4] });
  const kids = sdf.ast?.children ?? [];
  ok(kids[0]?._subjectPattern?.fill === 0, 'negative fill clamped to 0');
  ok(kids[1]?._subjectPattern?.fill === 1, 'over-1 fill clamped to 1');
}

// ---- Test group 4: edge cases -----------------------------------------------
console.log('\nTest group 4: edge cases');
{
  ok(sphereFill3dSDF({ count: 0 }) === null, 'count=0 returns null');
  ok(sphereFill3dSDF({ levels: [], count: 0 }) === null, 'no spheres returns null');
  const single = sphereFill3dSDF({ levels: [1.0] });
  ok(single != null && single.f([0, 0, 0]) < 0, 'single sphere at origin inside');
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
        material: { hue: 0.58, sat: 0.8, value: 0.6, kind: 'fill' },
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
    // Sphere index 1 center x = 1*1.5 - 0.75 = 0.75.
    ok(compiled.sdf.f([0.75, 0, 0]) < 0, 'compiled SDF: sphere center inside');
    let glsl;
    try {
      glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
      ok(true, 'compileSDF3ToGLSL succeeded');
    } catch (e) {
      ok(false, `GLSL emit failed: ${e.message}`);
    }
    if (glsl) {
      const exprStr = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
      ok(exprStr.includes('sdSphere'), 'GLSL emit contains sdSphere');
    }
  }
}

// ---- Test group 6: per-sphere colours (colors[]) -----------------------------
console.log('\nTest group 6: per-sphere colours via colors[]');
{
  // Mix object HSV + preset string; one sphere left uncoloured (falls back).
  const sdf = sphereFill3dSDF({
    levels: [0.8, 0.4, 0.2],
    colors: [{ hue: 0.58, sat: 0.82, value: 0.66 }, 'fruit-red'],
  });
  const kids = sdf.ast?.children ?? [];
  ok(kids.length === 3, 'three sphere leaves');
  // Sphere 0: object colour → per-leaf material, kind forced to fill (9).
  ok(kids[0]?._subjectMaterial != null, 'sphere 0 has per-leaf material');
  ok(kids[0]?._subjectMaterial?.kind === 9, 'sphere 0 material kind forced to fill (9)');
  ok(Math.abs(kids[0]?._subjectMaterial?.hue - 0.58) < 1e-6, 'sphere 0 hue = 0.58 (blue)');
  ok(kids[0]?._subjectMaterial?.roughness === 0.3, 'sphere 0 gets gauge roughness default 0.3');
  // Sphere 1: preset 'fruit-red' resolves, kind still forced to fill.
  ok(kids[1]?._subjectMaterial?.kind === 9, 'sphere 1 (preset) kind forced to fill');
  ok(kids[1]?._subjectMaterial?.hue === 0.0, "sphere 1 preset 'fruit-red' hue = 0");
  // Sphere 2: no colour → no per-leaf material → falls back to subject material.
  ok(kids[2]?._subjectMaterial === undefined, 'sphere 2 (no colour) falls back to subject material');
  // Fill fractions still independent of colour.
  ok(kids[0]?._subjectPattern?.fill === 0.8, 'sphere 0 keeps its fill 0.8');
}
{
  // Single coloured sphere: leaf returned directly, still carries its material.
  const single = sphereFill3dSDF({ levels: [0.5], colors: [{ hue: 0.3, sat: 0.7, value: 0.6 }] });
  ok(single?._subjectMaterial?.kind === 9, 'single coloured sphere kind = fill');
  ok(Math.abs(single?._subjectMaterial?.hue - 0.3) < 1e-6, 'single coloured sphere hue = 0.3');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
