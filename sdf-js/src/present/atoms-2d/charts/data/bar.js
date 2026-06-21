// =============================================================================
// atoms-2d/charts/data/bar.js — Horizontal bar chart atom
// -----------------------------------------------------------------------------
// 2nd atom in the 2D vector library (Phase 1, Part 1).
//
// Semantic: N labeled horizontal bars showing comparison. Each bar has
// a length proportional to its value. Most common chart type for
// "category vs metric" comparisons (e.g. "Q1/Q2/Q3/Q4 revenue").
//
// Args:
//   values  — array of numbers (raw, will be normalized inside)
//   labels  — array of strings (same length as values; left-side labels)
//   format  — value display format: 'currency' | 'percent' | 'number' | function(v)
//             (default: 'number')
//   max     — optional explicit max for scaling. If not provided, max(values).
//   title   — optional chart title above bars
//
// Render: pseudo-3D (drawPseudo3D)
//   - Each bar: gradient + drop shadow + subtle iso edge
//   - Labels on left (Inter 500, aligned right against bars)
//   - Values at end of each bar (Inter 600, slight offset)
//   - Title (Inter 700) above bars if provided
//   - Color: palette.colors[i % N] if available, else palette accent
//
// Per [[atlas-sprint14-finance-preset-plan]] — atom #2 of 5 finance
// preset assets.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'bar',
  category: 'charts/data',
  description:
    'Horizontal labeled bar chart. Categories on left, bar length = value, value displayed at bar end.',
  args: {
    values: { type: 'number[]', required: true, example: [1.2, 1.8, 2.4, 3.1] },
    labels: { type: 'string[]', required: true, example: ['Q1', 'Q2', 'Q3', 'Q4'] },
    format: {
      type: "'currency'|'percent'|'number'|function",
      example: 'currency',
      default: 'number',
    },
    max: { type: 'number?', example: 4 },
    title: { type: 'string?', example: 'Quarterly Revenue ($M)' },
  },
};

const DEFAULT_TITLE_FRAC = 0.16; // fraction of h reserved for title
const LABEL_GAP = 8;
const VALUE_GAP = 6;

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
  if (n === 0) return; // nothing to draw

  const max = args.max ?? Math.max(...values, 0);
  const format = args.format ?? 'number';
  const title = args.title;

  // ---- Title (if present) ----
  let chartTop = y;
  if (title) {
    const titleSize = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x, y);
    chartTop = y + h * DEFAULT_TITLE_FRAC;
  }
  const chartHeight = y + h - chartTop;

  // ---- Compute label width (longest label) ----
  const labelSize = Math.max(11, Math.round((chartHeight / n) * 0.32));
  ctx.font = `500 ${labelSize}px Inter, system-ui, sans-serif`;
  let maxLabelW = 0;
  for (const l of labels.slice(0, n)) {
    const m = ctx.measureText(String(l));
    if (m.width > maxLabelW) maxLabelW = m.width;
  }

  // ---- Compute value display + width ----
  const formatted = values.slice(0, n).map((v) => formatValue(v, format));
  const valueSize = Math.max(11, Math.round((chartHeight / n) * 0.34));
  ctx.font = `600 ${valueSize}px IBM Plex Mono, monospace`;
  let maxValueW = 0;
  for (const v of formatted) {
    const m = ctx.measureText(v);
    if (m.width > maxValueW) maxValueW = m.width;
  }

  // ---- Bar geometry ----
  const barAreaLeft = x + maxLabelW + LABEL_GAP;
  const barAreaRight = x + w - maxValueW - VALUE_GAP;
  const barAreaW = Math.max(40, barAreaRight - barAreaLeft);
  const barHeight = Math.min(36, (chartHeight - 8 * (n - 1)) / n);
  const barGap = (chartHeight - barHeight * n) / Math.max(1, n - 1);

  // ---- Draw each bar ----
  for (let i = 0; i < n; i++) {
    const v = values[i];
    const cy = chartTop + i * (barHeight + barGap);
    const lengthFrac = max > 0 ? v / max : 0;
    const barW = Math.max(2, barAreaW * lengthFrac);
    const barColor = colors ? colors[i % colors.length] : fallbackBar;

    // Bar label (left)
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `500 ${labelSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(labels[i]), barAreaLeft - LABEL_GAP, cy + barHeight / 2);

    // Bar body — pseudo-3D
    drawPseudoBar(ctx, barAreaLeft, cy, barW, barHeight, barColor);

    // Value at end of bar
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `600 ${valueSize}px IBM Plex Mono, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatted[i], barAreaLeft + barW + VALUE_GAP, cy + barHeight / 2);
  }
}

// ============================================================================
// Private helpers
// ============================================================================

function drawPseudoBar(ctx, x, y, w, h, color) {
  if (w <= 0 || h <= 0) return;
  const radius = Math.min(h / 2, 4);

  // Shadow
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  // Gradient (top lighter, bottom darker for depth)
  const gradient = ctx.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, rgbaCss(lighten(color, 0.18), 1));
  gradient.addColorStop(1, rgbCss(color));
  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Iso edge accent on top
  ctx.save();
  ctx.fillStyle = rgbaCss(lighten(color, 0.32), 0.7);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - radius, y);
  ctx.lineTo(x + w - radius, y + 2);
  ctx.lineTo(x, y + 2);
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
