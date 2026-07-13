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
import { applySplitLayout, applyStatementLayout } from './layout.js';

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
  let subjects = Array.isArray(aligned?.subjects) ? aligned.subjects : [];

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
  // Sprint 95 (版式语法): opts.layout 选择页面骨架 — 'banner' (默认,
  // 现状) / 'split' (左竖 rail 真迹 + 右正文列) / 'statement' (全幅真迹 +
  // 居中装裱卡)。两个新版式都需要 art 面 (decor 或 coverArt), 否则静默回
  // 落 banner — deck.json 几何不动, 重映射只在 paint 时发生。
  const hasArtSurface = !!(decor || coverArt);
  const splitCanvas = opts.layout === 'split' && hasArtSurface && !isPureCover;
  const statementCanvas = opts.layout === 'statement' && hasArtSurface && !isPureCover;
  // Sprint 80 (user: 目录页把图案做到标题栏, 不要放正文): agenda / section
  // pages run the cover-canvas pipeline INSIDE their title banner (the
  // banner is a 'cover' atom with its own bounds) — ink ground → artwork →
  // overlay type, clipped to the band. The BODY stays clean: no under-decor.
  const bannerCanvas =
    !splitCanvas &&
    !statementCanvas &&
    !!((decor || coverArt) && !isPureCover && (role === 'agenda' || role === 'section'));
  let statementKicker = '';
  let statementCard = null;
  if (splitCanvas) {
    subjects = applySplitLayout({ ...aligned, subjects }, canvas.width, canvas.height).subjects;
  } else if (statementCanvas) {
    const st = applyStatementLayout({ ...aligned, subjects }, canvas.width, canvas.height);
    subjects = st.sceneData.subjects;
    statementKicker = st.kicker;
    statementCard = st.card;
  }
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
  // Sprint 95: statement 全幅真迹之下 underlay 无意义, 恒跳过; split 与
  // banner 同律 — art 面已在 rail, 正文默认干净, decorUnder 显式请求才画。
  // Sprint 84: mounted pages can ask for the subtle body underlay TOO
  // (opts.decorUnder) — banner art + body elements in the mount's palette,
  // instead of clean-but-voiceless content pages.
  const wantUnder = statementCanvas
    ? false
    : bannerCanvas || splitCanvas
      ? opts.decorUnder === true
      : !coverArt && !bannerCanvas;
  if (decor && !isPureCover && wantUnder) {
    drawDecor(ctx, decor, {
      palette,
      x: 0,
      y: 0,
      w: canvas.width,
      h: canvas.height,
      intensity: decor.intensity || UNDER_INTENSITY[role] || 'subtle',
    });
  }
  // Sprint 90 (user: 目录页 Overview 小字与"核心主题"冲突 — 标题上提):
  // on agenda banner pages the body heading (agenda-list args.title) is
  // HOISTED into the banner as its title, the English slot label retires,
  // and agenda item sublabels (小字) are dropped — the numbered titles
  // carry the page. opts.bannerTitle overrides everything when provided.
  let bannerTitle = opts.bannerTitle || null;
  let bannerSubtitle = opts.bannerSubtitle || null;
  // Sprint 95: split 的 rail 标题与 banner 同享 hoist/查重/小字剥除文法
  if (bannerCanvas || splitCanvas) {
    subjects = subjects.slice(); // never mutate the caller's array
    const coverSub = subjects.find((c2) => c2 && c2.type === 'cover');
    const refTitle = String(opts.bannerTitle || coverSub?.args?.title || '').replace(/\s/g, '');
    for (let i = 0; i < subjects.length; i++) {
      const s2 = subjects[i];
      if (!s2 || !s2.args) continue;
      if (role === 'agenda' && s2.type === 'agenda-list') {
        if (!bannerTitle && s2.args.title) bannerTitle = s2.args.title;
        const items = Array.isArray(s2.args.items)
          ? s2.args.items.map((it) => ({ ...it, sublabel: undefined }))
          : s2.args.items;
        subjects[i] = { ...s2, args: { ...s2.args, title: undefined, items } };
      } else if (
        s2.type !== 'cover' &&
        typeof s2.args.title === 'string' &&
        refTitle &&
        s2.args.title.replace(/\s/g, '').startsWith(refTitle)
      ) {
        // Sprint 91 round-1: body atom repeating the banner title drops its own
        subjects[i] = { ...s2, args: { ...s2.args, title: undefined } };
      } else if (
        (s2.type === 'bullet-list' || s2.type === 'number-list') &&
        Array.isArray(s2.args.items)
      ) {
        // Sprint 91 (user: 小字统一删除) — headline-driven art pages drop
        // the grey caption layer under bullets
        subjects[i] = {
          ...s2,
          args: {
            ...s2.args,
            items: s2.args.items.map((it) =>
              it && typeof it === 'object' ? { ...it, sublabel: undefined } : it,
            ),
          },
        };
      }
    }
  }

  // Sprint 95 statement: 作品即页面 — 全幅真迹 + 居中装裱卡 (paper 底 +
  // 投影 + accent 短划 + kicker 小字 = 美术馆标牌), 正文 atom 已被
  // applyStatementLayout 收进卡内。
  if (statementCanvas) {
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
    const c = statementCard;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = rgbCss(palette.bg);
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.restore();
    if (statementKicker) {
      const ink = palette.silhouetteColor || [30, 27, 30];
      ctx.fillStyle = rgbCss(palette.accent || (palette.colors && palette.colors[0]) || ink);
      ctx.fillRect(c.x + c.w / 2 - 24, c.y + 30, 48, 3);
      ctx.fillStyle = rgbaCss(ink, 0.75);
      ctx.font = '700 16px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(statementKicker, c.x + c.w / 2, c.y + 44);
      ctx.textAlign = 'left';
    }
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
    const isBannerAtom = (bannerCanvas || splitCanvas) && s.type === 'cover';
    if (isBannerAtom) {
      // split: cover 主体即左 rail (applySplitLayout 已置 0,0,railW,H) —
      // 竖幅 cover-fit 裁绘, 大画布优先, 无变体时退 strip 首件 / decor 引擎
      // mini cover-canvas clipped to the banner band
      const bx = s.x ?? 0;
      const by = s.y ?? 0;
      const bw = s.w ?? canvas.width;
      const bh = s.h ?? canvas.height;
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();
      if (decorArt) {
        // Sprint 86 (user: 内页标题也用大画布) — EVERY banner shows the
        // LARGE piece as a full-bleed band crop; the sparse-smalls mode
        // remains only as a fallback when no large exists
        drawArtCover(decorArt, bx, by, bw, bh);
      } else if (decorArtStrip) {
        // 竖 rail 不适合横向胶片条 — 取首件小画布 cover-fit 竖裁
        if (splitCanvas) drawArtCover(decorArtStrip[0], bx, by, bw, bh);
        else drawArtStrip(bx, by, bw, bh);
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
        ? {
            ...s.args,
            style: 'overlay',
            ...(isBannerAtom && bannerTitle ? { title: bannerTitle } : {}),
            ...(isBannerAtom && bannerSubtitle ? { subtitle: bannerSubtitle } : {}),
          }
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
