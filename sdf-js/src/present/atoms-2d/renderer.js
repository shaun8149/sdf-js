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
import { alignSceneData } from '../align.js';

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

  // Sprint 83: layout hygiene — near-miss edges cluster + snap to an 8px
  // lattice at paint time (deck.json keeps raw lift geometry). opts.align
  // === false opts out (visual-audit replays raw coordinates).
  const aligned = opts.align === false ? sceneData : alignSceneData(sceneData);
  const subjects = Array.isArray(aligned?.subjects) ? aligned.subjects : [];

  // Decoration layer (Sprint 41): generative backdrop, theme-constrained +
  // seeded. Content slides get it UNDER the atoms ('subtle'); pure-cover
  // slides get it OVER the gradient ('bold' — the cover paints full-bleed
  // and would bury an underlay).
  const decor = opts.decor;
  const isPureCover = subjects.length > 0 && subjects.every((s) => s?.type === 'cover');
  // Sprint 73 (三级页面体系): the deck breathes in three registers —
  //   cover/agenda/section openers = generative ARTWORK pages (hero/bold),
  //   content pages = generative ELEMENTS (subtle underlay, unchanged).
  // Callers pass opts.decorRole ('cover'|'agenda'|'section'|'content');
  // pure covers resolve to 'cover' on their own.
  const role = opts.decorRole || (isPureCover ? 'cover' : 'content');
  const UNDER_INTENSITY = { agenda: 'bold', section: 'bold', content: 'subtle' };
  // Sprint 74 cover-canvas pipeline (user: 封面还是大部分蓝色, 美感不足):
  // ink ground → ArtBlocks-grade painting → the cover atom re-enters as an
  // 'overlay' (scrim + type only). The artwork gets the FULL palette on a
  // near-black canvas — the hues finally pop — and the title sits above it.
  // Sprint 80: opts.decorArt — an EXTERNAL artwork (CanvasImageSource, e.g.
  // an authentic generative piece rendered elsewhere) takes the decor
  // engine's place on art surfaces: cover-fit full-bleed on covers,
  // cover-fit crop inside title banners. The decor engine never runs when
  // decorArt is present.
  // Sprint 81: opts.decorArtStrip — an ARRAY of SMALL-canvas mints for the
  // title banner (user: 标题上的作品小画布更好 — a small canvas lets the
  // whole composition sit inside the band instead of a zoomed crop).
  // Sprint 83 (user: 小画布不要排满, 目录页标题上放 1-2 个就好): the strip
  // is SPARSE by default — an ink ground with 1-2 framed pieces on the
  // right, breathing room instead of a wall-to-wall filmstrip. Callers can
  // widen via opts.decorArtStripMax.
  const decorArt = opts.decorArt || null;
  const decorArtStrip =
    Array.isArray(opts.decorArtStrip) && opts.decorArtStrip.length ? opts.decorArtStrip : null;
  const coverArt = decorArt || (decorArtStrip && decorArtStrip[0]) || null;
  const coverCanvas = !!((decor || coverArt) && isPureCover);
  // Sprint 80 (user: 目录页把图案做到标题栏, 不要放正文): agenda / section
  // pages run the cover-canvas pipeline INSIDE their title banner (the
  // banner is a 'cover' atom with its own bounds) — ink ground → artwork →
  // overlay type, clipped to the band. The BODY stays clean: no under-decor.
  const bannerCanvas = !!(
    (decor || coverArt) &&
    !isPureCover &&
    (role === 'agenda' || role === 'section')
  );
  const drawArtCover = (img, dx, dy, dw, dh) => {
    const iw = img.width || img.videoWidth || 1;
    const ih = img.height || img.videoHeight || 1;
    const sc = Math.max(dw / iw, dh / ih);
    const sw = dw / sc;
    const sh = dh / sc;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, dx, dy, dw, dh);
  };
  // sparse gallery: ink ground + 1-2 whole small mints, right-aligned and
  // framed with breathing room — the label owns the left, art owns the right
  const drawArtStrip = (dx, dy, dw, dh) => {
    const ink = (palette.silhouetteColor || [30, 27, 30]).map((c) => Math.round(c * 0.3));
    ctx.fillStyle = `rgb(${ink[0]}, ${ink[1]}, ${ink[2]})`;
    ctx.fillRect(dx, dy, dw, dh);
    const pad = Math.max(8, dh * 0.12);
    const tileH = dh - pad * 2;
    const maxN = Math.max(1, opts.decorArtStripMax ?? 2);
    let right = dx + dw - pad * 1.5;
    for (let k = 0; k < Math.min(maxN, decorArtStrip.length); k++) {
      const img = decorArtStrip[k];
      const iw = img.width || 1;
      const ih = img.height || 1;
      const tileW = (tileH * iw) / ih;
      const left = right - tileW;
      if (left < dx + dw * 0.42) break; // the label zone stays clear
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = Math.max(6, dh * 0.08);
      ctx.shadowOffsetY = 2;
      ctx.drawImage(img, left, dy + pad, tileW, tileH);
      ctx.restore();
      right = left - pad * 1.5;
    }
  };
  if (coverCanvas) {
    if (coverArt) {
      drawArtCover(coverArt, 0, 0, canvas.width, canvas.height);
    } else {
      const ink = (palette.silhouetteColor || [30, 27, 30]).map((c) => Math.round(c * 0.3));
      ctx.fillStyle = `rgb(${ink[0]}, ${ink[1]}, ${ink[2]})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawDecor(ctx, decor, {
        palette,
        x: 0,
        y: 0,
        w: canvas.width,
        h: canvas.height,
        intensity: decor.intensity || 'artwork',
      });
    }
  }
  if (decor && !coverArt && !isPureCover && !bannerCanvas) {
    drawDecor(ctx, decor, {
      palette,
      x: 0,
      y: 0,
      w: canvas.width,
      h: canvas.height,
      intensity: decor.intensity || UNDER_INTENSITY[role] || 'subtle',
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
    const isBannerAtom = bannerCanvas && s.type === 'cover';
    if (isBannerAtom) {
      // mini cover-canvas clipped to the banner band
      const bx = s.x ?? 0;
      const by = s.y ?? 0;
      const bw = s.w ?? canvas.width;
      const bh = s.h ?? canvas.height;
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();
      if (decorArtStrip) {
        drawArtStrip(bx, by, bw, bh);
      } else if (decorArt) {
        drawArtCover(decorArt, bx, by, bw, bh);
      } else {
        const ink = (palette.silhouetteColor || [30, 27, 30]).map((c) => Math.round(c * 0.3));
        ctx.fillStyle = `rgb(${ink[0]}, ${ink[1]}, ${ink[2]})`;
        ctx.fillRect(bx, by, bw, bh);
        drawDecor(ctx, decor, {
          palette,
          x: bx,
          y: by,
          w: bw,
          h: bh,
          intensity: decor.intensity || 'artwork',
        });
      }
      ctx.restore();
    }
    const args =
      (coverCanvas && s.type === 'cover') || isBannerAtom
        ? { ...s.args, style: 'overlay' }
        : s.args || {};
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

  // (cover decoration now painted BEFORE the cover atom — see the
  // cover-canvas pipeline above; the atom re-enters as scrim + type)

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
