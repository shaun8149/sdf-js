// =============================================================================
// test-cube-3d.mjs — L1 unit tests for the cube-3d atom
// -----------------------------------------------------------------------------
// Probe-style SDF assertions. ~30 assertions across 6 groups:
//   1. Arrangements (10 layouts × positions verified)
//   2. Materials (3 — solid / wireframe / glass — tree-shape verified)
//   3. Connectors (4 — verify primitive count + placement)
//   4. Labels (3 modes + labelMaterial='extruded')
//   5. Per-cube transforms (cubeSizes / cubeRotations / cubeOffsets)
//   6. Edge cases (count=1, count=0, invalid combos)
// =============================================================================

import '../src/sdf/index.js';
import {
  cube3dSDF,
  ARRANGEMENTS,
  autoColor,
  cubeAutoId,
} from '../src/scene/components/shapes/cube-3d.js';

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

console.log('=== cube-3d smoke test ===\n');

// [Test groups added in subsequent phase tasks]

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
