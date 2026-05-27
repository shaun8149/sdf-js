// =============================================================================
// test-generator-s-e2e.mjs — end-to-end smoke for Generator-S Phase 2
// -----------------------------------------------------------------------------
// Builds a "fighter-jet" scene: fuselage + array of fins down spine + mirrored
// wings (left/right with opposite anim phase). Expands variants, compiles,
// confirms sanity-clean, and pokes a few SDF probes for sanity.
//
// Run:  node sdf-js/scripts/test-generator-s-e2e.mjs
// =============================================================================

import { compile } from '../src/scene/compile.js';
import { expandVariants } from '../src/scene/generator-s.js';
import { sanityCheck } from '../src/scene/sanity.js';
import { Random } from '../src/util/random.js';

const HASH = '0x' + 'b'.repeat(64);

const scene = {
  v: 1,
  id: 'fighter-jet',
  defaults: {
    camera: { yaw: 0.5, pitch: 0.3, distance: 10, focal: 1.8,
              targetX: 0, targetY: 0, targetZ: 0 },
    light: { altitude: 0.6, azimuth: 0.5, distance: 100, intensity: 1.0 },
  },
  subjects: [
    // Fuselage
    {
      id: 'fuselage',
      type: 'capsule', args: { a: [0, 0, -2.5], b: [0, 0, 2.5], radius: 0.4 },
      transform: { translate: [0, 0, 0] },
    },
    // Array of fins along the top spine
    {
      id: 'fin',
      type: 'box', args: { dims: [0.05, 0.4, 0.25] },
      transform: { translate: [0, 0.5, 0] },
      variants: [{
        op: 'array', count: 4, axis: 'z', spacing: 0.7, origin: 'center',
        scale: { jitter: 0.05 },
      }],
    },
    // Wing pair: mirror across yz plane, opposite anim phase
    {
      id: 'wing',
      type: 'box', args: { dims: [2.0, 0.08, 0.6] },
      transform: { translate: [1.5, 0, 0], rotate: [0, 0, 0] },
      animation: [{
        channel: 'transform.rotate.z',
        value: { kind: 'time', form: 'sin', amp: 0.15, freq: 1.5, phase: 0 },
      }],
      variants: [{ op: 'mirror', plane: 'yz', phaseFlip: Math.PI }],
    },
  ],
};

console.log('Input scene: 3 subjects (fuselage + fin proto + wing proto)');
console.log('  - fin has array variant (count=4)');
console.log('  - wing has mirror variant (left + right)');

// Step 1: expand
const expanded = expandVariants(scene, new Random(HASH));
console.log(`\nAfter expand: ${expanded.subjects.length} subjects`);
for (const s of expanded.subjects) {
  const t = s.transform?.translate ?? [0,0,0];
  console.log(`  - ${s.id}  translate=[${t.map(v=>v.toFixed(2)).join(', ')}]`);
}

if (expanded.subjects.length !== 7) {
  console.error(`✗ expected 7 subjects (1 fuselage + 4 fins + 2 wings), got ${expanded.subjects.length}`);
  process.exit(1);
}

// Step 2: compile
let compiled;
try {
  compiled = compile(expanded);
  console.log('\n✓ compile() succeeded');
} catch (e) {
  console.error(`✗ compile() threw: ${e.message}`);
  process.exit(1);
}

// Step 3: sanity check (compile auto-runs it; also call explicitly to inspect)
const sr = sanityCheck(expanded, compiled);
console.log(`\nSanity: ${sr.summary}  (errors=${sr.errors.length}, warnings=${sr.warnings.length})`);
if (sr.errors.length > 0) {
  console.error('Sanity errors:');
  for (const e of sr.errors) console.error('  ✗', e.rule, '@', e.path, '—', e.message);
  process.exit(1);
}

// Step 4: SDF probe — confirm fuselage center is INSIDE, far outside is OUT
const sdfFn = compiled.sdf.f.bind(compiled.sdf);
const dCenter = sdfFn([0, 0, 0]);
const dFar    = sdfFn([10, 10, 10]);
console.log(`\nSDF probes: center=${dCenter.toFixed(3)} (expect <0), far=${dFar.toFixed(3)} (expect >0)`);
if (dCenter > 0) { console.error('✗ center should be inside fuselage'); process.exit(1); }
if (dFar < 0)    { console.error('✗ far should be outside'); process.exit(1); }

// Step 5: check left/right wings — wing-0 should be at +x, wing-1 at -x
const wingLeft  = expanded.subjects.find(s => s.id === 'wing-0');
const wingRight = expanded.subjects.find(s => s.id === 'wing-1');
if (!wingLeft || !wingRight) { console.error('✗ wings not found'); process.exit(1); }
if (wingLeft.transform.translate[0] !== 1.5) {
  console.error(`✗ wing-0.x expected 1.5, got ${wingLeft.transform.translate[0]}`);
  process.exit(1);
}
if (wingRight.transform.translate[0] !== -1.5) {
  console.error(`✗ wing-1.x expected -1.5, got ${wingRight.transform.translate[0]}`);
  process.exit(1);
}
console.log('✓ wing-0 at x=+1.5, wing-1 at x=-1.5 (bilateral pair)');

// Step 6: anim phase check (v1 spec: phase is under value.phase)
const leftPhase  = wingLeft.animation[0].value.phase;
const rightPhase = wingRight.animation[0].value.phase;
console.log(`✓ wing anim phase: left=${leftPhase}, right=${rightPhase} (Δ = ${(rightPhase-leftPhase).toFixed(4)})`);
if (Math.abs((rightPhase - leftPhase) - Math.PI) > 1e-9) {
  console.error('✗ phaseFlip not applied');
  process.exit(1);
}

console.log('\n=== End-to-end smoke PASSED ===');
