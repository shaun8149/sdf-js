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

// STATIC GEOMETRY (user-locked 2026-07-15): only the CAMERA animates. A stage
// that drops in is at the wrong height every frame but the last, so the funnel
// never matches its source page while it plays; and geometry moving under a
// moving camera splits the viewer's attention.
ok(
  stages.every((s) => !s.animation),
  'stages carry NO build-in animation (camera owns all motion)',
);

ok(scene.cameraSequence && scene.cameraSequence.shots.length >= 4, 'has a multi-shot fly-through');
// fighting-game grammar: low hero opening → crane peak → spiral descent →
// hard-cut punch-in on the emphasis stage (shake + exposure pop) → wide payoff.
const shots = scene.cameraSequence.shots;
const ys = shots.map((s) => s.pos[1]);
const peakIdx = ys.indexOf(Math.max(...ys));
ok(ys[0] < ys[peakIdx], 'opens low (hero angle), rises to the crane peak');
ok(Math.min(...ys.slice(peakIdx)) < ys[peakIdx] - 2, 'descends from the peak (fly-through)');
const superShot = shots.find(
  (s) => s.transition === 'cut' && (Array.isArray(s.shake) ? s.shake[0] : s.shake || 0) >= 0.2,
);
ok(!!superShot, 'has a hard-cut punch-in with heavy shake (the super)');
ok(Array.isArray(superShot?.exposure), 'super shot pops exposure (ramp)');
ok(
  shots.some((s) => Math.abs(s.pos[0]) > 0.8 && s.transition === 'blend'),
  'descent orbits off-axis (spiral)',
);
ok((shots[shots.length - 1].focalDistance || 0) > 4, 'ends on a wide payoff frame');

// labels → overlay, each with a revealAt; title present; NO baked SDF text
const labels = scene.overlay.filter((o) => o.role === 'screen' || o.role === 'value');
ok(
  labels.length === 8 && labels.every((o) => typeof o.revealAt === 'number'),
  '4 subtitle names + 4 anchored values, each reveal-tagged',
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
