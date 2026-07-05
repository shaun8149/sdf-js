// sdf-js/scripts/test-assemble-deck.mjs — deck assembly: N IRs → one world.
import { readFileSync } from 'node:fs';
import { assembleDeck, shiftBuildInExpr } from '../src/scene/assemble-deck.js';
import { renderIR } from '../src/scene/render-ir.js';
import { compile } from '../src/scene/index.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== assemble-deck (N IRs → one continuous world) ===\n');

// ---- expr shifting (the strict parser) ----------------------------------------
{
  ok(
    shiftBuildInExpr('3.505 - 0.9 * smoothstep(0.25, 0.85, t)', 2, 10) ===
      '5.505 - 0.9 * smoothstep(10.25, 10.85, t)',
    'drop expr shifts in y and t',
  );
  ok(
    shiftBuildInExpr('-1.500 + 2.000 * smoothstep(0.20, 0.80, t)', 0, 5.5) ===
      '-1.500 + 2.000 * smoothstep(5.70, 6.30, t)',
    'erupt expr shifts in t only',
  );
  let threw = false;
  try {
    shiftBuildInExpr('sin(t) * 3.0', 0, 1);
  } catch {
    threw = true;
  }
  ok(threw, 'unknown expr shape throws (fail loud)');
}

const deck = JSON.parse(
  readFileSync(new URL('../scenes/ir/deck-pitch.json', import.meta.url), 'utf8'),
);

{
  const scene = assembleDeck(deck);
  const stations = deck.slides.map((ir) => renderIR(ir));

  // subjects: sum of stations, prefixed, spatially separated by stride
  const expected = stations.reduce((s, st) => s + st.subjects.length, 0);
  ok(scene.subjects.length === expected, `all station subjects present (${expected})`);
  ok(
    scene.subjects.every((s) => /^s\d+-/.test(s.id)),
    'ids prefixed per station (no collisions)',
  );
  const xOf = (pfx) => {
    const xs = scene.subjects
      .filter((s) => s.id.startsWith(pfx))
      .map((s) => s.transform.translate[0]);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  ok(
    xOf('s1-') - xOf('s0-') > 10 && xOf('s2-') - xOf('s1-') > 10,
    'stations spaced along the deck axis',
  );

  // camera: all station shots + one transit between each pair
  const shotCount =
    stations.reduce((s, st) => s + st.cameraSequence.shots.length, 0) + (deck.slides.length - 1);
  ok(scene.cameraSequence.shots.length === shotCount, 'shot count = stations + transits');
  const transits = scene.cameraSequence.shots.filter((s) => (s.shake || 0) > 0.1 && s.fov === 50);
  ok(transits.length === 2, 'two transit shots (stage transitions)');

  // time: station k's build-ins start after station k-1's camera time has elapsed
  const t0Of = (pfx) =>
    Math.min(
      ...scene.subjects
        .filter((s) => s.id.startsWith(pfx) && s.animation)
        .map((s) => Number(s.animation[0].expr.match(/smoothstep\((-?[\d.]+)/)[1])),
    );
  const dur0 = stations[0].cameraSequence.shots.reduce((s, sh) => s + sh.duration, 0);
  ok(t0Of('s1-') >= dur0, 'station 2 build-ins wait for station 1 to play out');
  ok(t0Of('s2-') > t0Of('s1-'), 'stations reveal in deck order');

  // overlay: anchors moved with stations; titles reveal with their slide
  const titles = scene.overlay.filter((o) => o.role === 'title');
  ok(titles.length === 3 && titles[1].anchor[0] > 10, 'three station titles, placed at stations');
  ok(titles[0].revealAt === 0 && titles[1].revealAt > 10, 'later titles reveal later');

  // still ONE studio-compilable SceneData
  try {
    compile(scene, {});
    ok(true, 'the whole deck compiles as one scene');
  } catch (e) {
    ok(false, `compile failed: ${e.message}`);
  }

  // deterministic
  const again = assembleDeck(JSON.parse(JSON.stringify(deck)));
  ok(JSON.stringify(again) === JSON.stringify(scene), 'deterministic');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
