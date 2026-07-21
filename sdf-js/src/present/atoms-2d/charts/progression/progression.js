// =============================================================================
// atoms-2d/charts/progression/progression.js — Multi-step progression indicator
// -----------------------------------------------------------------------------
// 2D pseudo-3D equivalent of progression-3d. Horizontal chevron-style step
// indicator showing progress through N stages (completed / current / upcoming).
//
// Args:
//   steps   — array of { label, status?: 'done'|'current'|'todo' }
//   title   — optional title
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { resolveIcon } from '../../../../icons/index.js';

export const spec = {
  type: 'progression',
  category: 'charts/progression',
  description: 'N-step chevron progression indicator (done / current / todo states).',
  args: {
    steps: {
      type: "array of { label, status?: 'done'|'current'|'todo' }",
      required: true,
      example: [
        { label: 'Discovery', status: 'done' },
        { label: 'Design', status: 'done' },
        { label: 'Build', status: 'current' },
        { label: 'Test', status: 'todo' },
        { label: 'Launch', status: 'todo' },
      ],
    },
    title: { type: 'string?', example: 'Project Status' },
  },
};

const PAD = 14;
const CHEVRON_DEPTH = 14;
const COLOR_DONE = [60, 170, 110];
const COLOR_CURRENT = [60, 130, 200];
const COLOR_TODO = [195, 195, 200];

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 640;
  const h = opts.h ?? 160;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];

  const steps = Array.isArray(args.steps) ? args.steps : [];
  const n = steps.length;
  if (n === 0) return;

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.min(32, Math.round(h * 0.085))}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.22;
  }

  const plotW = w - PAD * 2;
  const plotH = y + h - plotTop - PAD;
  const cy = plotTop + plotH / 2;
  const chevH = Math.min(60, plotH * 0.7);
  const chevW = (plotW - CHEVRON_DEPTH * (n - 1)) / n;

  for (let i = 0; i < n; i++) {
    const step = steps[i];
    const status = step.status || (i === 0 ? 'done' : 'todo');
    const color =
      status === 'done' ? COLOR_DONE : status === 'current' ? COLOR_CURRENT : COLOR_TODO;
    const isFirst = i === 0;
    const isLast = i === n - 1;
    const cx0 = x + PAD + i * (chevW + CHEVRON_DEPTH * 0.3);
    drawChevron(ctx, cx0, cy - chevH / 2, chevW, chevH, isFirst, isLast, color);

    // Icon OR label inside chevron (Sprint 18: icon replaces text label when step.icon is set)
    const chevCx = cx0 + chevW / 2;
    if (step.icon) {
      const resolved = resolveIcon(step.icon);
      const viewBox = resolved.source === 'brand' ? 24 : 256;
      const iconSize = Math.min(chevH * 0.55, 40);
      const iconColor = status === 'todo' ? [120, 120, 125] : [255, 255, 255];
      ctx.save();
      try {
        ctx.translate(chevCx - iconSize / 2, cy - iconSize / 2);
        ctx.scale(iconSize / viewBox, iconSize / viewBox);
        ctx.fillStyle = rgbCss(iconColor);
        if (resolved.path) ctx.fill(resolved.path);
      } catch (_) {
        /* Path2D unavailable (Node) */
      }
      ctx.restore();
    } else {
      // Label inside (centered) — original behaviour
      ctx.fillStyle = status === 'todo' ? rgbaCss([60, 60, 60], 0.7) : 'rgba(255,255,255,0.97)';
      ctx.font = `700 ${Math.min(15, chevH * 0.3)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(step.label || `Step ${i + 1}`, chevCx, cy + 1);
    }
  }
}

function drawChevron(ctx, x, y, w, h, isFirst, isLast, color) {
  // Build chevron path: rectangle with right point + left notch (unless first/last)
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.2);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, rgbCss(lighten(color, 0.18)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;

  ctx.beginPath();
  // Top-left
  if (isFirst) {
    ctx.moveTo(x, y);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + CHEVRON_DEPTH, y + h / 2); // notch in
    ctx.lineTo(x, y + h);
  }
  // We'll go around differently. Let me redo.
  ctx.closePath();
  ctx.beginPath();

  if (isFirst) {
    ctx.moveTo(x, y); // top-left corner
  } else {
    ctx.moveTo(x, y); // top-left starting point
  }

  // Top edge
  ctx.lineTo(x + w, y);

  // Right edge: point (chevron tip) unless last
  if (isLast) {
    ctx.lineTo(x + w, y + h);
  } else {
    ctx.lineTo(x + w + CHEVRON_DEPTH, y + h / 2);
    ctx.lineTo(x + w, y + h);
  }

  // Bottom edge
  ctx.lineTo(x, y + h);

  // Left edge: notch (chevron cut) unless first
  if (isFirst) {
    ctx.lineTo(x, y);
  } else {
    ctx.lineTo(x + CHEVRON_DEPTH, y + h / 2);
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Top iso accent
  ctx.save();
  ctx.fillStyle = rgbaCss(lighten(color, 0.4), 0.4);
  ctx.beginPath();
  ctx.moveTo(x + (isFirst ? 0 : CHEVRON_DEPTH), y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + 2);
  ctx.lineTo(x + (isFirst ? 0 : CHEVRON_DEPTH + 2), y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
