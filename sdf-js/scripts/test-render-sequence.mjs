// sdf-js/scripts/test-render-sequence.mjs
import {
  renderSequence,
  renderSequence2d,
  magnitudeToRadii,
} from '../src/scene/render-sequence.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== render-sequence (3D funnel) ===\n');

const ir = {
  structure: 'sequence',
  nodes: ['Leads', 'Qualified', 'Proposal', 'Closed'],
  magnitude: [1000, 400, 150, 40],
  emphasis: [3],
  order: [0, 1, 2, 3],
  title: 'Sales Funnel',
};

// radii: monotonically narrowing, length N+1, last is the tip
const r = magnitudeToRadii(ir.magnitude, 1.4, 0.12);
ok(r.length === 5, 'radii has N+1 boundaries');
ok(r[0] > r[1] && r[1] > r[2], 'radii narrow with magnitude');
ok(Math.abs(r[4] - 0.12) < 1e-9, 'last boundary is the tip radius');

const scene = renderSequence(ir);
// one funnel-3d subject PER stage (so each can build in independently)
const stages = scene.subjects.filter((s) => s.type === 'funnel-3d');
ok(stages.length === 4, 'one funnel-3d subject per stage (N=4)');
ok(
  stages.every((s) => s.args.stages === 1 && s.args.radii.length === 2),
  'each stage is a 1-band frustum (radii length 2)',
);
ok(
  stages[0].args.radii[0] > stages[3].args.radii[0],
  'top stage wider than bottom (radii from magnitude)',
);

// build-in: each stage animates transform.translate.y with a staggered smoothstep reveal
ok(
  stages.every(
    (s) => Array.isArray(s.animation) && s.animation[0].channel === 'transform.translate.y',
  ),
  'each stage has a translate.y build-in channel',
);
ok(
  stages.every((s) => /smoothstep\(/.test(s.animation[0].expr)),
  'build-in uses smoothstep (one-shot reveal)',
);
const starts = stages.map((s) => Number(s.animation[0].expr.match(/smoothstep\(([\d.]+)/)[1]));
ok(starts[0] < starts[3], 'reveal windows staggered by order (top reveals first)');

ok(scene.cameraSequence && scene.cameraSequence.shots.length >= 2, 'has a multi-shot fly-through');
const ys = scene.cameraSequence.shots.map((s) => s.pos[1]);
ok(ys[0] > ys[ys.length - 1], 'camera descends (fly-through)');

// labels → overlay, each with a revealAt; title present; NO baked SDF text
const labels = scene.overlay.filter((o) => o.role === 'card' || o.role === 'value');
ok(
  labels.length === 8 && labels.every((o) => typeof o.revealAt === 'number'),
  '4 cards + 4 values, each reveal-tagged',
);
ok(
  scene.overlay.some((o) => o.role === 'title'),
  'title in overlay',
);
ok(
  scene.subjects.every((s) => !/text/.test(s.type)),
  'no baked SDF text',
);

// IR-decoupling: reads label/magnitude, never x/y — deterministic from the IR
const s2 = renderSequence({ ...ir });
ok(
  JSON.stringify(s2.subjects.map((s) => s.args.radii)) ===
    JSON.stringify(scene.subjects.map((s) => s.args.radii)),
  'deterministic from IR (no x/y read)',
);

// 2D counterpart: same IR → the existing 2D funnel atom's args
const flat = renderSequence2d(ir);
ok(flat.type === 'funnel', '2D counterpart targets the funnel 2D atom');
ok(
  flat.args.stages.length === 4 &&
    flat.args.stages[0].label === 'Leads' &&
    flat.args.stages[0].value === 1000,
  '2D stages carry label+value from the IR',
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
