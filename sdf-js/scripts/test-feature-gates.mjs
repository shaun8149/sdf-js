// sdf-js/scripts/test-feature-gates.mjs — studio material-branch feature gating.
import { readFileSync } from 'node:fs';
import { applyFeatureGates } from '../src/render/studio.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== feature-gates (studio material branches) ===\n');

// ---- gate mechanics on a synthetic chain ------------------------------------
const CHAIN = `
    //#feature sea
    if (isSea) {
      col = seaShade();
    } else
    //#endfeature
    //#feature mountain
    if (isMountain) {
      col = mountainShade();
    } else
    //#endfeature
    {
      col = standardShade();
    }
`;

const braces = (s) => (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;

{
  const all = applyFeatureGates(CHAIN, null);
  ok(all.includes('isSea') && all.includes('isMountain'), 'null features → everything kept');
  ok(!all.includes('//#feature'), 'marker lines always stripped');
  ok(braces(all) === 0, 'braces balanced (all)');
}
{
  const none = applyFeatureGates(CHAIN, new Set());
  ok(
    !none.includes('isSea') && !none.includes('isMountain'),
    'empty set → all gated branches dropped',
  );
  ok(none.includes('standardShade'), 'standard block survives');
  ok(braces(none) === 0, 'braces balanced (none)');
}
{
  const mid = applyFeatureGates(CHAIN, new Set(['mountain']));
  ok(!mid.includes('isSea') && mid.includes('isMountain'), 'subset keeps only requested branch');
  ok(braces(mid) === 0, 'braces balanced (subset)');
}

// ---- the real template markers are sane -------------------------------------
{
  const src = readFileSync(new URL('../src/render/studio.js', import.meta.url), 'utf8');
  const feats = [...src.matchAll(/\/\/#feature (\w+)/g)].map((m) => m[1]);
  const ends = (src.match(/\/\/#endfeature/g) || []).length;
  ok(feats.length === ends, `markers balanced in studio.js (${feats.length} features)`);
  ok(
    [
      'sea',
      'mountain',
      'emissive',
      'translucent',
      'snowy',
      'building',
      'eroded',
      'glass',
      'fill',
    ].every((f) => feats.includes(f)),
    'all 9 material-kind branches are marked',
  );
  // each marked block must be the dangling-else form: starts with `if (` and
  // its body ends with `} else` so any subset re-chains into valid GLSL
  const blocks = [...src.matchAll(/\/\/#feature \w+\r?\n([\s\S]*?)\/\/#endfeature/g)].map(
    (m) => m[1],
  );
  ok(
    blocks.every(
      (b) =>
        /^\s*if \(is\w+\) \{/.test(b) &&
        /\} else\s*$/.test(b.trimEnd() + '\n' ? b.replace(/\s+$/, '') : b),
    ),
    'every block is `if (…) { … } else` (dangling-else form)',
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
