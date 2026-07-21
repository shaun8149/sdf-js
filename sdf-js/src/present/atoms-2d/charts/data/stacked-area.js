// =============================================================================
// atoms-2d/charts/data/stacked-area.js — Stacked area chart
// -----------------------------------------------------------------------------
// N series accumulated over X axis, showing composition over time.
//
// Args:
//   series   — { name: string, values: number[] }[] — ordered bottom → top
//   xLabels  — string[]  (X-axis tick labels)
//   title    — string?
//   format   — 'number' | 'currency' | 'percent' (Y-axis label format)
//
// Render (pseudo-3D):
//   • Faint horizontal grid lines
//   • Y-axis labels (formatted)
//   • Series rendered bottom → top:
//       each band filled polygon from cumulative[k-1] to cumulative[k]
//       subtle vertical gradient per band (pseudo-3D depth)
//   • Crisp border stroke on each band's upper boundary
//   • Top series gets a drop shadow for "outermost" sense
//   • Legend at top with colour swatch + series names
//   • X-axis labels beneath chart
//
// Per Sprint 15a Task 5.1.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'stacked-area',
  category: 'charts/data',
  description:
    'Stacked area chart — N series accumulated over X axis (showing composition over time).',
  args: {
    series: {
      type: 'array of { name: string, values: number[] }',
      required: true,
      example: [
        { name: 'Product A', values: [10, 12, 15, 20, 25] },
        { name: 'Product B', values: [5, 8, 10, 14, 18] },
        { name: 'Product C', values: [3, 4, 6, 8, 11] },
      ],
    },
    xLabels: { type: 'string[]', example: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] },
    title: { type: 'string?', example: 'Revenue by Product Over Time' },
    format: { type: "'number'|'currency'|'percent'", default: 'number' },
  },
};

// Layout fractions
const TITLE_FRAC = 0.13;
const LEGEND_FRAC = 0.11;
const X_LABEL_FRAC = 0.1;
const Y_LABEL_W_FRAC = 0.11;
const PAD = 14;

function formatValue(v, format) {
  switch (format) {
    case 'currency':
      if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
      if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
      return `$${Math.round(v)}`;
    case 'percent':
      return `${v}%`;
    default:
      if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
      if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
      return String(Math.round(v));
  }
}

// Default palette colours if not supplied by branding
const FALLBACK_COLORS = [
  [60, 100, 200],
  [60, 170, 110],
  [220, 140, 40],
  [180, 60, 160],
  [220, 80, 80],
  [80, 180, 200],
];

