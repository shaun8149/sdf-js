// =============================================================================
// atoms-2d/charts/diagrams/journey-flow-curve.js — Customer Journey + emotion curve
// -----------------------------------------------------------------------------
// PL signature: horizontal timeline with touchpoints + smooth emotion curve.
// Used for customer experience maps, user journey, service blueprint slides.
//
// Args:
//   title?       — optional heading
//   touchpoints  — array of { label, sublabel?, emotion } (REQUIRED)
//                  emotion: -1.0 (very negative) to +1.0 (very positive)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'journey-flow-curve',
  category: 'charts/diagrams',
  description:
    'Customer Journey with touchpoints + smooth Catmull-Rom emotion curve. Used for experience maps, user journeys, service blueprints.',
  args: {
    title: { type: 'string?', example: 'Customer Onboarding Journey' },
    touchpoints: {
      type: 'array of { label, sublabel?, emotion } (emotion: -1.0 to +1.0)',
      required: true,
      example: [
        { label: 'Discovery', sublabel: 'Sees ad', emotion: 0.3 },
        { label: 'Sign-up', sublabel: 'Free trial', emotion: 0.6 },
        { label: 'Onboarding', sublabel: 'Setup wizard', emotion: -0.2 },
        { label: 'First Value', sublabel: 'Aha moment', emotion: 0.9 },
        { label: 'Renewal', sublabel: 'Converts', emotion: 0.8 },
      ],
    },
  },
};

// Catmull-Rom spline through points
function catmullRomPath(ctx, pts) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const accent = palette.accent ?? [42, 130, 200];
  const fg = palette.silhouetteColor ?? [20, 28, 50];
  const bg = palette.bg ?? [248, 246, 240];

  const tps = Array.isArray(args.touchpoints) ? args.touchpoints : [];

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const PAD = 20;
  const AXIS_PAD_LEFT = 48;
  const LABEL_H = 72; // space below baseline for labels
  let plotTop = y + PAD;

  // Title
  if (args.title) {
    const titleFs = Math.round(h * 0.065);
    ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, plotTop);
    plotTop += titleFs + PAD * 0.5;
  }

  if (tps.length === 0) return;

  // Plot area
  const plotBottom = y + h - LABEL_H;
  const plotH = plotBottom - plotTop;
  const baseline = plotTop + plotH * 0.6;

  // X positions: evenly distributed
  const xLeft = x + AXIS_PAD_LEFT + PAD;
  const xRight = x + w - PAD - 20;
  const xRange = xRight - xLeft;
  const n = tps.length;

  const pts = tps.map((tp, i) => {
    const px = n > 1 ? xLeft + (i / (n - 1)) * xRange : xLeft + xRange / 2;
    const emotion = Math.max(-1, Math.min(1, Number(tp.emotion) || 0));
    const py = baseline - emotion * plotH * 0.3;
    return { x: px, y: py, emotion };
  });

  // Horizontal gridlines
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.08);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  // baseline
  ctx.beginPath();
  ctx.moveTo(xLeft - 10, baseline);
  ctx.lineTo(xRight + 10, baseline);
  ctx.stroke();
  // +0.5 line
  ctx.beginPath();
  ctx.moveTo(xLeft - 10, baseline - plotH * 0.15);
  ctx.lineTo(xRight + 10, baseline - plotH * 0.15);
  ctx.stroke();
  // -0.5 line
  ctx.beginPath();
  ctx.moveTo(xLeft - 10, baseline + plotH * 0.15);
  ctx.lineTo(xRight + 10, baseline + plotH * 0.15);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Y-axis label (rotated)
  const yAxisFs = 11;
  ctx.save();
  ctx.translate(x + 16, plotTop + plotH * 0.5);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `500 ${yAxisFs}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgbaCss(fg, 0.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('← Negative   Positive →', 0, 0);
  ctx.restore();

  // Filled area under curve (accent color, low alpha)
  ctx.save();
  ctx.beginPath();
  catmullRomPath(ctx, pts);
  ctx.lineTo(pts[pts.length - 1].x, baseline);
  ctx.lineTo(pts[0].x, baseline);
  ctx.closePath();
  ctx.fillStyle = rgbaCss(accent, 0.12);
  ctx.fill();
  ctx.restore();

  // Curve stroke
  ctx.save();
  ctx.beginPath();
  catmullRomPath(ctx, pts);
  ctx.strokeStyle = rgbCss(accent);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();

  // Touchpoint verticals + dots + labels
  for (let i = 0; i < tps.length; i++) {
    const tp = tps[i];
    const pt = pts[i];
    const isPositive = pt.emotion >= 0;
    const dotColor = isPositive ? accent : [239, 68, 68];

    // Vertical line from baseline to dot
    ctx.save();
    ctx.strokeStyle = rgbaCss(fg, 0.18);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pt.x, baseline);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Dot
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.2);
    ctx.shadowBlur = 6;
    ctx.fillStyle = rgbCss(dotColor);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Labels below baseline
    const labelY = plotBottom + 10;
    const labelFs = Math.min(12, Math.round(xRange / n / 7));
    ctx.font = `700 ${Math.max(9, labelFs)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(tp.label || '', pt.x, labelY);

    if (tp.sublabel) {
      const subFs = Math.max(9, Math.max(9, labelFs) - 1);
      ctx.font = `500 ${subFs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = rgbaCss(fg, 0.5);
      ctx.fillText(tp.sublabel, pt.x, labelY + Math.max(9, labelFs) + 2);
    }
  }
}
