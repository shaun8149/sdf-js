// sdf-js/scripts/test-deck-decor.mjs — Layer C v1: seeded deck decor.
// The three disciplines are ASSERTED, not hoped for: seeded (determinism +
// distinct identities), subtle (brightness cap + placement bands), family
// (accumulation counts inside the window budget caps). Plus the budget-by-
// construction claim: sliceDeckWindow must scope decor to its own windows.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assembleDeck, sliceDeckWindow } from '../src/scene/assemble-deck.js';
import {
  makeDeckDecor,
  DECOR_VALUE_CAP,
  STATION_DECOR_MAX,
  SEGMENT_DECOR_MAX,
} from '../src/scene/deck-decor.js';
import { validate } from '../src/scene/spec.js';
import { expandStage } from '../src/scene/stage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK = JSON.parse(readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp.json'), 'utf8'));

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== deck decor (Layer C v1: seeded, subtle, family) ===\n');

// analytic-renderer SUPPORTED subset the families are allowed to use
const ANALYTIC_TYPES = new Set(['box', 'sphere', 'capsule', 'ellipsoid', 'cylinder']);

// ---- seeded: determinism + identity -------------------------------------------
{
  const a1 = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-A' });
  const a2 = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-A' });
  const b = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-B' });
  ok(JSON.stringify(a1) === JSON.stringify(a2), 'same seed → byte-identical deck');
  const decorOf = (s) => s.subjects.filter((x) => /-decor-/.test(x.id));
  ok(
    JSON.stringify(decorOf(a1)) !== JSON.stringify(decorOf(b)),
    'different seed → different decor identity',
  );
  ok(decorOf(a1).length > 0, `decor present (${decorOf(a1).length} subjects)`);
  const plain = assembleDeck(DECK, { layout: 'radial' });
  ok(decorOf(plain).length === 0, 'no seed → no decor (goldens unchanged)');
}

// ---- family voices actually differ across seeds --------------------------------
{
  const voices = new Set(
    ['s1', 's2', 's3', 's4', 's5', 's6'].map((s) => JSON.stringify(makeDeckDecor(s).voice)),
  );
  ok(voices.size >= 3, `6 seeds → ≥3 distinct family voices (${voices.size})`);
}

// ---- subtle: brightness cap + placement bands ----------------------------------
{
  const scene = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-A' });
  const decor = scene.subjects.filter((x) => /-decor-/.test(x.id));
  ok(
    decor.every((s) => s.material.value <= DECOR_VALUE_CAP && s.material.glow === 0),
    `all decor under brightness cap ${DECOR_VALUE_CAP}, zero glow`,
  );
  ok(
    decor.every((s) => ANALYTIC_TYPES.has(s.type)),
    'all decor inside the analytic SUPPORTED set (zero-march default preserved)',
  );
  // stelae stay in the annulus outside the arena
  const origins = new Map(
    scene.deckWindows.filter((w) => w.kind === 'station').map((w) => [w.stations[0], w.origin]),
  );
  const stelae = decor.filter((s) => /^s\d+-decor-stela-/.test(s.id));
  const inBand = stelae.every((s) => {
    const k = Number(/^s(\d+)-/.exec(s.id)[1]);
    const o = origins.get(k);
    const t = s.transform.translate;
    const r = Math.hypot(t[0] - o[0], t[2] - o[2]);
    return r >= 8.0 && r <= 12.0;
  });
  ok(inBand, `stelae confined to the annulus band (${stelae.length} checked)`);
}

// ---- budget by construction: window slicing scopes decor ------------------------
{
  const scene = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-A' });
  const stWin = scene.deckWindows.find((w) => w.kind === 'station' && w.stations[0] === 3);
  const sliced = sliceDeckWindow(scene, stWin);
  const decorIn = sliced.subjects.filter((x) => /-decor-/.test(x.id));
  ok(
    decorIn.every((x) => x.id.startsWith('s3-decor-')),
    'station window carries ONLY its own station decor',
  );
  ok(
    decorIn.length <= STATION_DECOR_MAX,
    `station window decor ≤ cap (${decorIn.length}/${STATION_DECOR_MAX})`,
  );
  const trWin = scene.deckWindows.find((w) => w.kind === 'transit');
  const trSliced = sliceDeckWindow(scene, trWin);
  const trDecor = trSliced.subjects.filter((x) => /^path-\d+-decor-/.test(x.id));
  ok(
    trDecor.length > 0 && trDecor.length <= SEGMENT_DECOR_MAX,
    `transit window carries its inlay, ≤ cap (${trDecor.length}/${SEGMENT_DECOR_MAX})`,
  );
  const trStelae = trSliced.subjects.filter((x) => /^s\d+-decor-/.test(x.id));
  ok(
    trStelae.every((x) => /^s(0|1)-/.test(x.id)),
    'transit window stelae limited to its two endpoint stations',
  );
}

// ---- decorated deck still validates --------------------------------------------
{
  const scene = assembleDeck(DECK, { layout: 'radial', decorSeed: 'hash-A', stage: true });
  const v = validate(expandStage(scene));
  ok(v.ok, `decorated staged deck validates${v.ok ? '' : ` — ${v.errors[0]}`}`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
