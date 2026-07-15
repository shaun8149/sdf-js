// sdf-js/scripts/test-render-hierarchy.mjs — hierarchy → cone tree renderer.
import { readFileSync } from 'node:fs';
import { renderHierarchy, coneTreeLayout } from '../src/scene/render-hierarchy.js';
import { renderIR } from '../src/scene/render-ir.js';
import { validateIR } from '../src/scene/ir.js';
import { compile } from '../src/scene/index.js';
import { expandStage } from '../src/scene/stage.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== render-hierarchy (cone tree) ===\n');

const ir = JSON.parse(readFileSync(new URL('../scenes/ir/org-tree.json', import.meta.url), 'utf8'));

// ---- IR validation ------------------------------------------------------------
ok(validateIR(ir).ok, 'org-tree fixture validates');
ok(
  !validateIR({ structure: 'hierarchy', nodes: ['a', 'b'] }).ok,
  'hierarchy without relations rejected',
);
ok(
  !validateIR({ structure: 'hierarchy', nodes: ['a', 'b', 'c'], relations: [[0, 1]] }).ok,
  'two roots rejected (exactly one root)',
);
ok(
  !validateIR({ structure: 'hierarchy', nodes: ['a', 'b'], relations: [[0, 5]] }).ok,
  'out-of-range relation rejected',
);

// ---- cone-tree layout ----------------------------------------------------------
{
  const { pos, level, root, maxLevel } = coneTreeLayout(ir);
  ok(root === 0, 'root found (no parent)');
  ok(maxLevel === 2, 'depth = 2 for the org fixture');
  ok(pos[0][1] > pos[1][1] && pos[1][1] > pos[4][1], 'levels descend in y (root on top)');
  // siblings fan AROUND the parent — the three VPs must not be collinear in x
  // (the 2D-org-chart failure mode); at least one uses the z axis.
  const vps = [1, 2, 3].map((i) => pos[i]);
  ok(
    vps.some((p) => Math.abs(p[2]) > 0.3),
    'siblings occupy z (true 3D fan, not a flat line)',
  );
  ok(level[5] === 2 && level[8] === 2, 'grandchildren on level 2');
}

// ---- scene shape ---------------------------------------------------------------
{
  const scene = renderHierarchy(ir);
  const nodeSubjects = scene.subjects.filter((s) => s.id.startsWith('node-'));
  ok(nodeSubjects.length === 9, 'one subject per node');
  // STATIC GEOMETRY (user-locked 2026-07-15): only the CAMERA animates — the
  // whole tree stands from frame one, matching the source org chart.
  ok(
    nodeSubjects.every((s) => !s.animation),
    'nodes carry NO build-in animation (camera owns all motion)',
  );
  // edges ride with the CHILD subject (union: ball + up-link capsule)
  const withLink = nodeSubjects.filter((s) => s.children.some((c) => c.type === 'capsule'));
  ok(withLink.length === 8, 'every non-root node carries its up-link capsule');

  // fighting-game grammar: rises to a crane peak, descends, has the super, ends wide
  const shots = scene.cameraSequence.shots;
  const ys = shots.map((s) => s.pos[1]);
  const peakIdx = ys.indexOf(Math.max(...ys));
  ok(ys[0] < ys[peakIdx], 'opens low (hero at the root), rises to the crane');
  ok(Math.min(...ys.slice(peakIdx)) < ys[peakIdx] - 2, 'descends through the levels');
  const superShot = shots.find(
    (s) => s.transition === 'cut' && (Array.isArray(s.shake) ? s.shake[0] : s.shake || 0) >= 0.2,
  );
  ok(
    !!superShot && Array.isArray(superShot.exposure),
    'super punch-in (cut + shake + exposure pop)',
  );
  ok((shots[shots.length - 1].focalDistance || 0) > 5, 'ends on a wide payoff frame');

  // labels: one card per node, level-staggered reveals; no baked SDF text
  const cards = scene.overlay.filter((o) => o.role === 'card');
  ok(
    cards.length === 9 && cards.every((o) => typeof o.revealAt === 'number'),
    '9 reveal-tagged cards',
  );
  ok(
    scene.subjects.every((s) => !/text/.test(s.type)),
    'no baked SDF text',
  );

  // deterministic from IR
  const again = renderHierarchy(JSON.parse(JSON.stringify(ir)));
  ok(JSON.stringify(again.subjects) === JSON.stringify(scene.subjects), 'deterministic from IR');

  // compiles end-to-end
  try {
    compile(expandStage(scene), {});
    ok(true, 'compiles to SDF (studio-ready)');
  } catch (e) {
    ok(false, `compile failed: ${e.message}`);
  }
}

// ---- dispatcher ----------------------------------------------------------------
{
  ok(renderIR(ir).name.startsWith('(hierarchy)'), 'renderIR dispatches hierarchy');
  ok(
    renderIR({ structure: 'sequence', nodes: ['A', 'B'], magnitude: [2, 1] }).name.startsWith(
      '(sequence)',
    ),
    'renderIR dispatches sequence',
  );
  let threw = false;
  try {
    renderIR({ structure: 'nope', nodes: ['A'] });
  } catch {
    threw = true;
  }
  ok(threw, 'renderIR throws on unknown structure');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
