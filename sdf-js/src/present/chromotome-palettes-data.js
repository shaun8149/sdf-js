// =============================================================================
// chromotome-palettes-data.js — Atlas Present Sprint 9 branding library extension
// -----------------------------------------------------------------------------
// Ports ~23 hand-curated palettes from Kjetil Midtgarden Golid (kgolid)'s
// chromotome library (MIT licensed, github.com/kgolid/chromotome) into Atlas
// Present's branding-palettes.js shape.
//
// Sprint 6 (PR #31) shipped the chromotome data as an iframe-side idiom
// (sdf-js/examples/p5-idiom-registry/kgolid-chromotome-palettes.js) for
// LLM to inline into args.code. Sprint 9 (this file) makes the SAME palettes
// available as ATLAS-LEVEL branding presets, swappable via the Swap Branding
// menu like the original 5 simple presets.
//
// Conversion from chromotome shape → Atlas branding shape:
//   chromotome: { name, colors: ['#hex', ...], background: '#hex', stroke?: '#hex' }
//   atlas:      { id, label, bg: [r,g,b], silhouetteColor: [r,g,b], colors?: [[r,g,b], ...], stroke?: [r,g,b], source }
//
// Rules:
//   - id: 'chromotome:<name>' (namespaced to avoid collision with built-in ids)
//   - label: humanized name (e.g., 'hilda01' → 'Hilda 01')
//   - bg: hex(background) → [r,g,b]
//   - silhouetteColor: hex(stroke) if present, else darkest color in colors[]
//     (luminance-based) — gives reasonable fallback for renderers that only
//     read silhouetteColor (silhouette/lines/crayon/topo)
//   - colors: full multi-color array converted to [r,g,b] tuples — NEW field
//     LLM-generated P5 sketches can use for per-element coloring (KPI cards
//     each in different palette color)
//   - stroke: explicit stroke when chromotome has it (some palettes do, some don't)
//   - source: 'chromotome:<sub>' for attribution
//
// License + attribution preserved per palette via `source` field. Original
// chromotome README + LICENSE: MIT (c) Kjetil Midtgarden Golid.
// =============================================================================

