// =============================================================================
// test-composite-atoms.mjs — smoke for 5.4a 3 composite atoms
// -----------------------------------------------------------------------------
// Each composite atom expands at compile() entry. Verify:
//   - All 3 atom types compile + sanity clean
//   - Peer subjects appear in expanded scene
//   - Cinematic patches merged into defaults.postFx / camera.aperture / volumes
//   - Author overrides take precedence over atom defaults
//   - Pipeline composes with expandVariants() (Generator-S Phase 2)
//
// Run:  node sdf-js/scripts/test-composite-atoms.mjs
// =============================================================================

import { compile } from '../src/scene/compile.js';
import { expandVariants } from '../src/scene/generator-s.js';
import { expandCompositeAtoms, COMPOSITE_ATOM_TYPES } from '../src/scene/composite-atoms.js';
import { Random } from '../src/util/random.js';

const HASH = '0x' + 'c'.repeat(64);

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else      { fail++; console.log(`  ✗ ${name}`); }
}

console.log(`Registered composite atom types: ${[...COMPOSITE_ATOM_TYPES].join(', ')}`);

const baseScene = (compositeSubject) => ({
  v: 1,
  defaults: {
    camera: { yaw: 0.4, pitch: 0.2, distance: 60, focal: 1.5,
              targetX: 0, targetY: 2, targetZ: 0 },
    light: { altitude: 0.5, azimuth: 0.6, distance: 80, intensity: 1.1 },
  },
  subjects: [
    // Hero subject (manually emitted by LLM in real lift)
    { id: 'hero', type: 'sphere', args: { radius: 2 }, transform: { translate: [0, 1, 0] } },
    compositeSubject,
  ],
});

// ---------------------------------------------------------------------------
// carrier-strike-group
// ---------------------------------------------------------------------------
console.log('\n[carrier-strike-group]:');
{
  const scene = baseScene({ id: 'fleet', type: 'carrier-strike-group', args: {} });
  // Step 1: expand composite (happens inside compile() too, but call here to inspect)
  const expanded = expandCompositeAtoms(scene);
  ok(expanded.subjects.length === 5, `expands to 5 subjects (1 hero + 4 peer atom-emitted: escort + gull + cloud + sea) got ${expanded.subjects.length}`);
  ok(expanded.subjects.some(s => s.id === 'escort-destroyer'), 'has escort-destroyer subject');
  ok(expanded.subjects.some(s => s.id === 'gull'), 'has gull subject');
  ok(expanded.subjects.some(s => s.id === 'cloud'), 'has cloud subject');
  ok(expanded.subjects.some(s => s.id === 'sea'), 'has sea subject (auto)');
  ok(expanded.defaults?.postFx?.exposure !== undefined, 'cinematic postFx merged into defaults');
  ok(expanded.defaults?.camera?.aperture === 0.6, `camera.aperture merged (=${expanded.defaults?.camera?.aperture})`);
  ok(Array.isArray(expanded.volumes) && expanded.volumes[0]?.kind === 'fog', 'fog volume added');

  // Step 2: expand variants
  const expandedVariants = expandVariants(expanded, new Random(HASH));
  // After variant expansion: escort × 4 + gull × 6 + cloud × 3 = 13 expansions + hero + sea = 15
  console.log(`    After Generator-S expansion: ${expandedVariants.subjects.length} top-level subjects`);
  ok(expandedVariants.subjects.length >= 14 && expandedVariants.subjects.length <= 16,
     `expanded subject count in [14, 16] (got ${expandedVariants.subjects.length})`);

  // Step 3: compile
  let compiled, threw = null;
  try { compiled = compile(scene); } catch (e) { threw = e.message; }
  ok(!threw, `compile() succeeded (err: ${threw})`);
  if (compiled) {
    ok(compiled.sanityResult?.errors.length === 0,
       `sanity clean (got ${compiled.sanityResult?.errors.length} errors, ${compiled.sanityResult?.warnings.length} warnings)`);
  }
}

// ---------------------------------------------------------------------------
// carrier-strike-group with override args
// ---------------------------------------------------------------------------
console.log('\n[carrier-strike-group with args override]:');
{
  const scene = baseScene({
    id: 'fleet',
    type: 'carrier-strike-group',
    args: { escortCount: 2, birdCount: 3, cloudCount: 0, cinematic: false, sea: false }
  });
  const expanded = expandCompositeAtoms(scene);
  ok(expanded.subjects.length === 4, `4 subjects (hero + escort + gull + cloud, no sea) got ${expanded.subjects.length}`);
  ok(!expanded.defaults?.postFx, 'postFx not added (cinematic=false)');
  ok(!Array.isArray(expanded.volumes) || expanded.volumes.length === 0, 'no fog volume');
  // escort-destroyer's variants.count should be 2
  const escort = expanded.subjects.find(s => s.id === 'escort-destroyer');
  ok(escort?.variants?.[0]?.count === 2, `escort count override = 2 (got ${escort?.variants?.[0]?.count})`);
  const gull = expanded.subjects.find(s => s.id === 'gull');
  ok(gull?.variants?.[0]?.count === 3, `gull count override = 3`);
  const cloud = expanded.subjects.find(s => s.id === 'cloud');
  ok(cloud?.variants?.[0]?.count === 0, `cloud count override = 0`);
}