export function drawPseudo3D(ctx, args, opts = {}) {
  const ox = opts.x ?? 0;
  const oy = opts.y ?? 0;
  const w = opts.w ?? 560;
  const h = opts.h ?? 320;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];

  // Resolve series
  const series = Array.isArray(args.series) ? args.series : [];
  const n = series.length;
  if (n === 0) return;

  const xLabels = Array.isArray(args.xLabels) ? args.xLabels : [];
  const format = args.format || 'number';
  const title = args.title;

  // Determine tick count from the first series with values
  const tickCount = series.reduce((max, s) => {
    const len = Array.isArray(s.values) ? s.values.length : 0;
    return Math.max(max, len);
  }, 0);
  if (tickCount < 2) return;

  // Compute cumulative stacks at each x position
  // cumulatives[k][i] = sum of series[0..k].values[i]
  const cumulatives = [];
  for (let k = 0; k < n; k++) {
    const row = [];
    for (let i = 0; i < tickCount; i++) {
      const prev = k === 0 ? 0 : cumulatives[k - 1][i];
      const val = Array.isArray(series[k].values) ? (series[k].values[i] ?? 0) : 0;
      row.push(prev + Math.max(0, val));
    }
    cumulatives.push(row);
  }

  // Y-axis max = maximum of the topmost cumulative
  const maxY = Math.max(...cumulatives[n - 1], 1);

  // Band colours
  const bandColors = series.map((_, k) => {
    const base = palette.colors || FALLBACK_COLORS;
    return base[k % base.length] || FALLBACK_COLORS[k % FALLBACK_COLORS.length];
  });

  // ---- Title ----
  let cursorY = oy + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.068);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, ox + PAD, oy + PAD);
    cursorY = oy + h * TITLE_FRAC;
  }

  // ---- Legend ----
  const legendTop = cursorY;
  const legendSize = Math.round(h * 0.045);
  const swatchSz = legendSize;
  const legendGap = 10;
  const legendItemGap = 18;
  ctx.font = `500 ${legendSize}px Inter, system-ui, sans-serif`;

  // Measure total legend width to centre it
  let totalLegendW = 0;
  const itemWidths = [];
  for (let k = 0; k < n; k++) {
    const tw = ctx.measureText(series[k].name || `Series ${k + 1}`).width;
    const iw = swatchSz + legendGap + tw + (k < n - 1 ? legendItemGap : 0);
    itemWidths.push(tw);
    totalLegendW += iw;
  }
  let lx = ox + (w - totalLegendW) / 2;
  const ly = legendTop + (h * LEGEND_FRAC - legendSize) / 2;

  for (let k = 0; k < n; k++) {
    const c = bandColors[k];
    // Colour swatch (rounded rect)
    ctx.save();
    ctx.fillStyle = rgbaCss(c, 0.85);
    ctx.beginPath();
    const r = 2;
    ctx.moveTo(lx + r, ly);
    ctx.arcTo(lx + swatchSz, ly, lx + swatchSz, ly + swatchSz, r);
    ctx.arcTo(lx + swatchSz, ly + swatchSz, lx, ly + swatchSz, r);
    ctx.arcTo(lx, ly + swatchSz, lx, ly, r);
    ctx.arcTo(lx, ly, lx + swatchSz, ly, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = rgbaCss(fg, 0.75);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(series[k].name || `Series ${k + 1}`, lx + swatchSz + legendGap, ly + swatchSz / 2);

    lx += swatchSz + legendGap + itemWidths[k] + legendItemGap;
  }

  // ---- Plot area geometry ----
  const plotTop = legendTop + h * LEGEND_FRAC + PAD;
  const xLabelH = h * X_LABEL_FRAC;
  const plotBottom = oy + h - xLabelH - PAD;
  const plotLeft = ox + PAD + Math.round(w * Y_LABEL_W_FRAC);
  const plotRight = ox + w - PAD;
  const plotW = plotRight - plotLeft;
  const plotH = Math.max(40, plotBottom - plotTop);

  // Coordinate helpers
  const px = (i) => plotLeft + (plotW * i) / (tickCount - 1);
  const py = (val) => plotBottom - (plotH * val) / maxY;

  // ---- Faint horizontal grid (4 lines) ----
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.08);
  ctx.lineWidth = 1;
  for (let gi = 0; gi <= 4; gi++) {
    const gy = plotTop + (plotH * gi) / 4;
    ctx.beginPath();
    ctx.moveTo(plotLeft, gy);
    ctx.lineTo(plotRight, gy);
    ctx.stroke();
  }
  ctx.restore();

  // ---- Y-axis labels ----
  ctx.font = `500 ${Math.round(h * 0.042)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgbaCss(fg, 0.55);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let gi = 0; gi <= 4; gi++) {
    const val = (maxY * gi) / 4;
    const gy = plotBottom - (plotH * gi) / 4;
    ctx.fillText(formatValue(val, format), plotLeft - 5, gy);
  }

  // ---- Band fills: render bottom → top ----
  for (let k = 0; k < n; k++) {
    const topRow = cumulatives[k];
    const botRow = k === 0 ? Array(tickCount).fill(0) : cumulatives[k - 1];
    const color = bandColors[k];

    // Build polygon path: left → right along top edge, then right → left along bottom edge
    ctx.save();

    // Gradient: lighter near top of band, slightly deeper at bottom (pseudo-3D)
    const bandTopPx = py(Math.max(...topRow));
    const bandBotPx = py(0);
    const grad = ctx.createLinearGradient(0, bandTopPx, 0, bandBotPx);
    grad.addColorStop(0, rgbaCss(color, 0.82));
    grad.addColorStop(1, rgbaCss(color, 0.55));

    // Drop shadow only on the topmost (outermost) band
    if (k === n - 1) {
      ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    // Top edge left → right
    ctx.moveTo(px(0), py(topRow[0]));
    for (let i = 1; i < tickCount; i++) ctx.lineTo(px(i), py(topRow[i]));
    // Bottom edge right → left
    for (let i = tickCount - 1; i >= 0; i--) ctx.lineTo(px(i), py(botRow[i]));
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Crisp stroke along upper boundary
    ctx.save();
    ctx.strokeStyle = rgbCss(color);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(px(0), py(topRow[0]));
    for (let i = 1; i < tickCount; i++) ctx.lineTo(px(i), py(topRow[i]));
    ctx.stroke();
    ctx.restore();
  }

  // ---- X-axis labels ----
  const nLabels = Math.min(tickCount, xLabels.length || tickCount);
  ctx.font = `500 ${Math.round(h * 0.045)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgbaCss(fg, 0.72);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i < tickCount; i++) {
    const label = i < xLabels.length ? String(xLabels[i]) : String(i + 1);
    ctx.fillText(label, px(i), plotBottom + 6);
  }
  void nLabels; // suppress unused warning
}
