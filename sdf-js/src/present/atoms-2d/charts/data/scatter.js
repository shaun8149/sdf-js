// =============================================================================
// atoms-2d/charts/data/scatter.js — Scatter plot (XY data points)
// -----------------------------------------------------------------------------
// 2D twin of scatter-3d. L-shaped axes + cloud of data-driven dots in the
// plot area. Used for correlation / distribution / XY data viz.
//
// Args:
//   points — array of { x, y, label?, group?, color? } where x/y are 0..1
//            normalized within the plot area (REQUIRED)
//   xAxis  — optional axis label (bottom)
//   yAxis  — optional axis label (rotated, left)
//   title  — optional title (top-left)
//   colors — optional [r,g,b][] cycled by point.group key
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'scatter',
  category: 'charts/data',
  description: 'Scatter plot — L-axes + N data-driven dots with optional labels and groups.',
  args: {
    points: {
      type: 'array of { x, y, label?, group?, color? }',
      required: true,
      example: [
        { x: 0.2, y: 0.3, label: 'A' },
        { x: 0.5, y: 0.7, label: 'B' },
        { x: 0.8, y: 0.4, label: 'C' },
      ],
    },
    xAxis: { type: 'string?', example: 'Cost' },
    yAxis: { type: 'string?', example: 'Value' },
    title: { type: 'string?', example: 'Cost vs Value' },
    colors: {
      type: '[r,g,b][]?',
      example: [
        [60, 130, 200],
        [200, 80, 80],
      ],
    },
  },
};

const PAD = 14;
const AXIS_LABEL_GUTTER = 28;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 500;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const baseColors = args.colors || palette.colors || [[60, 130, 200]];

  const points = Array.isArray(args.points) ? args.points : [];
  const N = points.length;

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.07)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.13;
  }

  // Reserve space for axes labels
  const leftGutter = args.yAxis ? AXIS_LABEL_GUTTER : PAD;
  const bottomGutter = args.xAxis ? AXIS_LABEL_GUTTER : PAD;
  const plotL = x + leftGutter;
  const plotR = x + w - PAD;
  const plotT = plotTop;
  const plotB = y + h - bottomGutter;
  const plotW = plotR - plotL;
  const plotH = plotB - plotT;

  // L-axes
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.45);
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(plotL, plotT);
  ctx.lineTo(plotL, plotB);
  ctx.lineTo(plotR, plotB);
  ctx.stroke();
  ctx.restore();

  // Faint grid
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.06);
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const yi = plotT + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(plotL, yi);
    ctx.lineTo(plotR, yi);
    ctx.stroke();
  }
  ctx.restore();

  // Plot points
  const dotR = Math.min(8, Math.max(4, plotW * 0.018));
  // Map group string → color
  const groupColor = new Map();
  let nextGroupIdx = 0;
  function colorFor(point) {
    if (point.color) return point.color;
    const g = point.group;
    if (g == null) return baseColors[0];
    if (!groupColor.has(g)) groupColor.set(g, baseColors[nextGroupIdx++ % baseColors.length]);
    return groupColor.get(g);
  }

  for (let i = 0; i < N; i++) {
    const p = points[i];
    const px = plotL + clamp(Number(p.x) || 0, 0, 1) * plotW;
    const py = plotB - clamp(Number(p.y) || 0, 0, 1) * plotH;
    const color = colorFor(p);

    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.2);
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    const grad = ctx.createRadialGradient(px - dotR * 0.3, py - dotR * 0.3, 0, px, py, dotR);
    grad.addColorStop(0, rgbCss(lighten(color, 0.3)));
    grad.addColorStop(1, rgbCss(color));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (p.label) {
      ctx.fillStyle = rgbaCss(fg, 0.8);
      ctx.font = `500 ${Math.round(h * 0.034)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.label), px + dotR + 4, py);
    }
  }

  // Axis labels
  if (args.xAxis) {
    ctx.fillStyle = rgbaCss(fg, 0.75);
    ctx.font = `600 ${Math.round(h * 0.042)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(args.xAxis, plotL + plotW / 2, plotB + 8);
  }
  if (args.yAxis) {
    ctx.save();
    ctx.translate(x + 12, plotT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = rgbaCss(fg, 0.75);
    ctx.font = `600 ${Math.round(h * 0.042)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(args.yAxis, 0, 0);
    ctx.restore();
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
