// =============================================================================
// test-branding-palettes.mjs — Sprint 9: chromotome integration into Atlas branding
// -----------------------------------------------------------------------------
// Verifies: built-in 5 still present + chromotome 23 appended + getPalette
// resolves both kinds + new fields (colors, stroke, source) on chromotome
// palettes + backward-compat (existing 2-color consumers unchanged).
// =============================================================================

import {
  BRANDING_PALETTES,
  getPalette,
  getPaletteFamilies,
} from '../src/present/branding-palettes.js';
import {
  chromotomePaletteToBranding,
  CHROMOTOME_BRANDING_PALETTES,
} from '../src/present/chromotome-palettes-data.js';

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

console.log('=== branding-palettes Sprint 9 smoke ===\n');

// Sprint 15B: BRANDING_PALETTES order is now [9 atlas + 5 built-in + 23 chromotome]
// (atlas-first so UI surfaces them prioritally). Tests below use lookup-by-id
// rather than fixed slice indices for forward-compat as new themes/palettes ship.

console.log('--- built-in 5 still present (backward compat by id lookup) ---');
{
  ok(Array.isArray(BRANDING_PALETTES), 'BRANDING_PALETTES is array');
  const builtInIds = ['mono-light', 'mono-dark', 'warm-paper', 'cool-mint', 'high-contrast'];
  const found = builtInIds.map((id) => BRANDING_PALETTES.find((p) => p.id === id));
  ok(
    found.every((p) => p),
    `all 5 built-in still resolvable by id (${builtInIds.join(',')})`,
  );
  const monoLight = getPalette('mono-light');
  ok(
    monoLight.bg.length === 3 && monoLight.silhouetteColor.length === 3,
    'built-in shape unchanged: {bg, silhouetteColor} as [r,g,b]',
  );
  ok(monoLight.colors === undefined, 'built-in palettes have no colors[] field (backward compat)');
}

console.log('\n--- chromotome present (Sprint 9) ---');
{
  ok(BRANDING_PALETTES.length >= 5 + 20, `total ≥ 25 palettes (got ${BRANDING_PALETTES.length})`);
  // Sprint 15B: total = 9 atlas themes + 5 built-in + chromotome count
  const expectedTotal = 9 + 5 + CHROMOTOME_BRANDING_PALETTES.length;
  ok(
    BRANDING_PALETTES.length === expectedTotal,
    `total = 9 atlas + 5 built-in + chromotome (${expectedTotal})`,
  );

  const chromo = BRANDING_PALETTES.filter((p) => p.id.startsWith('chromotome:'));
  ok(
    chromo.length === CHROMOTOME_BRANDING_PALETTES.length,
    `chromotome palette count matches source (${chromo.length})`,
  );
  ok(
    chromo.every((p) => Array.isArray(p.colors) && p.colors.length >= 3),
    'every chromotome palette has colors[≥3]',
  );
  ok(
    chromo.every((p) => p.colors.every((c) => Array.isArray(c) && c.length === 3)),
    'every color is [r,g,b] tuple',
  );
  ok(
    chromo.every((p) => p.bg.length === 3),
    'bg converted to [r,g,b]',
  );
  ok(
    chromo.every((p) => p.source && p.source.startsWith('chromotome:')),
    'attribution preserved via source',
  );
}

console.log('\n--- conversion correctness ---');
{
  // Test hex → rgb conversion via chromotomePaletteToBranding directly
  const sample = chromotomePaletteToBranding({
    name: 'test_red',
    source: 'test',
    colors: ['#ff0000', '#00ff00', '#0000ff'],
    background: '#808080',
    stroke: '#000000',
  });
  ok(
    JSON.stringify(sample.colors) ===
      JSON.stringify([
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
      ]),
    'colors hex → rgb correct',
  );
  ok(
    JSON.stringify(sample.bg) === JSON.stringify([128, 128, 128]),
    'bg hex → rgb correct (#808080 → [128,128,128])',
  );
  ok(
    JSON.stringify(sample.silhouetteColor) === JSON.stringify([0, 0, 0]),
    'silhouetteColor uses stroke when present',
  );
  ok(sample.id === 'chromotome:test_red', 'id namespaced');
  ok(sample.label === 'Test Red', `label humanized (got "${sample.label}")`);

  // Test fallback: no stroke → darkest color
  const noStroke = chromotomePaletteToBranding({
    name: 'no_stroke',
    source: 'test',
    colors: ['#ffffff', '#888888', '#222222'],
    background: '#ffffff',
  });
  ok(
    JSON.stringify(noStroke.silhouetteColor) === JSON.stringify([34, 34, 34]),
    'silhouetteColor falls back to darkest color when no stroke',
  );
}

console.log('\n--- getPalette resolution ---');
{
  ok(getPalette('mono-light').id === 'mono-light', 'built-in resolves by id');
  ok(
    getPalette('chromotome:hilda01').id === 'chromotome:hilda01',
    'chromotome resolves by namespaced id',
  );
  ok(getPalette('nonsense').id === 'mono-light', 'unknown id falls back to first (mono-light)');
}

console.log('\n--- getPaletteFamilies ---');
{
  const fams = getPaletteFamilies();
  ok(Array.isArray(fams), 'returns array');
  ok(fams.length >= 5, `≥5 families (built-in + 4 chromotome sub-collections): ${fams.length}`);
  const familyNames = fams.map((f) => f.family);
  ok(familyNames.includes('built-in'), 'has built-in family');
  ok(
    familyNames.some((f) => f.startsWith('chromotome:')),
    'has chromotome family',
  );
  const totalCount = fams.reduce((sum, f) => sum + f.count, 0);
  ok(totalCount === BRANDING_PALETTES.length, 'family counts sum to total palettes');
}

console.log(`\n=== Result: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
