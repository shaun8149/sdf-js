// =============================================================================
// atoms-2d/charts/data/histogram.js — Frequency distribution histogram
// -----------------------------------------------------------------------------
// Frequency distribution chart: N adjacent bins (no gap), optional Gaussian
// bell-curve overlay, optional milestone vertical markers.
//
// Key visual distinction from bar.js / column.js:
//   - Vertical bars that TOUCH — no gap between adjacent bins
//   - X-axis shows bin boundaries (range values); Y-axis shows count
//   - Bell-curve overlay: Gaussian fitted from weighted bin midpoints
//   - Milestones: dashed vertical lines + top labels for { value, label }
//
// Args:
//   bins        — array of { range: [low, high], count: number } (REQUIRED)
//   title       — optional chart title (top-left)
//   bellCurve   — boolean (default false). Overlay fitted Gaussian curve.
//   milestones  — array of { value, label }? — vertical dashed reference lines
//
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'histogram',
  category: 'charts/data',
  description: 'Frequency distribution — N bins, no gap between bars, optional bell-curve overlay.',
  args: {
    bins: {
      type: 'array of { range: [low, high], count: number }',
      required: true,
      example: [
        { range: [0, 10], count: 5 },
        { range: [10, 20], count: 12 },
        { range: [20, 30], count: 18 },
        { range: [30, 40], count: 14 },
        { range: [40, 50], count: 7 },
      ],
    },
    title: { type: 'string?', example: 'Survey Response Distribution' },
    bellCurve: { type: 'boolean?', default: false },
    milestones: {
      type: 'array of { value, label }?',
      example: [{ value: 25, label: 'Median' }],
    },
  },
};

const PAD_TOP = 12;
const PAD_BOTTOM = 38; // x-axis labels
const PAD_LEFT = 46; // y-axis labels
const PAD_RIGHT = 14;
const TITLE_FRAC = 0.13;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 540;
  const h = opts.h ?? 320;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const barColor = palette.colors?.[0] || [60, 100, 200];
  const accentColor = palette.accentColor || [210, 80, 60];

  const bins = Array.isArray(args.bins) ? args.bins : [];
  const n = bins.length;
  if (n === 0) return;

  // ---- Title ----
  let chartTop = y + PAD_TOP;
  if (args.title) {
    const titleSize = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.title), x, y);
    chartTop = y + h * TITLE_FRAC;
  }

  // ---- Plot area ----
  const plotL = x + PAD_LEFT;
  const plotR = x + w - PAD_RIGHT;
  const plotT = chartTop;
  const plotB = y + h - PAD_BOTTOM;
  const plotW = plotR - plotL;
  const plotH = plotB - plotT;

  // ---- Data stats ----
  const maxCount = Math.max(...bins.map((b) => Number(b.count) || 0), 1);
  const xMin = Number(bins[0].range[0]);
  const xMax = Number(bins[n - 1].range[1]);
  const xSpan = xMax - xMin || 1;
  const binW = plotW / n; // pixel width per bin (uniform bins assumed)

  // ---- Y-axis ticks + gridlines ----
  const yStep = niceStep(maxCount, 4);
  const yMax = Math.ceil(maxCount / yStep) * yStep;
  const labelSize = Math.max(10, Math.round(h * 0.038));

  ctx.font = `500 ${labelSize}px IBM Plex Mono, monospace`;
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.06);
  ctx.lineWidth = 1;
  for (let t = 0; t <= yMax; t += yStep) {
    const ty = plotB - (t / yMax) * plotH;
    // Grid line
    ctx.beginPath();
    ctx.moveTo(plotL, ty);
    ctx.lineTo(plotR, ty);
    ctx.stroke();
    // Y label
    ctx.fillStyle = rgbaCss(fg, 0.55);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(t), plotL - 5, ty);
  }
  ctx.restore();

  // ---- Axes (L-shape) ----
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.5);
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(plotL, plotT);
  ctx.lineTo(plotL, plotB);
  ctx.lineTo(plotR, plotB);
  ctx.stroke();
  ctx.restore();

  // ---- Bars (no gap — histogram style) ----
  for (let i = 0; i < n; i++) {
    const bin = bins[i];
    const count = Number(bin.count) || 0;
    const bx = plotL + i * binW;
    const bh = yMax > 0 ? (count / yMax) * plotH : 0;
    const by = plotB - bh;
    if (bh > 0) {
      drawHistBar(ctx, bx, by, binW, bh, barColor, i === n - 1);
    }
  }

  // ---- X-axis bin boundary labels ----
  ctx.font = `500 ${labelSize}px IBM Plex Mono, monospace`;
  ctx.fillStyle = rgbaCss(fg, 0.6);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // Show label at each bin boundary; skip if too many (show every other)
  const labelStep = n > 6 ? 2 : 1;
  for (let i = 0; i <= n; i += labelStep) {
    const val = i < n ? Number(bins[i].range[0]) : Number(bins[n - 1].range[1]);
    const lx = plotL + i * binW;
    ctx.fillText(String(val), lx, plotB + 5);
  }

  // ---- Bell curve overlay ----
  if (args.bellCurve) {
    const { mean, sigma } = gaussianParams(bins);
    if (sigma > 0) {
      drawBellCurve(
        ctx,
        bins,
        mean,
        sigma,
        yMax,
        plotL,
        plotT,
        plotW,
        plotH,
        xMin,
        xSpan,
        accentColor,
      );
    }
  }

  // ---- Milestone markers ----
  if (Array.isArray(args.milestones) && args.milestones.length > 0) {
    drawMilestones(ctx, args.milestones, xMin, xSpan, plotL, plotT, plotB, plotW, plotH, fg);
  }
}

