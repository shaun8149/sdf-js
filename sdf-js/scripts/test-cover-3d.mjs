// =============================================================================
// test-cover-3d.mjs — smoke test for Atlas atom #8 (cover-3d)
// -----------------------------------------------------------------------------
// Verifies:
//   1. Stage geometry (floor plate top at y=0)
//   2. Backdrop wall geometry (vertical at back of stage)
//   3. backdropHeight=0 → stage only (no wall)
//   4. AST: title/subtitle stored as semantic metadata
//   5. Scene integration + GLSL emit
//
// Run:  node sdf-js/scripts/test-cover-3d.mjs
// =============================================================================

import { cover3dSDF } from '../src/scene/components/presentation/cover-3d.js';
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

console.log('=== cover-3d smoke test ===\n');

// -----------------------------------------------------------------------------
// Test group 1: Default cover (stageW=4, stageD=2, stageT=0.2, backH=2.5, backT=0.15)
// Stage: x∈[-2,2], y∈[-0.2,0], z∈[-1,1]
// Backdrop: x∈[-2,2], y∈[0,2.5], z∈[-1.15,-1] (just behind stage)
// -----------------------------------------------------------------------------
console.log('Test group 1: Default cover geometry');
const C = cover3dSDF();

// Inside stage center
ok(C.f([0, -0.1, 0]) < 0, `inside stage center at [0, -0.1, 0]`);

// Above stage top, in stage area but not in backdrop area
ok(C.f([0, 0.5, 0.5]) > 0, `air above stage at [0, 0.5, 0.5] → positive`);

// Inside backdrop center (y=1.25, z=-1.075)
const dBack = C.f([0, 1.25, -1.075]);
ok(dBack < 0, `inside backdrop center at [0, 1.25, -1.075] (got ${dBack.toFixed(3)})`);

// Far above backdrop
ok(C.f([0, 5, -1]) > 2, `far above backdrop`);

// Far in front of stage
ok(C.f([0, 0, 5]) > 3.5, `far in front of stage at [0, 0, 5]`);

// Far behind backdrop
ok(C.f([0, 1, -5]) > 3, `far behind backdrop at [0, 1, -5]`);

// Outside stage X
ok(C.f([5, -0.1, 0]) > 2.5, `outside stage X at [5, -0.1, 0]`);

// -----------------------------------------------------------------------------
// Test group 2: backdropHeight=0 → stage only
// -----------------------------------------------------------------------------
console.log('\nTest group 2: backdropHeight=0 → stage only');
const Cstage = cover3dSDF({ backdropHeight: 0 });
ok(Cstage.f([0, -0.1, 0]) < 0, 'stage-only: stage inside still works');
ok(Cstage.f([0, 1.0, -1.0]) > 0.5, 'stage-only: no backdrop, point outside');

const CstageT = cover3dSDF({ backdropThickness: 0 });
ok(CstageT.f([0, 1.0, -1.0]) > 0.5, 'backdropThickness=0: no backdrop, point outside');

// -----------------------------------------------------------------------------
// Test group 3: Wide cinema variant
// -----------------------------------------------------------------------------
console.log('\nTest group 3: Wide cinema variant');
const Cwide = cover3dSDF({ stageWidth: 6.0, backdropHeight: 3.0 });
ok(Cwide.f([2.5, -0.1, 0]) < 0, `wide cinema: inside at x=2.5`);
ok(Cwide.f([3.5, -0.1, 0]) > 0, `wide cinema: outside at x=3.5`);
ok(Cwide.f([0, 2.5, -1.075]) < 0, `wide cinema: tall backdrop inside`);

// -----------------------------------------------------------------------------
// Test group 4: Semantic AST metadata
// -----------------------------------------------------------------------------
console.log('\nTest group 4: Semantic AST metadata');
const Csem = cover3dSDF({ title: 'Next-gen Prezi', subtitle: '2026 product demo' });
ok(Csem.ast.kind === 'prim', 'AST.kind = prim');
ok(Csem.ast.name === 'cover-3d', `AST.name = cover-3d`);
ok(Csem.ast.args[6] === 'Next-gen Prezi', `AST.args[6] = title`);
ok(Csem.ast.args[7] === '2026 product demo', `AST.args[7] = subtitle`);

// -----------------------------------------------------------------------------
// Test group 5: Scene integration
// -----------------------------------------------------------------------------
console.log('\nTest group 5: Scene integration');
const scene = {
  v: 1,
  defaults: {
    camera: {
      yaw: 0.4,
      pitch: 0.2,
      distance: 10,
      focal: 1.5,
      targetX: 0,
      targetY: 0.8,
      targetZ: 0,
    },
    light: { altitude: 0.5, azimuth: 0.6, distance: 15, intensity: 1.2 },
  },
  subjects: [
    {
      type: 'cover-3d',
      id: 'test-cover',
      pos: { x: 0, y: 0, z: 0 },
      dims: { stageWidth: 4.0, stageDepth: 2.0, backdropHeight: 2.5, title: 'Test' },
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
  const d = compiled.sdf.f([0, -0.1, 0]);
  ok(d < 0, `compiled SDF inside stage (got ${d.toFixed(3)})`);

  let glsl;
  try {
    glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
    ok(true, 'compileSDF3ToGLSL succeeded');
  } catch (e) {
    ok(false, `GLSL emit failed: ${e.message}`);
  }

  if (glsl) {
    const exprStr = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
    ok(exprStr.includes('sdCover3d'), 'GLSL emit contains sdCover3d');
  }
}

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
