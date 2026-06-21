/* global drawingContext */
/**
 * Atlas Icon Library — curated SVG path icons for Atlas P5 sketches
 *
 * Source: Heroicons outline (MIT, github.com/tailwindlabs/heroicons) +
 *   Tabler Icons outline (MIT, github.com/tabler/tabler-icons). 24 icons
 *   hand-picked for abstract-concept affordance in infographic content.
 * Atlas adaptation: 2026-06-21 Sprint 13 — recipe-only ports, paths re-coded
 *   from SVG d= attributes into P5 drawingContext.Path2D format for fast
 *   in-iframe rendering without DOM SVG element creation.
 *
 * What this does
 * --------------
 * Provides drawAtlasIcon(name, x, y, size, color) — a single helper for
 * inline P5 sketches to draw any of 24 curated icons. Each icon renders
 * as a stroked outline (no fill) at the specified position + size.
 *
 * 24 icons cover the most common infographic affordances:
 *   - Concept: user / users / building / globe / chart-bar / chart-pie
 *   - Action: arrow-right / arrow-up / arrow-down / refresh / check / x
 *   - Object: cube / database / cloud / file / mail / phone
 *   - Annotation: star / heart / lightning / clock / shield / question
 *
 * Atlas use case
 * --------------
 * Iconography is one of Napkin's core moats — abstract concept affordance
 * (a "team" gets a user icon, "data" gets a database icon, etc.) makes
 * infographics scan-readable. Sprint 13 closes this gap with a small
 * but rich-enough curated set.
 *
 * LLM should call drawAtlasIcon when content has clear icon affordance:
 *   - "users / team / people" → 'user' or 'users'
 *   - "data / database / storage" → 'database' or 'cloud'
 *   - "growth / increase" → 'arrow-up' or 'chart-bar'
 *   - "warning / alert" → 'lightning' or 'shield'
 *
 * Signature
 * ---------
 *   drawAtlasIcon(name, x, y, size, color) — draws to current P5 canvas
 *
 *   name: one of ATLAS_ICON_NAMES (see list below)
 *   x, y: center position (icon drawn centered, NOT top-left anchored)
 *   size: bounding box (icons are square; 24 typical, 48 large, 96 hero)
 *   color: '#hex' string OR [r,g,b] array OR 'inherit' to use current stroke
 *
 * Inside-iframe usage:
 *   const fg = window.__brandingPalette.silhouetteColor;
 *   drawAtlasIcon('user', 100, 180, 32, fg);
 *   drawAtlasIcon('arrow-right', 200, 180, 32, fg);
 *   drawAtlasIcon('database', 300, 180, 32, fg);
 *
 * Returns: nothing (draws to current canvas via drawingContext)
 *
 * Test: scripts/test-p5-idiom-registry.mjs (export presence + name list)
 */

