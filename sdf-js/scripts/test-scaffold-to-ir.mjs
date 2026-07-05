// sdf-js/scripts/test-scaffold-to-ir.mjs
import { funnelSlotToIR } from '../src/scene/scaffold-to-ir.js';
import { validateIR } from '../src/scene/ir.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== scaffold-to-ir (funnel) ===\n');

const slot = {
  name: 'ask',
  subjects: [
    {
      type: 'funnel',
      x: 80,
      y: 120,
      w: 520,
      h: 480,
      args: {
        title: 'Sales Funnel',
        stages: [
          { label: 'Leads', value: 1000 },
          { label: 'Qualified', value: 400 },
          { label: 'Proposal', value: 150 },
          { label: 'Closed', value: 40 },
        ],
      },
    },
  ],
};

const ir = funnelSlotToIR(slot);
ok(validateIR(ir).ok, 'produces a valid IR');
ok(ir.structure === 'sequence', 'structure = sequence');
ok(
  JSON.stringify(ir.nodes) === JSON.stringify(['Leads', 'Qualified', 'Proposal', 'Closed']),
  'nodes from stage labels',
);
ok(
  JSON.stringify(ir.magnitude) === JSON.stringify([1000, 400, 150, 40]),
  'magnitude from stage values',
);
ok(
  !JSON.stringify(ir).includes('120') && !JSON.stringify(ir).includes('520'),
  'IR carries no x/y/w/h',
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
