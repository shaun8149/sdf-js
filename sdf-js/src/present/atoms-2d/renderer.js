// =============================================================================
// atoms-2d/renderer.js — high-level "render SceneData into Canvas2D" wrapper
// -----------------------------------------------------------------------------
// Consumes a SceneData object whose `subjects[]` are 2D atoms (NOT p5-sketch)
// and renders to a target canvas. Bridges between SceneData spec emitted by
// LLM lift and the per-atom render functions in registry.js.
//
// Per [[atlas-2d-two-track-architecture-lock]]: this renderer runs in MAIN
// PAGE (no iframe), receives Atlas-authored atoms, fast Canvas2D path.
//
// API:
//   renderSceneDataToCanvas(canvas, sceneData, opts) — render all subjects
//   create2DAtomCanvas(width, height) — convenience factory for offscreen render
//
// Returns the dataUrl (PNG) when called with `opts.exportPng = true`.
// =============================================================================

import { renderAtom, isAtom2DType } from './registry.js';
import { drawDecor } from '../decor/registry.js';

const DEFAULT_PALETTE = {
  bg: [247, 244, 224],
  silhouetteColor: [30, 27, 30],
};

/**
 * Render a SceneData of 2D atoms onto a canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} sceneData — { subjects: [{ type, args, style?, x?, y?, w?, h? }, ...] }
 * @param {object} [opts]
 * @param {object} [opts.palette]   — overrides per-subject palette
 * @param {string} [opts.style]     — overrides per-subject style (deck-level lock)
 * @param {boolean} [opts.clear=true] — clear canvas before rendering
 *
 * @returns {Promise<{rendered: number, skipped: number, errors: Array}>}
 */
export async function renderSceneDataToCanvas(canvas, sceneData, opts = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('atoms-2d/renderer: canvas has no 2D context');

  const palette = opts.palette || DEFAULT_PALETTE;
  const deckStyle = opts.style;

  // Fill background
  if (opts.clear !== false) {
    ctx.fillStyle = rgbCss(palette.bg);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const subjects = Array.isArray(sceneData?.subjects) ? sceneData.subjects : [];

  // Decoration layer (Sprint 41): generative backdrop, theme-constrained +
  // seeded. Content slides get it UNDER the atoms ('subtle'); pure-cover
  // slides get it OVER the gradient ('bold' — the cover paints full-bleed
  // and would bury an underlay).
  const decor = opts.decor;
  const isPureCover = subjects.length > 0 && subjects.every((s) => s?.type === 'cover');
  if (decor && !isPureCover) {
    drawDecor(ctx, decor, {
      palette,
      x: 0,
      y: 0,
      w: canvas.width,
      h: canvas.height,
      intensity: decor.intensity || 'subtle',
    });
  }
  let rendered = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < subjects.length; i++) {
    const s = subjects[i];
    if (!s || typeof s.type !== 'string') {
      skipped++;
      continue;
    }
    if (!isAtom2DType(s.type)) {
      // Not a 2D atom — caller should route to p5-sketch path
      skipped++;
      continue;
    }
    const args = s.args || {};
    const style = deckStyle || s.style || 'pseudo3d';
    const subjectOpts = {
      x: s.x ?? 0,
      y: s.y ?? 0,
      w: s.w ?? canvas.width,
      h: s.h ?? canvas.height,
      palette,
    };
    try {
      ctx.save();
      await renderAtom(ctx, s.type, args, style, subjectOpts);
      ctx.restore();
      rendered++;
    } catch (e) {
      ctx.restore(); // ensure no leaked transform state
      errors.push({ index: i, type: s.type, error: e.message });
    }
  }

  // Pure-cover slides: decoration goes on top of the gradient.
  if (decor && isPureCover) {
    drawDecor(ctx, decor, {
      palette,
      x: 0,
      y: 0,
      w: canvas.width,
      h: canvas.height,
      intensity: decor.intensity || 'bold',
    });
  }

  return { rendered, skipped, errors };
}

/**
 * Convenience: create an offscreen canvas at the given size.
 * Useful for previews / PNG export.
 */
export function create2DAtomCanvas(width = 600, height = 360) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Convert [r,g,b] to CSS rgb() string. Helper exported for atom files.
 */
/**
 * fitFontPx — shrink a font size until `text` fits `maxW` at the given CSS
 * font template (Sprint 37 visual polish; shrink beats "…"-truncation per
 * the typography lock). `template` receives the candidate px and returns
 * the full ctx.font string. Floor 9px (registry clamps below that anyway).
 */
export function fitFontPx(ctx, text, maxW, startPx, template, minPx = 9) {
  let fs = startPx;
  ctx.save();
  for (; fs > minPx; fs--) {
    ctx.font = template(fs);
    if (ctx.measureText(String(text)).width <= maxW) break;
  }
  ctx.restore();
  return fs;
}

export function rgbCss(rgb) {
  if (!rgb) return 'rgb(0,0,0)';
  return `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`;
}

/**
 * Like rgbCss but with alpha. atom 0 < a <= 1.
 */
export function rgbaCss(rgb, a = 1) {
  if (!rgb) return `rgba(0,0,0,${a})`;
  return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
}
