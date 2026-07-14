// sdf-js/scripts/test-courtyard.mjs — Wave 4: the courtyard archetype.
// Verifies the debate-revised promises EXACTLY as rewritten — "visible at
// DESIGNATED shot moments" (threshold/overlook/finale), zone arcs readable in
// plan, cover-as-centerpiece, massing budget conservation, collapse guard.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assembleDeck, sliceDeckWindow } from '../src/scene/assemble-deck.js';
import { validate } from '../src/scene/spec.js';
import { expandStage } from '../src/scene/stage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK = JSON.parse(readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp.json'), 'utf8'));

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== courtyard archetype (Wave 4) ===\n');

const scene = assembleDeck(DECK, { layout: 'courtyard' });
const stations = new Map(
  scene.deckWindows.filter((w) => w.kind === 'station').map((w) => [w.stations[0], w.origin]),
);

// ---- plan: cover at the centre, chapters as arc clusters ------------------------
{
  const o0 = stations.get(0);
  ok(Math.hypot(o0[0], o0[2]) < 1e-9, 'cover hold station sits at the courtyard centre');
  const ringR = Math.hypot(stations.get(2)[0], stations.get(2)[2]);
  const allOnRing = [...stations.entries()]
    .filter(([k]) => k !== 0)
    .every(([, o]) => Math.abs(Math.hypot(o[0], o[2]) - ringR) < 1e-6);
  ok(allOnRing, `all content stations on one ring (R=${ringR.toFixed(1)})`);
  // chapter seams: angular gap between zone neighbors < gap across a boundary
  const ang = (k) => {
    const o = stations.get(k);
    return Math.atan2(o[0], o[2]);
  };
  const gap = (a, b) => {
    let d = Math.abs(ang(a) - ang(b));
    return Math.min(d, 2 * Math.PI - d);
  };
  ok(
    // 2026-07-14 PDF 保真重排:zones = [0,1][2..6][7..13][14..19][20..22]
    // → 章边界 6|7 与 13|14
    gap(2, 3) < gap(6, 7) && gap(8, 9) < gap(13, 14),
    'zone-boundary seams wider than intra-zone rhythm',
  );
}

// ---- camera: the vista lives in DESIGNATED beats --------------------------------
{
  // Blind-test round 1: thresholds became TRANSIT windows (full-world
  // boundaries popped geometry — the continuity break radial won on).
  const fullWins = scene.deckWindows.filter((w) => w.kind === 'finale');
  ok(fullWins.length === 2, `only overlook + finale stay full-world (${fullWins.length})`);
  const transits = scene.deckWindows.filter((w) => w.kind === 'transit');
  ok(
    transits.length === DECK.slides.length - 1 + DECK.zones.length - 1,
    `12 slings + 3 threshold slings, all plain transit windows (${transits.length})`,
  );
  const cover = scene.deckWindows.find((w) => w.kind === 'station' && w.stations[0] === 0);
  ok(
    cover.stations.length === 1,
    'cover window stays single-station (48s-to-first-frame regression guard)',
  );
  const overlook = scene.cameraSequence.shots.find((sh) => sh.beat === 'overlook');
  ok(!!overlook, 'overlook beat exists (the TOC page 3D twin)');
  ok(
    overlook && Math.abs(overlook.target[0]) < 1e-6 && Math.abs(overlook.target[2]) < 1e-6,
    'overlook looks at the courtyard centre',
  );
  // timeline stays contiguous: windows tile [0, total] with no gaps
  const winsSorted = [...scene.deckWindows].sort((a, b) => a.start - b.start);
  let tiled = Math.abs(winsSorted[0].start) < 1e-6;
  for (let i = 1; i < winsSorted.length; i++)
    tiled = tiled && Math.abs(winsSorted[i].start - winsSorted[i - 1].end) < 1e-6;
  const total = scene.cameraSequence.shots.reduce((s, sh) => s + sh.duration, 0);
  tiled = tiled && Math.abs(winsSorted[winsSorted.length - 1].end - total) < 1e-6;
  ok(tiled, 'window timeline tiles the full presentation with no gaps');
}

