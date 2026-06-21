// =============================================================================
// atoms-2d/charts/data/line.js — Line chart with annotations
// -----------------------------------------------------------------------------
// 3rd atom in 2D vector library (Phase 1b).
//
// Semantic: time-series or sequential trend showing change over points.
// Each point connected by a line; optional data point markers; optional
// per-point annotation labels (e.g. "→ launch", "← peak").
//
// Args:
//   values        — number[] (Y values, in plot order)
//   labels        — string[] (X labels under each point)
//   format        — 'currency' | 'percent' | 'number' (Y-axis value formatter)
//   title         — optional title above chart
//   annotations   — array of { index, text } — point-specific callouts
//   showPoints    — bool, draw dot markers (default true)
//   showValues    — bool, draw Y value above each point (default false)
//
// Render: pseudo-3D (drawPseudo3D)
//   - Faint baseline grid (3 horizontal lines)
//   - Connected line with subtle drop shadow + thick stroke
//   - Filled area gradient under line (fades to bg)
//   - Point markers (circles with shadow + gradient — same pseudo-3D treatment)
//   - X labels under each point (Inter 500)
//   - Annotations as small callouts pointing to specific points
//
// Per [[atlas-sprint14-finance-preset-plan]] atom #5 of 5 finance preset
// (line trend with annotations).
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'line',
  category: 'charts/data',
  description:
    'Line/trend chart showing sequence of values. Optional dot markers, value labels, and point-specific annotations.',
  args: {
    values: { type: 'number[]', required: true, example: [1.2, 1.8, 2.4, 3.1] },
    labels: { type: 'string[]', required: true, example: ['Q1', 'Q2', 'Q3', 'Q4'] },
    format: {
      type: "'currency'|'percent'|'number'",
      default: 'number',
      example: 'currency',
    },
    title: { type: 'string?', example: 'Revenue Trajectory ($M)' },
    annotations: {
      type: '{ index: number, text: string }[]?',
      example: [{ index: 2, text: '↑ product launch' }],
    },
    showPoints: { type: 'boolean?', default: true },
    showValues: { type: 'boolean?', default: false },
  },
};

const TITLE_FRAC = 0.14;
const X_LABEL_FRAC = 0.1;
const ANNOTATION_FRAC = 0.16;
const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 480;
  const h = opts.h ?? 280;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];
  const lineColor = palette.colors?.[0] || [60, 100, 200];

  const values = Array.isArray(args.values) ? args.values : [];
  const labels = Array.isArray(args.labels) ? args.labels : [];
  const n = Math.min(values.length, labels.length);
  if (n < 2) return;

  const format = args.format || 'number';
  const title = args.title;
  const annotations = Array.isArray(args.annotations) ? args.annotations : [];
  const showPoints = args.showPoints !== false;
  const showValues = args.showValues === true;
  const hasAnn = annotations.length > 0;

  // ---- Title ----
  let chartTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    chartTop = y + h * TITLE_FRAC;
  }

  // ---- Plot area ----
  const xLabelH = h * X_LABEL_FRAC;
  const annH = hasAnn ? h * ANNOTATION_FRAC : 0;
  const plotBottom = y + h - xLabelH - PAD;
  const plotTop = chartTop + annH + PAD;
  const plotLeft = x + PAD;
  const plotRight = x + w - PAD;
  const plotW = plotRight - plotLeft;
  const plotH = Math.max(40, plotBottom - plotTop);

  const minV = Math.min(...values);
  const maxV = Math.max(...values, minV + 1);
  const range = maxV - minV || 1;

  // ---- Faint baseline grid (3 horizontal lines) ----
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.08);
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const gy = plotTop + (plotH * i) / 3;
    ctx.beginPath();
    ctx.moveTo(plotLeft, gy);
    ctx.lineTo(plotRight, gy);
    ctx.stroke();
  }
  ctx.restore();

  // ---- Compute point positions ----
  const points = [];
  for (let i = 0; i < n; i++) {
    const xp = plotLeft + (plotW * i) / (n - 1);
    const yp = plotBottom - (plotH * (values[i] - minV)) / range;
    points.push({ x: xp, y: yp, value: values[i], label: labels[i] });
  }

  // ---- Area fill (gradient under line) ----
  const areaGradient = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
  areaGradient.addColorStop(0, rgbaCss(lineColor, 0.35));
  areaGradient.addColorStop(1, rgbaCss(lineColor, 0.02));
  ctx.fillStyle = areaGradient;
  ctx.beginPath();
  ctx.moveTo(points[0].x, plotBottom);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.lineTo(points[n - 1].x, plotBottom);
  ctx.closePath();
  ctx.fill();

  // ---- Connect line (with drop shadow) ----
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.strokeStyle = rgbCss(lineColor);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.restore();

  // ---- Point markers ----
  if (showPoints) {
    for (const p of points) {
      ctx.save();
      ctx.shadowColor = rgbaCss([0, 0, 0], 0.2);
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = rgbCss(bg);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = rgbCss(lineColor);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Value labels (optional) ----
  if (showValues) {
    ctx.font = `600 ${Math.round(h * 0.05)}px IBM Plex Mono, monospace`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const p of points) {
      ctx.fillText(formatValue(p.value, format), p.x, p.y - 9);
    }
  }

  // ---- X labels (under each point) ----
  ctx.font = `500 ${Math.round(h * 0.05)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgbaCss(fg, 0.75);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const p of points) {
    ctx.fillText(String(p.label), p.x, plotBottom + 6);
  }

  // ---- Annotations (callouts pointing to specific points) ----
  if (hasAnn) {
    ctx.font = `600 ${Math.round(h * 0.045)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(lineColor);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const ann of annotations) {
      if (typeof ann.index !== 'number' || ann.index < 0 || ann.index >= n) continue;
      const p = points[ann.index];
      const ay = chartTop + annH * 0.45;
      // Draw connector line from text to point
      ctx.strokeStyle = rgbaCss(lineColor, 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, ay + 4);
      ctx.lineTo(p.x, p.y - 8);
      ctx.stroke();
      ctx.fillText(String(ann.text), p.x, ay);
    }
  }
}

function formatValue(v, format) {
  switch (format) {
    case 'currency':
      return `$${v}`;
    case 'percent':
      return `${v}%`;
    default:
      return String(v);
  }
}
