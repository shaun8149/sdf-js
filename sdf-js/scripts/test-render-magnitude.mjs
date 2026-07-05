// sdf-js/scripts/test-render-magnitude.mjs — magnitude → monolith row renderer.
import { readFileSync } from 'node:fs';
import { renderMagnitude } from '../src/scene/render-magnitude.js';
import { renderIR } from '../src/scene/render-ir.js';
import { validateIR } from '../src/scene/ir.js';
import { compile } from '../src/scene/index.js';
import { expandStage } from '../src/scene/stage.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== render-magnitude (monolith row) ===\n');

const ir = JSON.parse(
  readFileSync(new URL('../scenes/ir/revenue-regions.json', import.meta.url), 'utf8'),
);

ok(validateIR(ir).ok, 'revenue fixture validates');
ok(
  !validateIR({ structure: 'magnitude', nodes: ['a', 'b'] }).ok,
  'magnitude without a magnitude array rejected',
);

{
  const scene = renderMagnitude(ir);
  const monos = scene.subjects.filter((s) => s.id.startsWith('mono-'));
  ok(monos.length === 5, 'one monolith per category');
  ok(
    monos.every((s) => s.type === 'rounded_box'),
    'monoliths are beveled (hewn stone)',
  );
  ok(
    scene.subjects.filter((s) => s.id.startsWith('plinth-')).length === 5,
    'each monolith has a plinth',
  );
  // honest encoding: height linear in magnitude, equal footprints
  const h = Object.fromEntries(monos.map((s) => [s.id, s.args.dims[1]]));
  ok(Math.abs(h['mono-2'] / h['mono-1'] - 890 / 620) < 0.01, 'heights linear in magnitude');
  ok(
    monos.every((s) => s.args.dims[0] === monos[0].args.dims[0]),
    'equal footprints',
  );
  // rise-not-drop: animated y starts BELOW the final position
  const startsBelow = monos.every((s) => {
    const m = s.animation[0].expr.match(/^(-?[\d.]+) \+ ([\d.]+) \* smoothstep/);
    return m && Number(m[1]) < s.transform.translate[1];
  });
  ok(startsBelow, 'monoliths ERUPT from underground (rise, not drop)');

  // fighting-game grammar: hero low at the champion → crane → tracking beats → super → wide
  const shots = scene.cameraSequence.shots;
  ok(shots[0].pos[1] < 1 && shots[0].target[1] > 1, 'hero shot looks UP at the champion');
  const ys = shots.map((s) => s.pos[1]);
  const peakIdx = ys.indexOf(Math.max(...ys));
  ok(peakIdx === 1, 'crane peak is beat 2');
  // tracking: consecutive mid shots move along x
  const xs = shots.slice(2, 2 + 5).map((s) => s.pos[0]);
  ok(new Set(xs.map((x) => x.toFixed(2))).size === 5, 'tracking shot dollies along the row');
  const superShot = shots.find(
    (s) => s.transition === 'cut' && (Array.isArray(s.shake) ? s.shake[0] : s.shake || 0) >= 0.2,
  );
  ok(
    !!superShot && Array.isArray(superShot.exposure),
    'super punch-in (cut + shake + exposure pop)',
  );
  ok(superShot.target[1] > superShot.pos[1], 'super looks UP the emphasis monolith');
  ok(
    Array.isArray(superShot.ambient) && superShot.ambient[0] < 0.5,
    'super crashes the ambient (spotlight moment)',
  );
  ok((shots[shots.length - 1].focalDistance || 0) > 5, 'ends on a wide payoff frame');

  // labels: 5 name cards + 5 value chips, reveal-tagged
  const cards = scene.overlay.filter((o) => o.role === 'card');
  const values = scene.overlay.filter((o) => o.role === 'value');
  ok(cards.length === 5 && values.length === 5, '5 cards + 5 values');
  ok(
    [...cards, ...values].every((o) => typeof o.revealAt === 'number'),
    'all reveal-tagged',
  );

  // deterministic + compiles
  const again = renderMagnitude(JSON.parse(JSON.stringify(ir)));
  ok(JSON.stringify(again.subjects) === JSON.stringify(scene.subjects), 'deterministic from IR');
  try {
    compile(expandStage(scene), {});
    ok(true, 'compiles to SDF (studio-ready)');
  } catch (e) {
    ok(false, `compile failed: ${e.message}`);
  }
}

ok(renderIR(ir).name.startsWith('(magnitude)'), 'renderIR dispatches magnitude');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
