// =============================================================================
// atoms-2d/charts/data/funnel-with-conversion.js — Funnel + conversion rate chips
// -----------------------------------------------------------------------------
// Like funnel.js but with explicit conversion % chips between consecutive stages.
// E.g. SaaS funnel: Visitors → (12%) → Signups → (35%) → Trials → (18%) → Paid
//
// Args:
//   title          — optional chart title
//   stages         — array of { label, value, sublabel? } (3-7) REQUIRED
//   showAbsolute   — show absolute values inside stages (default true)
//   showConversion — show conversion % chips between stages (default true)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'funnel-with-conversion',
  category: 'charts/data',
  description:
    'Funnel chart with explicit conversion rate % shown between consecutive stages (e.g. SaaS funnel: Visitors → Signups 12% → Trials 35% → Paid 18%).',
  args: {
    title: { type: 'string?', example: 'SaaS Conversion Funnel' },
    stages: {
      type: 'array of { label, value, sublabel? } (3-7)',
      required: true,
      example: [
        { label: 'Visitors', value: 100000 },
        { label: 'Signups', value: 12000 },
        { label: 'Trials', value: 4200 },
        { label: 'Paid', value: 760 },
      ],
    },
    showAbsolute: { type: 'boolean?', default: true },
    showConversion: { type: 'boolean?', default: true },
  },
};

const PAD = 14;
const STAGE_GAP = 18; // larger gap to fit conversion chip

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 480;
  const h = opts.h ?? 380;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.accent || palette.colors?.[0] || [60, 130, 200];
  const baseColor = palette.colors?.[0] || [60, 130, 200];

  const stages = Array.isArray(args.stages) ? args.stages : [];
  const showAbsolute = args.showAbsolute !== false;
  const showConversion = args.showConversion !== false;
  const n = stages.length;
  if (n === 0) return;

  // Background
  const bgColor = palette.bg ? rgbCss(palette.bg) : '#fafaf8';
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);

  // Title
  let plotTop = y + PAD;
  if (args.title) {
    const ts = Math.round(h * 0.065);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${ts}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.13;
  }

  // Reserve right column for value annotations
  const rightColW = 110;
  const plotH = y + h - plotTop - PAD;
  const plotW = w - PAD * 2 - rightColW;
  const cx = x + PAD + plotW / 2;
  const topY = plotTop;
  const chipH = STAGE_GAP - 2;
  const stageH = (plotH - STAGE_GAP * (n - 1)) / n;

  // Width tapering proportional to sqrt(value)
  const values = stages.map((s) => (s.value != null ? Number(s.value) : null));
  const firstValue = values[0] || 1;
  const maxW = plotW * 0.92;
  const minW = plotW * 0.22;

  const widthAt = (i) => {
    if (values[i] != null && values[0] != null) {
      const ratio = Math.sqrt(values[i] / firstValue);
      const wEdge = minW + (maxW - minW) * ratio;
      const ratioNext =
        i + 1 < n && values[i + 1] != null
          ? Math.sqrt(values[i + 1] / firstValue)
          : ratio * (minW / maxW);
      return [wEdge, minW + (maxW - minW) * ratioNext];
    }
    const t0 = i / n;
    const t1 = (i + 1) / n;
    return [maxW + (minW - maxW) * t0, maxW + (minW - maxW) * t1];
  };

  const makeStageColor = (i) => {
    const darken = i * 0.08;
    return [
      Math.max(0, Math.round(baseColor[0] * (1 - darken))),
      Math.max(0, Math.round(baseColor[1] * (1 - darken))),
      Math.max(0, Math.round(baseColor[2] * (1 - darken))),
    ];
  };

  for (let i = 0; i < n; i++) {
    const [wTop, wBot] = widthAt(i);
    const topEdgeY = topY + i * (stageH + STAGE_GAP);
    const botEdgeY = topEdgeY + stageH;
    const color = makeStageColor(i);

    // Trapezoid stage
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    const grad = ctx.createLinearGradient(0, topEdgeY, 0, botEdgeY);
    grad.addColorStop(0, rgbCss(lighten(color, 0.08)));
    grad.addColorStop(1, rgbCss(color));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - wTop / 2, topEdgeY);
    ctx.lineTo(cx + wTop / 2, topEdgeY);
    ctx.lineTo(cx + wBot / 2, botEdgeY);
    ctx.lineTo(cx - wBot / 2, botEdgeY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Border
    ctx.save();
    ctx.strokeStyle = rgbaCss(color, 0.25);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - wTop / 2, topEdgeY);
    ctx.lineTo(cx + wTop / 2, topEdgeY);
    ctx.lineTo(cx + wBot / 2, botEdgeY);
    ctx.lineTo(cx - wBot / 2, botEdgeY);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Labels inside stage
    const stageCy = (topEdgeY + botEdgeY) / 2;
    const labelFs = Math.min(14, stageH * 0.28);
    const subFs = Math.min(11, stageH * 0.2);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 2;
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = `700 ${labelFs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hasSubLine = showAbsolute && stages[i].value != null;
    ctx.fillText(stages[i].label || '', cx, stageCy - (hasSubLine ? stageH * 0.1 : 0));
    ctx.restore();

    if (hasSubLine) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `400 ${subFs}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Number(stages[i].value).toLocaleString(), cx, stageCy + stageH * 0.18);
      ctx.restore();
    }

    // Right column value
    if (stages[i].value != null) {
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `600 ${Math.min(12, stageH * 0.25)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(Number(stages[i].value).toLocaleString(), cx + plotW / 2 + 12, stageCy);
    }

    // Conversion chip between this stage and next
    if (showConversion && i < n - 1 && values[i] != null && values[i + 1] != null) {
      const convRate = ((Number(values[i + 1]) / Number(values[i])) * 100).toFixed(1);
      const gapCY = botEdgeY + STAGE_GAP / 2;
      const chipW = Math.min(80, plotW * 0.35);

      // Chip pill background
      ctx.save();
      ctx.fillStyle = rgbCss(accent);
      ctx.beginPath();
      const chipX = cx - chipW / 2;
      const chipY = gapCY - chipH / 2;
      ctx.roundRect(chipX, chipY, chipW, chipH, chipH / 2);
      ctx.fill();
      ctx.restore();

      // Chip text
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      ctx.font = `700 ${Math.min(11, chipH * 0.55)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`↓ ${convRate}%`, cx, gapCY);
      ctx.restore();
    }
  }
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
