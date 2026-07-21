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
ok(
  !validateIR({ structure: 'sequence', nodes: ['A', 'B'], order: [0, 2] }).ok,
  'order indices must reference existing nodes',
);
ok(
  !validateIR({ structure: 'sequence', nodes: ['A', 'B'], emphasis: [2] }).ok,
  'node emphasis indices must reference existing nodes',
);
ok(
  !validateIR({ structure: 'sequence', nodes: ['A', 'B'], emphasis: 1 }).ok,
  'node emphasis must be an index array',
);
ok(
  validateIR({
    structure: 'proportion',
    groups: [{ values: [1, 2] }, { values: [2, 1] }],
    emphasis: 1,
  }).ok,
  'proportion scalar emphasis validates against groups',
);
ok(
  !validateIR({
    structure: 'proportion',
    groups: [{ values: [1, 2] }, { values: [2, 1] }],
    emphasis: 2,
  }).ok,
  'proportion emphasis must reference an existing group',
);
ok(
  validateIR({
    structure: 'roadmap',
    milestones: [{ label: 'A' }, { label: 'B' }],
    emphasis: 1,
  }).ok,
  'roadmap scalar emphasis validates against milestones',
);
ok(
  !validateIR({
    structure: 'roadmap',
    milestones: [{ label: 'A' }, { label: 'B' }],
    emphasis: 2,
  }).ok,
  'roadmap emphasis must reference an existing milestone',
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
