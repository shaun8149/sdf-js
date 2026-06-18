// =============================================================================
// test-line-3d.mjs — smoke test for Atlas chart atom #4 (line-3d)
// -----------------------------------------------------------------------------
// Verifies:
//   1. CPU SDF: points at correct (x, value*maxH) positions
//   2. Capsule segments connect adjacent points
//   3. pointRadius=0 disables markers; lineThickness=0 disables line
//   4. Closed loop connects last → first
//   5. Single point degenerate (no segments)
//   6. AST padding + GLSL emit contains sdLine3d
//
// Run:  node sdf-js/scripts/test-line-3d.mjs
// =============================================================================

import { line3dSDF } from '../src/scene/components/charts/data/line-3d.js';
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

console.log('=== line-3d smoke test ===\n');

// -----------------------------------------------------------------------------
// Test group 1: Default 6-point line
// values=[0.3,0.5,0.7,0.4,0.8,0.9], spacing=0.5, maxH=2.0
// totalX = 5*0.5 = 2.5, xStart = -1.25
// Point positions: x = -1.25, -0.75, -0.25, 0.25, 0.75, 1.25
//                  y = 0.6, 1.0, 1.4, 0.8, 1.6, 1.8
// -----------------------------------------------------------------------------
console.log('Test group 1: Default 6-point line');
const L = line3dSDF();

// At point 0 (x=-1.25, y=0.6): inside sphere marker (radius 0.08)
const dP0 = L.f([-1.25, 0.6, 0]);
ok(dP0 < 0, `inside point 0 at [-1.25, 0.6, 0] (got ${dP0.toFixed(3)})`);

// At point 5 (x=1.25, y=1.8): inside sphere marker
const dP5 = L.f([1.25, 1.8, 0]);
ok(dP5 < 0, `inside point 5 at [1.25, 1.8, 0] (got ${dP5.toFixed(3)})`);

// Midway between p0 and p1 (x=-1.0, y=(0.6+1.0)/2=0.8): on line segment (capsule)
const dMid01 = L.f([-1.0, 0.8, 0]);
ok(dMid01 < 0, `inside line segment 0-1 at [-1.0, 0.8, 0] (got ${dMid01.toFixed(3)})`);

// Far above all points
const dAbove = L.f([0, 5, 0]);
ok(dAbove > 3, `far above at [0, 5, 0] (got ${dAbove.toFixed(3)})`);

// Far to side
const dSide = L.f([5, 1, 0]);
ok(dSide > 3.5, `far right at [5, 1, 0] (got ${dSide.toFixed(3)})`);

// Below baseline (negative Y, points are all positive Y) → outside
const dBelow = L.f([0, -1, 0]);
ok(dBelow > 0.5, `below baseline at [0, -1, 0] (got ${dBelow.toFixed(3)})`);

// -----------------------------------------------------------------------------
// Test group 2: Markers-only (lineThickness = 0)
// -----------------------------------------------------------------------------
console.log('\nTest group 2: Markers only (lineThickness=0)');
const Lm = line3dSDF({
  values: [0.5, 1.0, 0.5],
  pointSpacing: 1.0,
  pointRadius: 0.15,
  lineThickness: 0,
});
// 3 points: x=-1,0,+1 with y=1,2,1
// At point 1 (x=0, y=2): inside marker (radius 0.15)
ok(Lm.f([0, 2.0, 0]) < 0, 'markers only: inside point 1 marker');
// On midpoint of segment 0-1: should be OUTSIDE (no line)
const dGapM = Lm.f([-0.5, 1.5, 0]);
ok(dGapM > 0.2, `markers only: midway between p0,p1 outside (got ${dGapM.toFixed(3)})`);

// -----------------------------------------------------------------------------
// Test group 3: Line-only (pointRadius = 0)
// -----------------------------------------------------------------------------
console.log('\nTest group 3: Line only (pointRadius=0)');
const Ll = line3dSDF({
  values: [0.5, 1.0, 0.5],
  pointSpacing: 1.0,
  pointRadius: 0,
  lineThickness: 0.1,
});
// Midway on segment 0-1 (x=-0.5, y=1.5): inside capsule
ok(Ll.f([-0.5, 1.5, 0]) < 0, 'line only: midway on segment is inside');
// Slightly beyond first point (x=-1.5, y=1): should be outside (line doesn't extend)
const dExt = Ll.f([-1.5, 1, 0]);
ok(dExt > 0.05, `line only: beyond first point outside (got ${dExt.toFixed(3)})`);