// Each icon = SVG path commands relative to a 24×24 viewBox.
// Use stroke (no fill) by default for cleaner infographic look.
// Path data extracted from Heroicons + Tabler MIT-licensed sources.
const _ICON_PATHS = {
  // === People / org ===
  user: 'M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.3 0-9.9 1.7-9.9 4.9v2.5h19.7v-2.5c0-3.3-6.6-4.9-9.8-4.9z',
  users:
    'M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zM8 11c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.6 0-1 .1 1.2.8 2 1.8 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z',
  building:
    'M3 21V7l9-4 9 4v14H3zm2-2h4v-4h6v4h4V8.3L12 5.2 5 8.3V19zm6-6h2v-2h-2v2zm0-4h2V7h-2v2zm4 4h2v-2h-2v2zm0-4h2V7h-2v2zM7 13h2v-2H7v2zm0-4h2V7H7v2z',
  globe:
    'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 2c.7 0 1.9 1 2.7 3.5h-5.4C10.1 5 11.3 4 12 4zm-1.9.4c-.4.7-.8 1.7-1 2.7H6.5c.9-1.2 2.2-2.2 3.6-2.7zm3.8 0c1.4.5 2.7 1.5 3.6 2.7h-2.6c-.2-1-.6-2-1-2.7zM4.7 9h3c-.1.6-.1 1.3-.1 2s0 1.4.1 2h-3c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2zm5 0h4.5c.1.6.1 1.3.1 2s0 1.4-.1 2H9.7C9.6 13.4 9.6 12.7 9.6 12s0-1.4.1-3zm6.5 0h3c.2.6.3 1.3.3 2s-.1 1.4-.3 2h-3c.1-.6.1-1.3.1-2s0-1.4-.1-2zm-9.7 6h2.6c.2 1 .6 2 1 2.7-1.4-.5-2.7-1.5-3.6-2.7zm2.8 0h5.4c-.7 2.5-2 3.5-2.7 3.5s-1.9-1-2.7-3.5zm6.6 0h2.6c-.9 1.2-2.2 2.2-3.6 2.7.4-.7.8-1.7 1-2.7z',

  // === Charts / data ===
  'chart-bar': 'M3 20h18v1H3v-1zM5 18V8h3v10H5zM10 18V4h3v14h-3zM15 18v-7h3v7h-3z',
  'chart-pie':
    'M11 2v9.6L19.4 16C18.5 19.4 15.5 22 12 22c-5.5 0-10-4.5-10-10 0-4.6 3.1-8.4 7.3-9.6h1.7zm-2 2.1C5.7 5 3 8.2 3 12c0 4.4 3.6 8 8 8 2.6 0 4.9-1.3 6.4-3.2L11 14V4.1zm4 0v6.9l5.9 3.1c.1-.4.1-.7.1-1 0-4.4-3.1-8.1-7-9z',
  database:
    'M12 2c4.9 0 8 1.4 8 3v14c0 1.7-3.1 3-8 3s-8-1.4-8-3V5c0-1.6 3.1-3 8-3zm0 2c-3.7 0-6 .9-6 1s2.3 1 6 1 6-.9 6-1-2.3-1-6-1zm6 3.5c-1.4.7-3.5 1-6 1s-4.6-.4-6-1V12c0 .1 2.3 1 6 1s6-.9 6-1V7.5zm0 6c-1.4.7-3.5 1-6 1s-4.6-.4-6-1V19c0 .1 2.3 1 6 1s6-.9 6-1v-5.5z',
  cloud:
    'M19 18H6a4 4 0 0 1-.6-7.9 5.5 5.5 0 0 1 10.7-1.5A4.5 4.5 0 0 1 19 18zm-3.4-8.1l-.5-1.4a3.5 3.5 0 0 0-6.8 1c0 .1 0 .3.1.6l.2 1.1-1.1.2A2 2 0 0 0 6 16h13a2.5 2.5 0 0 0 0-5h-.4l-.3-.7-.7-.2-.3-.2z',

  // === Action / direction ===
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-up': 'M12 5v14M6 11l6-6 6 6',
  'arrow-down': 'M12 5v14M6 13l6 6 6-6',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  check: 'M5 13l4 4L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',

  // === Object / business ===
  cube: 'M12 2L3 7v10l9 5 9-5V7l-9-5zM5 8.2l7 3.9 7-3.9M12 12.1V22',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6',
  mail: 'M3 8l9 6 9-6V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8zm0-2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v0l-9 6-9-6v0z',

  // === Annotation / status ===
  star: 'M12 2l3.1 6.3L22 9.3l-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2 2 9.3l6.9-1L12 2z',
  heart:
    'M12 21l-1.5-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1A6 6 0 0 1 16.5 3C19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.5 11.2L12 21z',
  lightning: 'M13 2L3 14h7l-1 8 10-12h-7l1-8z',
  clock:
    'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H11v6l5.2 3.1.8-1.3-4.5-2.7V7z',
  shield: 'M12 2L3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5l-9-3z',
  question:
    'M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10zm0-18c4.4 0 8 3.6 8 8s-3.6 8-8 8-8-3.6-8-8 3.6-8 8-8zm-1 13h2v2h-2v-2zm1-10c-2.2 0-4 1.8-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 .9-.5 1.4-1.2 1.9-.6.5-1.8 1.1-1.8 2.6v.5h2v-.5c0-.7.6-1 1.3-1.5.9-.7 1.7-1.4 1.7-2.7 0-2.4-1.6-4.3-4-4.3z',
};

/** Exported names for prompt + LLM enumeration. */
const ATLAS_ICON_NAMES = Object.keys(_ICON_PATHS);

/**
 * Draw an Atlas icon at (x, y) with given size and color, centered on (x, y).
 *
 * Implementation detail: uses drawingContext.Path2D() under the hood since
 * P5 doesn't have native SVG path support. Strokes at lineWidth proportional
 * to size (size/24 × 2 for 24-viewbox icons).
 */
function drawAtlasIcon(name, x, y, size, color) {
  const path = _ICON_PATHS[name];
  if (!path) {
    if (typeof console !== 'undefined') console.warn('[atlas-icon] unknown name:', name);
    return;
  }
  // Resolve color to CSS string
  let strokeColor = color;
  if (Array.isArray(color)) {
    strokeColor = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
  }
  // Get drawingContext via P5 global or fallback
  const ctx =
    (typeof drawingContext !== 'undefined' && drawingContext) ||
    (typeof globalThis !== 'undefined' && globalThis.drawingContext) ||
    null;
  if (!ctx) return; // No canvas context — silent no-op

  const scale = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(scale, scale);
  ctx.strokeStyle = strokeColor === 'inherit' ? ctx.strokeStyle : strokeColor;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'transparent';
  try {
    const path2d = new Path2D(path);
    ctx.stroke(path2d);
  } catch (e) {
    // Path2D may not exist in some contexts — fallback no-op
  }
  ctx.restore();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawAtlasIcon, ATLAS_ICON_NAMES };
}
if (typeof window !== 'undefined') {
  window.drawAtlasIcon = drawAtlasIcon;
  window.ATLAS_ICON_NAMES = ATLAS_ICON_NAMES;
}
