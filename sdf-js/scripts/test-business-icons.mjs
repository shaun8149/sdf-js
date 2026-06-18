// =============================================================================
// test-business-icons.mjs — smoke test for Atlas atom #7 (business-icon set)
// -----------------------------------------------------------------------------
// Verifies:
//   1. All 10 icons compile + return finite SDF at origin
//   2. Far-away points return positive distance (outside bounding region)
//   3. Inside-icon probe for representative shape per icon
//   4. AST dispatcher: iconId maps name correctly
//   5. Unknown name falls back to 'check' (id=2)
//   6. Scene integration + GLSL emit contains sdBusinessIcon
//
// Run:  node sdf-js/scripts/test-business-icons.mjs
// =============================================================================

import { businessIconSDF, ICON_NAMES, ICON_IDS } from '../src/scene/components/icons/business.js';
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

console.log('=== business-icon smoke test ===\n');

// -----------------------------------------------------------------------------
// Test group 1: All 10 icons compile + produce finite SDF
// -----------------------------------------------------------------------------
console.log('Test group 1: All 10 icons compile + produce finite SDF');
for (const name of ICON_NAMES) {
  const icon = businessIconSDF({ name });
  const d = icon.f([0, 0, 0]);
  ok(Number.isFinite(d), `${name}: SDF at origin is finite (got ${d.toFixed(3)})`);
}

// -----------------------------------------------------------------------------
// Test group 2: All icons return large positive distance when far away
// -----------------------------------------------------------------------------
console.log('\nTest group 2: All icons outside at far point [10, 10, 10]');
for (const name of ICON_NAMES) {
  const icon = businessIconSDF({ name });
  const d = icon.f([10, 10, 10]);
  ok(d > 5, `${name}: far point → positive distance ≥5 (got ${d.toFixed(3)})`);
}

// -----------------------------------------------------------------------------
// Test group 3: Inside-icon probes (shape-specific)
// -----------------------------------------------------------------------------
console.log('\nTest group 3: Inside-icon probes');

// arrow-up: apex at (0, 0.5) should be on stroke
ok(businessIconSDF({ name: 'arrow-up' }).f([0, 0.5, 0]) < 0.05, 'arrow-up: apex inside stroke');
// arrow-down: apex at (0, -0.5)
ok(businessIconSDF({ name: 'arrow-down' }).f([0, -0.5, 0]) < 0.05, 'arrow-down: apex inside');
// check: midpoint of long leg
ok(businessIconSDF({ name: 'check' }).f([0.25, 0, 0]) < 0.1, 'check: along long leg inside');
// x-mark: center of X
ok(businessIconSDF({ name: 'x-mark' }).f([0, 0, 0]) < 0, 'x-mark: center inside (both diagonals)');
// dollar: vertical bar center
ok(businessIconSDF({ name: 'dollar' }).f([0, 0, 0]) < 0, 'dollar: vertical bar center inside');
// percent: center of top sphere (-0.25, 0.25)
ok(
  businessIconSDF({ name: 'percent' }).f([-0.25, 0.25, 0]) < 0,
  'percent: top sphere center inside',
);
// person: head center (0, 0.2)
ok(businessIconSDF({ name: 'person' }).f([0, 0.2, 0]) < 0, 'person: head center inside');
// gear: outer ring (at angle 0, r=0.5)
ok(businessIconSDF({ name: 'gear' }).f([0.5, 0, 0]) < 0.1, 'gear: outer ring inside');
// document: center (0, 0, 0) inside
ok(businessIconSDF({ name: 'document' }).f([0, 0, 0]) < 0, 'document: center inside');
// calendar: center inside
ok(businessIconSDF({ name: 'calendar' }).f([0, 0, 0]) < 0, 'calendar: center inside');

// -----------------------------------------------------------------------------
// Test group 4: AST dispatcher
// -----------------------------------------------------------------------------
console.log('\nTest group 4: AST dispatcher');
for (const [name, expectedId] of Object.entries(ICON_IDS)) {
  const icon = businessIconSDF({ name });
  ok(icon.ast.args[0] === expectedId, `${name}: AST iconId = ${expectedId}`);
  ok(icon.ast.args[4] === name, `${name}: AST name preserved = "${name}"`);
}

// -----------------------------------------------------------------------------
// Test group 5: Unknown name fallback
// -----------------------------------------------------------------------------
console.log('\nTest group 5: Unknown name fallback');
const unknown = businessIconSDF({ name: 'not-a-real-icon' });
ok(
  unknown.ast.args[0] === 2,
  `unknown name → fallback to check (id=2, got ${unknown.ast.args[0]})`,
);

// -----------------------------------------------------------------------------
// Test group 6: Scene integration
// -----------------------------------------------------------------------------
console.log('\nTest group 6: Scene integration');
const scene = {
  v: 1,
  defaults: {
    camera: { yaw: 0.4, pitch: 0.2, distance: 6, focal: 1.5, targetX: 0, targetY: 0, targetZ: 0 },
    light: { altitude: 0.5, azimuth: 0.6, distance: 10, intensity: 1.2 },
  },
  subjects: [
    {
      type: 'business-icon',
      id: 'test-icon',
      pos: { x: 0, y: 0, z: 0 },
      dims: { name: 'check', size: 1.0, thickness: 0.15, depth: 0.15 },
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
  let glsl;
  try {
    glsl = compileSDF3ToGLSL(compiled.sdf, { time: 'u_time' });
    ok(true, 'compileSDF3ToGLSL succeeded');
  } catch (e) {
    ok(false, `GLSL emit failed: ${e.message}`);
  }

  if (glsl) {
    const exprStr = typeof glsl === 'string' ? glsl : glsl.expr || JSON.stringify(glsl);
    ok(exprStr.includes('sdBusinessIcon'), 'GLSL emit contains sdBusinessIcon dispatcher call');
  }
}

// -----------------------------------------------------------------------------
console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
