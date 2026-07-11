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
  // MATERIAL-KIND blocks must be the dangling-else form: starts with `if (`
  // and ends with `} else` so any subset re-chains into valid GLSL. The
  // structural rich/stone gates (compile-time shading paths) are exempt —
  // they are self-contained statement runs, checked separately below.
  const KIND_SET = new Set([
    'sea', 'emissive', 'translucent', 'glass', 'mountain', 'snowy', 'building',
    'eroded', 'fill',
  ]);
  const marked = [...src.matchAll(/\/\/#feature (\w+)\r?\n([\s\S]*?)\/\/#endfeature/g)];
  const kindBlocks = marked.filter((m) => KIND_SET.has(m[1])).map((m) => m[2]);
  ok(
    kindBlocks.length >= 9 &&
      kindBlocks.every(
        (b) => /^\s*if \(is\w+\) \{/.test(b) && /\} else\s*$/.test(b.replace(/\s+$/, '')),
      ),
    'every material-kind block is `if (…) { … } else` (dangling-else form)',
  );
  // rich/stone are mutually exclusive shading paths: EITHER selection must
  // leave the shader with balanced braces (subset compiles structurally).
  const names = marked.map((m) => m[1]);
  ok(names.includes('rich') && names.includes('stone'), 'rich + stone gates present');
  const balance = (glsl) => [...glsl].reduce((n, c) => n + (c === '{') - (c === '}'), 0);
  const richOnly = applyFeatureGates(src, new Set([...KIND_SET, 'rich']));
  const stoneOnly = applyFeatureGates(src, new Set([...KIND_SET, 'stone']));
  ok(balance(richOnly) === balance(stoneOnly), 'rich and stone selections brace-balance equally');
  ok(!stoneOnly.includes('softShadow(p + n * 0.002, toLight'), 'stone drops the main shadow march');
  ok(stoneOnly.includes('STONE mode'), 'stone shading path survives gating');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