// -----------------------------------------------------------------------------
// Test group 4: Closed loop
// values=[1.0, 0.5, 0.5] forms a triangle when closed; without closed,
// just a 3-point line.
// -----------------------------------------------------------------------------
console.log('\nTest group 4: Closed loop');
const Lc = line3dSDF({
  values: [1.0, 0.5, 0.5],
  pointSpacing: 1.0,
  pointRadius: 0.05,
  lineThickness: 0.1,
  closed: true,
});
// With closed=true, segment from last point (x=+1, y=1) → first point (x=-1, y=2) exists.
// Midpoint of that connector: (0, 1.5)
const dClosed = Lc.f([0, 1.5, 0]);
ok(dClosed < 0, `closed loop: midway on closing segment inside (got ${dClosed.toFixed(3)})`);

// Same point without closed=false should be OUTSIDE
const Lo = line3dSDF({
  values: [1.0, 0.5, 0.5],
  pointSpacing: 1.0,
  pointRadius: 0.05,
  lineThickness: 0.1,
  closed: false,
});
const dOpen = Lo.f([0, 1.5, 0]);
ok(dOpen > 0.05, `open: same point outside (got ${dOpen.toFixed(3)})`);

// -----------------------------------------------------------------------------
// Test group 5: Single-point degenerate
// -----------------------------------------------------------------------------
console.log('\nTest group 5: Single point');
const L1 = line3dSDF({ values: [0.7], pointRadius: 0.2, lineThickness: 0.1 });
// 1 point at x=0, y=1.4 (totalX=0, xStart=0). Marker only (no line, no segments).
ok(L1.f([0, 1.4, 0]) < 0, '1-point: inside marker');
ok(L1.f([1, 1.4, 0]) > 0.5, '1-point: far side outside');

// -----------------------------------------------------------------------------
// Test group 6: AST + scene integration
// -----------------------------------------------------------------------------
console.log('\nTest group 6: AST + scene integration');
const Last = line3dSDF({ values: [0.3, 0.7], closed: true });
ok(Last.ast.kind === 'prim', 'AST.kind = prim');
ok(Last.ast.name === 'line-3d', `AST.name = line-3d (got ${Last.ast.name})`);
ok(Array.isArray(Last.ast.args[0]), 'AST.args[0] is array');
ok(Last.ast.args[0].length === 32, `padded to 32 (got ${Last.ast.args[0].length})`);
ok(Last.ast.args[1] === 2, 'AST count = 2');
ok(Last.ast.args[6] === 1, 'AST closedFlag = 1 for closed=true');

const Last2 = line3dSDF({ values: [0.5], closed: false });
ok(Last2.ast.args[6] === 0, 'AST closedFlag = 0 for closed=false');

// Scene integration
const scene = {
  v: 1,
  defaults: {
    camera: { yaw: 0.4, pitch: 0.2, distance: 8, focal: 1.5, targetX: 0, targetY: 1, targetZ: 0 },
    light: { altitude: 0.5, azimuth: 0.6, distance: 12, intensity: 1.2 },
  },
  subjects: [
    {
      type: 'line-3d',
      id: 'test-line',
      pos: { x: 0, y: 0, z: 0 },
      dims: {
        values: [0.3, 0.5, 0.7, 0.4, 0.8, 0.9],
        pointSpacing: 0.5,
        pointRadius: 0.08,
        lineThickness: 0.04,
        maxHeight: 2.0,
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
  // At point 0: x=-1.25, y=0.6
  const d = compiled.sdf.f([-1.25, 0.6, 0]);
  ok(d < 0, `compiled SDF inside point 0 (got ${d.toFixed(3)})`);

  let glsl;
  try {
    glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
    ok(true, 'compileSDF3ToGLSL succeeded');
  } catch (e) {
    ok(false, `GLSL emit failed: ${e.message}`);
  }

  if (glsl) {
    const exprStr = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
    ok(exprStr.includes('sdLine3d'), 'GLSL emit contains sdLine3d');
    ok(exprStr.includes('float[32]'), 'GLSL emit uses float[32] array literal');
  }
}

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
