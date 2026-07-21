// =============================================================================
// atoms-2d/charts/data/isotype-stat-comparison.js — Isotype stat comparison
// -----------------------------------------------------------------------------
// N rows of role/category counts — large hero number + role icon + row of
// mini repeated icons (up to 30 cap) + label + optional caption.
// Converts a simple table into a shareable infographic.
//
// Args:
//   stats — array of 2-5:
//     { iconName?: string, count: number, label: string, caption?: string }
//   title — optional chart title
//
// Per [[atlas-pl-observation-pool-v3]] Batch 3 Finding B — Sprint 15b B3.
// Uses Phosphor icons from src/icons/index.js (viewBox=256, fill paint).
// =============================================================================

import { rgbCss, rgbaCss, fitFontPx } from '../../renderer.js';
import { getIconPath2D } from '../../../../icons/index.js';

export const spec = {
  type: 'isotype-stat-comparison',
  category: 'charts/data',
  description: 'N rows of role/category counts — large number + literal N icons + label.',
  args: {
    stats: {
      type: 'array of 2-5 { iconName?: string, count: number, label: string, caption?: string }',
      required: true,
      example: [
        { iconName: 'stethoscope', count: 100, label: 'Doctors', caption: 'Full-time' },
        { iconName: 'first-aid', count: 25, label: 'Nurses' },
        { iconName: 'briefcase', count: 12, label: 'Admin' },
      ],
    },
    title: { type: 'string?', example: 'Hospital Staff Composition' },
  },
};

export const SAMPLES = [
  {
    args: {
      title: 'Hospital Staff Composition',
      stats: [
        { iconName: 'stethoscope', count: 100, label: 'Doctors', caption: 'Full-time' },
        { iconName: 'first-aid', count: 25, label: 'Nurses' },
        { iconName: 'briefcase', count: 12, label: 'Admin' },
      ],
    },
  },
  {
    args: {
      title: 'Engineering Team',
      stats: [
        { iconName: 'code', count: 45, label: 'Engineers', caption: 'Backend + Frontend' },
        { iconName: 'palette', count: 8, label: 'Designers' },
        { iconName: 'chart-bar', count: 5, label: 'PMs' },
        { iconName: 'users', count: 3, label: 'QA' },
      ],
    },
  },
];