// ---- massing: budget conservation + never distance-culled -----------------------
{
  const massing = scene.subjects.filter((s) => s.collection === 'massing');
  ok(
    massing.length === DECK.zones.length * 2 + 3,
    `1 hull + 1 tower per chapter + 3 world-heart proxies (${massing.length})`,
  );
  const heart = massing.filter((s) => s.id.startsWith('massing-center-'));
  ok(heart.length === 3, 'world-heart proxy present (centre never vanishes between windows)');
  // NaN in a translate bakes 'NaN' into GLSL and kills the whole program at
  // compile — caught live once (centroid accumulator read [2] of an [x,z] pair)
  ok(
    massing.every((s) => s.transform.translate.every((v) => Number.isFinite(v))),
    'all massing positions finite (GLSL NaN guard)',
  );
  const ringR2 = Math.hypot(stations.get(2)[0], stations.get(2)[2]);
  ok(
    massing
      .filter((s) => !s.id.startsWith('massing-center-'))
      .every((s) => {
        const t = s.transform.translate;
        return Math.abs(Math.hypot(t[0], t[2]) - (ringR2 + 34)) < ringR2 * 0.35;
      }),
    'chapter massing sits in the fixed band outside the ring',
  );
  const stWin = scene.deckWindows.find((w) => w.kind === 'station' && w.stations[0] === 3);
  const sliced = sliceDeckWindow(scene, stWin);
  const keptMassing = sliced.subjects.filter((s) => s.collection === 'massing');
  ok(keptMassing.length === massing.length, 'station window keeps ALL massing (never culled)');
  const hills = sliced.subjects.filter((s) => s.collection === 'horizon');
  ok(hills.length === 0, `slab quota yields to massing (slabs=${hills.length}, conservation)`);
  ok(
    massing
      .map((s) => (typeof s.material === 'string' ? scene.materials[s.material] : s.material))
      .every((m) => m.value <= 0.35 && m.glow === 0),
    'massing stays silhouette-dark (subtle discipline)',
  );
}

// ---- collapse guard + fallback ---------------------------------------------------
{
  const warnings = [];
  const orig = console.warn;
  console.warn = (m) => warnings.push(String(m));
  // 1-station chapters → must refuse courtyard and produce the plain radial
  const thin = assembleDeck(
    { title: 't', zones: [[0], [1], [2]], slides: DECK.slides.slice(0, 3) },
    { layout: 'courtyard' },
  );
  const noZones = assembleDeck(
    { title: 't', slides: DECK.slides.slice(0, 3) },
    { layout: 'courtyard' },
  );
  console.warn = orig;
  ok(warnings.length === 2, 'both degenerate cases warn loudly');
  const radial = assembleDeck(
    { title: 't', slides: DECK.slides.slice(0, 3) },
    { layout: 'radial' },
  );
  ok(
    JSON.stringify(thin.subjects.map((s) => s.transform.translate)) ===
      JSON.stringify(radial.subjects.map((s) => s.transform.translate)),
    '1-station-chapter deck degrades to exactly the shipped radial',
  );
  ok(
    JSON.stringify(noZones.subjects.map((s) => s.transform.translate)) ===
      JSON.stringify(radial.subjects.map((s) => s.transform.translate)),
    'zone-less deck degrades to exactly the shipped radial',
  );
}

// ---- total continuity (2026-07-12 directive): deck playback never cuts ----------
{
  for (const layout of ['radial', 'courtyard']) {
    const s = assembleDeck(DECK, { layout });
    const cuts = s.cameraSequence.shots.filter((sh, i) => i > 0 && sh.transition !== 'blend');
    ok(cuts.length === 0, `${layout}: zero cut transitions in deck playback (${cuts.length})`);
  }
}

// ---- determinism + validity ------------------------------------------------------
{
  const again = assembleDeck(DECK, { layout: 'courtyard' });
  ok(JSON.stringify(again) === JSON.stringify(scene), 'courtyard assembly is deterministic');
  const v = validate(expandStage(assembleDeck(DECK, { layout: 'courtyard', stage: true })));
  ok(v.ok, `staged courtyard validates${v.ok ? '' : ` — ${v.errors[0]}`}`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
