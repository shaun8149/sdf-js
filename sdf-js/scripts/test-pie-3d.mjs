// =============================================================================
// test-pie-3d.mjs — smoke test for Atlas chart atom #5 (pie-3d)
// -----------------------------------------------------------------------------
// Verifies:
//   1. CPU SDF: inside disc → negative, outside → positive
//   2. Auto-normalization: [40, 25, 15, 12, 8] normalized to sum=1
//   3. Donut: innerRadius > 0 carves out hole
//   4. Z-thickness extrusion: beyond ±thickness/2 → outside
//   5. Slice independence: only slice 0 with value=1 → full disc
//   6. AST + GLSL emit
//
// Run:  node sdf-js/scripts/test-pie-3d.mjs
// =============================================================================

import { pie3dSDF } from '../src/scene/components/charts/data/pie-3d.js';
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

console.log('=== pie-3d smoke test ===\n');

// -----------------------------------------------------------------------------
// Test group 1: Default 5-slice pie, outerR=1, thickness=0.3
// -----------------------------------------------------------------------------
console.log('Test group 1: Default 5-slice pie');
const P = pie3dSDF();

// At origin (center of disc, z=0): inside the pie volume
const dOrigin = P.f([0, 0, 0]);
ok(dOrigin < 0, `origin → inside (got ${dOrigin.toFixed(3)})`);

// Just inside outer radius (r=0.9, on top: y=0.9, x=0, z=0)
const dInside = P.f([0, 0.9, 0]);
ok(dInside < 0, `near outer edge inside → negative (got ${dInside.toFixed(3)})`);

// Just outside outer radius (r=1.1)
const dOutside = P.f([0, 1.1, 0]);
ok(dOutside > 0, `outside outer radius → positive (got ${dOutside.toFixed(3)})`);

// Above the pie (z > thickness/2 = 0.15)
const dAbove = P.f([0, 0, 0.5]);
ok(dAbove > 0.3, `above thickness → positive (got ${dAbove.toFixed(3)})`);

// At z = exactly thickness/2 boundary
const dEdge = P.f([0, 0, 0.15]);
ok(Math.abs(dEdge) < 0.01, `z=thickness/2 → on surface (got ${dEdge.toFixed(3)})`);

// Inside Z range but outside radius
const dFarSide = P.f([5, 0, 0]);
ok(dFarSide > 3.5, `far X → outside (got ${dFarSide.toFixed(3)})`);

// -----------------------------------------------------------------------------
// Test group 2: Auto-normalization (raw counts → sum=1)
// values=[40, 25, 15, 12, 8] sums to 100, should normalize to [0.4, ...]
// Geometry should be identical to passing [0.4, 0.25, 0.15, 0.12, 0.08]
// -----------------------------------------------------------------------------
console.log('\nTest group 2: Auto-normalization');
const Praw = pie3dSDF({ values: [40, 25, 15, 12, 8] });
const Pnorm = pie3dSDF({ values: [0.4, 0.25, 0.15, 0.12, 0.08] });
const dRaw = Praw.f([0, 0.5, 0]);
const dNorm = Pnorm.f([0, 0.5, 0]);
ok(Math.abs(dRaw - dNorm) < 1e-9, `[40,25,...] ≡ [0.4,0.25,...] (raw=${dRaw}, norm=${dNorm})`);

// -----------------------------------------------------------------------------
// Test group 3: Donut (innerRadius > 0 carves hole)
// -----------------------------------------------------------------------------
console.log('\nTest group 3: Donut hole');
const D = pie3dSDF({ values: [25, 25, 25, 25], innerRadius: 0.5, outerRadius: 1.0 });
// At origin (inside hole) → outside the donut
const dCenter = D.f([0, 0, 0]);
ok(dCenter > 0.4, `donut center hole → outside (got ${dCenter.toFixed(3)})`);
// At r=0.75 (middle of ring) → inside donut
const dRing = D.f([0.75, 0, 0]);
ok(dRing < 0, `donut ring → inside (got ${dRing.toFixed(3)})`);
// Just inside inner edge (r=0.45) → outside donut (in the hole)
const dInnerEdge = D.f([0.45, 0, 0]);
ok(dInnerEdge > 0, `inside inner edge (hole) → outside donut (got ${dInnerEdge.toFixed(3)})`);

