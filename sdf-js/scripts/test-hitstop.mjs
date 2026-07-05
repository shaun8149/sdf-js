// sdf-js/scripts/test-hitstop.mjs — fighting-game frame freeze (time warp).
import { readFileSync } from 'node:fs';
import { warpTime, unwarpTime } from '../src/scene/camera-sequence.js';
import { renderIR } from '../src/scene/render-ir.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';
import { validate as validateSceneData } from '../src/scene/spec.js';
import { expandStage } from '../src/scene/stage.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== hitstop (whole-world frame freeze) ===\n');

// ---- warp math -----------------------------------------------------------------
{
  const stops = [{ at: 2.0, hold: 0.5 }];
  ok(warpTime(1.5, stops) === 1.5, 'before the stop: 1:1');
  ok(warpTime(2.2, stops) === 2.0, 'during the hold: frozen at `at`');
  ok(warpTime(2.5, stops) === 2.0, 'end of hold: still frozen');
  ok(Math.abs(warpTime(3.0, stops) - 2.5) < 1e-9, 'after: resumes, shifted by hold');
  // two stops chain
  const two = [
    { at: 1.0, hold: 0.2 },
    { at: 3.0, hold: 0.3 },
  ];
  ok(Math.abs(warpTime(4.6, two) - 4.1) < 1e-9, 'multiple stops accumulate');
  // unwarp inverts (presentation → raw), across both stops
  for (const T of [0.5, 1.0, 2.0, 3.5]) {
    ok(Math.abs(warpTime(unwarpTime(T, two), two) - T) < 1e-9, `unwarp∘warp = id @ T=${T}`);
  }
  ok(warpTime(9, null) === 9 && unwarpTime(9, []) === 9, 'no stops → identity');
}

// ---- every structure carries a super hitstop at the cut -------------------------
{
  const irs = [
    { structure: 'sequence', nodes: ['A', 'B', 'C'], magnitude: [9, 4, 1], title: 't' },
    {
      structure: 'hierarchy',
      nodes: ['r', 'a', 'b'],
      relations: [
        [0, 1],
        [0, 2],
      ],
      title: 't',
    },
    {
      structure: 'network',
      nodes: ['a', 'b', 'c'],
      relations: [
        [0, 1],
        [1, 2],
      ],
      title: 't',
    },
    { structure: 'magnitude', nodes: ['a', 'b'], magnitude: [5, 2], title: 't' },
  ];
  for (const ir of irs) {
    const scene = renderIR(ir);
    const stops = scene.cameraSequence.hitstops;
    ok(Array.isArray(stops) && stops.length === 1, `${ir.structure}: one hitstop`);
    // the stop lands just inside the super (cut) shot's window
    const shots = scene.cameraSequence.shots;
    const cutIdx = shots.findIndex((s) => s.transition === 'cut');
    const cutStart = shots.slice(0, cutIdx).reduce((s, sh) => s + sh.duration, 0);
    ok(
      stops[0].at >= cutStart && stops[0].at < cutStart + shots[cutIdx].duration,
      `${ir.structure}: hitstop inside the super`,
    );
    const v = validateSceneData(expandStage(scene));
    ok(v.ok !== false || !v.errors?.length, `${ir.structure}: scene still validates`);
  }
}

// ---- deck shifts hitstops onto the deck timeline ---------------------------------
{
  const deck = JSON.parse(
    readFileSync(new URL('../scenes/ir/deck-pitch.json', import.meta.url), 'utf8'),
  );
  const scene = assembleDeck(deck);
  const stops = scene.cameraSequence.hitstops;
  ok(stops.length === 3, 'three stations → three hitstops');
  ok(stops[0].at < stops[1].at && stops[1].at < stops[2].at, 'sorted along the deck timeline');
  ok(stops[1].at > 12, 'station 2 hitstop shifted past station 1 + transit');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