function _hexToRgb(hex) {
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

function _luminance([r, g, b]) {
  // sRGB relative luminance (ITU-R BT.709 coefficients)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function _darkestColor(rgbColors) {
  let best = rgbColors[0];
  let bestLuma = _luminance(rgbColors[0]);
  for (let i = 1; i < rgbColors.length; i++) {
    const l = _luminance(rgbColors[i]);
    if (l < bestLuma) {
      bestLuma = l;
      best = rgbColors[i];
    }
  }
  return best;
}

function _humanizeName(name) {
  // 'hilda01' → 'Hilda 01', 'rag-mysore' → 'Rag Mysore', 'kov_01' → 'Kov 01'
  return name
    .replace(/[-_]/g, ' ')
    .replace(/(\D)(\d)/g, '$1 $2')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Convert one chromotome palette to Atlas branding shape.
 * Exposed for testing; library exports the pre-converted list.
 */
export function chromotomePaletteToBranding(p) {
  const colors = p.colors.map(_hexToRgb);
  const bg = _hexToRgb(p.background);
  const stroke = p.stroke ? _hexToRgb(p.stroke) : null;
  const silhouetteColor = stroke || _darkestColor(colors);
  return {
    id: 'chromotome:' + p.name,
    label: _humanizeName(p.name),
    bg,
    silhouetteColor,
    colors,
    stroke,
    source: 'chromotome:' + (p.source || 'misc'),
  };
}

// Source data: same 23 palettes as Sprint 6's iframe idiom file
// (sdf-js/examples/p5-idiom-registry/kgolid-chromotome-palettes.js).
// Duplicated here to keep this Layer 2 file independent of the registry.
const _CHROMOTOME_SOURCE = [
  // hilda (vintage children's book)
  {
    name: 'hilda01',
    source: 'hilda',
    colors: ['#ec5526', '#f4ac12', '#9ebbc1', '#f7f4e2'],
    stroke: '#1e1b1e',
    background: '#e7e8d4',
  },
  {
    name: 'hilda02',
    source: 'hilda',
    colors: ['#eb5627', '#eebb20', '#4e9eb8', '#f7f5d0'],
    stroke: '#201d13',
    background: '#77c1c0',
  },
  {
    name: 'hilda03',
    source: 'hilda',
    colors: ['#e95145', '#f8b917', '#b8bdc1', '#ffb2a2'],
    stroke: '#010101',
    background: '#6b7752',
  },
  {
    name: 'hilda04',
    source: 'hilda',
    colors: ['#e95145', '#f6bf7a', '#589da1', '#f5d9bc'],
    stroke: '#000001',
    background: '#f5ede1',
  },
  {
    name: 'hilda05',
    source: 'hilda',
    colors: ['#ff6555', '#ffb58f', '#d8eecf', '#8c4b47', '#bf7f93'],
    stroke: '#2b0404',
    background: '#ffda82',
  },
  {
    name: 'hilda06',
    source: 'hilda',
    colors: ['#f75952', '#ffce84', '#74b7b2', '#f6f6f6', '#b17d71'],
    stroke: '#0e0603',
    background: '#f6ecd4',
  },

  // jung (saturated animal-inspired)
  {
    name: 'jung_bird',
    source: 'jung',
    colors: ['#fc3032', '#fed530', '#33c3fb', '#ff7bac', '#fda929'],
    stroke: '#000000',
    background: '#ffffff',
  },
  {
    name: 'jung_horse',
    source: 'jung',
    colors: ['#e72e81', '#f0bf36', '#3056a2'],
    stroke: '#000000',
    background: '#ffffff',
  },
  {
    name: 'jung_croc',
    source: 'jung',
    colors: ['#f13274', '#eed03e', '#405e7f', '#19a198'],
    stroke: '#000000',
    background: '#ffffff',
  },
  {
    name: 'jung_hippo',
    source: 'jung',
    colors: ['#ff7bac', '#ff921e', '#3ea8f5', '#7ac943'],
    stroke: '#000000',
    background: '#ffffff',
  },
  {
    name: 'jung_wolf',
    source: 'jung',
    colors: ['#e51c39', '#f1b844', '#36c4b7', '#666666'],
    stroke: '#000000',
    background: '#ffffff',
  },

  // ranganath (Indian textile / temple)
  {
    name: 'rag-mysore',
    source: 'ranganath',
    colors: ['#ec6c26', '#613a53', '#e8ac52', '#639aa0'],
    background: '#d5cda1',
  },
  {
    name: 'rag-gol',
    source: 'ranganath',
    colors: ['#d3693e', '#803528', '#f1b156', '#90a798'],
    background: '#f0e0a4',
  },
  {
    name: 'rag-belur',
    source: 'ranganath',
    colors: ['#f46e26', '#68485f', '#3d273a', '#535d55'],
    background: '#dcd4a6',
  },
  {
    name: 'rag-bangalore',
    source: 'ranganath',
    colors: ['#ea720e', '#ca5130', '#e9c25a', '#52534f'],
    background: '#f9ecd3',
  },
  {
    name: 'rag-taj',
    source: 'ranganath',
    colors: ['#ce565e', '#8e1752', '#f8a100', '#3ac1a6'],
    background: '#efdea2',
  },
  {
    name: 'rag-virupaksha',
    source: 'ranganath',
    colors: ['#f5736a', '#925951', '#feba4c', '#9d9b9d'],
    background: '#eedfa2',
  },

  // kovecses (mid-century modern)
  {
    name: 'kov_01',
    source: 'kovecses',
    colors: ['#d24c23', '#7ba6bc', '#f0c667', '#ede2b3', '#672b35', '#142a36'],
    stroke: '#132a37',
    background: '#108266',
  },
  {
    name: 'kov_02',
    source: 'kovecses',
    colors: ['#e8dccc', '#e94641', '#eeaeae'],
    stroke: '#e8dccc',
    background: '#6c96be',
  },
  {
    name: 'kov_03',
    source: 'kovecses',
    colors: ['#e3937b', '#d93f1d', '#090d15', '#e6cca7'],
    stroke: '#090d15',
    background: '#558947',
  },
  {
    name: 'kov_04',
    source: 'kovecses',
    colors: ['#d03718', '#292b36', '#33762f', '#ead7c9', '#ce7028', '#689d8d'],
    stroke: '#292b36',
    background: '#deb330',
  },
  {
    name: 'kov_05',
    source: 'kovecses',
    colors: ['#de3f1a', '#de9232', '#007158', '#e6cdaf', '#869679'],
    stroke: '#010006',
    background: '#7aa5a6',
  },
  {
    name: 'kov_06',
    source: 'kovecses',
    colors: ['#a87c2a', '#bdc9b1', '#f14616', '#ecbfaf', '#017724', '#0e2733', '#2b9ae9'],
    stroke: '#292319',
    background: '#dfd4c1',
  },
];

/** Pre-converted Atlas branding shape — ready to import into BRANDING_PALETTES. */
export const CHROMOTOME_BRANDING_PALETTES = _CHROMOTOME_SOURCE.map(chromotomePaletteToBranding);
