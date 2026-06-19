// =============================================================================
// test-compositor-api.mjs — L1 unit tests for extracted compositor APIs
// =============================================================================

import '../src/sdf/index.js';
import * as api from '../src/compositor-api.js';

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

console.log('=== compositor-api smoke test ===\n');

ok(api.DEFAULT_LIFT_MODEL === 'claude-sonnet-4-6', 'DEFAULT_LIFT_MODEL exported');

// [More tests added in Tasks 1.2-1.6]

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
