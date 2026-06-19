// =============================================================================
// test-waypoint-tween.mjs — L1 unit tests for camera tween module
// =============================================================================

import * as tw from '../src/present/waypoint-tween.js';

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

console.log('=== waypoint-tween smoke test ===\n');

// [More tests added in Tasks 2.2-2.4]

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
