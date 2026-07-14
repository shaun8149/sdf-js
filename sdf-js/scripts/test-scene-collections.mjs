// sdf-js/scripts/test-scene-collections.mjs — Blender-borrow Wave A.
// The load-bearing claim: collection-driven slicing is SEMANTICALLY IDENTICAL
// to the legacy id-regex slicing, for every window of every layout. Plus the
// material registry round-trip (dedup → refs → resolveMaterialRefs inflates
// back) and the validator's dangling-reference errors.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assembleDeck, sliceDeckWindow } from '../src/scene/assemble-deck.js';
import { validate, resolveMaterialRefs } from '../src/scene/spec.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK = JSON.parse(readFileSync(resolve(__dirname, '../scenes/ir/bytedance-bp.json'), 'utf8'));

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== scene collections + material registry (Wave A) ===\n');

// ---- collections are the ONLY routing channel (Wave A2: legacy regex gone) ------
for (const layout of ['radial', 'courtyard']) {
  const scene = assembleDeck(DECK, { layout });
  ok(!!scene.collections && !!scene.materials, `${layout}: collections + materials emitted`);
  ok(
    scene.subjects.every(
      (s) => typeof s.collection === 'string' && scene.collections[s.collection],
    ),
    `${layout}: every subject carries a registered collection`,
  );
  // a scene without a collections registry has no routing data — sliceDeckWindow
  // passes it through whole rather than guessing from id strings (Wave A2
  // contract: ids are pure identity, never routing)
  const bare = { ...scene, collections: undefined };
  const win = scene.deckWindows.find((w) => w.kind === 'station');
  ok(
    sliceDeckWindow(bare, win).subjects.length === scene.subjects.length,
    `${layout}: no registry → whole world passes through (ids never route)`,
  );
  // routing really flows from the TAG, not the id: retag one station subject
  // to a far station and it must leave its home window
  const sliced = sliceDeckWindow(scene, win).subjects.map((s) => s.id);
  const victim = scene.subjects.find((s) => s.collection === `station-${win.stations[0]}`);
  const lastStation = `station-${DECK.slides.length - 1}`;
  const retagged = {
    ...scene,
    subjects: scene.subjects.map((s) => (s === victim ? { ...s, collection: lastStation } : s)),
  };
  const slicedRetag = sliceDeckWindow(retagged, win).subjects.map((s) => s.id);
  ok(
    sliced.includes(victim.id) && !slicedRetag.includes(victim.id),
    `${layout}: retagging a subject moves it between windows (tag routes, id doesn't)`,
  );
}

// ---- material registry round-trip ------------------------------------------------
{
  const scene = assembleDeck(DECK, { layout: 'radial' });
  const refs = scene.subjects.filter((s) => typeof s.material === 'string');
  ok(
    // 2026-07-14: 引擎 network 站按 user 指示移出 deck → 全 deck ~189 subjects
    refs.length > 150,
    `materials dedup'd to refs (${refs.length} refs, ${Object.keys(scene.materials).length} entries)`,
  );
  ok(
    Object.keys(scene.materials).length < 60,
    `registry stays small (${Object.keys(scene.materials).length} unique materials)`,
  );
  const inflated = resolveMaterialRefs(scene);
  ok(
    inflated.subjects.every((s) => s.material == null || typeof s.material === 'object'),
    'resolveMaterialRefs inflates every ref back to an object',
  );
  // registry name that shadows nothing → untouched preset strings still work
  const v = validate(scene);
  ok(v.ok, `assembled deck validates with registry (${v.errors[0] || 'no errors'})`);
}

// ---- validator: dangling references are ERRORS -----------------------------------
{
  const bad = {
    v: 1,
    materials: { good: { hue: 0.5 } },
    subjects: [{ id: 'a', type: 'sphere', args: { radius: 1 }, material: 'nope' }],
  };
  const v = validate(bad);
  ok(
    !v.ok && v.errors.some((e) => e.includes('not in scene.materials')),
    'dangling material ref = ERROR when registry present',
  );
  const badCol = {
    v: 1,
    collections: { real: { kind: 'dressing' } },
    subjects: [{ id: 'a', type: 'sphere', args: { radius: 1 }, collection: 'ghost' }],
  };
  const v2 = validate(badCol);
  ok(
    !v2.ok && v2.errors.some((e) => e.includes('not in scene.collections')),
    'dangling collection ref = ERROR when registry present',
  );
  // no registry → preset warning path unchanged (forward compat)
  const legacy = {
    v: 1,
    defaults: {
      camera: { yaw: 0, pitch: -0.1, distance: 8, focal: 1.2, targetX: 0, targetY: 1, targetZ: 0 },
      light: { azimuth: 0.5, altitude: 0.7, distance: 30, intensity: 1 },
    },
    subjects: [{ id: 'a', type: 'sphere', args: { radius: 1 }, material: 'gold' }],
  };
  const vLegacy = validate(legacy);
  ok(vLegacy.ok, `preset strings without registry keep working (${vLegacy.errors[0] || ''})`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