const PAD = 20;
// Capped lower than the old 30 — at high counts (e.g. 100) the mini icons
// squished down to unrecognizable slivers within the fixed miniIconAreaW.
// Above the cap we show a "×N" ratio note instead of drawing more icons.
const ICON_MINI_MAX = 20;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 560;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg ? rgbCss(palette.bg) : '#fafaf8';
  const accent = palette.colors?.[0] || [60, 130, 200];

  const stats = Array.isArray(args.stats) ? args.stats.slice(0, 5) : [];
  const title = args.title;

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  if (stats.length === 0) return;

  // Title
  let contentY = y + PAD;
  if (title) {
    ctx.save();
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.065)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, contentY);
    contentY += Math.round(h * 0.1);
    ctx.restore();
  }

  const contentH = y + h - PAD - contentY;
  const rowH = contentH / stats.length;
  // Min/max row height guards
  const effectiveRowH = Math.max(40, Math.min(120, rowH));

  // Layout: [count col] [single icon] [mini icons row] [gap] [label col]
  const countColW = Math.round(w * 0.18);
  const singleIconW = Math.round(w * 0.1);
  const labelColW = Math.round(w * 0.22);
  const labelGap = 14; // breathing room so mini icons never touch the label text
  const miniIconAreaW = w - PAD * 2 - countColW - singleIconW - labelColW - labelGap;
  const miniIconStartX = x + PAD + countColW + singleIconW;

  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i];
    const count = Math.max(0, Math.round(stat.count ?? 0));
    const label = stat.label ?? '';
    const caption = stat.caption;
    const iconName = stat.iconName;

    const rowY = contentY + i * rowH + (rowH - effectiveRowH) / 2;
    const rowMidY = rowY + effectiveRowH / 2;

    // --- Subtle row divider ---
    if (i > 0) {
      ctx.save();
      ctx.strokeStyle = rgbaCss(fg, 0.08);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + PAD, rowY - (rowH - effectiveRowH) / 2);
      ctx.lineTo(x + w - PAD, rowY - (rowH - effectiveRowH) / 2);
      ctx.stroke();
      ctx.restore();
    }

    // --- Hero count number (Inter 900, accent color) ---
    const heroFontSize = Math.round(effectiveRowH * 0.52);
    ctx.save();
    ctx.fillStyle = rgbCss(accent);
    ctx.font = `900 ${heroFontSize}px "Inter Display", Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(count), x + PAD + countColW - 8, rowMidY);
    ctx.restore();

    // --- Single role icon (Phosphor, viewBox=256, fill) ---
    const iconSize = Math.round(effectiveRowH * 0.48);
    const iconX = x + PAD + countColW + 4;
    const iconY = rowMidY - iconSize / 2;

    drawPhosphorIcon(ctx, iconName, iconX, iconY, iconSize, accent);

    // --- Mini icon row ---
    // Cap at ICON_MINI_MAX so icons never squish into unrecognizable
    // slivers at high counts; when capped, show a "×N" ratio note (each
    // icon represents N units) instead of an ambiguous ellipsis.
    const displayCount = Math.min(count, ICON_MINI_MAX);
    const isCapped = count > ICON_MINI_MAX;
    const ratioText = isCapped ? `×${Math.max(2, Math.round(count / ICON_MINI_MAX))}` : '';
    const ratioFontSize = Math.round(effectiveRowH * 0.22);

    if (displayCount > 0) {
      ctx.save();
      ctx.font = `700 ${ratioFontSize}px Inter, system-ui, sans-serif`;
      const ratioW = ratioText ? ctx.measureText(ratioText).width + 8 : 0;
      ctx.restore();

      const usableW = miniIconAreaW - ratioW;
      const miniSize = Math.min(
        Math.round(effectiveRowH * 0.32),
        Math.round(usableW / displayCount),
      );
      const miniSize2 = Math.max(8, Math.min(miniSize, 24));
      const miniGap = Math.min(miniSize2 * 1.2, usableW / displayCount);

      for (let j = 0; j < displayCount; j++) {
        const mx = miniIconStartX + j * miniGap;
        const my = rowMidY - miniSize2 / 2;
        drawPhosphorIcon(ctx, iconName, mx, my, miniSize2, accent, 0.7);
      }

      if (ratioText) {
        ctx.save();
        ctx.fillStyle = rgbaCss(fg, 0.55);
        ctx.font = `700 ${ratioFontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(ratioText, miniIconStartX + displayCount * miniGap + 4, rowMidY);
        ctx.restore();
      }
    }

    // --- Label + caption ---
    // Shrink-to-fit within the label column (Sprint 37: long labels ran
    // past the right edge — the column width was never enforced).
    const labelX = x + w - PAD - labelColW;
    const labelMaxW = labelColW;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = caption ? 'bottom' : 'middle';
    ctx.fillStyle = rgbCss(fg);
    const labelFs = fitFontPx(
      ctx,
      label,
      labelMaxW,
      Math.round(effectiveRowH * 0.32),
      (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
    );
    ctx.font = `700 ${labelFs}px Inter, system-ui, sans-serif`;
    ctx.fillText(label, labelX, caption ? rowMidY - 1 : rowMidY);

    if (caption) {
      ctx.fillStyle = rgbaCss(fg, 0.6);
      const capFs = fitFontPx(
        ctx,
        caption,
        labelMaxW,
        Math.round(effectiveRowH * 0.24),
        (fs) => `600 ${fs}px Inter, system-ui, sans-serif`,
      );
      ctx.font = `600 ${capFs}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(caption, labelX, rowMidY + 2);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Phosphor icon renderer (viewBox=256, fill mode)
// ---------------------------------------------------------------------------

function drawPhosphorIcon(ctx, iconName, x, y, size, color, alpha = 1) {
  if (!iconName) return;

  // getIconPath2D may return null in Node test env (no Path2D global)
  // or when icon name is not in baked library. Both cases: silent skip.
  let path2d = null;
  try {
    path2d = getIconPath2D(iconName);
  } catch (_) {
    // silent
  }

  if (!path2d) return;

  const scale = size / 256;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = rgbCss(color);
  try {
    ctx.fill(path2d);
  } catch (_) {
    // Some stub ctx don't support fill(path). Silent fallback: draw a small
    // filled circle as placeholder so tests don't crash.
    ctx.restore();
    ctx.save();
    ctx.fillStyle = rgbCss(color);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
