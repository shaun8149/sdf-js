// =============================================================================
// test-pyramid-3d.mjs — smoke test for first Atlas chart atom
// -----------------------------------------------------------------------------
// Verifies:
//   1. CPU SDF returns sensible distances at probe points
//   2. Sign changes at boundary
//   3. Different level counts produce expected behavior
//   4. AST tag correctly set for GPU emit
//   5. Scene integration: compile() succeeds + GLSL emit contains sdPyramid3d
//
// Run:  node sdf-js/scripts/test-pyramid-3d.mjs
// =============================================================================

import { pyramid3dSDF } from '../src/scene/components/charts/hierarchy/pyramid-3d.js';
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

console.log('=== pyramid-3d smoke test ===\n');

// -----------------------------------------------------------------------------
// Test group 1: Default pyramid (5 levels)
// totalH = 5 * 0.3 + 4 * 0.05 = 1.7 → y range [-0.85, 0.85]
// base layer y center = -0.85 + 0.15 = -0.7
// top layer y center  = +0.85 - 0.15 = +0.7
// -----------------------------------------------------------------------------
console.log('Test group 1: Default pyramid (5 levels)');
const p = pyramid3dSDF();

const d_origin = p.f([0, 0, 0]);
ok(d_origin < 0, `inside at origin (got ${d_origin.toFixed(3)})`);

const d_above = p.f([0, 5, 0]);
ok(d_above > 4, `far above [0,5,0] → ~4+ (got ${d_above.toFixed(3)})`);

const d_side = p.f([10, 0, 0]);
ok(d_side > 8.5, `far to side [10,0,0] → ~9 (got ${d_side.toFixed(3)})`);

// just outside base layer (baseWidth/2 = 1, base layer y center = -0.7)
const d_just_out = p.f([1.1, -0.7, 0]);
ok(
  d_just_out > 0 && d_just_out < 0.2,
  `just outside base [1.1, -0.7, 0] → small positive (got ${d_just_out.toFixed(3)})`,
);

// inside top layer (topWidth/2 = 0.2, top layer y = +0.7)
const d_top_inside = p.f([0.1, 0.7, 0]);
ok(d_top_inside < 0, `inside top layer [0.1, 0.7, 0] → negative (got ${d_top_inside.toFixed(3)})`);

// outside top layer (x = 0.5 > 0.2)
const d_top_outside = p.f([0.5, 0.7, 0]);
ok(
  d_top_outside > 0,
  `outside top layer [0.5, 0.7, 0] → positive (got ${d_top_outside.toFixed(3)})`,
);

// -----------------------------------------------------------------------------
// Test group 2: 1-level pyramid (degenerate = single box)
// -----------------------------------------------------------------------------
console.log('\nTest group 2: 1-level pyramid (single box)');
const p1 = pyramid3dSDF({ levels: 1, baseWidth: 1, topWidth: 1, layerHeight: 1, depth: 1 });
ok(p1.f([0, 0, 0]) < 0, '1-level at origin → inside');
ok(p1.f([2, 0, 0]) > 0, '1-level at [2,0,0] → outside');
ok(p1.f([0, 2, 0]) > 0, '1-level at [0,2,0] → outside');

// -----------------------------------------------------------------------------
// Test group 3: 7-level stepped (Mexican) pyramid (gap=0.1)
// totalH = 7 * 0.3 + 6 * 0.1 = 2.7 → y range [-1.35, 1.35]
// -----------------------------------------------------------------------------
console.log('\nTest group 3: 7-level stepped pyramid (gap=0.1)');
const p7 = pyramid3dSDF({ levels: 7, baseWidth: 3, topWidth: 0.5, gap: 0.1 });
ok(p7.f([0, 0, 0]) < 0, '7-level at origin → inside');
ok(p7.f([0, 2, 0]) > 0, '7-level at [0,2,0] (above top) → outside');
// base layer y center = -1.35 + 0.15 = -1.2, baseWidth/2 = 1.5
ok(p7.f([1, -1.2, 0]) < 0, '7-level at base [1, -1.2, 0] (inside base layer) → inside');

// -----------------------------------------------------------------------------
// Test group 4: Param clamping
// -----------------------------------------------------------------------------
console.log('\nTest group 4: Parameter clamping');
const p25 = pyramid3dSDF({ levels: 25 });
ok(p25.ast.args[0] === 20, `levels=25 clamped to 20 (got ${p25.ast.args[0]})`);

const p0 = pyramid3dSDF({ levels: 0 });
ok(p0.ast.args[0] === 1, `levels=0 clamped to 1 (got ${p0.ast.args[0]})`);

const pFractional = pyramid3dSDF({ levels: 5.7 });
ok(pFractional.ast.args[0] === 5, `levels=5.7 floored to 5 (got ${pFractional.ast.args[0]})`);

// -----------------------------------------------------------------------------
// Test group 5: AST tag for GPU emit
// -----------------------------------------------------------------------------
console.log('\nTest group 5: AST tag');
const pAst = pyramid3dSDF({ levels: 3, baseWidth: 1.5, topWidth: 0.5 });
ok(pAst.ast.kind === 'prim', 'AST.kind === "prim"');
ok(pAst.ast.name === 'pyramid-3d', `AST.name === "pyramid-3d" (got ${pAst.ast.name})`);
ok(pAst.ast.args.length === 6, `AST.args.length === 6 (got ${pAst.ast.args.length})`);
ok(pAst.ast.args[0] === 3, 'AST.args[0] === 3 (levels)');
ok(pAst.ast.args[1] === 1.5, 'AST.args[1] === 1.5 (baseWidth)');

// -----------------------------------------------------------------------------
// Test group 6: Scene integration (compile + GLSL emit)
// -----------------------------------------------------------------------------
console.log('\nTest group 6: Scene integration (SceneData → compile → GLSL)');
const scene = {
  v: 1,
  defaults: {
    camera: {
      yaw: 0.4,
      pitch: 0.2,
      distance: 6,
      focal: 1.5,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
    },
    light: { altitude: 0.5, azimuth: 0.6, distance: 8, intensity: 1.1 },
  },
  subjects: [
    {
      type: 'pyramid-3d',
      id: 'test-pyramid',
      pos: { x: 0, y: 0, z: 0 },
      dims: {
        levels: 5,
        baseWidth: 2,
        topWidth: 0.4,
        layerHeight: 0.3,
        gap: 0.05,
        depth: 0.6,
      },
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
  const dOrigin = compiled.sdf.f([0, 0, 0]);
  ok(dOrigin < 0, `compiled SDF at origin → inside (got ${dOrigin.toFixed(3)})`);

  let glsl;
  try {
    glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
    ok(true, 'compileSDF3ToGLSL succeeded');
  } catch (e) {
    ok(false, `GLSL emit failed: ${e.message}`);
  }

  if (glsl) {
    const exprStr = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
    ok(
      exprStr.includes('sdPyramid3d'),
      `GLSL emit contains sdPyramid3d (expr substring: ${exprStr.substring(0, 80)}...)`,
    );
  }
}

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