// ============================================================================
// Private helpers
// ============================================================================

/**
 * Draw a single histogram bar — pseudo-3D gradient + shadow + iso-edge.
 * Bars touch: no horizontal corner rounding. isLast avoids right-edge artifact.
 */
function drawHistBar(ctx, bx, by, bw, bh, color, isLast) {
  if (bw <= 0 || bh <= 0) return;
  const ISO = 2;

  // Drop shadow
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.14);
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;

  // Gradient: lighter at top
  const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
  grad.addColorStop(0, rgbaCss(lighten(color, 0.22), 1));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, bw, bh);
  ctx.restore();

  // Iso top edge
  ctx.save();
  ctx.fillStyle = rgbaCss(lighten(color, 0.36), 0.7);
  ctx.fillRect(bx, by, bw, ISO);
  ctx.restore();

  // Right-side 1px dark divider between adjacent bars (skip on last bar)
  if (!isLast) {
    ctx.save();
    ctx.fillStyle = rgbaCss([0, 0, 0], 0.1);
    ctx.fillRect(bx + bw - 1, by, 1, bh);
    ctx.restore();
  }
}

/**
 * Compute Gaussian mean and sigma from weighted bin midpoints.
 */
function gaussianParams(bins) {
  let totalCount = 0;
  let weightedSum = 0;
  for (const b of bins) {
    const mid = (Number(b.range[0]) + Number(b.range[1])) / 2;
    const c = Number(b.count) || 0;
    totalCount += c;
    weightedSum += mid * c;
  }
  if (totalCount === 0) return { mean: 0, sigma: 0 };
  const mean = weightedSum / totalCount;
  let variance = 0;
  for (const b of bins) {
    const mid = (Number(b.range[0]) + Number(b.range[1])) / 2;
    const c = Number(b.count) || 0;
    variance += c * (mid - mean) ** 2;
  }
  variance /= totalCount;
  return { mean, sigma: Math.sqrt(variance) };
}

/**
 * Draw a smooth Gaussian bell curve scaled to match histogram bar heights.
 * gaussPeak (count units) = totalCount * binWidth / (sigma * sqrt(2π))
 */
function drawBellCurve(
  ctx,
  bins,
  mean,
  sigma,
  yMax,
  plotL,
  plotT,
  plotW,
  plotH,
  xMin,
  xSpan,
  accentColor,
) {
  const SAMPLES = 80;

  let totalCount = 0;
  let binWidth = 0;
  for (const b of bins) {
    totalCount += Number(b.count) || 0;
    const bw = Number(b.range[1]) - Number(b.range[0]);
    if (bw > 0) binWidth = bw;
  }
  const gaussPeak = (totalCount * binWidth) / (sigma * Math.sqrt(2 * Math.PI));

  ctx.save();
  ctx.strokeStyle = rgbaCss(accentColor, 0.9);
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const xVal = xMin + t * xSpan;
    const gauss = gaussPeak * Math.exp(-0.5 * ((xVal - mean) / sigma) ** 2);
    const px = plotL + t * plotW;
    const py = plotT + plotH - (gauss / yMax) * plotH;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw milestone dashed lines (value in data space) with top label.
 */
function drawMilestones(ctx, milestones, xMin, xSpan, plotL, plotT, plotB, plotW, plotH, fg) {
  const labelSize = Math.max(10, Math.round(plotH * 0.07));
  const milestoneColor = [60, 140, 200];

  for (const ms of milestones) {
    const val = Number(ms.value);
    if (!Number.isFinite(val)) continue;
    const t = (val - xMin) / xSpan;
    if (t < 0 || t > 1) continue;
    const mx = plotL + t * plotW;

    ctx.save();
    ctx.strokeStyle = rgbaCss(milestoneColor, 0.8);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(mx, plotT);
    ctx.lineTo(mx, plotB);
    ctx.stroke();
    ctx.restore();

    if (ms.label) {
      ctx.save();
      ctx.fillStyle = rgbaCss(milestoneColor, 0.95);
      ctx.font = `600 ${labelSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(ms.label), mx, plotT - 2);
      ctx.restore();
    }
  }
}

/**
 * Compute a visually pleasant Y-axis step size.
 */
function niceStep(maxVal, targetTicks) {
  const raw = maxVal / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  for (const factor of [1, 2, 5, 10]) {
    if (factor * pow >= raw) return factor * pow;
  }
  return pow * 10;
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
