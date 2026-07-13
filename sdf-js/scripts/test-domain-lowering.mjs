// sdf-js/scripts/test-domain-lowering.mjs — Wave C: domain-rep lowering.
// The load-bearing claim is NUMERIC: for every qualifying modifier, the
// lowered DomainGroup and the expanded instances are THE SAME SIGNED
// DISTANCE FIELD. We sample the CPU SDF on a grid around the geometry and
// pin |f_lowered − f_expanded| < 1e-6 — a wrong yaw convention, mirror
// plane or center offset fails loudly here, no eyeballs needed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expandModifiers } from '../src/scene/modifiers.js';
import { assembleDeck, sliceDeckWindow } from '../src/scene/assemble-deck.js';
import { expandAndCompile } from '../src/runtime/apply-studio-scene.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK = JSON.parse(readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp.json'), 'utf8'));

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== domain-rep lowering (Wave C) ===\n');

const D = {
  camera: { yaw: 0, pitch: -0.1, distance: 8, focal: 1.2, targetX: 0, targetY: 1, targetZ: 0 },
  light: { azimuth: 0.5, altitude: 0.7, distance: 30, intensity: 1 },
};

// max |f_a - f_b| over a sample grid
function maxDiff(sdfA, sdfB, center, extent, steps = 7) {
  let worst = 0;
  for (let ix = 0; ix <= steps; ix++)
    for (let iy = 0; iy <= 2; iy++)
      for (let iz = 0; iz <= steps; iz++) {
        const p = [
          center[0] + ((ix / steps) * 2 - 1) * extent,
          center[1] + iy * 0.8,
          center[2] + ((iz / steps) * 2 - 1) * extent,
        ];
        worst = Math.max(worst, Math.abs(sdfA.f(p) - sdfB.f(p)));
      }
  return worst;
}

function bothForms(scene) {
  const expanded = expandAndCompile(scene).sdf;
  const lowered = expandAndCompile(scene, { lowerRepeats: true }).sdf;
  return { expanded, lowered };
}

// ---- array run at an arbitrary angle ---------------------------------------------
{
  const scene = {
    v: 1,
    defaults: D,
    subjects: [
      {
        id: 'run',
        type: 'box',
        args: { dims: [1.7, 0.05, 0.32] },
        modifiers: [{ type: 'array', count: 7, offset: [1.9, 0, 1.1] }],
        transform: { translate: [3, 0.5, -2], rotate: [0, -Math.atan2(1.1, 1.9), 0] },
      },
    ],
  };
  const { expanded, lowered } = bothForms(scene);
  const d = maxDiff(expanded, lowered, [3 + 1.9 * 3, 0.5, -2 + 1.1 * 3], 12);
  ok(d < 1e-6, `array(7) lowered ≡ expanded (max |Δf| = ${d.toExponential(2)})`);
}

// ---- misaligned child yaw refuses to lower (exactness guard) ---------------------
// Domain rep evaluates the nearest tile only; a child not reflection-
// symmetric about tile boundaries would overestimate near-boundary
// distances. Correctness > leaves: it must fall back to expansion.
{
  const scene = {
    v: 1,
    subjects: [
      {
        id: 'run2',
        type: 'box',
        args: { dims: [1, 0.2, 0.4] },
        modifiers: [{ type: 'array', count: 5, offset: [0, 0, 2.2] }],
        transform: { translate: [-1, 0.3, 0], rotate: [0, 0.7, 0] },
      },
    ],
  };
  const low = expandModifiers(scene, { lower: true });
  ok(
    low.subjects.filter((s) => s.id.startsWith('run2#')).length === 5,
    'misaligned child yaw falls back to expansion (exactness guard)',
  );
}

// ---- mirror pair off-origin -------------------------------------------------------
{
  const scene = {
    v: 1,
    defaults: D,
    subjects: [
      {
        id: 'pair',
        type: 'box',
        args: { dims: [0.9, 2.2, 0.5] },
        modifiers: [{ type: 'mirror', axis: 'x', origin: [5, -3] }],
        transform: { translate: [9.2, 1.1, -3], rotate: [0, 0.3, 0] },
      },
    ],
  };
  const { expanded, lowered } = bothForms(scene);
  const d = maxDiff(expanded, lowered, [5, 1.1, -3], 8);
  ok(d < 1e-6, `mirror pair lowered ≡ expanded (max |Δf| = ${d.toExponential(2)})`);
}

// ---- even counts / scatter refuse to lower (fallback to expansion) ---------------
{
  const scene = {
    v: 1,
    subjects: [
      {
        id: 'even',
        type: 'box',
        args: { dims: [1, 1, 1] },
        modifiers: [{ type: 'array', count: 4, offset: [2, 0, 0] }],
        transform: { translate: [0, 0.5, 0] },
      },
      {
        id: 'dust',
        type: 'sphere',
        args: { radius: 0.2 },
        modifiers: [
          { type: 'scatter', count: 5, seed: 's', region: { kind: 'annulus', rMin: 3, rMax: 5 } },
        ],
        transform: { translate: [0, 0.2, 0] },
      },
    ],
  };
  const low = expandModifiers(scene, { lower: true });
  ok(
    low.subjects.filter((s) => s.id.startsWith('even#')).length === 4,
    'even-count array falls back to expansion',
  );
  ok(
    low.subjects.filter((s) => s.id.startsWith('dust#')).length === 5,
    'scatter always expands (irregular placements)',
  );
}

// ---- the real deck: transit slice, leaf economics + full-field equivalence -------
{
  const scene = assembleDeck(DECK, { layout: 'radial' });
  // a magnitude→magnitude transit (stations 3-4): boxes/ellipsoids only, so
  // the CPU point-eval covers every subject in the union (some exotic prims
  // — hold stems etc. — have GPU-only eval paths and would poison sampling)
  const win = scene.deckWindows.filter((w) => w.kind === 'transit')[3];
  const rawSlice = sliceDeckWindow(scene, win);
  const CPU_TYPES = new Set(['box', 'rounded_box', 'ellipsoid', 'sphere']);
  const slice = {
    ...rawSlice,
    subjects: rawSlice.subjects.filter((s) => CPU_TYPES.has(s.type) || s.modifiers),
  };
  const low = expandModifiers(slice, { lower: true });
  const reps = low.subjects.filter((s) => s.type === 'rep');
  const mirrors = low.subjects.filter((s) => s.type === 'mirror');
  ok(reps.length >= 2, `transit slice lowers its runways to rep nodes (${reps.length})`);
  ok(mirrors.length >= 3, `station guards lower to mirror nodes (${mirrors.length})`);
  const exp = expandModifiers(slice);
  const saved = exp.subjects.length - low.subjects.length;
  ok(
    saved >= 12,
    `leaf economics: ${exp.subjects.length} → ${low.subjects.length} subjects (−${saved})`,
  );
  // full-field equivalence on the real slice. Animations are stripped from
  // BOTH forms identically — CPU point-eval has no clock, and the lowering
  // path under test doesn't touch animation (it rides the wrapper verbatim).
  const still = {
    ...slice,
    subjects: slice.subjects.map((s) => {
      const c = { ...s };
      delete c.animation;
      return c;
    }),
  };
  const { expanded, lowered } = bothForms(still);
  const d = maxDiff(expanded, lowered, win.origin, 24, 9);
  ok(d < 1e-6, `real transit slice: lowered ≡ expanded (max |Δf| = ${d.toExponential(2)})`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
