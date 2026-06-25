// atoms-2d/charts/data/change-curve-chart.js — Kübler-Ross Change Curve
// S-shaped (dip-then-rise) curve with phase annotation labels.
// Args: title?, xAxis?, yAxis?, phases[] (req, 3-8 { label, description? })

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'change-curve-chart',
  category: 'charts/data',
  description:
    'Kübler-Ross change curve — S-curve dip + recovery with annotated phase labels on x-axis.',
  args: {
    title: { type: 'string?', example: 'Change Adoption Curve' },
    xAxis: { type: 'string?', example: 'Time' },
    yAxis: { type: 'string?', example: 'Morale / Competence' },
    phases: {
      type: 'array',
      required: true,
      example: [
        { label: 'Shock', description: 'Initial announcement' },
        { label: 'Denial', description: 'It will not affect us' },
        { label: 'Anger', description: 'Why is this happening?' },
        { label: 'Depression', description: 'Lowest morale point' },
        { label: 'Acceptance', description: 'Understanding begins' },
        { label: 'Integration', description: 'New normal achieved' },
      ],
    },
  },
};

const PAD = 16,
  AXIS_LABEL_H = 36,
  AXIS_LABEL_W = 40;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 380;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const accent = palette.accent || palette.colors?.[0] || [60, 100, 200];

  const phases = Array.isArray(args.phases) ? args.phases.slice(0, 8) : [];
  if (phases.length === 0) return;

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  // Title
  let plotTop = y + PAD;
  if (args.title) {
    const titleH = Math.round(h * 0.1);
    ctx.save();
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(titleH * 0.65)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(args.title), x + PAD, y + titleH / 2);
    ctx.restore();
    plotTop = y + titleH;
  }

  const hasYAxis = Boolean(args.yAxis);
  const hasXAxis = Boolean(args.xAxis);
  const yAxisW = hasYAxis ? AXIS_LABEL_W : PAD;
  const xAxisH = hasXAxis ? AXIS_LABEL_H : PAD;

  // Plot area
  const plotL = x + PAD + yAxisW;
  const plotR = x + w - PAD;
  const plotB = y + h - PAD - xAxisH;
  const plotW = plotR - plotL;
  const plotHt = plotB - plotTop - PAD;

  // Phase label area at the bottom (below curve but above x-axis)
  const phaseLabelH = Math.round(plotHt * 0.3);
  const curveB = plotB - phaseLabelH;
  const curveH = plotB - plotTop - PAD - phaseLabelH;

  // Draw axes
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.4);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plotL, plotTop + PAD);
  ctx.lineTo(plotL, curveB);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(plotL, curveB);
  ctx.lineTo(plotR, curveB);
  ctx.stroke();
  ctx.restore();

  // Axis labels
  if (hasXAxis) {
    ctx.save();
    ctx.fillStyle = rgbaCss(fg, 0.65);
    ctx.font = `600 ${Math.round(h * 0.038)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.xAxis), plotL + plotW / 2, plotB + 4);
    ctx.restore();
  }

  if (hasYAxis) {
    ctx.save();
    ctx.translate(x + PAD * 0.5, plotTop + PAD + curveH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = rgbaCss(fg, 0.65);
    ctx.font = `600 ${Math.round(h * 0.035)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(args.yAxis), 0, 0);
    ctx.restore();
  }

  const N = phases.length;
  // Kübler-Ross Y: dips at t≈0.4, rises to end
  function phaseY(i) {
    const t = i / (N - 1);
    const a = -4.0 * (t - 0.4) * (t - 0.4) + 0.9;
    const b = 0.6 * t + 0.3;
    const blend = Math.max(0, Math.min(1, (t - 0.3) / 0.5));
    return a * (1 - blend) + b * blend;
  }

  function phaseCoord(i) {
    const px = plotL + (i / (N - 1)) * plotW;
    const py = plotTop + PAD + (1 - phaseY(i)) * curveH;
    return { px, py };
  }

  const points = phases.map((_, i) => phaseCoord(i));

  // Draw filled area under curve
  ctx.save();
  const grad = ctx.createLinearGradient(0, plotTop + PAD, 0, curveB);
  grad.addColorStop(0, rgbaCss(accent, 0.25));
  grad.addColorStop(1, rgbaCss(accent, 0.03));
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(points[0].px, curveB);
  ctx.lineTo(points[0].px, points[0].py);
  drawSmoothCurve(ctx, points);
  ctx.lineTo(points[N - 1].px, curveB);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Draw the curve line itself
  ctx.save();
  ctx.strokeStyle = rgbCss(accent);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].px, points[0].py);
  drawSmoothCurve(ctx, points);
  ctx.stroke();
  ctx.restore();

  // Phase dots on the curve
  for (let i = 0; i < N; i++) {
    const { px, py } = points[i];
    ctx.save();
    ctx.fillStyle = rgbCss(accent);
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.2);
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Vertical dashed connector from dot to phase label zone
    ctx.save();
    ctx.strokeStyle = rgbaCss(fg, 0.2);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px, py + 5);
    ctx.lineTo(px, curveB - 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Phase labels in zone below curve
  const labelFontSize = Math.min(Math.round(phaseLabelH * 0.22), Math.round(plotW / N / 5.5), 12);
  const descFontSize = Math.max(8, Math.round(labelFontSize * 0.75));

  for (let i = 0; i < N; i++) {
    const { px } = points[i];
    const labelY = curveB + 6;

    ctx.save();
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${labelFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(phases[i].label || ''), px, labelY);
    ctx.restore();

    if (phases[i].description) {
      ctx.save();
      ctx.fillStyle = rgbaCss(fg, 0.55);
      ctx.font = `500 ${descFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(phases[i].description), px, labelY + labelFontSize * 1.3);
      ctx.restore();
    }
  }
}

// Draw a smooth curve through the given points using cubic bezier approximation
function drawSmoothCurve(ctx, points) {
  const N = points.length;
  if (N < 2) return;

  for (let i = 0; i < N - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(N - 1, i + 2)];

    // Catmull-Rom → cubic bezier control points (tension = 0.5)
    const t = 0.5;
    const cp1x = p1.px + ((p2.px - p0.px) * t) / 3;
    const cp1y = p1.py + ((p2.py - p0.py) * t) / 3;
    const cp2x = p2.px - ((p3.px - p1.px) * t) / 3;
    const cp2y = p2.py - ((p3.py - p1.py) * t) / 3;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.px, p2.py);
  }
}
