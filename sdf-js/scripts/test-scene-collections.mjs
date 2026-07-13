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

// ---- semantic equivalence: collections vs legacy regex --------------------------
for (const layout of ['radial', 'courtyard']) {
  const scene = assembleDeck(DECK, { layout });
  ok(!!scene.collections && !!scene.materials, `${layout}: collections + materials emitted`);
  ok(
    scene.subjects.every(
      (s) => typeof s.collection === 'string' && scene.collections[s.collection],
    ),
    `${layout}: every subject carries a registered collection`,
  );
  // strip collections/tags → the slicer falls back to the legacy regex path
  const legacy = {
    ...scene,
    collections: undefined,
    subjects: scene.subjects.map((s) => ({ ...s, collection: undefined })),
  };
  let identical = true;
  for (const win of scene.deckWindows) {
    const a = sliceDeckWindow(scene, win)
      .subjects.map((s) => s.id)
      .join('|');
    const b = sliceDeckWindow(legacy, win)
      .subjects.map((s) => s.id)
      .join('|');
    if (a !== b) {
      identical = false;
      console.log(`    ✗ window ${win.kind}[${win.stations}] diverges`);
      break;
    }
  }
  ok(identical, `${layout}: collection slicing ≡ legacy regex slicing (every window)`);
}

// ---- material registry round-trip ------------------------------------------------
{
  const scene = assembleDeck(DECK, { layout: 'radial' });
  const refs = scene.subjects.filter((s) => typeof s.material === 'string');
  ok(
    refs.length > 200,
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
