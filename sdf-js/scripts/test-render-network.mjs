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
  ok(
    [...nodesS, ...edgesS].every(
      (s) => Array.isArray(s.animation) && s.animation[0].channel === 'transform.translate.y',
    ),
    'every node AND edge has a build-in',
  );
  // wiring order: all nodes land before the first edge starts
  const t0 = (s) => Number(s.animation[0].expr.match(/smoothstep\(([\d.]+)/)[1]);
  ok(Math.max(...nodesS.map(t0)) < Math.min(...edgesS.map(t0)), 'edges wire AFTER nodes land');

  // fighting-game grammar
  const shots = scene.cameraSequence.shots;
  const ys = shots.map((s) => s.pos[1]);
  const peakIdx = ys.indexOf(Math.max(...ys));
  ok(peakIdx > 0 && peakIdx < shots.length - 1, 'crane peak mid-sequence (hero → crane → tour)');
  const superShot = shots.find((s) => s.transition === 'cut' && (s.shake || 0) >= 0.2);
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

// ---- dispatcher -------------------------------------------------------------------
ok(renderIR(ir).name.startsWith('(network)'), 'renderIR dispatches network');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
