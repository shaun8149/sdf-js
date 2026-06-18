// =============================================================================
// test-bar-3d.mjs — smoke test for Atlas chart atom #2 (bar-3d)
// -----------------------------------------------------------------------------
// Verifies:
//   1. CPU SDF: bars sit on y=0, heights match values * maxHeight
//   2. X-centering: middle bar centered around X=0 for odd count
//   3. Count override: truncates / pads values list
//   4. MAX_BARS=32 clamping
//   5. Zero/negative values: skipped, no surface
//   6. Empty values + count=0: degenerate, returns large positive
//   7. AST: values padded to 32 for GLSL float[32] emit
//   8. Scene integration: compile + GLSL emit contains sdBar3d
//
// Run:  node sdf-js/scripts/test-bar-3d.mjs
// =============================================================================

import { bar3dSDF } from '../src/scene/components/charts/data/bar-3d.js';
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

console.log('=== bar-3d smoke test ===\n');

// -----------------------------------------------------------------------------
// Test group 1: Default 5-bar chart
// values=[0.3,0.7,1.0,0.5,0.8] maxH=2.0 barW=0.4 gap=0.1
// totalX = 5 * 0.4 + 4 * 0.1 = 2.4 → bars at x = -1.0, -0.5, 0.0, 0.5, 1.0
// heights = [0.6, 1.4, 2.0, 1.0, 1.6]
// -----------------------------------------------------------------------------
console.log('Test group 1: Default 5-bar chart');
const b = bar3dSDF();

// Inside middle bar (i=2), center of bar
const dMid = b.f([0, 1.0, 0]);
ok(dMid < 0, `inside middle bar at [0, 1.0, 0] (got ${dMid.toFixed(3)})`);

// Inside bar 0 (leftmost), height 0.6, center at x=-1.0
const dLeft = b.f([-1.0, 0.3, 0]);
ok(dLeft < 0, `inside leftmost bar at [-1.0, 0.3, 0] (got ${dLeft.toFixed(3)})`);

// Above bar 0 (only 0.6 tall, so y=1.5 is outside)
const dAboveLeft = b.f([-1.0, 1.5, 0]);
ok(dAboveLeft > 0, `above leftmost bar at [-1.0, 1.5, 0] (got ${dAboveLeft.toFixed(3)})`);

// Above middle bar (tallest, 2.0), y=2.5 → outside
const dAboveMid = b.f([0, 2.5, 0]);
ok(dAboveMid > 0, `above middle bar at [0, 2.5, 0] (got ${dAboveMid.toFixed(3)})`);

// Below ground (y < 0) → outside
const dBelow = b.f([0, -0.5, 0]);
ok(dBelow > 0, `below ground at [0, -0.5, 0] (got ${dBelow.toFixed(3)})`);

// Far to side
const dFar = b.f([5, 1, 0]);
ok(dFar > 3.5, `far right at [5, 1, 0] → ~3.8 (got ${dFar.toFixed(3)})`);

// In gap between bar 0 and bar 1 (x = -0.75, halfway between -1.0 and -0.5)
const dGap = b.f([-0.75, 0.3, 0]);
ok(dGap > 0, `in gap between bar 0/1 at [-0.75, 0.3, 0] (got ${dGap.toFixed(3)})`);

// -----------------------------------------------------------------------------
// Test group 2: Single bar (degenerate KPI value)
// values=[0.85], count=null → N=1, h=1.7, bar at x=0
// -----------------------------------------------------------------------------
console.log('\nTest group 2: Single bar');
const b1 = bar3dSDF({ values: [0.85] });
ok(b1.f([0, 0.85, 0]) < 0, '1-bar inside at [0, 0.85, 0]');
ok(b1.f([0, 2.0, 0]) > 0, '1-bar above at [0, 2.0, 0]');
ok(b1.f([1.0, 0.85, 0]) > 0, '1-bar far side at [1.0, 0.85, 0]');

// -----------------------------------------------------------------------------
// Test group 3: Zero value bar → skipped (no surface)
// values=[0.5, 0, 0.5], count=3
// Bar 1 (i=1, value=0) should produce no surface at x=0
// -----------------------------------------------------------------------------
console.log('\nTest group 3: Zero-value bars skipped');
const bZero = bar3dSDF({ values: [0.5, 0, 0.5], count: 3 });
// totalX = 3 * 0.4 + 2 * 0.1 = 1.4 → x = -0.5, 0, 0.5
// At middle (x=0, where bar 1 with value=0 would be) → should be NO surface, far positive
const dZeroMid = bZero.f([0, 0.5, 0]);
ok(dZeroMid > 0.05, `no surface where zero bar would be (got ${dZeroMid.toFixed(3)})`);

