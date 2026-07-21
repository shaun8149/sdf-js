// sdf-js/scripts/test-render-network.mjs — network → constellation renderer.
import { readFileSync } from 'node:fs';
import { renderNetwork, constellationLayout } from '../src/scene/render-network.js';
import { renderIR } from '../src/scene/render-ir.js';
import { validateIR } from '../src/scene/ir.js';
import { compile } from '../src/scene/index.js';
import { expandStage } from '../src/scene/stage.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== render-network (constellation) ===\n');

const ir = JSON.parse(
  readFileSync(new URL('../scenes/ir/ecosystem.json', import.meta.url), 'utf8'),
);

// ---- IR validation ------------------------------------------------------------
ok(validateIR(ir).ok, 'ecosystem fixture validates');
ok(!validateIR({ structure: 'network', nodes: ['a', 'b'] }).ok, 'network without edges rejected');
ok(
  !validateIR({ structure: 'network', nodes: ['a', 'b'], relations: [[1, 1]] }).ok,
  'self-loop rejected',
);

// ---- layout ---------------------------------------------------------------------
{
  const { pos, degree, hub } = constellationLayout(ir);
  ok(hub === 5 || degree[hub] === Math.max(...degree), 'hub = highest-degree node');
  ok(
    pos.every((p) => p[1] > 0.3),
    'whole cloud floats above the floor',
  );
  // true 3D: nodes must occupy all three axes
  const spread = (k) => Math.max(...pos.map((p) => p[k])) - Math.min(...pos.map((p) => p[k]));
  ok(spread(0) > 1 && spread(1) > 0.8 && spread(2) > 1, 'cloud spreads in x, y AND z');
  // determinism
  const again = constellationLayout(JSON.parse(JSON.stringify(ir)));
  ok(JSON.stringify(again.pos) === JSON.stringify(pos), 'layout deterministic');
  // connected nodes end up nearer than the cloud diameter (springs worked)
  const d = (a, b) =>
    Math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1], pos[a][2] - pos[b][2]);
  const dia = Math.max(...ir.relations.map(([a, b]) => d(a, b)));
  ok(dia < 6, `edges reasonably short after relaxation (max ${dia.toFixed(2)})`);
}

// ---- scene shape ----------------------------------------------------------------
{
  const scene = renderNetwork(ir);
  const nodesS = scene.subjects.filter((s) => s.id.startsWith('net-node-'));
  const edgesS = scene.subjects.filter((s) => s.id.startsWith('net-edge-'));
  ok(nodesS.length === 10, 'one subject per node');
  ok(edgesS.length === 14, 'one subject per edge');
  // STATIC GEOMETRY (user-locked 2026-07-15): only the CAMERA animates — the
  // graph is fully wired from frame one, matching the source diagram.
  ok(
    [...nodesS, ...edgesS].every((s) => !s.animation),
    'nodes and edges carry NO build-in animation (camera owns all motion)',
  );

  // fighting-game grammar
  const shots = scene.cameraSequence.shots;
  const ys = shots.map((s) => s.pos[1]);
  // hero opens LOW inside the cloud; the crane lifts high; the tour + payoff
  // stay high (rays exit the cloud into the floor fast — the sparse-scene
  // march-cost fix). So: crane above hero, and nothing after drops back to
  // hero level except the super punch-in.
  ok(ys[1] > ys[0] + 0.5, 'crane lifts well above the in-cloud hero');
  ok(ys[2] > ys[0], 'tour stays high (grounded rays, not eye-level fly-through)');
  const superShot = shots.find(
    (s) => s.transition === 'cut' && (Array.isArray(s.shake) ? s.shake[0] : s.shake || 0) >= 0.2,
  );
  ok(
    !!superShot && Array.isArray(superShot.exposure),
    'super punch-in (cut + shake + exposure pop)',
  );
  ok((shots[shots.length - 1].focalDistance || 0) > 4, 'ends on a wide payoff frame');

  const cards = scene.overlay.filter((o) => o.role === 'card');
  ok(
    cards.length === 10 && cards.every((o) => typeof o.revealAt === 'number'),
    '10 reveal-tagged cards',
  );

  try {
    compile(expandStage(scene), {});
    ok(true, 'compiles to SDF (studio-ready)');
  } catch (e) {
    ok(false, `compile failed: ${e.message}`);
  }
}

// ---- flywheel form (form:'cycle') --------------------------------------------------
{
  const { flywheelLayout, cycleMembers } = await import('../src/scene/render-network.js');
  // the 2015 BP p22 shape: engine feeds a 3-node cycle
  const fly = {
    structure: 'network',
    form: 'cycle',
    title: '推荐引擎加速内容生态效率',
    nodes: ['推荐引擎', '分发', '互动', '创作'],
    relations: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 1],
      [1, 3],
      [2, 1],
    ],
    emphasis: [0],
  };
  const inC = cycleMembers(fly);
  ok(!inC[0] && inC[1] && inC[2] && inC[3], 'cycle members: engine out, loop in');
  const { ring, centers } = flywheelLayout(fly);
  ok(ring.join(',') === '1,2,3' && centers.join(',') === '0', 'ring order follows the flow');
  const scene = renderNetwork(fly);
  ok(scene.name.startsWith('(network·flywheel)'), 'cycle form renders as flywheel');
  const hub = scene.subjects.find((s) => s.id === 'fly-hub-0');
  ok(
    !!hub &&
      Math.abs(hub.transform.translate[0]) < 1e-9 &&
      Math.abs(hub.transform.translate[2]) < 1e-9,
    'engine stands at the hub',
  );
  const ringNodes = scene.subjects.filter((s) => s.id.startsWith('fly-node-'));
  ok(
    ringNodes.length === 3 &&
      ringNodes.every((s) => {
        const [x, , z] = s.transform.translate;
        return Math.abs(Math.hypot(x, z) - 2.5) < 1e-6;
      }),
    'ring nodes sit on the rim at equal radius',
  );
  ok(
    scene.subjects.filter((s) => s.id.startsWith('fly-arc-')).length === 18 &&
      scene.subjects.filter((s) => s.id.startsWith('fly-tip-')).length === 9,
    'directed rim arcs with arrowheads (3 arcs × 6 segs + 3×3 tips)',
  );
  const superShot = scene.cameraSequence.shots.find((s) => s.beat === 'super');
  ok(!!superShot && superShot.transition === 'cut', 'flywheel keeps the super punch-in');
  ok(scene.subjects.length <= 60, `leaf budget sane (${scene.subjects.length} ≤ 60)`);
  try {
    compile(expandStage(scene), {});
    ok(true, 'flywheel compiles to SDF');
  } catch (e) {
    ok(false, `flywheel compile failed: ${e.message}`);
  }
  // a cycle too thin for a wheel falls back to the constellation
  const thin = {
    ...fly,
    relations: [
      [0, 1],
      [1, 0],
    ],
    nodes: ['a', 'b'],
  };
  ok(
    renderNetwork({ ...thin, form: 'cycle' }).name.startsWith('(network)'),
    'thin cycle falls back',
  );
  const large = {
    structure: 'network',
    form: 'cycle',
    title: 'oversized flywheel',
    nodes: Array.from({ length: 10 }, (_, i) => `n${i}`),
    relations: Array.from({ length: 10 }, (_, i) => [i, (i + 1) % 10]),
  };
  ok(
    renderNetwork(large).name.startsWith('(network)'),
    'oversized cycle falls back before exceeding the studio subject budget',
  );
}

// ---- dispatcher -------------------------------------------------------------------
ok(renderIR(ir).name.startsWith('(network)'), 'renderIR dispatches network');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
