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

console.log('--- built-in 5 still present (backward compat) ---');
{
  ok(Array.isArray(BRANDING_PALETTES), 'BRANDING_PALETTES is array');
  const ids = BRANDING_PALETTES.slice(0, 5).map((p) => p.id);
  const expected = ['mono-light', 'mono-dark', 'warm-paper', 'cool-mint', 'high-contrast'];
  ok(
    JSON.stringify(ids) === JSON.stringify(expected),
    `first 5 are built-in in order (got ${ids.join(',')})`,
  );
  ok(
    BRANDING_PALETTES[0].bg.length === 3 && BRANDING_PALETTES[0].silhouetteColor.length === 3,
    'built-in shape unchanged: {bg, silhouetteColor} as [r,g,b]',
  );
  ok(
    BRANDING_PALETTES[0].colors === undefined,
    'built-in palettes have no colors[] field (backward compat)',
  );
}

console.log('\n--- chromotome appended (Sprint 9) ---');
{
  ok(BRANDING_PALETTES.length >= 5 + 20, `total ≥ 25 palettes (got ${BRANDING_PALETTES.length})`);
  ok(
    BRANDING_PALETTES.length === 5 + CHROMOTOME_BRANDING_PALETTES.length,
    `total = 5 + chromotome count (${5 + CHROMOTOME_BRANDING_PALETTES.length})`,
  );

  const chromo = BRANDING_PALETTES.slice(5);
  ok(
    chromo.every((p) => p.id.startsWith('chromotome:')),
    'all appended palettes have chromotome: id prefix',
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
