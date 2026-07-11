// =============================================================================
// themes.js — Atlas Present 9 curated theme presets (3 macros × 3 colors)
// -----------------------------------------------------------------------------
// Sprint 15B: Adds 9 theme presets organized by PL/Gamma's 3-macro-cluster
// theory (per [[gamma-8-template-observation]]):
//
//   - Editorial / Calm    — serif + soft photo + dark/cream + large negative space
//   - Pitch / Punchy      — display sans + high contrast + saturated accent
//   - Organic / Nature    — rounded sans + soft gradients + nature palette
//
// Each macro ships in 3 color variants (navy/forest/burgundy for editorial,
// black-neon/cobalt-orange/charcoal-yellow for pitch, teal/coral/lavender for
// organic) — 9 effective presets total.
//
// Schema EXTENDS branding-palettes.js BrandingPreset with:
//   - macroCluster: 'editorial' | 'pitch' | 'organic'
//   - accent: [r,g,b] — primary action color (often != colors[0])
//   - font: { heading: string, body: string } — typography family per macro
//   - featured: true — flagged for primary UI menu (vs. cycling through 28 chromotome)
//
// Backward compat: existing atoms reading {bg, silhouetteColor, colors[]} still
// work; new atoms can opt into reading {accent, font} for richer theming.
// =============================================================================

/**
 * @typedef {object} ThemePreset
 * @property {string} id — stable identifier
 * @property {string} label — display name
 * @property {'editorial'|'pitch'|'organic'} macroCluster
 * @property {[number,number,number]} bg — page background
 * @property {[number,number,number]} silhouetteColor — primary text/fg color
 * @property {[number,number,number]} accent — primary accent / action color
 * @property {Array<[number,number,number]>} colors — multi-color series (charts, etc)
 * @property {{heading: string, body: string}} font — typography families
 * @property {true} featured — true for the 9 macro presets
 * @property {[number,number,number]} [stroke] — optional explicit stroke color
 */

