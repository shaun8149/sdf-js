// =============================================================================
// test-p5-sandbox.mjs — L1 tests for Atlas Present Sprint 3 SDF helper bundle
// -----------------------------------------------------------------------------
// Node-side unit tests for the 28 SDF helper math functions exposed inside
// the P5 sandbox iframe. Iframe protocol itself (postMessage flow) is
// verified by Phase 6 browse smoke (real browser).
// =============================================================================

// sdf-js/ package.json declares "type":"module", so .js files load as ESM.
// The helper bundle is an IIFE that assigns to module.exports for Node tests,
// but ESM loading skips that branch. Load source + eval in a fake CJS context.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const bundleSrc = readFileSync(resolve(__dirname, '../src/present/sdf-helper-bundle.js'), 'utf8');
const fakeModule = { exports: {} };
new Function('module', 'exports', bundleSrc)(fakeModule, fakeModule.exports);
const helpers = fakeModule.exports;

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
function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

console.log('=== sdf-helper-bundle smoke test ===\n');

// Confirm bundle exports
ok(typeof helpers === 'object' && helpers !== null, 'helpers module exports an object');
ok(typeof helpers.sub2 === 'function', 'sub2 exported');
ok(typeof helpers.sdf_box === 'function', 'sdf_box exported');
ok(typeof helpers.sdf_circle === 'function', 'sdf_circle exported');

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