// -----------------------------------------------------------------------------
// Test group 4: Single slice with value=1 → full disc
// -----------------------------------------------------------------------------
console.log('\nTest group 4: Single slice = full disc');
const Pfull = pie3dSDF({ values: [1] });
// All points within outerR (any angle) should be inside
ok(Pfull.f([0, 0, 0]) < 0, 'full disc: origin inside');
ok(Pfull.f([0.5, 0, 0]) < 0, 'full disc: +X inside');
ok(Pfull.f([0, 0.5, 0]) < 0, 'full disc: +Y inside');
ok(Pfull.f([-0.5, 0, 0]) < 0, 'full disc: -X inside');
ok(Pfull.f([0, -0.5, 0]) < 0, 'full disc: -Y inside');
ok(Pfull.f([1.2, 0, 0]) > 0, 'full disc: beyond R outside');

// -----------------------------------------------------------------------------
// Test group 5: Two equal slices (each 50%, half-disc each)
// Clockwise from top: slice 0 covers right half (12→6 going CW = +X side),
// slice 1 covers left half (6→12 going CW = -X side)
// -----------------------------------------------------------------------------
console.log('\nTest group 5: Two 50% slices');
const Phalf = pie3dSDF({ values: [1, 1] });
// Inside disc on +X side (slice 0) and -X side (slice 1) → both inside
ok(Phalf.f([0.5, 0, 0]) < 0, '+X half: inside (slice 0)');
ok(Phalf.f([-0.5, 0, 0]) < 0, '-X half: inside (slice 1)');
// Inside disc on top (+Y) — should be inside (it's a boundary between slices)
ok(Phalf.f([0, 0.5, 0]) < 0, '+Y top: inside (boundary)');
// Outside disc beyond outer radius
ok(Phalf.f([1.5, 0, 0]) > 0, 'far +X: outside');

// -----------------------------------------------------------------------------
// Test group 6: Empty / count=0
// -----------------------------------------------------------------------------
console.log('\nTest group 6: Empty');
const Pempty = pie3dSDF({ values: [], count: 0 });
ok(Pempty.f([0, 0, 0]) > 100, 'empty: no surface');

// -----------------------------------------------------------------------------
// Test group 7: AST + scene integration
// -----------------------------------------------------------------------------
console.log('\nTest group 7: AST + scene integration');
const Past = pie3dSDF({ values: [40, 60], innerRadius: 0.3 });
ok(Past.ast.kind === 'prim', 'AST.kind = prim');
ok(Past.ast.name === 'pie-3d', `AST.name = pie-3d (got ${Past.ast.name})`);
ok(Past.ast.args[0].length === 32, `padded to 32 (got ${Past.ast.args[0].length})`);
ok(Past.ast.args[1] === 2, 'AST count = 2');
ok(
  Math.abs(Past.ast.args[0][0] - 0.4) < 1e-9,
  `AST values[0] normalized to 0.4 (got ${Past.ast.args[0][0]})`,
);
ok(
  Math.abs(Past.ast.args[0][1] - 0.6) < 1e-9,
  `AST values[1] normalized to 0.6 (got ${Past.ast.args[0][1]})`,
);
ok(Past.ast.args[6] === 1, 'AST clockwiseFlag = 1');

const scene = {
  v: 1,
  defaults: {
    camera: { yaw: 0.4, pitch: 0.2, distance: 8, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
    light: { altitude: 0.5, azimuth: 0.6, distance: 12, intensity: 1.2 },
  },
  subjects: [
    {
      type: 'pie-3d',
      id: 'test-pie',
      pos: { x: 0, y: 0, z: 0 },
      dims: { values: [30, 25, 20, 15, 10], outerRadius: 1.0, innerRadius: 0.4, thickness: 0.4 },
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
  // Inside the donut ring (r=0.7, +X direction)
  const d = compiled.sdf.f([0.7, 0, 0]);
  ok(d < 0, `compiled SDF inside donut ring (got ${d.toFixed(3)})`);

  let glsl;
  try {
    glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
    ok(true, 'compileSDF3ToGLSL succeeded');
  } catch (e) {
    ok(false, `GLSL emit failed: ${e.message}`);
  }

  if (glsl) {
    const exprStr = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
    ok(exprStr.includes('sdPie3d'), 'GLSL emit contains sdPie3d');
    ok(exprStr.includes('float[32]'), 'GLSL emit uses float[32] array literal');
  }
}

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
