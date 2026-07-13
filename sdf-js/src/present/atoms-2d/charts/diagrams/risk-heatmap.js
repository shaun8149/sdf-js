// =============================================================================
// atoms-2d/charts/diagrams/risk-heatmap.js — Risk Heat Map
// -----------------------------------------------------------------------------
// 5x5 grid (likelihood × impact) with cells colored by severity.
// Each risk plotted as a dot in its cell. PL Cybersecurity / Risk Assessment
// template signature.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { semanticColor } from '../../color.js';

export const spec = {
  type: 'risk-heatmap',
  category: 'charts/diagrams',
  description:
    '5x5 risk grid (likelihood × impact) with cells colored by severity. PL Cybersecurity / Risk Assessment signature.',
  args: {
    title: { type: 'string?', example: 'Risk Assessment Matrix' },
    xAxis: { type: 'string?', example: 'Likelihood' },
    yAxis: { type: 'string?', example: 'Impact' },
    xLabels: { type: 'string[]?', example: ['Very Low', 'Low', 'Medium', 'High', 'Very High'] },
    yLabels: { type: 'string[]?', example: ['Very Low', 'Low', 'Medium', 'High', 'Very High'] },
    risks: {
      type: 'array',
      required: true,
      example: [
        { label: 'Data breach', likelihood: 4, impact: 5 },
        { label: 'Compliance fine', likelihood: 2, impact: 4 },
        { label: 'Vendor delay', likelihood: 5, impact: 2 },
      ],
    },
  },
};

const TITLE_H_FRAC = 0.1;
const PAD = 14;
const AXIS_LABEL_W = 32;
const AXIS_LABEL_H = 28;

// severity = likelihood × impact (1-25), color by zone
function cellColor(col, row, palette) {
  // col = likelihood (0-4 = very low to very high), row = impact (0-4 = very low to very high)
  const severity = (col + 1) * (row + 1); // 1..25
  if (severity >= 20) return semanticColor(palette, 'negative'); // critical
  if (severity >= 13) return semanticColor(palette, 'warning'); // high
  if (severity >= 6) return [220, 200, 50]; // medium — yellow (warning 与 positive 之间的过渡档)
  return semanticColor(palette, 'positive'); // low
}

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];

  const title = args.title;
  const xAxisLabel = args.xAxis || 'Likelihood';
  const yAxisLabel = args.yAxis || 'Impact';
  const xLabels =
    Array.isArray(args.xLabels) && args.xLabels.length === 5
      ? args.xLabels
      : ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
  const yLabels =
    Array.isArray(args.yLabels) && args.yLabels.length === 5
      ? args.yLabels
      : ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
  const risks = Array.isArray(args.risks) ? args.risks.slice(0, 12) : [];

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  // Title bar
  let plotTop = y + PAD;
  if (title) {
    const titleH = Math.round(h * TITLE_H_FRAC);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(titleH * 0.55)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + PAD, y + titleH / 2);
    plotTop = y + titleH;
  }

  // Grid area accounting for axis labels
  const gridX = x + AXIS_LABEL_W + PAD;
  const gridY = plotTop + PAD;
  const gridW = w - AXIS_LABEL_W - PAD * 2;
  const gridH = h - (plotTop - y) - AXIS_LABEL_H - PAD * 2;
  const cellW = gridW / 5;
  const cellH = gridH / 5;

  // Draw 5x5 cells (col=likelihood 0..4 left→right, row=impact 0..4 bottom→top)
  for (let col = 0; col < 5; col++) {
    for (let rowI = 0; rowI < 5; rowI++) {
      // rowI=0 is top in canvas coords, but impact increases bottom→top
      const impactLevel = 4 - rowI; // 4=very high impact at top
      const color = cellColor(col, impactLevel, palette);
      const cx = gridX + col * cellW;
      const cy = gridY + rowI * cellH;

      ctx.fillStyle = rgbaCss(color, 0.75);
      ctx.fillRect(cx, cy, cellW, cellH);

      // Cell border
      ctx.strokeStyle = rgbaCss(bg, 0.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, cy, cellW, cellH);
    }
  }

  // Outer grid border
  ctx.strokeStyle = rgbaCss(fg, 0.3);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(gridX, gridY, gridW, gridH);

  // X-axis labels (likelihood) below grid
  const xLabelY = gridY + gridH + 6;
  const xLabelFontSize = Math.min(10, Math.round(cellW * 0.18));
  ctx.fillStyle = rgbaCss(fg, 0.7);
  ctx.font = `500 ${xLabelFontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i < 5; i++) {
    ctx.fillText(xLabels[i], gridX + i * cellW + cellW / 2, xLabelY);
  }

  // X-axis title
  const xAxisFontSize = Math.min(12, Math.round(h * 0.035));
  ctx.fillStyle = rgbCss(fg);
  ctx.font = `700 ${xAxisFontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(xAxisLabel, gridX + gridW / 2, xLabelY + xLabelFontSize + 4);

  // Y-axis labels (impact) left of grid — rotated
  ctx.save();
  const yLabelFontSize = Math.min(10, Math.round(cellH * 0.18));
  ctx.fillStyle = rgbaCss(fg, 0.7);
  ctx.font = `500 ${yLabelFontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    const cy = gridY + i * cellH + cellH / 2;
    const impactIdx = 4 - i;
    ctx.save();
    ctx.translate(x + AXIS_LABEL_W / 2, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabels[impactIdx], 0, 0);
    ctx.restore();
  }

  // Y-axis title
  ctx.fillStyle = rgbCss(fg);
  ctx.font = `700 ${xAxisFontSize}px Inter, system-ui, sans-serif`;
  ctx.save();
  ctx.translate(x + 10, gridY + gridH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(yAxisLabel, 0, 0);
  ctx.restore();

  ctx.restore();

  // Plot risk dots in their cells
  const dotR = Math.min(8, cellW * 0.15);
  const dotLabelSize = Math.min(10, cellW * 0.16);
  for (const risk of risks) {
    const col = Math.max(0, Math.min(4, Math.round(Number(risk.likelihood) - 1)));
    const impactLevel = Math.max(0, Math.min(4, Math.round(Number(risk.impact) - 1)));
    const rowI = 4 - impactLevel; // canvas row (0 = top)
    const cx = gridX + col * cellW + cellW / 2;
    const cy = gridY + rowI * cellH + cellH / 2;

    // Dot
    ctx.fillStyle = rgbaCss(fg, 0.85);
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fill();

    // Label (truncated to fit)
    if (risk.label) {
      ctx.fillStyle = rgbaCss(fg, 0.75);
      ctx.font = `500 ${dotLabelSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = cx > gridX + gridW * 0.7 ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      const labelX = cx + (cx > gridX + gridW * 0.7 ? -dotR - 3 : dotR + 3);
      const maxLW = cellW * 0.8;
      let label = String(risk.label);
      while (label.length > 3 && ctx.measureText(label).width > maxLW) {
        label = label.slice(0, -1);
      }
      if (label !== risk.label) label += '…';
      ctx.fillText(label, labelX, cy);
    }
  }
}