/** @type {ThemePreset[]} */
export const ATLAS_THEMES = [
  // ============================================================================
  // EDITORIAL / CALM — serif + soft photo + large negative space
  // ============================================================================
  {
    id: 'editorial-navy',
    label: 'Editorial · Navy',
    macroCluster: 'editorial',
    bg: [248, 246, 240], // warm off-white paper
    silhouetteColor: [22, 35, 70], // deep navy
    accent: [38, 70, 130], // navy accent
    colors: [
      [38, 70, 130],
      [110, 95, 75],
      [165, 130, 90],
      [200, 195, 180],
    ],
    font: { heading: 'Georgia, "Source Serif Pro", serif', body: 'Inter, system-ui, sans-serif' },
    featured: true,
  },
  {
    id: 'editorial-spectrum',
    label: 'Editorial · Spectrum',
    macroCluster: 'editorial',
    // Sprint 72 (user feedback: 纯蓝白太单调): the classic multi-hue
    // editorial-infographic set — ink navy anchor + terracotta / sage /
    // gold / plum. Made for SECTION ACCENT programming (applySectionAccents):
    // each chapter of a long deck holds one hue, the family resemblance
    // comes from shared bg/ink/saturation discipline.
    bg: [248, 246, 240],
    silhouetteColor: [30, 34, 52],
    accent: [38, 70, 130], // navy stays the anchor — covers/agenda/summary
    colors: [
      [38, 70, 130], // navy (anchor)
      [186, 88, 58], // terracotta
      [96, 132, 92], // sage
      [196, 148, 62], // gold
      [118, 84, 138], // plum
      [70, 128, 148], // steel teal
    ],
    font: {
      heading: 'Georgia, "Source Serif Pro", serif',
      body: 'Inter, system-ui, sans-serif',
    },
    featured: true,
  },
  {
    id: 'editorial-forest',
    label: 'Editorial · Forest',
    macroCluster: 'editorial',
    bg: [244, 242, 232], // cream
    silhouetteColor: [30, 55, 40], // deep forest
    accent: [62, 110, 78], // forest green
    colors: [
      [62, 110, 78],
      [140, 105, 70],
      [200, 175, 130],
      [165, 145, 115],
    ],
    font: { heading: 'Georgia, "Source Serif Pro", serif', body: 'Inter, system-ui, sans-serif' },
    featured: true,
  },
  {
    id: 'editorial-burgundy',
    label: 'Editorial · Burgundy',
    macroCluster: 'editorial',
    bg: [250, 244, 238],
    silhouetteColor: [70, 25, 30], // deep burgundy
    accent: [140, 50, 60], // burgundy accent
    colors: [
      [140, 50, 60],
      [170, 130, 80],
      [200, 180, 140],
      [110, 100, 90],
    ],
    font: { heading: 'Georgia, "Source Serif Pro", serif', body: 'Inter, system-ui, sans-serif' },
    featured: true,
  },

  // ============================================================================
  // PITCH / PUNCHY — display sans + high contrast + saturated accent
  // ============================================================================
  {
    id: 'pitch-black-neon',
    label: 'Pitch · Black Neon',
    macroCluster: 'pitch',
    bg: [16, 18, 22], // near-black
    silhouetteColor: [240, 240, 245],
    accent: [60, 230, 130], // neon green
    colors: [
      [60, 230, 130],
      [240, 240, 245],
      [120, 130, 145],
      [255, 215, 60],
    ],
    font: {
      heading: '"Inter Display", Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
    },
    featured: true,
  },
  {
    id: 'pitch-cobalt-orange',
    label: 'Pitch · Cobalt Orange',
    macroCluster: 'pitch',
    bg: [255, 255, 255],
    silhouetteColor: [20, 25, 50], // deep cobalt
    accent: [255, 120, 40], // saturated orange
    colors: [
      [255, 120, 40],
      [20, 60, 180],
      [220, 220, 235],
      [60, 65, 90],
    ],
    font: {
      heading: '"Inter Display", Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
    },
    featured: true,
  },
  {
    id: 'pitch-charcoal-yellow',
    label: 'Pitch · Charcoal Yellow',
    macroCluster: 'pitch',
    bg: [38, 40, 46], // charcoal
    silhouetteColor: [248, 248, 245],
    accent: [255, 215, 50], // bold yellow
    colors: [
      [255, 215, 50],
      [248, 248, 245],
      [180, 185, 195],
      [120, 120, 130],
    ],
    font: {
      heading: '"Inter Display", Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
    },
    featured: true,
  },

  // ============================================================================
  // ORGANIC / NATURE — rounded sans + soft gradients + nature palette
  // ============================================================================
  {
    id: 'pitch-spectrum',
    label: 'Pitch · Spectrum',
    macroCluster: 'pitch',
    // Sprint 73: multi-hue on ink — vivid editorial energy for pitch decks.
    // Palette: chromotome kov_06 (the repo's established palette corpus),
    // the Fidenza-on-dark register: vermilion anchor + azure / ochre /
    // green / blush over deep ink. Built for section-accent programming.
    bg: [14, 22, 30],
    silhouetteColor: [238, 236, 228],
    accent: [241, 70, 22], // vermilion anchor
    colors: [
      [241, 70, 22], // vermilion (anchor)
      [43, 154, 233], // azure
      [168, 124, 42], // gold ochre
      [1, 119, 86], // deep green (lifted from kov_06 green toward teal for dark-bg contrast)
      [236, 191, 175], // blush
      [189, 201, 177], // sage grey
    ],
    font: {
      heading: '"Inter Display", Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
    },
    featured: true,
  },
  {
    id: 'organic-spectrum',
    label: 'Organic · Spectrum',
    macroCluster: 'organic',
    // Sprint 73: the Fidenza warm-naturals register — sand canvas,
    // vermilion / amber / deep green / sage (chromotome kov_05 + hilda
    // family, the repo's palette corpus). Flow-ribbons on this palette IS
    // the Fidenza feel our L2 recipe port was born from.
    bg: [246, 240, 228],
    silhouetteColor: [56, 44, 36],
    accent: [200, 66, 34], // vermilion, earthed
    colors: [
      [200, 66, 34], // vermilion (anchor)
      [222, 146, 50], // amber
      [0, 113, 88], // deep green
      [134, 150, 121], // sage
      [140, 75, 71], // clay
      [86, 118, 140], // river blue
    ],
    font: {
      heading: 'Georgia, "Source Serif Pro", serif',
      body: 'Inter, system-ui, sans-serif',
    },
    featured: true,
  },
  {
    id: 'organic-teal',
    label: 'Organic · Teal',
    macroCluster: 'organic',
    bg: [232, 244, 240], // mint mist
    silhouetteColor: [25, 60, 65],
    accent: [60, 145, 145], // teal
    colors: [
      [60, 145, 145],
      [110, 175, 165],
      [220, 200, 145],
      [165, 145, 115],
    ],
    font: {
      heading: '"Quicksand", "Nunito", Inter, system-ui, sans-serif',
      body: '"Nunito Sans", Inter, system-ui, sans-serif',
    },
    featured: true,
  },
  {
    id: 'organic-coral',
    label: 'Organic · Coral',
    macroCluster: 'organic',
    bg: [253, 246, 238], // peach paper
    silhouetteColor: [80, 40, 45],
    accent: [230, 110, 90], // coral
    colors: [
      [230, 110, 90],
      [245, 175, 130],
      [200, 145, 130],
      [255, 205, 175],
    ],
    font: {
      heading: '"Quicksand", "Nunito", Inter, system-ui, sans-serif',
      body: '"Nunito Sans", Inter, system-ui, sans-serif',
    },
    featured: true,
  },
  {
    id: 'organic-lavender',
    label: 'Organic · Lavender',
    macroCluster: 'organic',
    bg: [244, 240, 250],
    silhouetteColor: [55, 40, 75],
    accent: [135, 110, 195], // soft purple
    colors: [
      [135, 110, 195],
      [180, 165, 220],
      [205, 180, 230],
      [120, 145, 200],
    ],
    font: {
      heading: '"Quicksand", "Nunito", Inter, system-ui, sans-serif',
      body: '"Nunito Sans", Inter, system-ui, sans-serif',
    },
    featured: true,
  },

  // ============================================================================
  // PROFESSIONAL / AUTHORITY — business-grade dark palettes (Sprint 19 Batch 1)
  // ============================================================================
  {
    id: 'consulting-charcoal',
    label: 'Consulting Charcoal',
    macroCluster: 'pitch',
    bg: [26, 26, 34], // near-black charcoal
    silhouetteColor: [220, 215, 200], // warm off-white text
    accent: [156, 142, 110], // muted warm olive/gray
    colors: [
      [156, 142, 110],
      [100, 95, 82],
      [200, 193, 174],
      [60, 60, 72],
      [220, 215, 200],
    ],
    font: {
      heading: '"Inter Display", Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
    },
    featured: true,
  },
  {
    id: 'financial-navy-cerulean',
    label: 'Financial Navy',
    macroCluster: 'pitch',
    bg: [26, 40, 66], // deep navy
    silhouetteColor: [240, 248, 255], // near-white text
    accent: [58, 138, 200], // bright cerulean
    colors: [
      [58, 138, 200],
      [26, 40, 66],
      [100, 150, 200],
      [180, 210, 235],
      [240, 248, 255],
    ],
    font: {
      heading: '"Inter Display", Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
    },
    featured: true,
  },
  {
    id: 'hr-slate-teal',
    label: 'HR Slate Teal',
    macroCluster: 'pitch',
    bg: [13, 26, 40], // dark slate navy
    silhouetteColor: [230, 242, 240], // near-white text
    accent: [42, 184, 168], // bright teal
    colors: [
      [42, 184, 168],
      [26, 100, 110],
      [80, 210, 195],
      [160, 220, 215],
      [220, 140, 90],
    ],
    font: {
      heading: '"Inter Display", Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
    },
    featured: true,
  },
];

/**
 * @returns {ThemePreset[]} all 9 curated themes
 */
export function getAtlasThemes() {
  return ATLAS_THEMES.slice();
}

/**
 * Get a theme by id. Returns null if not found.
 * @param {string} id
 * @returns {ThemePreset | null}
 */
export function getTheme(id) {
  return ATLAS_THEMES.find((t) => t.id === id) || null;
}

/**
 * @param {'editorial'|'pitch'|'organic'} macroCluster
 * @returns {ThemePreset[]} 3 color variants for the macro
 */
export function getThemesByMacro(macroCluster) {
  return ATLAS_THEMES.filter((t) => t.macroCluster === macroCluster);
}

/**
 * Macro cluster definitions — for UI grouping.
 */
export const THEME_MACROS = [
  {
    id: 'editorial',
    label: 'Editorial · Calm',
    description: 'Serif typography, soft photography, generous negative space, deep colors.',
  },
  {
    id: 'pitch',
    label: 'Pitch · Punchy',
    description: 'Display sans typography, high contrast, saturated accent colors.',
  },
  {
    id: 'organic',
    label: 'Organic · Nature',
    description: 'Rounded sans typography, soft gradients, nature-inspired palette.',
  },
];
