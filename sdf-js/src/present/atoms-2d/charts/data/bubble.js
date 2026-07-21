// =============================================================================
// atoms-2d/charts/data/bubble.js — Bubble chart (XY + size dimension)
// -----------------------------------------------------------------------------
// Extension of scatter: each data point has an (x, y) position AND a size
// dimension rendered as a circle with pseudo-3D gradient + drop shadow.
// Useful for three-variable data viz: e.g. product portfolio (cost × revenue ×
// market share), risk maps (probability × impact × exposure), etc.
//
// Args:
//   points    — array of { x, y, size, label?, color? } where x/y are
//               0..1 normalized within the plot area; size is 0..1 (REQUIRED)
//   xAxis     — optional axis label (bottom)
//   yAxis     — optional axis label (rotated, left)
//   title     — optional title (top-left)
//   sizeScale — optional max-radius in pixels (default 30). Each bubble radius =
//               point.size * sizeScale.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'bubble',
  category: 'charts/data',
  description: 'Bubble chart — N data points plotted on (x, y) axes with size dimension.',
  args: {
    points: {
      type: 'array of { x, y, size, label?, color? }',
      required: true,
      example: [
        { x: 0.2, y: 0.3, size: 0.4, label: 'Product A' },
        { x: 0.5, y: 0.7, size: 0.8, label: 'Product B' },
        { x: 0.8, y: 0.4, size: 0.2, label: 'Product C' },
      ],
    },
    xAxis: { type: 'string?', example: 'Cost' },
    yAxis: { type: 'string?', example: 'Revenue' },
    title: { type: 'string?', example: 'Product Portfolio' },
    sizeScale: { type: 'number?', default: 30, example: 30 },
  },
};

const PAD = 14;
const AXIS_LABEL_GUTTER = 28;
// Slightly larger min bubble radius so small-size points don't shrink to
// near-invisible dots (a sparse-looking chart with barely-there bubbles).
const MIN_RADIUS = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 500;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const baseColors = palette.colors || [[60, 130, 200]];

  const points = Array.isArray(args.points) ? args.points : [];
  const N = points.length;
  const sizeScale = Number(args.sizeScale) > 0 ? Number(args.sizeScale) : 30;

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

  // Draw bubbles — largest first so smaller ones render on top
  const sorted = points
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (Number(b.p.size) || 0) - (Number(a.p.size) || 0));

  for (const { p, i } of sorted) {
    const px = plotL + clamp(Number(p.x) || 0, 0, 1) * plotW;
    const py = plotB - clamp(Number(p.y) || 0, 0, 1) * plotH;
    const sizeNorm = clamp(Number(p.size) || 0, 0, 1);
    if (sizeNorm <= 0) continue;
    const radius = Math.max(MIN_RADIUS, sizeNorm * sizeScale);

    const color = p.color ? p.color : baseColors[i % baseColors.length];

    // Drop shadow
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.22);
    ctx.shadowBlur = radius * 0.6;
    ctx.shadowOffsetY = radius * 0.25;

    // Semi-transparent fill with a solid stroke — labels now always render
    // OUTSIDE the bubble (dark-on-light background), so the fill no longer
    // needs to be dark/opaque enough to host white text; a lighter,
    // see-through fill + a crisp solid outline reads better against any bg.
    const glowX = px - radius * 0.32;
    const glowY = py - radius * 0.32;
    const grad = ctx.createRadialGradient(glowX, glowY, 0, px, py, radius);
    grad.addColorStop(0, rgbaCss(lighten(color, 0.45), 0.55));
    grad.addColorStop(0.5, rgbaCss(color, 0.42));
    grad.addColorStop(1, rgbaCss(darken(color, 0.1), 0.38));
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Solid stroke outline
    ctx.save();
    ctx.strokeStyle = rgbCss(color);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Subtle specular highlight — small white circle at top-left
    ctx.save();
    ctx.globalAlpha = 0.35;
    const specR = radius * 0.22;
    const specX = px - radius * 0.3;
    const specY = py - radius * 0.3;
    const specGrad = ctx.createRadialGradient(specX, specY, 0, specX, specY, specR);
    specGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.arc(specX, specY, specR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Label rendering — ALWAYS outside the bubble (dark text, right offset).
    // Previously large bubbles centered a white label INSIDE the fill, but
    // the fill is a mid-tone accent color, not dark, so white-on-accent
    // often read as illegible "dark on dark" (esp. with darker palettes).
    if (p.label) {
      const label = String(p.label);
      const fontSize = Math.round(Math.max(11, Math.min(radius * 0.4, h * 0.036)));
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;

      const offsetX = radius + 6;
      const labelX = px + offsetX;
      const labelY = py;

      // Leader line
      ctx.save();
      ctx.strokeStyle = rgbaCss(fg, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + radius, py);
      ctx.lineTo(px + radius + 4, py);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = rgbaCss(fg, 0.85);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, labelX, labelY);
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

// ---- Helpers ----------------------------------------------------------------

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

function darken(rgb, amt) {
  return [
    Math.max(0, rgb[0] * (1 - amt)),
    Math.max(0, rgb[1] * (1 - amt)),
    Math.max(0, rgb[2] * (1 - amt)),
  ];
}
