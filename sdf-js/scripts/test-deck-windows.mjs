// sdf-js/scripts/test-deck-windows.mjs — deck window timeline + slicing invariants.
// Guards the per-station shader switch (M3 perf): assembleDeck must emit a
// contiguous window timeline, and sliceDeckWindow must cut each window down to
// its own stations (plus shared world dressing) without touching the camera.
import { assembleDeck, sliceDeckWindow } from '../src/scene/assemble-deck.js';
import { attachDeckWindows, windowIndexAt } from '../src/runtime/deck-shader-windows.js';
import { expandAndCompile, pickRenderScale } from '../src/runtime/apply-studio-scene.js';

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

// ---- horizon-hill trimming (super-linear shader cost: every leaf counts) ------
{
  const hills = (s) =>
    s.subjects.filter((x) => typeof x.id === 'string' && x.id.startsWith('horizon-'));
  const fullHills = hills(scene).length;
  ok(fullHills > 6, `full deck rings ${fullHills} hills (needs trimming to matter)`);
  ok(hills(sliceOf(0)).length === 6, 'station window keeps only the 6 nearest hills');
  ok(hills(sliceOf(1)).length === 6, 'transit window keeps only the 6 nearest hills');
  ok(
    Array.isArray(wins[0].origin) && wins[0].origin.length === 3,
    'station window carries its origin (nearest-hill anchor)',
  );
  // nearest means nearest: every kept hill is at most as far as every dropped one
  const d2 = (x, o) => {
    const t = (x.transform && x.transform.translate) || [0, 0, 0];
    return (t[0] - o[0]) ** 2 + (t[2] - o[2]) ** 2;
  };
  const keptIds = new Set(hills(sliceOf(0)).map((x) => x.id));
  const kept = hills(scene).filter((x) => keptIds.has(x.id));
  const dropped = hills(scene).filter((x) => !keptIds.has(x.id));
  const maxKept = Math.max(...kept.map((x) => d2(x, wins[0].origin)));
  const minDropped = Math.min(...dropped.map((x) => d2(x, wins[0].origin)));
  ok(maxKept <= minDropped + 1e-9, 'kept hills are the nearest ones to the window origin');
}

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

// ---- runtime feature wiring ---------------------------------------------------
// Regression: attachDeckWindows used to swap only the SDF. If window 0 was a
// cheap 2x-SSAA slice and the finale was the full heavy scene, the finale kept
// 2x internal resolution and could hit the GPU watchdog / black-screen path.
{
  const lightSubjects = Array.from({ length: 4 }, (_, i) => ({
    id: `s0-box-${i}`,
    type: 'box',
    args: { dims: [0.4, 0.4, 0.4] },
    transform: { translate: [i * 0.7, 0.2, 0] },
  }));
  const heavySubjects = Array.from({ length: 20 }, (_, i) => ({
    id: `s1-box-${i}`,
    type: 'box',
    args: { dims: [0.4, 0.4, 0.4] },
    transform: { translate: [i * 0.7, 0.2, 2] },
  }));
  const runtimeScene = {
    v: 1,
    name: 'window scale regression',
    subjects: [...lightSubjects, ...heavySubjects],
    cameraSequence: {
      loop: false,
      shots: [{ duration: 2, pos: [0, 3, 8], target: [0, 0.5, 0], fov: 45 }],
    },
    defaults: {
      camera: { yaw: 0, pitch: -0.1, distance: 8, focal: 1, targetX: 0, targetY: 0, targetZ: 0 },
      light: { azimuth: 0.5, altitude: 0.7, distance: 20, intensity: 1 },
    },
    deckWindows: [
      { kind: 'station', stations: [0], start: 0, end: 1, origin: [0, 0, 0] },
      { kind: 'finale', stations: [0, 1], start: 1, end: 2 },
    ],
  };
  ok(pickRenderScale(sliceDeckWindow(runtimeScene, runtimeScene.deckWindows[0])) === 2.0, 'fixture starts light');
  ok(pickRenderScale(sliceDeckWindow(runtimeScene, runtimeScene.deckWindows[1])) === 1.0, 'fixture finale is heavy');

  const oldRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 0);
  const scales = [];
  const animated = [];
  const studio = {
    setPostFx() {},
    setRuneHeightmap() {},
    setVolumes() {},
    setSequence() {},
    setRenderScale: (s) => scales.push(s),
    setAnimated: (v) => animated.push(!!v),
    render: () => ({}),
    precompile: () => Promise.resolve(true),
    swapSDF: () => ({}),
    isSequenceActive: () => true,
    getPresentationTime: () => 0,
  };
  try {
    const handle = attachDeckWindows(studio, runtimeScene, { holdDuringWarmup: false });
    await handle.warmed;
    handle.detach();
  } finally {
    if (oldRaf) globalThis.requestAnimationFrame = oldRaf;
    else delete globalThis.requestAnimationFrame;
  }
  ok(scales[0] === 2.0, 'runtime applies opening window renderScale');
  ok(scales.includes(1.0), 'runtime lowers renderScale before heavy finale swap');
  ok(scales[scales.length - 1] === 2.0, 'warmup restores opening window renderScale');
  ok(animated.length >= 3, 'runtime refreshes per-window animated state while warming');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
