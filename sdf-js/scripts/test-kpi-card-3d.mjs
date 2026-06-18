// =============================================================================
// test-kpi-card-3d.mjs — smoke test for Atlas chart atom #6 (kpi-card-3d)
// -----------------------------------------------------------------------------
// Verifies:
//   1. Rounded box geometry: inside / outside / corners
//   2. Corner radius clamping (> half of smallest dim)
//   3. Semantic AST metadata: value/label/unit/trend/trendValue stored
//   4. Scene integration: GLSL emit contains sdRoundedBox
//
// Run:  node sdf-js/scripts/test-kpi-card-3d.mjs
// =============================================================================

import { kpiCard3dSDF } from '../src/scene/components/charts/data/kpi-card-3d.js';
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

console.log('=== kpi-card-3d smoke test ===\n');

// -----------------------------------------------------------------------------
// Test group 1: Default card (1.6 × 1.0 × 0.15, cornerR=0.08)
// half-extents: 0.8 X, 0.5 Y, 0.075 Z
// -----------------------------------------------------------------------------
console.log('Test group 1: Default card geometry');
const K = kpiCard3dSDF();

// At origin: deeply inside
ok(K.f([0, 0, 0]) < -0.05, `origin → deep inside (got ${K.f([0, 0, 0]).toFixed(3)})`);

// Just inside on +X (x=0.7, well within 0.8 half-width)
ok(K.f([0.7, 0, 0]) < 0, `inside +X at [0.7, 0, 0]`);

// Just outside on +X (x=0.9, beyond 0.8 half-width)
ok(K.f([0.9, 0, 0]) > 0, `outside +X at [0.9, 0, 0] (got ${K.f([0.9, 0, 0]).toFixed(3)})`);

// Just outside on +Y (y=0.6, beyond 0.5 half-height)
ok(K.f([0, 0.6, 0]) > 0, `outside +Y at [0, 0.6, 0]`);

// Way above on +Z (z=1.0, far beyond 0.075 half-depth)
const dAbove = K.f([0, 0, 1.0]);
ok(dAbove > 0.9, `far above +Z at [0, 0, 1.0] → ~0.925 (got ${dAbove.toFixed(3)})`);

// At corner (0.7, 0.4, 0): should be inside-ish (within rounded corner area)
ok(K.f([0.7, 0.4, 0]) < 0, `inside corner area at [0.7, 0.4, 0]`);

// -----------------------------------------------------------------------------
// Test group 2: Corner radius clamping
// width=0.4, height=0.4, depth=0.4, cornerRadius=10 → should clamp to 0.2 (half)
// -----------------------------------------------------------------------------
console.log('\nTest group 2: Corner radius clamping');
const Kclamp = kpiCard3dSDF({ width: 0.4, height: 0.4, depth: 0.4, cornerRadius: 10 });
ok(
  Kclamp.ast.args[3] === 0.2,
  `cornerR=10 clamped to 0.2 = half of smallest dim (got ${Kclamp.ast.args[3]})`,
);

// -----------------------------------------------------------------------------
// Test group 3: Different aspect ratios
// -----------------------------------------------------------------------------
console.log('\nTest group 3: Aspect ratios');
const Kwide = kpiCard3dSDF({ width: 3, height: 0.6, depth: 0.2 });
ok(Kwide.f([1.4, 0, 0]) < 0, 'wide card: inside at x=1.4 (within 1.5 half-w)');
ok(Kwide.f([1.6, 0, 0]) > 0, 'wide card: outside at x=1.6');
ok(Kwide.f([0, 0.4, 0]) > 0, 'wide card: outside at y=0.4 (beyond 0.3 half-h)');

const Ktall = kpiCard3dSDF({ width: 0.6, height: 2, depth: 0.2 });
ok(Ktall.f([0, 0.9, 0]) < 0, 'tall card: inside at y=0.9');
ok(Ktall.f([0.4, 0, 0]) > 0, 'tall card: outside at x=0.4');

// -----------------------------------------------------------------------------
// Test group 4: Semantic AST metadata stored
// -----------------------------------------------------------------------------
console.log('\nTest group 4: Semantic metadata in AST');
const Ksem = kpiCard3dSDF({
  width: 1.8,
  height: 1.0,
  value: 42,
  label: 'Q3 Revenue',
  unit: 'M',
  trend: 'up',
  trendValue: 12,
});
ok(Ksem.ast.kind === 'prim', 'AST.kind = prim');
ok(Ksem.ast.name === 'kpi-card-3d', `AST.name = kpi-card-3d`);
ok(Ksem.ast.args[0] === 1.8, 'AST.args[0] = width 1.8');
ok(Ksem.ast.args[4] === 42, 'AST.args[4] = value 42');
ok(Ksem.ast.args[5] === 'Q3 Revenue', `AST.args[5] = label "Q3 Revenue"`);
ok(Ksem.ast.args[6] === 'M', `AST.args[6] = unit "M"`);
ok(Ksem.ast.args[7] === 'up', `AST.args[7] = trend "up"`);
ok(Ksem.ast.args[8] === 12, 'AST.args[8] = trendValue 12');

// -----------------------------------------------------------------------------
// Test group 5: Scene integration
// -----------------------------------------------------------------------------
console.log('\nTest group 5: Scene integration');
const scene = {
  v: 1,
  defaults: {
    camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
    light: { altitude: 0.5, azimuth: 0.6, distance: 10, intensity: 1.2 },
  },
  subjects: [
    {
      type: 'kpi-card-3d',
      id: 'test-card',
      pos: { x: 0, y: 0, z: 0 },
      dims: { width: 1.6, height: 1.0, depth: 0.15, cornerRadius: 0.1, value: 99, label: 'Test' },
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
  const d = compiled.sdf.f([0, 0, 0]);
  ok(d < 0, `compiled SDF inside card at origin (got ${d.toFixed(3)})`);

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
      exprStr.includes('sdRoundedBox'),
      'GLSL emit uses sdRoundedBox (delegated to existing primitive)',
    );
  }
}

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
