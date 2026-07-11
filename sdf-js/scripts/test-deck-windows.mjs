// sdf-js/scripts/test-deck-windows.mjs — deck window timeline + slicing invariants.
// Guards the per-station shader switch (M3 perf): assembleDeck must emit a
// contiguous window timeline, and sliceDeckWindow must cut each window down to
// its own stations (plus shared world dressing) without touching the camera.
import { assembleDeck, sliceDeckWindow } from '../src/scene/assemble-deck.js';
import { windowIndexAt } from '../src/runtime/deck-shader-windows.js';
import { expandAndCompile } from '../src/runtime/apply-studio-scene.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== deck windows (timeline + slice + compile) ===\n');

const ir = (t) => ({
  structure: 'magnitude',
  title: t,
  nodes: ['A', 'B', 'C'],
  magnitude: [3, 2, 1],
});
const deck = { title: 'perf', slides: [ir('one'), ir('two'), ir('three')] };
const scene = assembleDeck(deck, { stage: true });
const wins = scene.deckWindows;
const total = scene.cameraSequence.shots.reduce((s, sh) => s + sh.duration, 0);

// ---- timeline shape ----------------------------------------------------------
ok(Array.isArray(wins) && wins.length === 6, `3 slides → 6 windows (got ${wins && wins.length})`);
ok(
  wins.map((w) => w.kind).join(',') === 'station,transit,station,transit,station,finale',
  'kind sequence station/transit alternates, finale last',
);
ok(wins[0].start === 0, 'first window starts at 0');
ok(
  wins.every((w, i) => i === 0 || Math.abs(w.start - wins[i - 1].end) < 1e-9),
  'windows are contiguous',
);
ok(Math.abs(wins[wins.length - 1].end - total) < 1e-9, `last window ends at total (${total})`);
ok(
  wins[1].stations.join(',') === '0,1' && wins[3].stations.join(',') === '1,2',
  'transit windows carry both endpoint stations',
);
ok(wins[5].stations.join(',') === '0,1,2', 'finale window carries all stations');

// ---- slicing ------------------------------------------------------------------
const sliceOf = (i) => sliceDeckWindow(scene, wins[i]);
const stationIds = (s, k) => s.subjects.filter((x) => x.id && x.id.startsWith(`s${k}-`)).length;
{
  const s1 = sliceOf(2); // station window of slide 1
  ok(stationIds(s1, 1) > 0, 'station slice keeps its own subjects');
  ok(stationIds(s1, 0) === 0 && stationIds(s1, 2) === 0, 'station slice drops other stations');
  ok(s1.subjects.length < scene.subjects.length, 'station slice is smaller than the full deck');
  ok(s1.cameraSequence === scene.cameraSequence, 'slice shares the full camera sequence');
  ok(s1.defaults === scene.defaults, 'slice shares deck defaults (postFx/lights unchanged)');
}
{
  const tr = sliceOf(1); // transit 0→1
  ok(stationIds(tr, 0) > 0 && stationIds(tr, 1) > 0, 'transit slice keeps both endpoint stations');
  ok(stationIds(tr, 2) === 0, 'transit slice drops the far station');
  ok(
    tr.subjects.some((x) => x.id && x.id.startsWith('path-0-')),
    'transit slice keeps the breadcrumb path it flies over',
  );
}
ok(sliceOf(5).subjects.length === scene.subjects.length, 'finale slice is the full world');

// ---- every slice must actually compile to an SDF ------------------------------
for (let i = 0; i < wins.length; i++) {
  let sdf = null;
  try {
    sdf = expandAndCompile(sliceOf(i)).sdf;
  } catch (e) {
    /* fall through */
  }
  ok(!!sdf, `window ${i} (${wins[i].kind}) slice compiles to an SDF`);
}

// ---- windowIndexAt ------------------------------------------------------------
ok(windowIndexAt(wins, 0) === 0, 'windowIndexAt(0) → first window');
ok(windowIndexAt(wins, wins[1].start + 0.01) === 1, 'windowIndexAt lands mid-transit');
ok(windowIndexAt(wins, total + 99) === wins.length - 1, 'past the end → finale window');
ok(windowIndexAt(wins, -1) === 0, 'negative time clamps to first window');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
