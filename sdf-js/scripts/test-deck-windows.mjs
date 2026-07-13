// sdf-js/scripts/test-deck-windows.mjs — deck window timeline + slicing invariants.
// Guards the per-station shader switch (M3 perf): assembleDeck must emit a
// contiguous window timeline, and sliceDeckWindow must cut each window down to
// its own stations (plus shared world dressing) without touching the camera.
import { assembleDeck, sliceDeckWindow } from '../src/scene/assemble-deck.js';
import { windowIndexAt } from '../src/runtime/deck-shader-windows.js';
import { expandAndCompile } from '../src/runtime/apply-studio-scene.js';
import { expandModifiers } from '../src/scene/modifiers.js';

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
const stationIds = (s, k) => s.subjects.filter((x) => x.collection === `station-${k}`).length;
const halfX = (s) => {
  const a = s.args || {};
  if (Array.isArray(a.dims)) return a.dims[0] / 2;
  if (a.radius != null) return a.radius;
  return 0.8;
};
const xBoundsOf = (subjects) => {
  const b = { min: Infinity, max: -Infinity };
  for (const s of subjects) {
    const t = (s.transform && s.transform.translate) || [0, 0, 0];
    const h = halfX(s);
    b.min = Math.min(b.min, t[0] - h);
    b.max = Math.max(b.max, t[0] + h);
  }
  return b;
};
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
    tr.subjects.some((x) => x.collection === 'path-0'),
    'transit slice keeps the breadcrumb path it flies over',
  );
}
{
  // finale-LOD: the money shot keeps the ANCHOR station real (the camera
  // rises from it — nothing swaps in front of the lens) and stands proxies
  // in for every other station; runways + dressing stay, proxies never leak
  // into normal windows.
  const fin = sliceOf(5);
  ok(fin.subjects.length < scene.subjects.length, 'finale slice is lighter than the full world');
  ok(wins[5].anchor === 2, 'finale anchor = last station');
  ok(stationIds(fin, 2) > 0, 'finale keeps the anchor station real');
  ok(stationIds(fin, 0) === 0 && stationIds(fin, 1) === 0, 'far-station content leaves the finale');
  const proxies = fin.subjects.filter((x) => (x.collection || '').startsWith('proxy-'));
  ok(
    proxies
      .map((x) => x.collection)
      .sort()
      .join(',') === 'proxy-0,proxy-1',
    'every non-anchor station stands as a silhouette proxy',
  );
  ok(
    fin.subjects.some((x) => x.collection === 'path-0'),
    'runways stay in the finale (the world lines)',
  );
  {
    const proxy0 = proxies.find((x) => x.collection === 'proxy-0');
    const real0 = expandModifiers({
      subjects: scene.subjects.filter((x) => x.collection === 'station-0'),
    }).subjects;
    const pb = xBoundsOf([proxy0]);
    const rb = xBoundsOf(real0);
    ok(
      pb.min <= rb.min + 1e-9 && pb.max >= rb.max - 1e-9,
      'finale proxy bounds include modifier-expanded station geometry',
    );
  }
  ok(
    [0, 1, 2, 3, 4].every(
      (i) => !sliceOf(i).subjects.some((x) => (x.collection || '').startsWith('proxy-')),
    ),
    'proxies never appear in normal windows',
  );
}

// ---- horizon-hill trimming (super-linear shader cost: every leaf counts) ------
{
  const hills = (s) => s.subjects.filter((x) => x.collection === 'horizon');
  const fullHills = hills(scene).length;
  ok(fullHills > 7, `full deck rings ${fullHills} monoliths (needs trimming to matter)`);
  // ambience tiers: data stations trim the skyline hard (focus on the data),
  // transits keep a mid budget (no tier field → content default)
  ok(hills(sliceOf(0)).length === 3, 'content station window trims to 3 skyline monoliths');
  ok(hills(sliceOf(1)).length === 3, 'transit window trims to 3 skyline monoliths');
  {
    const heroScene = assembleDeck(
      { title: 'h', slides: [{ structure: 'hold', title: 'c', nodes: [] }, ir('x')] },
      { stage: true },
    );
    const hw = heroScene.deckWindows.find((w) => w.kind === 'station' && w.tier === 'hero');
    ok(!!hw, 'hold stations are tier hero');
    ok(
      hills(sliceDeckWindow(heroScene, hw)).length === 7,
      'hero windows keep the full skyline (7 monoliths)',
    );
  }
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
  // nearest-K invariant checked against the CONTENT budget below
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

// ---- section color program -----------------------------------------------------
{
  const palette = {
    anchor: [241, 70, 22],
    colors: [
      [241, 70, 22],
      [43, 154, 233],
      [168, 124, 42],
      [1, 119, 86],
    ],
  };
  const deck2 = {
    title: 'c',
    slides: [
      { structure: 'hold', title: 'cover', nodes: [] },
      ir('a'),
      ir('b'),
      { structure: 'hold', title: 'mid', nodes: ['x'] },
      ir('c'),
    ],
  };
  const sc = assembleDeck(deck2, { stage: true, palette });
  // Wave A: assembled decks carry material REFS — deref via the registry
  const matOf = (scene, s) =>
    typeof s.material === 'string' ? scene.materials[s.material] : s.material;
  const chips = sc.overlay.filter((o) => o.role === 'value' && o.accentColor);
  ok(chips.length > 0, 'value chips carry the station accent color');
  const stationHues = new Set();
  for (const sub of sc.subjects) {
    if (!/-mono-1$/.test(sub.id || '')) continue; // id = identity...
    const m = /^station-(\d+)$/.exec(sub.collection || ''); // ...collection = whose
    if (m) stationHues.add(`${m[1]}:${matOf(sc, sub).hue.toFixed(3)}`);
  }
  const hues = [...stationHues].map((x) => x.split(':')[1]);
  ok(new Set(hues).size >= 2, `content stations rotate hues (${[...stationHues].join(' ')})`);
  const noPal = assembleDeck(deck2, { stage: true });
  const blue = noPal.subjects.find((x) => /^s1-mono-1$/.test(x.id));
  ok(
    Math.abs(matOf(noPal, blue).hue - 0.595) < 0.02,
    'no palette → classic blue family (back-compat)',
  );
}

// ---- windowIndexAt ------------------------------------------------------------
ok(windowIndexAt(wins, 0) === 0, 'windowIndexAt(0) → first window');
ok(windowIndexAt(wins, wins[1].start + 0.01) === 1, 'windowIndexAt lands mid-transit');
ok(windowIndexAt(wins, total + 99) === wins.length - 1, 'past the end → finale window');
ok(windowIndexAt(wins, -1) === 0, 'negative time clamps to first window');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
