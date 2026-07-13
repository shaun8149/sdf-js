// sdf-js/scripts/test-modifiers.mjs — Blender-borrow Wave B: placement
// modifiers. Claims pinned here: (1) expansion math per type; (2) SEMANTIC
// EQUIVALENCE — the assembled deck's runway/guard instances land exactly
// where the hand-unrolled subjects used to; (3) scatter determinism;
// (4) validator errors on malformed stacks.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expandModifiers } from '../src/scene/modifiers.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';
import { validate } from '../src/scene/spec.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK = JSON.parse(readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp.json'), 'utf8'));

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
const near = (a, b) => Math.abs(a - b) < 1e-9;
console.log('=== placement modifiers (Wave B) ===\n');

const D = {
  camera: { yaw: 0, pitch: -0.1, distance: 8, focal: 1.2, targetX: 0, targetY: 1, targetZ: 0 },
  light: { azimuth: 0.5, altitude: 0.7, distance: 30, intensity: 1 },
};
const box = (extra) => ({ id: 'b', type: 'box', args: { dims: [1, 1, 1] }, ...extra });

// ---- array ---------------------------------------------------------------------
{
  const s = expandModifiers({
    v: 1,
    subjects: [
      box({
        modifiers: [{ type: 'array', count: 3, offset: [2, 0, 0] }],
        transform: { translate: [1, 0.5, 0] },
      }),
    ],
  });
  ok(s.subjects.length === 3, 'array(3) → 3 instances');
  ok(
    near(s.subjects[0].transform.translate[0], 1) &&
      near(s.subjects[1].transform.translate[0], 3) &&
      near(s.subjects[2].transform.translate[0], 5),
    'array instances step by offset from the base',
  );
  ok(
    s.subjects.every((x, i) => x.id === `b#${i}` && !x.modifiers),
    'instance ids #i, modifiers consumed',
  );
}

// ---- mirror --------------------------------------------------------------------
{
  const s = expandModifiers({
    v: 1,
    subjects: [
      box({
        modifiers: [{ type: 'mirror', axis: 'x' }],
        transform: { translate: [4, 1, 2], rotate: [0, 0.3, 0] },
      }),
    ],
  });
  ok(s.subjects.length === 2, 'mirror → 2 instances');
  const [a, b2] = s.subjects.map((x) => x.transform);
  ok(
    near(a.translate[0], 4) && near(b2.translate[0], -4) && near(b2.translate[2], 2),
    'mirror flips x, keeps z',
  );
  ok(near(a.rotate[1], 0.3) && near(b2.rotate[1], -0.3), 'mirror negates yaw (true reflection)');
}

// ---- radial + composition -------------------------------------------------------
{
  const s = expandModifiers({
    v: 1,
    subjects: [
      box({
        modifiers: [
          { type: 'radial', count: 4, radius: 10, faceCenter: true },
          { type: 'mirror', axis: 'z' },
        ],
        transform: { translate: [0, 2, 0] },
      }),
    ],
  });
  ok(s.subjects.length === 8, 'stack composes in order (radial×4 then mirror×2 = 8)');
  const r0 = s.subjects[0].transform.translate;
  ok(near(Math.hypot(r0[0], r0[2]), 10) && near(r0[1], 2), 'radial ring radius + y preserved');
}

// ---- scatter determinism ---------------------------------------------------------
{
  const mk = () =>
    expandModifiers({
      v: 1,
      subjects: [
        box({
          modifiers: [
            {
              type: 'scatter',
              count: 6,
              seed: 'atlas',
              region: { kind: 'annulus', rMin: 5, rMax: 8 },
            },
          ],
          transform: { translate: [0, 0.4, 0] },
        }),
      ],
    });
  const a = JSON.stringify(mk());
  ok(a === JSON.stringify(mk()), 'scatter is deterministic (same seed → same field)');
  const radii = mk().subjects.map((x) =>
    Math.hypot(x.transform.translate[0], x.transform.translate[2]),
  );
  ok(
    radii.every((r) => r >= 5 - 1e-9 && r <= 8 + 1e-9),
    'scatter stays inside the annulus region',
  );
}

// ---- semantic equivalence on the real deck ---------------------------------------
{
  const scene = assembleDeck(DECK, { layout: 'radial' });
  const runways = scene.subjects.filter((s) => /-runway$/.test(s.id));
  ok(
    runways.length === DECK.slides.length - 1,
    `runway subjects authored once per gap (${runways.length})`,
  );
  const expanded = expandModifiers(scene);
  const strips = expanded.subjects.filter((s) => /-runway#\d+$/.test(s.id));
  ok(
    strips.length === (DECK.slides.length - 1) * 7,
    `expansion restores 7 strips per gap (${strips.length})`,
  );
  // the strips must land exactly on the legacy hand-unrolled positions:
  // origin + step·d for d = 1..7 along each segment
  const win = scene.deckWindows.filter((w) => w.kind === 'station');
  const originOf = (k) => win.find((w) => w.stations[0] === k).origin;
  let exact = true;
  for (let k = 0; k < DECK.slides.length - 1 && exact; k++) {
    const [ax, , az] = originOf(k);
    const [bx, , bz] = originOf(k + 1);
    for (let d = 1; d <= 7; d++) {
      const inst = expanded.subjects.find((s) => s.id === `path-${k}-runway#${d - 1}`);
      const ex = ax + ((bx - ax) * d) / 8;
      const ez = az + ((bz - az) * d) / 8;
      if (
        !inst ||
        !near(inst.transform.translate[0], ex) ||
        !near(inst.transform.translate[2], ez)
      ) {
        exact = false;
        break;
      }
    }
  }
  ok(exact, 'runway instances land exactly on the legacy hand-unrolled positions');
  // guards: one subject per tier, mirror expands to the legacy ± pair
  const guards = expanded.subjects.filter((s) => /^s\d+-guard-\d+#\d+$/.test(s.id));
  ok(
    guards.length > 0 && guards.length % 2 === 0,
    `guard mirrors expand to pairs (${guards.length})`,
  );
  const pair = guards.filter((s) => s.id.startsWith('s2-guard-0'));
  ok(
    pair.length === 2 &&
      near(pair[0].transform.translate[0] + pair[1].transform.translate[0], 2 * originOf(2)[0]) &&
      near(pair[0].transform.rotate[1], 0.3) &&
      near(pair[1].transform.rotate[1], -0.3),
    'guard pair mirrors across the station axis with negated yaw',
  );
  // collections ride onto instances (routing unaffected)
  ok(
    strips.every((s) => s.collection && s.collection.startsWith('path-')),
    'instances inherit the collection tag',
  );
}

// ---- validator -------------------------------------------------------------------
{
  const bad = validate({
    v: 1,
    defaults: D,
    subjects: [box({ modifiers: [{ type: 'spiral', count: 3 }] })],
  });
  ok(
    !bad.ok && bad.errors.some((e) => e.includes('unknown "spiral"')),
    'unknown modifier type = ERROR',
  );
  const noSeed = validate({
    v: 1,
    defaults: D,
    subjects: [
      box({
        modifiers: [{ type: 'scatter', count: 3, region: { kind: 'annulus', rMin: 1, rMax: 2 } }],
      }),
    ],
  });
  ok(
    !noSeed.ok && noSeed.errors.some((e) => e.includes('seed')),
    'scatter without seed = ERROR (determinism covenant)',
  );
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
