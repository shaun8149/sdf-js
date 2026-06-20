/**
 * Chromotome Palettes (curated color palette library)
 *
 * Source: Kjetil Midtgarden Golid (kgolid),
 *   https://github.com/kgolid/chromotome — MIT licensed
 * Atlas adaptation: 2026-06-20 — recipe-only port, ~25 hand-selected palettes
 *   spanning 4 sub-collections (hilda / jung / ranganath / kovecses) +
 *   simplified accessor API. Original chromotome has ~120-150 palettes across
 *   20+ sub-files; we curate a representative subset to keep bundle tight.
 *
 * What it does
 * ------------
 * Provides a library of curated color palettes. Each palette = {name,
 * colors[], background, stroke?}. Accessor:
 *   getChromotomePalettes() → Array<palette>
 *   getChromotomePaletteByName(name) → palette | null
 *   getRandomChromotomePalette(seedFn) → palette (seedFn = deterministic rand)
 *
 * Atlas use case
 * --------------
 * **Major upgrade for Atlas Present branding system**. Current
 * `src/present/branding-palettes.js` ships 5 simple 2-color presets
 * ({bg, silhouetteColor}). Chromotome adds RICH palettes (4-7 colors +
 * background + stroke per palette) that enable:
 *
 *   1. **Multi-color visuals**: 8 KPI cards each in different color of
 *      the active palette (vs current "all same silhouette color").
 *   2. **Distinct stroke vs fill**: stroke color separate from fill =
 *      finer typography control.
 *   3. **Cultural/aesthetic diversity**: hilda (vintage children's book),
 *      jung (saturated animal-inspired), ranganath (Indian textile),
 *      kovecses (mid-century modern).
 *
 * Two adoption paths:
 *   A) LLM inlines a palette into args.code directly (for one-off variants
 *      where Atlas's bound palette doesn't fit the content's mood)
 *   B) **Sprint 7 upgrade Atlas branding-palettes.js** to load chromotome
 *      as additional preset family, user picks from broader library
 *
 * License + attribution
 * ---------------------
 * Original chromotome: MIT (c) Kjetil Midtgarden Golid. Atlas curates a
 * subset; copyright preserved per-palette via `source: 'chromotome:<sub>'`
 * field on each palette object.
 *
 * Inside-iframe usage (LLM inlines this function + palette data):
 *   const p = getChromotomePaletteByName('hilda01');
 *   background(...hexToRgb(p.background));
 *   for (let i = 0; i < p.colors.length; i++) {
 *     fill(...hexToRgb(p.colors[i]));
 *     rect(50 + i * 80, 200, 60, 60);
 *   }
 *
 * Test: scripts/test-p5-idiom-registry.mjs (palette validity + accessor smoke)
 */

