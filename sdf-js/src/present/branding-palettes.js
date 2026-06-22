// =============================================================================
// branding-palettes.js — Atlas Present curated palette presets
// -----------------------------------------------------------------------------
// Sprint 2 MVP: 5 simple 2-color presets ({bg, silhouetteColor}).
// Sprint 9 extension: + ~23 multi-color palettes from kgolid's chromotome
// library (vintage children's book / saturated animal / Indian textile /
// mid-century modern). LLM-generated P5 sketches can use the richer multi-
// color field for per-element coloring (KPI cards each in different palette
// color, etc.); silhouette/lines/crayon/topo renderers still use just
// {bg, silhouetteColor} for backward compat.
//
// Per preset shape:
//   - id: stable string id (stored in visual.activeBranding)
//   - label: UI display name
//   - bg: [r,g,b] background color
//   - silhouetteColor: [r,g,b] foreground (silhouette/lines/crayon/topo)
//   - colors?: array of [r,g,b] tuples — multi-color palette (NEW Sprint 9,
//     present on chromotome:* palettes, undefined on the 5 built-ins)
//   - stroke?: [r,g,b] explicit stroke color (NEW Sprint 9, optional)
//   - source?: attribution string for non-built-in palettes (NEW Sprint 9)
//
// Backward compat: all existing renderers + iframe sketches that only read
// {bg, silhouetteColor} continue to work unchanged. New consumers can
// optionally read .colors[] for richer rendering.
// =============================================================================

import { CHROMOTOME_BRANDING_PALETTES } from './chromotome-palettes-data.js';
import { ATLAS_THEMES } from './themes.js';

/**
 * @typedef {object} BrandingPreset
 * @property {string} id
 * @property {string} label
 * @property {[number,number,number]} bg
 * @property {[number,number,number]} silhouetteColor
 * @property {Array<[number,number,number]>} [colors] — Sprint 9: multi-color palette
 * @property {[number,number,number]} [stroke] — Sprint 9: explicit stroke
 * @property {string} [source] — Sprint 9: attribution (e.g., 'chromotome:hilda')
 */

/**
 * Built-in 5 simple presets — Sprint 2. Backward compat (existing code paths,
 * existing localStorage activeBranding values like 'mono-light' resolve here).
 */
const BUILT_IN_PALETTES = [
  { id: 'mono-light', label: 'Mono Light', bg: [248, 248, 246], silhouetteColor: [40, 40, 40] },
  { id: 'mono-dark', label: 'Mono Dark', bg: [28, 28, 32], silhouetteColor: [220, 220, 220] },
  { id: 'warm-paper', label: 'Warm Paper', bg: [252, 244, 224], silhouetteColor: [80, 50, 30] },
  { id: 'cool-mint', label: 'Cool Mint', bg: [220, 240, 232], silhouetteColor: [40, 90, 80] },
  { id: 'high-contrast', label: 'High Contrast', bg: [255, 255, 255], silhouetteColor: [0, 0, 0] },
];

/**
 * Full palette library: 9 Atlas themes (Sprint 15B, featured) + 5 built-in simple
 * + ~23 chromotome multi-color (Sprint 9). Iteration order: Atlas themes first
 * (3 macros × 3 colors), then legacy built-in, then chromotome. Total: 37
 * palettes. Featured 9 are flagged `featured: true` for UI prioritization.
 */
export const BRANDING_PALETTES = [
  ...ATLAS_THEMES,
  ...BUILT_IN_PALETTES,
  ...CHROMOTOME_BRANDING_PALETTES,
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

/**
 * Sprint 9: Get the list of palette family groups for future UI sub-menu.
 * Currently visual-panel just cycles through all 28 sequentially via Swap
 * Branding button; future Sprint can add a family picker to skip ahead.
 *
 * @returns {Array<{family: string, count: number}>}
 */
export function getPaletteFamilies() {
  const families = new Map();
  for (const p of BRANDING_PALETTES) {
    const fam = p.source ? p.source.split(':')[0] + ':' + p.source.split(':')[1] : 'built-in';
    families.set(fam, (families.get(fam) || 0) + 1);
  }
  return [...families.entries()].map(([family, count]) => ({ family, count }));
}