// ---------------------------------------------------------------------------
// airport-apron
// ---------------------------------------------------------------------------
console.log('\n[airport-apron]:');
{
  const scene = baseScene({ id: 'apron', type: 'airport-apron', args: {} });
  const expanded = expandCompositeAtoms(scene);
  ok(expanded.subjects.length === 4, `4 subjects (hero + parked-plane + ground-vehicle + runway-lamp) got ${expanded.subjects.length}`);
  ok(expanded.subjects.some(s => s.id === 'parked-plane'), 'has parked-plane');
  ok(expanded.subjects.some(s => s.id === 'ground-vehicle'), 'has ground-vehicle');
  ok(expanded.subjects.some(s => s.id === 'runway-lamp'), 'has runway-lamp');
  const planeArr = expanded.subjects.find(s => s.id === 'parked-plane').variants[0];
  ok(planeArr.op === 'array' && planeArr.count === 4 && planeArr.axis === 'z',
     `parked-plane uses array op axis=z count=4 (got ${JSON.stringify(planeArr).slice(0,80)})`);

  let compiled, threw = null;
  try { compiled = compile(scene); } catch (e) { threw = e.message; }
  ok(!threw, `compile() succeeded (err: ${threw})`);
  if (compiled) {
    ok(compiled.sanityResult?.errors.length === 0, `sanity clean`);
  }
}

// ---------------------------------------------------------------------------
// harbor-quay
// ---------------------------------------------------------------------------
console.log('\n[harbor-quay]:');
{
  const scene = baseScene({ id: 'quay', type: 'harbor-quay', args: {} });
  const expanded = expandCompositeAtoms(scene);
  ok(expanded.subjects.some(s => s.id === 'cargo-ship'), 'has cargo-ship');
  ok(expanded.subjects.some(s => s.id === 'harbor-crane'), 'has harbor-crane');
  ok(expanded.subjects.some(s => s.id === 'container-stack'), 'has container-stack');
  ok(expanded.subjects.some(s => s.id === 'gull'), 'has gull');
  ok(expanded.subjects.some(s => s.id === 'sea'), 'has sea');

  let compiled, threw = null;
  try { compiled = compile(scene); } catch (e) { threw = e.message; }
  ok(!threw, `compile() succeeded (err: ${threw})`);
  if (compiled) {
    ok(compiled.sanityResult?.errors.length === 0, `sanity clean`);
  }
}

// ---------------------------------------------------------------------------
// concert-stage (v3.15 leisure atom)
// ---------------------------------------------------------------------------
console.log('\n[concert-stage]:');
{
  const scene = baseScene({ id: 'concert', type: 'concert-stage', args: {} });
  const expanded = expandCompositeAtoms(scene);
  ok(expanded.subjects.length === 6,
     `6 subjects (hero + stage-floor + backdrop + speaker + lamp + audience) got ${expanded.subjects.length}`);
  ok(expanded.subjects.some(s => s.id === 'stage-floor'),    'has stage-floor');
  ok(expanded.subjects.some(s => s.id === 'stage-backdrop'), 'has stage-backdrop');
  ok(expanded.subjects.some(s => s.id === 'speaker'),        'has speaker (mirror)');
  ok(expanded.subjects.some(s => s.id === 'stage-lamp'),     'has stage-lamp (array)');
  ok(expanded.subjects.some(s => s.id === 'audience-figure'),'has audience-figure (scatter)');
  ok(expanded.volumes?.[0]?.kind === 'fog',                  'stage-haze fog volume added');
  ok(expanded.defaults?.camera?.aperture === 0.7,            `aperture 0.7 (got ${expanded.defaults?.camera?.aperture})`);

  let compiled, threw = null;
  try { compiled = compile(scene); } catch (e) { threw = e.message; }
  ok(!threw, `compile() succeeded (err: ${threw})`);
  if (compiled) {
    ok(compiled.sanityResult?.errors.length === 0, `sanity clean`);
  }
}

// ---------------------------------------------------------------------------
// Idempotency: no composite types → no change
// ---------------------------------------------------------------------------
console.log('\n[idempotency] scene without composite types unchanged:');
{
  const scene = {
    v: 1,
    defaults: { camera: { yaw:0, pitch:0.2, distance:10, focal:1.5, targetX:0, targetY:0, targetZ:0 },
                light: { altitude:0.5, azimuth:0.5, distance:50, intensity:1.0 } },
    subjects: [{ id: 'sphere', type: 'sphere', args: { radius: 1 }, transform: { translate: [0,0,0] } }],
  };
  const expanded = expandCompositeAtoms(scene);
  ok(expanded.subjects.length === 1, 'still 1 subject');
  ok(!expanded.defaults?.postFx, 'no postFx added');
  ok(!expanded.volumes, 'no volumes added');
}

// ---------------------------------------------------------------------------
// Author override: explicit aperture wins over atom default
// ---------------------------------------------------------------------------
console.log('\n[author override] explicit camera.aperture wins:');
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw:0, pitch:0.2, distance:60, focal:1.5,
                targetX:0, targetY:2, targetZ:0,
                aperture: 1.2 },  // author explicit
      light: { altitude:0.5, azimuth:0.5, distance:80, intensity:1.0 },
    },
    subjects: [
      { id: 'hero', type: 'sphere', args: { radius: 2 } },
      { id: 'fleet', type: 'carrier-strike-group', args: {} },
    ],
  };
  const expanded = expandCompositeAtoms(scene);
  ok(expanded.defaults.camera.aperture === 1.2,
     `author aperture=1.2 preserved (got ${expanded.defaults.camera.aperture})`);
}

console.log(`\n${pass}/${pass + fail} tests passed`);
if (fail > 0) process.exit(1);