const _PALETTES = [
  // --- hilda (vintage children's book aesthetic) ---
  {
    name: 'hilda01',
    source: 'chromotome:hilda',
    colors: ['#ec5526', '#f4ac12', '#9ebbc1', '#f7f4e2'],
    stroke: '#1e1b1e',
    background: '#e7e8d4',
  },
  {
    name: 'hilda02',
    source: 'chromotome:hilda',
    colors: ['#eb5627', '#eebb20', '#4e9eb8', '#f7f5d0'],
    stroke: '#201d13',
    background: '#77c1c0',
  },
  {
    name: 'hilda03',
    source: 'chromotome:hilda',
    colors: ['#e95145', '#f8b917', '#b8bdc1', '#ffb2a2'],
    stroke: '#010101',
    background: '#6b7752',
  },
  {
    name: 'hilda04',
    source: 'chromotome:hilda',
    colors: ['#e95145', '#f6bf7a', '#589da1', '#f5d9bc'],
    stroke: '#000001',
    background: '#f5ede1',
  },
  {
    name: 'hilda05',
    source: 'chromotome:hilda',
    colors: ['#ff6555', '#ffb58f', '#d8eecf', '#8c4b47', '#bf7f93'],
    stroke: '#2b0404',
    background: '#ffda82',
  },
  {
    name: 'hilda06',
    source: 'chromotome:hilda',
    colors: ['#f75952', '#ffce84', '#74b7b2', '#f6f6f6', '#b17d71'],
    stroke: '#0e0603',
    background: '#f6ecd4',
  },

  // --- jung (saturated animal-inspired, primary palettes) ---
  {
    name: 'jung_bird',
    source: 'chromotome:jung',
    colors: ['#fc3032', '#fed530', '#33c3fb', '#ff7bac', '#fda929'],
    stroke: '#000000',
    background: '#ffffff',
  },
  {
    name: 'jung_horse',
    source: 'chromotome:jung',
    colors: ['#e72e81', '#f0bf36', '#3056a2'],
    stroke: '#000000',
    background: '#ffffff',
  },
  {
    name: 'jung_croc',
    source: 'chromotome:jung',
    colors: ['#f13274', '#eed03e', '#405e7f', '#19a198'],
    stroke: '#000000',
    background: '#ffffff',
  },
  {
    name: 'jung_hippo',
    source: 'chromotome:jung',
    colors: ['#ff7bac', '#ff921e', '#3ea8f5', '#7ac943'],
    stroke: '#000000',
    background: '#ffffff',
  },
  {
    name: 'jung_wolf',
    source: 'chromotome:jung',
    colors: ['#e51c39', '#f1b844', '#36c4b7', '#666666'],
    stroke: '#000000',
    background: '#ffffff',
  },

  // --- ranganath (Indian textile / temple inspired, warm earth tones) ---
  {
    name: 'rag-mysore',
    source: 'chromotome:ranganath',
    colors: ['#ec6c26', '#613a53', '#e8ac52', '#639aa0'],
    background: '#d5cda1',
  },
  {
    name: 'rag-gol',
    source: 'chromotome:ranganath',
    colors: ['#d3693e', '#803528', '#f1b156', '#90a798'],
    background: '#f0e0a4',
  },
  {
    name: 'rag-belur',
    source: 'chromotome:ranganath',
    colors: ['#f46e26', '#68485f', '#3d273a', '#535d55'],
    background: '#dcd4a6',
  },
  {
    name: 'rag-bangalore',
    source: 'chromotome:ranganath',
    colors: ['#ea720e', '#ca5130', '#e9c25a', '#52534f'],
    background: '#f9ecd3',
  },
  {
    name: 'rag-taj',
    source: 'chromotome:ranganath',
    colors: ['#ce565e', '#8e1752', '#f8a100', '#3ac1a6'],
    background: '#efdea2',
  },
  {
    name: 'rag-virupaksha',
    source: 'chromotome:ranganath',
    colors: ['#f5736a', '#925951', '#feba4c', '#9d9b9d'],
    background: '#eedfa2',
  },

  // --- kovecses (mid-century modern, muted with strong accents) ---
  {
    name: 'kov_01',
    source: 'chromotome:kovecses',
    colors: ['#d24c23', '#7ba6bc', '#f0c667', '#ede2b3', '#672b35', '#142a36'],
    stroke: '#132a37',
    background: '#108266',
  },
  {
    name: 'kov_02',
    source: 'chromotome:kovecses',
    colors: ['#e8dccc', '#e94641', '#eeaeae'],
    stroke: '#e8dccc',
    background: '#6c96be',
  },
  {
    name: 'kov_03',
    source: 'chromotome:kovecses',
    colors: ['#e3937b', '#d93f1d', '#090d15', '#e6cca7'],
    stroke: '#090d15',
    background: '#558947',
  },
  {
    name: 'kov_04',
    source: 'chromotome:kovecses',
    colors: ['#d03718', '#292b36', '#33762f', '#ead7c9', '#ce7028', '#689d8d'],
    stroke: '#292b36',
    background: '#deb330',
  },
  {
    name: 'kov_05',
    source: 'chromotome:kovecses',
    colors: ['#de3f1a', '#de9232', '#007158', '#e6cdaf', '#869679'],
    stroke: '#010006',
    background: '#7aa5a6',
  },
  {
    name: 'kov_06',
    source: 'chromotome:kovecses',
    colors: ['#a87c2a', '#bdc9b1', '#f14616', '#ecbfaf', '#017724', '#0e2733', '#2b9ae9'],
    stroke: '#292319',
    background: '#dfd4c1',
  },
];

function getChromotomePalettes() {
  return _PALETTES.slice();
}

function getChromotomePaletteByName(name) {
  return _PALETTES.find((p) => p.name === name) || null;
}

function getRandomChromotomePalette(rand) {
  const r = typeof rand === 'function' ? rand() : Math.random();
  return _PALETTES[Math.floor(r * _PALETTES.length)];
}

/**
 * Helper: convert hex string (#rgb / #rrggbb) to [r, g, b] array.
 * Useful inside iframe sketches that need to pass to P5 fill(r, g, b).
 */
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return [0, 0, 0];
  let s = hex.replace('#', '');
  if (s.length === 3)
    s = s
      .split('')
      .map((c) => c + c)
      .join('');
  if (s.length !== 6) return [0, 0, 0];
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return [0, 0, 0];
  return [r, g, b];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getChromotomePalettes,
    getChromotomePaletteByName,
    getRandomChromotomePalette,
    hexToRgb,
  };
}
if (typeof window !== 'undefined') {
  window.getChromotomePalettes = getChromotomePalettes;
  window.getChromotomePaletteByName = getChromotomePaletteByName;
  window.getRandomChromotomePalette = getRandomChromotomePalette;
  window.hexToRgb = hexToRgb;
}
