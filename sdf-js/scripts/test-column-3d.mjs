// =============================================================================
// test-column-3d.mjs — smoke test for Atlas chart atom #3 (column-3d)
// -----------------------------------------------------------------------------
// column-3d is bar-3d rotated 90° (axis swap on input p). Verifies:
//   1. CPU SDF: bars grow along +X, stacked along Y (first at top)
//   2. Param resolution shares with bar-3d (same MAX_BARS clamp etc)
//   3. AST padding for GLSL float[32]
//   4. Scene integration: compile + GLSL emit contains sdColumn3d
//
// Run:  node sdf-js/scripts/test-column-3d.mjs
// =============================================================================

import { column3dSDF } from '../src/scene/components/charts/data/column-3d.js';
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

console.log('=== column-3d smoke test ===\n');

// -----------------------------------------------------------------------------
// Test group 1: Default 5-row column chart
// values=[0.3, 0.5, 0.7, 0.4, 0.8] (default), maxH=2.0, barW=0.4, gap=0.1
// Y span: totalY = 5 * 0.4 + 4 * 0.1 = 2.4 → rows at Y = +1.0, +0.5, 0, -0.5, -1.0
// (FIRST item at TOP, so Y=+1.0 for i=0)
// Lengths (X): values * 2.0 = [0.6, 1.0, 1.4, 0.8, 1.6]
// Bars extend from X=0 to X=length (left-anchored)
// -----------------------------------------------------------------------------
console.log('Test group 1: Default 5-row column chart');
const c = column3dSDF();

// Row 0 (top), value=0.3 → length 0.6
//   center Y = +1.0, bar X spans [0, 0.6] → bar center X = 0.3
const dRow0 = c.f([0.3, 1.0, 0]);
ok(dRow0 < 0, `inside row 0 (top) at [0.3, 1.0, 0] (got ${dRow0.toFixed(3)})`);

// Row 4 (bottom), value=0.8 → length 1.6
//   center Y = -1.0, bar X spans [0, 1.6] → bar center X = 0.8
const dRow4 = c.f([0.8, -1.0, 0]);
ok(dRow4 < 0, `inside row 4 (bottom) at [0.8, -1.0, 0] (got ${dRow4.toFixed(3)})`);

// Beyond row 0 end (X > 0.6) at row 0 Y
const dBeyondRow0 = c.f([1.0, 1.0, 0]);
ok(dBeyondRow0 > 0, `beyond row 0 end at [1.0, 1.0, 0] (got ${dBeyondRow0.toFixed(3)})`);

// Bottom of last row (Y far below -1.0)
const dWayBelow = c.f([0.3, -3.0, 0]);
ok(dWayBelow > 1.5, `way below at [0.3, -3.0, 0] (got ${dWayBelow.toFixed(3)})`);

// Above first row (Y > +1.2 = top of row 0)
const dAboveRow0 = c.f([0.3, 1.5, 0]);
ok(dAboveRow0 > 0, `above row 0 at [0.3, 1.5, 0] (got ${dAboveRow0.toFixed(3)})`);

// Left side (X < 0, before bar start)
const dLeftSide = c.f([-0.5, 1.0, 0]);
ok(dLeftSide > 0.4, `left of bar start at [-0.5, 1.0, 0] (got ${dLeftSide.toFixed(3)})`);

// -----------------------------------------------------------------------------
// Test group 2: First-item-at-top orientation verified
// values=[1.0, 0.1] → row 0 (top) is LONG, row 1 (bottom) is SHORT
// -----------------------------------------------------------------------------
console.log('\nTest group 2: First item at top orientation');
const cTop = column3dSDF({ values: [1.0, 0.1], barWidth: 0.5, gap: 0.1 });
// totalY = 2 * 0.5 + 1 * 0.1 = 1.1
// row 0 Y = +0.3, row 1 Y = -0.3
// row 0 length = 2.0, row 1 length = 0.2
const dTopLong = cTop.f([1.5, 0.3, 0]); // far along row 0 (long bar)
ok(dTopLong < 0, `top row is long: inside at [1.5, 0.3, 0] (got ${dTopLong.toFixed(3)})`);
const dBottomShort = cTop.f([1.5, -0.3, 0]); // far along row 1 (short bar — should be OUTSIDE)
ok(
  dBottomShort > 0,
  `bottom row is short: outside at [1.5, -0.3, 0] (got ${dBottomShort.toFixed(3)})`,
);

// -----------------------------------------------------------------------------
// Test group 3: AST + scene integration
// -----------------------------------------------------------------------------
console.log('\nTest group 3: AST tag + scene integration');
const cAst = column3dSDF({ values: [0.5, 0.8] });
ok(cAst.ast.kind === 'prim', 'AST.kind = prim');
ok(cAst.ast.name === 'column-3d', `AST.name = column-3d (got ${cAst.ast.name})`);
ok(Array.isArray(cAst.ast.args[0]), 'AST.args[0] is array');
ok(cAst.ast.args[0].length === 32, `padded to 32 (got ${cAst.ast.args[0].length})`);
ok(cAst.ast.args[1] === 2, 'AST count = 2');

const scene = {
  v: 1,
  defaults: {
    camera: { yaw: 0.4, pitch: 0.2, distance: 8, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
    light: { altitude: 0.5, azimuth: 0.6, distance: 12, intensity: 1.2 },
  },
  subjects: [
    {
      type: 'column-3d',
      id: 'test-column',
      pos: { x: 0, y: 0, z: 0 },
      dims: { values: [0.3, 0.5, 0.7, 0.4, 0.8], barWidth: 0.4, gap: 0.1, maxHeight: 2.0 },
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
  // row 2 (middle), value=0.7 → length 1.4, Y center = 0, X bar center = 0.7
  const d = compiled.sdf.f([0.7, 0, 0]);
  ok(d < 0, `compiled SDF inside middle row at [0.7, 0, 0] (got ${d.toFixed(3)})`);

  let glsl;
  try {
    glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
    ok(true, 'compileSDF3ToGLSL succeeded');
  } catch (e) {
    ok(false, `GLSL emit failed: ${e.message}`);
  }

  if (glsl) {
    const exprStr = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
    ok(exprStr.includes('sdColumn3d'), 'GLSL emit contains sdColumn3d');
    ok(exprStr.includes('float[32]'), 'GLSL emit uses float[32] array literal');
  }
}

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
