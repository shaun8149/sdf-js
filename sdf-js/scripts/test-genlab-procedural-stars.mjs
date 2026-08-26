// test-genlab-procedural-stars.mjs — keep genlab procedural star calls on d2.star's signature.
// d2.star is (points, outerR, innerR). gen.html thinks in radii, so it must go
// through starByRadius; passing radius first creates giant 3-point stars.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '../examples/genlab/gen.html'), 'utf8');

let passed = 0;
let failed = 0;
function ok(cond, msg, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ ${msg}${extra ? ` — ${extra}` : ''}`);
  }
}

ok(
  html.includes('const starByRadius = (points, outerR, innerRatio = 0.45) =>'),
  'gen.html defines explicit radius helper for stars',
);
ok(html.includes('starByRadius(5, r * 1.15)'), 'morph star uses 5 points with scaled outer radius');
ok(html.includes('starByRadius(5, r)'), 'mandala star petal uses 5 points with petal radius');
ok(
  html.includes('starByRadius(6, 0.09, 0.5)'),
  'flake terminal star uses 6 points with radius and ratio',
);
ok(!/[^A-Za-z0-9_$]star\(\s*r\s*[,)]/.test(html), 'no radius-first star(r, ...) calls remain');
ok(
  !/[^A-Za-z0-9_$]star\(\s*0\.\d+\s*,\s*\d/.test(html),
  'no literal-radius-first star calls remain',
);

if (failed) {
  console.error(`\nFAILED: ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\nOK: ${passed} assertions`);
