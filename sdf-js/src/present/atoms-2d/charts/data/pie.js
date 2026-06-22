// =============================================================================
// atoms-2d/charts/data/pie.js — Pie / Donut chart
// -----------------------------------------------------------------------------
// 4th atom in 2D vector library (Phase 1b).
//
// Semantic: share of N segments out of 100%. Each segment proportional to
// its value. Most common chart type for "X out of Y" composition.
//
// Args:
//   values         — number[] (raw, will be normalized to 100%)
//   labels         — string[] (same length, segment names)
//   format         — 'percent' | 'currency' | 'number' (label suffix format)
//   title          — optional title above chart
//   donutRatio     — 0..0.95 — inner hole radius / outer radius (default 0)
//                    0 = solid pie, 0.5 = donut, 0.7 = thin ring
//   centerLabel    — optional text in donut center (e.g. "Total $100M")
//
// Render: pseudo-3D (drawPseudo3D)
//   - Outer slices with radial gradient + drop shadow
//   - Slice color from palette.colors[i % N]
//   - Labels outside each slice with leader line (only labels for ≥4% segments)
//   - Small segments grouped or labeled inline
//   - Center label (donut mode) — bold Inter
//
// Per [[atlas-sprint14-finance-preset-plan]] atom #4 of 5 finance preset
// (market share donut/pie).
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'pie',
  category: 'charts/data',
  description: 'Pie or donut chart for share/composition. Each slice proportional to value.',
  args: {
    values: { type: 'number[]', required: true, example: [32, 23, 11, 8, 26] },
    labels: {
      type: 'string[]',
      required: true,
      example: ['AWS', 'Azure', 'GCP', 'Alibaba', 'Others'],
    },
    format: { type: "'percent'|'currency'|'number'", default: 'percent', example: 'percent' },
    title: { type: 'string?', example: 'Cloud Market Share' },
    donutRatio: { type: 'number (0..0.95)', default: 0, example: 0.55 },
    centerLabel: { type: 'string?', example: '100%' },
  },
};

const PAD = 14;
const TITLE_FRAC = 0.12;
const SMALL_SEGMENT_THRESHOLD = 0.04; // segments < 4% don't get external label

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 400;
  const h = opts.h ?? 300;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];
  const colors = palette.colors || null;
  // Softer / lower-saturation fallback palette
  const fallbackColors = [
    [80, 115, 190],
    [195, 110, 75],
    [75, 165, 110],
    [165, 80, 165],
    [190, 170, 70],
    [130, 130, 135],
  ];

  const values = Array.isArray(args.values) ? args.values : [];
  const labels = Array.isArray(args.labels) ? args.labels : [];
  const n = Math.min(values.length, labels.length);
  if (n === 0) return;

  const format = args.format || 'percent';
  const title = args.title;
  const donutRatio = Math.max(0, Math.min(0.95, args.donutRatio || 0));
  const centerLabel = args.centerLabel;

  const sum = values.slice(0, n).reduce((a, b) => a + b, 0);
  if (sum <= 0) return;

  // ---- Background: warm off-white if palette.bg not set ----
  const bgRender = palette.bg ? rgbCss(palette.bg) : '#fafaf8';
  ctx.fillStyle = bgRender;
  ctx.fillRect(x, y, w, h);

  // ---- Title — Inter 700, 22-32px ----
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
  // Need room for external labels — reserve ~20% horizontal padding for them
  const labelRoom = w * 0.22;
  const plotArea = {
    cx: x + w / 2,
    cy: plotTop + (y + h - plotTop) / 2,
  };
  const radius = Math.min(w - labelRoom * 2, y + h - plotTop) / 2 - PAD;
  const innerRadius = radius * donutRatio;

  // ---- Compute slice angles ----
  const slices = [];
  let currentAngle = -Math.PI / 2; // start at 12 o'clock
  for (let i = 0; i < n; i++) {
    const v = values[i];
    const fraction = v / sum;
    const startAngle = currentAngle;
    const endAngle = currentAngle + fraction * Math.PI * 2;
    const midAngle = (startAngle + endAngle) / 2;
    const color = colors ? colors[i % colors.length] : fallbackColors[i % fallbackColors.length];
    slices.push({
      label: labels[i],
      value: v,
      fraction,
      startAngle,
      endAngle,
      midAngle,
      color,
    });
    currentAngle = endAngle;
  }

  // ---- Drop shadow for entire pie group (softer: 10px blur, alpha 0.12) ----
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.12);
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = rgbCss(fg);
  ctx.beginPath();
  ctx.arc(plotArea.cx, plotArea.cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- Draw each slice with subtle radial gradient (10% lighten at edge) ----
  for (const s of slices) {
    ctx.save();
    // Per-slice gradient: center slightly darker, outer edge 10% lighter
    const grad = ctx.createRadialGradient(
      plotArea.cx,
      plotArea.cy,
      innerRadius || 4,
      plotArea.cx,
      plotArea.cy,
      radius,
    );
    grad.addColorStop(0, rgbCss(darken(s.color, 0.06)));
    grad.addColorStop(1, rgbCss(lighten(s.color, 0.1)));
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(plotArea.cx, plotArea.cy);
    ctx.arc(plotArea.cx, plotArea.cy, radius, s.startAngle, s.endAngle);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Slice separator — white hairline 1.5px for crispness
    ctx.save();
    ctx.strokeStyle = bgRender;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plotArea.cx, plotArea.cy);
    ctx.lineTo(
      plotArea.cx + Math.cos(s.endAngle) * radius,
      plotArea.cy + Math.sin(s.endAngle) * radius,
    );
    ctx.stroke();
    ctx.restore();
  }

  // ---- Donut hole — fill with bg color ----
  if (donutRatio > 0) {
    ctx.fillStyle = bgRender;
    ctx.beginPath();
    ctx.arc(plotArea.cx, plotArea.cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();

    if (centerLabel) {
      // Center label hierarchy: large value Inter 700, proper size
      const centerFontSize = Math.min(28, Math.max(14, Math.round(innerRadius * 0.38)));
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `700 ${centerFontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(centerLabel), plotArea.cx, plotArea.cy);
    }
  }

  // ---- External labels with thin leader lines — Inter 600 ----
  const extLabelSize = Math.max(12, Math.min(16, Math.round(h * 0.052)));
  ctx.font = `600 ${extLabelSize}px Inter, sans-serif`;
  ctx.fillStyle = rgbCss(fg);
  for (const s of slices) {
    if (s.fraction < SMALL_SEGMENT_THRESHOLD) continue; // skip too-small slices

    const labelText = `${s.label}  ${formatValue(s.value, s.fraction, format)}`;
    const labelDist = radius + 16;
    const tipX = plotArea.cx + Math.cos(s.midAngle) * radius;
    const tipY = plotArea.cy + Math.sin(s.midAngle) * radius;
    const labelX = plotArea.cx + Math.cos(s.midAngle) * labelDist;
    const labelY = plotArea.cy + Math.sin(s.midAngle) * labelDist;
    const onRight = Math.cos(s.midAngle) > 0;

    // Thin leader line (hairline alpha 0.35)
    ctx.strokeStyle = rgbaCss(fg, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(labelX, labelY);
    ctx.stroke();

    ctx.textAlign = onRight ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, labelX + (onRight ? 5 : -5), labelY);
  }
}

function formatValue(rawValue, fraction, format) {
  switch (format) {
    case 'percent':
      return `${Math.round(fraction * 1000) / 10}%`;
    case 'currency':
      return `$${rawValue}`;
    default:
      return String(rawValue);
  }
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
