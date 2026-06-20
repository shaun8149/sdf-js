// =============================================================================
// branding-palettes.js — Atlas Present Sprint 2 curated palette presets
// -----------------------------------------------------------------------------
// 5 presets used by Swap Branding sub-panel. Each preset has:
//   - id: stable string id (stored in visual.activeBranding)
//   - label: UI display name
//   - bg: background color (silhouette renderer background option)
//   - silhouetteColor: [r,g,b] for silhouette renderer foreground
//
// Sprint 2 MVP keeps it simple: palettes affect silhouette/lines/crayon/topo
// renderer color choice. More elaborate per-element coloring is Sprint 3+.
// =============================================================================

/**
 * @typedef {object} BrandingPreset
 * @property {string} id
 * @property {string} label
 * @property {[number,number,number]} bg
 * @property {[number,number,number]} silhouetteColor
 */

export const BRANDING_PALETTES = [
  { id: 'mono-light', label: 'Mono Light', bg: [248, 248, 246], silhouetteColor: [40, 40, 40] },
  { id: 'mono-dark', label: 'Mono Dark', bg: [28, 28, 32], silhouetteColor: [220, 220, 220] },
  { id: 'warm-paper', label: 'Warm Paper', bg: [252, 244, 224], silhouetteColor: [80, 50, 30] },
  { id: 'cool-mint', label: 'Cool Mint', bg: [220, 240, 232], silhouetteColor: [40, 90, 80] },
  { id: 'high-contrast', label: 'High Contrast', bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
];

/**
 * Get a preset by id; fallback to first preset if id not found.
 *
 * @param {string} id
 * @returns {BrandingPreset}
 */
export function getPalette(id) {
  return BRANDING_PALETTES.find((p) => p.id === id) || BRANDING_PALETTES[0];
}