// -----------------------------------------------------------------------------
// Test group 4: Count override (truncate + pad)
// -----------------------------------------------------------------------------
console.log('\nTest group 4: count override');
const bTrunc = bar3dSDF({ values: [1, 1, 1, 1, 1, 1, 1, 1], count: 3 });
ok(bTrunc.ast.args[1] === 3, `truncate values via count=3 (got ast count=${bTrunc.ast.args[1]})`);

const bPad = bar3dSDF({ values: [1, 1], count: 5 });
ok(bPad.ast.args[1] === 5, `pad via count=5 (got ast count=${bPad.ast.args[1]})`);
// padded[2..4] should be 0 (no bar)
const padTotalX = 5 * 0.4 + 4 * 0.1;
const padBar3xc = -padTotalX / 2 + 0.2 + 3 * 0.5;
const dPadEmpty = bPad.f([padBar3xc, 0.5, 0]);
ok(dPadEmpty > 0.05, `padded bar 3 (value=0) has no surface (got ${dPadEmpty.toFixed(3)})`);

// -----------------------------------------------------------------------------
// Test group 5: MAX_BARS clamp (32)
// -----------------------------------------------------------------------------
console.log('\nTest group 5: MAX_BARS=32 clamping');
const b50 = bar3dSDF({ values: new Array(50).fill(0.5), count: 50 });
ok(b50.ast.args[1] === 32, `count=50 clamped to 32 (got ${b50.ast.args[1]})`);

// -----------------------------------------------------------------------------
// Test group 6: Empty + count=0
// -----------------------------------------------------------------------------
console.log('\nTest group 6: Empty / count=0');
const bEmpty = bar3dSDF({ values: [], count: 0 });
ok(bEmpty.ast.args[1] === 0, 'empty: count=0');
ok(bEmpty.f([0, 0, 0]) > 100, 'empty: SDF returns large positive (no surface)');

// -----------------------------------------------------------------------------
// Test group 7: AST padding for GLSL float[32]
// -----------------------------------------------------------------------------
console.log('\nTest group 7: AST padding');
const bSmall = bar3dSDF({ values: [0.3, 0.7] });
ok(bSmall.ast.kind === 'prim', 'AST.kind = prim');
ok(bSmall.ast.name === 'bar-3d', 'AST.name = bar-3d');
ok(Array.isArray(bSmall.ast.args[0]), 'AST.args[0] is array');
ok(bSmall.ast.args[0].length === 32, `padded to 32 (got ${bSmall.ast.args[0].length})`);
ok(bSmall.ast.args[0][0] === 0.3, 'AST.args[0][0] = 0.3');
ok(bSmall.ast.args[0][1] === 0.7, 'AST.args[0][1] = 0.7');
ok(bSmall.ast.args[0][2] === 0, 'AST.args[0][2] = 0 (padded)');
ok(bSmall.ast.args[0][31] === 0, 'AST.args[0][31] = 0 (padded tail)');
ok(bSmall.ast.args[1] === 2, `count = 2 (got ${bSmall.ast.args[1]})`);

// -----------------------------------------------------------------------------
// Test group 8: Scene integration
// -----------------------------------------------------------------------------
console.log('\nTest group 8: Scene integration (compile + GLSL emit)');
const scene = {
  v: 1,
  defaults: {
    camera: { yaw: 0.4, pitch: 0.2, distance: 8, focal: 1.5, targetX: 0, targetY: 1, targetZ: 0 },
    light: { altitude: 0.5, azimuth: 0.6, distance: 12, intensity: 1.2 },
  },
  subjects: [
    {
      type: 'bar-3d',
      id: 'test-bar',
      pos: { x: 0, y: 0, z: 0 },
      dims: { values: [0.3, 0.7, 1.0, 0.5, 0.8], barWidth: 0.4, gap: 0.1, maxHeight: 2.0 },
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
  const d = compiled.sdf.f([0, 1.0, 0]);
  ok(d < 0, `compiled SDF inside middle bar (got ${d.toFixed(3)})`);

  let glsl;
  try {
    glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
    ok(true, 'compileSDF3ToGLSL succeeded');
  } catch (e) {
    ok(false, `GLSL emit failed: ${e.message}`);
  }

  if (glsl) {
    const exprStr = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
    ok(exprStr.includes('sdBar3d'), 'GLSL emit contains sdBar3d');
    ok(exprStr.includes('float[32]'), 'GLSL emit uses float[32] array literal');
  }
}

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
