// sdf-js/scripts/test-ir.mjs
import { validateIR, STRUCTURES } from '../src/scene/ir.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== ir (validateIR) ===\n');

ok(STRUCTURES.includes('sequence'), 'sequence is a known structure');

const good = {
  structure: 'sequence',
  nodes: ['A', 'B', 'C'],
  magnitude: [100, 40, 10],
  order: [0, 1, 2],
};
ok(validateIR(good).ok, 'a well-formed sequence IR validates');

ok(!validateIR({ structure: 'nope', nodes: ['A'] }).ok, 'unknown structure rejected');
ok(!validateIR({ structure: 'sequence', nodes: [] }).ok, 'empty nodes rejected');
ok(
  !validateIR({ structure: 'sequence', nodes: ['A', 'B'], magnitude: [1] }).ok,
  'magnitude length must match nodes',
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
