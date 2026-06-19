// =============================================================================
// test-text-3d-pipe.mjs — L1 unit tests for Wave 1-pipe glyph SDFs
// =============================================================================

import '../src/sdf/index.js';
import {
  buildPipeGlyph,
  supportedPipeChars,
  pipeArcSpan,
} from '../src/scene/components/typography/glyphs-pipe.js';

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

console.log('=== text-3d-pipe smoke test ===\n');

console.log('Test group 1: pipeArcSpan helper');
// Full ring: a0=0, a1=2π → halfAp=π, mid=π → should approximate a full torus
const fullRing = pipeArcSpan(0, 0, 0.3, 0, 2 * Math.PI, 0.05);
ok(Number.isFinite(fullRing([0.3, 0, 0])), 'full-ring SDF finite at ring point');
ok(fullRing([0.3, 0, 0]) < 0, 'full-ring point on tube is inside');
ok(fullRing([0, 0, 0]) > 0, 'full-ring center (hole) is outside');

// Half ring opening down (a0=0, a1=π): arc covers upper half (y > 0)
const upperHalf = pipeArcSpan(0, 0, 0.3, 0, Math.PI, 0.05);
ok(upperHalf([0, 0.3, 0]) < 0, 'upper-half ring includes +Y point (inside)');
// Lower half should be FAR from arc (well past pipeRadius)
ok(upperHalf([0, -0.3, 0]) > 0.1, 'upper-half ring excludes -Y point (outside)');

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
