// =============================================================================
// test-icon-library-expanded.mjs — Sprint 18 icon library smoke
// -----------------------------------------------------------------------------
// Verifies:
//   - All 3 sources baked + reachable via resolveIcon
//   - 14 categories non-empty
//   - Brand icons return native color
//   - Flag icons resolve via 2-letter code, flag: prefix, country- prefix
//   - Fuzzy fallback works for ≤2 edit distance
//   - Unknown name returns null (no throw)
// =============================================================================

// Shim Path2D for Node — minimal stub so the resolver can construct one
globalThis.Path2D = class Path2D {
  constructor(d) {
    this.d = d;
  }
};

import {
  resolveIcon,
  getIconPath2D,
  getIconBrandColor,
  hasIcon,
  getCategoryIcons,
  getAllCategories,
} from '../src/icons/index.js';

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

console.log('=== icon library expanded smoke (Sprint 18) ===\n');

console.log('--- 14 categories present ---');
{
  const cats = getAllCategories();
  ok(cats.length === 14, `14 categories (got ${cats.length})`);
  for (const c of cats) {
    const names = getCategoryIcons(c);
    ok(names.length > 0, `category ${c} non-empty (${names.length} names)`);
  }
}

console.log('\n--- Phosphor source ---');
{
  const r = resolveIcon('briefcase');
  ok(r !== null, 'briefcase resolves (non-null)');
  ok(r.source === 'phosphor', `briefcase → phosphor (got ${r?.source})`);
  ok(r.path !== null, 'phosphor path is non-null');
  ok(r.color === null, 'phosphor color is null (theme-controlled)');
  ok(r.resolvedName === 'briefcase', 'resolvedName matches input');
}

console.log('\n--- Brand source (Simple Icons) ---');
{
  const r = resolveIcon('slack');
  ok(r !== null, 'slack resolves (non-null)');
  ok(r.source === 'brand', `slack → brand (got ${r?.source})`);
  ok(r.path !== null, 'brand path is non-null');
  ok(r.color !== null && r.color.startsWith('#'), `brand color hex (got ${r?.color})`);
  ok(getIconBrandColor('slack') === r.color, 'getIconBrandColor matches');
  // Prefix form
  const p = resolveIcon('brand:facebook');
  ok(p !== null, 'brand:facebook resolves (non-null)');
  ok(p.source === 'brand', `brand:facebook → brand (got ${p?.source})`);
  ok(p.resolvedName === 'facebook', 'prefix stripped in resolvedName');
}

console.log('\n--- Flag source ---');
{
  const a = resolveIcon('cn');
  ok(a !== null, 'cn resolves (non-null)');
  ok(a.source === 'flag', `cn → flag (got ${a?.source})`);
  ok(a.svgInner !== null && a.svgInner.length > 0, 'flag svgInner non-empty');
  const b = resolveIcon('flag:us');
  ok(b !== null, 'flag:us resolves (non-null)');
  ok(b.source === 'flag', `flag:us → flag (got ${b?.source})`);
  const c = resolveIcon('country-jp');
  ok(c !== null, 'country-jp resolves (non-null)');
  ok(c.source === 'flag', `country-jp → flag (got ${c?.source})`);
}

console.log('\n--- Fuzzy fallback (edit distance ≤2) ---');
{
  const r = resolveIcon('brifcase'); // missing 'e'
  ok(r !== null, 'brifcase resolves via fuzzy (non-null)');
  ok(r.source === 'fallback', `brifcase → fallback (got ${r?.source})`);
  ok(r.resolvedName === 'briefcase', `resolved to briefcase (got ${r?.resolvedName})`);
}

console.log('\n--- Unknown name → placeholder (no throw) ---');
{
  let threw = false;
  let r;
  try {
    r = resolveIcon('xyznotrealxyz');
  } catch (e) {
    threw = true;
  }
  ok(!threw, 'unknown name does not throw');
  ok(r.source === 'placeholder', `unknown → placeholder source (got ${r.source})`);
  ok(r.path !== null, 'placeholder has Path2D so render does not break');
  ok(r.color === null, 'placeholder has no brand color');
  ok(r.resolvedName === 'xyznotrealxyz', 'placeholder preserves input name for debugging');
  // getIconPath2D still returns null for unknown (placeholder path is non-null but getIconPath2D
  // checks resolveIcon internally — now returns the placeholder path)
  ok(getIconPath2D('xyznotrealxyz') !== null, 'getIconPath2D(unknown) returns placeholder Path2D');
}

console.log('\n--- hasIcon membership ---');
{
  ok(hasIcon('briefcase'), 'hasIcon(briefcase) true');
  ok(hasIcon('slack'), 'hasIcon(slack) true');
  ok(hasIcon('cn'), 'hasIcon(cn) true');
  ok(!hasIcon('xyznotreal'), 'hasIcon(xyznotreal) false');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
