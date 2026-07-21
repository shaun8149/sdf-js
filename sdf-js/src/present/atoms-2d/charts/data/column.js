// =============================================================================
// atoms-2d/charts/data/column.js — Vertical column chart
// -----------------------------------------------------------------------------
// 5th atom in 2D vector library (Phase 1c). Completes charts/data family.
//
// Sibling of `bar` atom: same data shape but COLUMNS (vertical bars) instead
// of horizontal bars. Convention: column = time-series (X = ordered
// categories, Y = value). bar = magnitude comparison (Y = categories, X =
// value). Both are valid for "values + labels" data — choice is editorial.
//
// Args (identical to bar atom for LLM consistency):
//   values  — number[] (raw, will be normalized via max)
//   labels  — string[] (same length, X-axis category names under each column)
//   format  — 'currency' | 'percent' | 'number' | function (value formatter)
//   max     — optional explicit max for scaling
//   title   — optional title above chart
//   showValues — bool, draw value on top of each column (default true)
//
// Render: pseudo-3D (drawPseudo3D)
//   - Title row (Inter 700) above
//   - Y-axis baseline (faint horizontal line at bottom)
//   - Each column: gradient + drop shadow + top iso edge
//   - Column color from palette.colors[i % N] (or fallback)
//   - X label under each column (Inter 500, centered)
//   - Value above each column top (IBM Plex Mono 600, optional)
//
// Per [[atlas-sprint14-finance-preset-plan]] — atom #2 of 5 finance preset
// (quarterly trajectory variant — bar but vertical).
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'column',
  category: 'charts/data',
  description:
    'Vertical column chart. Sibling of bar atom (same args, rotated 90°). Best for time-series.',
  args: {
    values: { type: 'number[]', required: true, example: [1.2, 1.8, 2.4, 3.1] },
    labels: { type: 'string[]', required: true, example: ['Q1', 'Q2', 'Q3', 'Q4'] },
    format: {
      type: "'currency'|'percent'|'number'|function",
      default: 'number',
      example: 'currency',
    },
    max: { type: 'number?', example: 4 },
    title: { type: 'string?', example: 'Quarterly Revenue ($M)' },
    showValues: { type: 'boolean?', default: true },
  },
};

const PAD = 20; // generous outer padding
const TITLE_FRAC = 0.13;
const X_LABEL_FRAC = 0.1;
const VALUE_TOP_GAP = 6;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 480;
  const h = opts.h ?? 280;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const colors = palette.colors || null;
  const fallbackBar = palette.colors?.[0] || [60, 100, 200];

  const values = Array.isArray(args.values) ? args.values : [];
  const labels = Array.isArray(args.labels) ? args.labels : [];
  const n = Math.min(values.length, labels.length);
  if (n === 0) return;

  const max = args.max ?? Math.max(...values, 0);
  const format = args.format ?? 'number';
  const title = args.title;
  const showValues = args.showValues !== false; // default true

  // ---- Background: warm off-white if palette.bg not set ----
  const bgColor = palette.bg ? rgbCss(palette.bg) : '#fafaf8';
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);

  // ---- Title row — Inter 700, 22-32px ----
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.min(28, Math.max(22, Math.round(h * 0.08)));
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * TITLE_FRAC;
  }

  // ---- Plot dimensions ----
  const xLabelH = h * X_LABEL_FRAC;
  const valueLabelH = showValues ? h * 0.07 : 0;
  const plotBottom = y + h - xLabelH - PAD;
  const plotEffectiveTop = plotTop + valueLabelH + PAD;
  const plotH = Math.max(40, plotBottom - plotEffectiveTop);
  const plotLeft = x + PAD;
  const plotRight = x + w - PAD;
  const plotW = plotRight - plotLeft;

  // ---- Hairline y-axis baseline (1px alpha 0.4) ----
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();
  ctx.restore();

  // ---- Column geometry ----
  const slotW = plotW / n;
  const columnW = Math.min(60, slotW * 0.7);

  // ---- Draw each column ----
  const valueSize = Math.max(12, Math.min(16, Math.round(h * 0.055)));
  const labelSize = Math.max(14, Math.min(18, Math.round(h * 0.055)));

  for (let i = 0; i < n; i++) {
    const v = values[i];
    const cx = plotLeft + slotW * (i + 0.5);
    const lengthFrac = max > 0 ? v / max : 0;
    const colH = Math.max(2, plotH * lengthFrac);
    const colTop = plotBottom - colH;
    const colLeft = cx - columnW / 2;
    const color = colors ? colors[i % colors.length] : fallbackBar;

    // Column body — pseudo-3D (subtle gradient)
    drawPseudoColumn(ctx, colLeft, colTop, columnW, colH, color);

    // Value on top — Inter 600
    if (showValues) {
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `600 ${valueSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(formatValue(v, format), cx, colTop - VALUE_TOP_GAP);
    }

    // X label below — Inter 600, 14-18px
    ctx.fillStyle = rgbaCss(fg, 0.85);
    ctx.font = `600 ${labelSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(labels[i]), cx, plotBottom + 8);
  }
}

// ============================================================================
// Private helpers
// ============================================================================

function drawPseudoColumn(ctx, x, y, w, h, color) {
  if (w <= 0 || h <= 0) return;
  const radius = Math.min(w / 2, 4);

  // Shadow — soft (10px blur, alpha 0.12)
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.12);
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;

  // Gradient (left lighter, right barely darker — subtle 8% lighten)
  const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
  gradient.addColorStop(0, rgbaCss(lighten(color, 0.08), 1));
  gradient.addColorStop(1, rgbCss(color));
  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.moveTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Top iso edge accent — reduced to 10% lighten for subtlety
  ctx.save();
  ctx.fillStyle = rgbaCss(lighten(color, 0.1), 0.6);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.lineTo(x + w - radius, y + 2);
  ctx.lineTo(x + radius, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function formatValue(v, format) {
  if (typeof format === 'function') return format(v);
  switch (format) {
    case 'currency':
      return `$${v}`;
    case 'percent':
      return `${v}%`;
    case 'number':
    default:
      return String(v);
  }
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
