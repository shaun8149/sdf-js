// test-lift-scaffold.mjs — real 2D scaffold slot → 3D scene (multi-subject layout).
import { liftScaffoldSlot, hasTwin } from '../src/scene/lift-scaffold.js';

let pass = 0, fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== lift-scaffold (scaffold slot → 3D) ===\n');

// twin availability reflects the real registry
ok(hasTwin('bullet-list') && hasTwin('pie') && hasTwin('pyramid'), 'twinned types report hasTwin=true');
// Sprint 24 closed the X-gap: comparison-table + quote-pull now HAVE twins
ok(hasTwin('comparison-table') && hasTwin('quote-pull'), 'Sprint 24 atoms report hasTwin=true');
ok(!hasTwin('no-such-atom-xyz'), 'unknown types report hasTwin=false');

// a multi-subject slot with two of the same type
const sd = {
  name: 'market',
  layout: 'hierarchy',
  subjects: [
    { type: 'pyramid', x: 80, y: 120, w: 520, h: 520, args: { layers: [{ label: 'TAM' }, { label: 'SAM' }, { label: 'SOM' }] } },
    { type: 'kpi-card', x: 680, y: 180, w: 520, h: 180, args: { value: 12, label: 'B' } },
    { type: 'kpi-card', x: 680, y: 400, w: 250, h: 160, args: { value: 3, label: 'M' } },
    { type: 'no-such-atom-xyz', x: 950, y: 400, w: 120, h: 120, args: {} },
  ],
};
const { scene, skipped } = liftScaffoldSlot(sd, { title: 'Market Size' });

ok(scene.subjects.length === 3, 'placed 3 twinned subjects (pyramid + 2 kpi)');
ok(skipped.length === 1 && skipped[0] === 'no-such-atom-xyz', 'skipped the 1 untwinned type');

// unique ids even for same-type subjects (the dup-id bug that broke validation)
const ids = scene.subjects.map((s) => s.id);
ok(new Set(ids).size === ids.length, 'subject ids are unique per slot');

// layout: each subject positioned by its 2D box (not stacked on origin)
const xs = scene.subjects.map((s) => s.transform.translate[0]);
ok(new Set(xs.map((x) => x.toFixed(2))).size === 3, 'subjects get distinct x positions from 2D layout');
// 2D-left (pyramid, small x) → screen-left: +x world (camera is +x→screen-left)
ok(xs[0] > 0, '2D-left subject maps to +x world (screen-left)');
ok(scene.subjects.every((s) => typeof s.transform.scale === 'number'), 'each subject fit-scaled to its box');

// one slot title, no baked SDF text
ok(scene.overlay.filter((o) => o.role === 'title').length === 1, 'exactly one slot title in overlay');
ok(scene.subjects.every((s) => !/text/.test(s.type)), 'no baked SDF text subjects');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
