// =============================================================================
// test-primitive-registry-sync.mjs — guards the spec ↔ factory invariant.
// -----------------------------------------------------------------------------
// scene/spec.js PRIMITIVE_TYPES (what validate() accepts) and scene/compile.js
// PRIMITIVE_FACTORIES (what compile() can build) are two hand-maintained lists.
// If they drift — a type added to spec but no factory, or vice versa — validate()
// passes a scene that then throws in compile() (or a factory becomes dead code).
// Every new atom must touch both; this test makes the drift a CI failure instead
// of a runtime surprise. Mirrors compile()'s actual lookup: PRIMITIVE_FACTORIES[
// normalizeType(type)], with extrude/revolve/extrude_to as pseudo (2D-source wrap).
// =============================================================================

import { PRIMITIVE_TYPES, normalizeType } from '../src/scene/spec.js';
import { PRIMITIVE_FACTORY_TYPES, PSEUDO_PRIMITIVE_TYPES } from '../src/scene/compile.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));

console.log('=== primitive registry sync (spec ↔ factories) ===\n');

const factorySet = new Set(PRIMITIVE_FACTORY_TYPES);
const pseudoSet = new Set(PSEUDO_PRIMITIVE_TYPES);

// FORWARD: every spec primitive type resolves to a real factory (or is pseudo) —
// the exact lookup compile() does. This is the one that prevents "validate()
// accepts it, compile() throws 'no factory'".
const unbacked = [...PRIMITIVE_TYPES].filter((t) => {
  const canonical = normalizeType(t);
  return !pseudoSet.has(canonical) && !factorySet.has(canonical);
});
ok(
  unbacked.length === 0,
  `every spec PRIMITIVE_TYPE has a factory or is pseudo (unbacked: [${unbacked.join(', ')}])`,
);

// REVERSE: every real factory is a recognized spec type — no orphaned/dead
// factory that validate() would reject.
const orphan = PRIMITIVE_FACTORY_TYPES.filter((k) => !PRIMITIVE_TYPES.has(k));
ok(
  orphan.length === 0,
  `every factory is in spec PRIMITIVE_TYPES (orphans: [${orphan.join(', ')}])`,
);

// sanity: counts line up (spec = real factories + pseudo, modulo aliases). Not an
// equality (spec carries snake_case aliases) — just assert the lists are non-empty
// and pseudo types are NOT in the factory list (they're null markers).
ok(
  PRIMITIVE_FACTORY_TYPES.length > 100,
  `factory list populated (${PRIMITIVE_FACTORY_TYPES.length})`,
);
ok(
  PSEUDO_PRIMITIVE_TYPES.every((p) => !factorySet.has(p)),
  'pseudo types are not in the real-factory list',
);

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
