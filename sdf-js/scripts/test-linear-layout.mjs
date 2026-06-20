// =============================================================================
// test-linear-layout.mjs — L1 unit tests for Linear archetype region computation
// =============================================================================

import * as ll from '../src/present/linear-layout.js';

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

function approxEq(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

console.log('=== linear-layout smoke test ===\n');

ok(ll.DEFAULT_SPACING === 6, 'DEFAULT_SPACING === 6');

// [More tests added in Tasks 2.2-2.3]

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
