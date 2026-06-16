// =============================================================================
// test-type-aliases.mjs — smoke for snake/kebab type aliasing (B2)
// -----------------------------------------------------------------------------
// LLM stochastically emits `capped_torus` when canonical is `capped-torus`
// (v3.10 regression broke vintage-bicycle + dining-setting this way).
// normalizeType() + validator mutation auto-fixes both forms.
//
// Run:  node sdf-js/scripts/test-type-aliases.mjs
// =============================================================================

import { PRIMITIVE_TYPES, PRIMITIVE_TYPE_ALIASES, normalizeType } from '../src/scene/spec.js';
import { compile } from '../src/scene/compile.js';

let pass = 0,
  fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

console.log(
  `Registry has ${PRIMITIVE_TYPES.size} types; built ${Object.keys(PRIMITIVE_TYPE_ALIASES).length} aliases.`,
);

// ---- normalizeType direct ----
console.log('\n[normalizeType] direct calls:');
ok(normalizeType('capped-torus') === 'capped-torus', 'kebab canonical → unchanged');
ok(normalizeType('capped_torus') === 'capped-torus', 'snake alias → kebab canonical');
ok(normalizeType('capped_cylinder') === 'capped_cylinder', 'snake canonical → unchanged');
ok(normalizeType('capped-cylinder') === 'capped_cylinder', 'kebab alias → snake canonical');
ok(
  normalizeType('rounded_cylinder') === 'rounded-cylinder',
  'snake alias (v3.10 dining-setting bug) → fixed',
);
ok(normalizeType('rounded-box') === 'rounded_box', 'kebab alias → snake canonical');
ok(normalizeType('cut-disk') === 'cut-disk', 'kebab canonical → unchanged');
ok(normalizeType('cut_disk') === 'cut-disk', 'snake alias');
ok(normalizeType('made_up_name') === 'made_up_name', 'unknown unchanged (validator rejects later)');

// ---- alias map sanity ----
console.log('\n[alias map] no collisions:');
let collisions = 0;
for (const [alias, canon] of Object.entries(PRIMITIVE_TYPE_ALIASES)) {
  if (PRIMITIVE_TYPES.has(alias)) {
    collisions++;
    console.log(`  collision: ${alias} is both canonical AND aliased to ${canon}`);
  }
}
ok(collisions === 0, `no alias collides with a canonical type (got ${collisions} collisions)`);

// ---- end-to-end via compile() ----
console.log('\n[e2e] LLM-style snake_case emit compiles via alias:');
{
  const scene = {
    v: 1,
    defaults: {
      camera: { yaw: 0, pitch: 0.3, distance: 10, focal: 1.8, targetX: 0, targetY: 0, targetZ: 0 },
      light: { altitude: 0.6, azimuth: 0.5, distance: 100, intensity: 1.0 },
    },
    subjects: [
      // Mimic vintage-bicycle v3.10 typo: capped_torus instead of capped-torus
      {
        id: 'wheel-1',
        type: 'capped_torus',
        args: { majorR: 0.5, minorR: 0.05, ang: Math.PI * 0.8 },
        transform: { translate: [-1, 0, 0] },
      },
      // Mimic dining-setting v3.10 typo: rounded_cylinder
      {
        id: 'fork-handle',
        type: 'rounded_cylinder',
        args: { radius: 0.05, height: 0.4, cornerR: 0.02 },
        transform: { translate: [1, 0, 0] },
      },
    ],
  };
  let compiled,
    threw = null;
  try {
    compiled = compile(scene);
  } catch (e) {
    threw = e.message;
  }
  ok(!threw, `compile succeeded with snake-form types (err: ${threw})`);
  if (compiled) {
    ok(
      scene.subjects[0].type === 'capped-torus',
      `subject 0 type mutated to canonical (got "${scene.subjects[0].type}")`,
    );
    ok(
      scene.subjects[1].type === 'rounded-cylinder',
      `subject 1 type mutated to canonical (got "${scene.subjects[1].type}")`,
    );
    const sdfTest = compiled.sdf.f([0, 0, 0]);
    ok(Number.isFinite(sdfTest), `SDF eval at origin returns finite (got ${sdfTest})`);
  }
}

console.log(`\n${pass}/${pass + fail} tests passed`);
if (fail > 0) process.exit(1);
