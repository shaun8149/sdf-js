// =============================================================================
// atoms-2d/charts/data/donut-with-center.js — Donut Chart with Center Metric
// -----------------------------------------------------------------------------
// Donut/ring chart with a prominent center hero metric (single large KPI value)
// and breakdown segments. Different from pie.js (which is filled slices — this
// is a ring with a large centered value). Used for ARR breakdown, headcount by
// region, budget allocation.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'donut-with-center',
  category: 'charts/data',
  description:
    'Donut chart with prominent center metric — single hero KPI + breakdown segments around it.',
  args: {
    title: { type: 'string?', example: 'Revenue Breakdown' },
    centerValue: { type: 'string', required: true, example: '$24M' },
    centerLabel: { type: 'string?', example: 'Total ARR' },
    segments: {
      type: 'array',
      required: true,
      example: [
        { label: 'Enterprise', value: 12 },
        { label: 'Mid-market', value: 8 },
        { label: 'SMB', value: 4 },
      ],
    },
    showPct: { type: 'boolean?', default: true },
  },
};

const TITLE_FRAC = 0.12;
const PAD = 14;
const FALLBACK_COLORS = [
  [80, 130, 200],
  [60, 170, 120],
  [200, 100, 60],
  [170, 80, 160],
  [200, 160, 40],
  [120, 160, 200],
  [200, 130, 130],
];

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const accent = palette.colors?.[0] || [80, 130, 200];
  const colors = palette.colors || FALLBACK_COLORS;

  const title = args.title;
  const centerValue = String(args.centerValue || '');
  const centerLabel = args.centerLabel;
  const segments = Array.isArray(args.segments) ? args.segments.slice(0, 7) : [];
  const showPct = args.showPct !== false;

  if (segments.length === 0) return;

  // Background
  const bgColor = palette.bg ? rgbCss(palette.bg) : '#fafaf8';
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);

  // Title
  let plotTop = y + PAD;
  if (title) {
    const titleH = Math.round(h * TITLE_FRAC);
    const titleSize = Math.min(24, Math.max(16, Math.round(titleH * 0.55)));
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + PAD, y + titleH / 2);
    plotTop = y + titleH;
  }

  // Layout: donut on left side, legend on right
  const plotH = h - (plotTop - y) - PAD;
  const legendW = Math.round(w * 0.38);
  const donutArea = { x: x + PAD, y: plotTop, w: w - legendW - PAD * 2, h: plotH };

  // Donut geometry
  const outerR = Math.min(donutArea.w / 2, donutArea.h / 2) - PAD;
  const innerR = outerR * 0.55;
  const cx = donutArea.x + donutArea.w / 2;
  const cy = donutArea.y + donutArea.h / 2;

  // Compute segment angles
  const total = segments.reduce((s, seg) => s + (Number(seg.value) || 0), 0);
  if (total <= 0) return;

  let currentAngle = -Math.PI / 2;
  const segData = segments.map((seg, i) => {
    const v = Number(seg.value) || 0;
    const frac = v / total;
    const startA = currentAngle;
    const endA = currentAngle + frac * Math.PI * 2;
    currentAngle = endA;
    const color = seg.color
      ? Array.isArray(seg.color)
        ? seg.color
        : colors[i % colors.length]
      : colors[i % colors.length];
    return { ...seg, frac, startA, endA, midA: (startA + endA) / 2, color };
  });

  // Drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = rgbCss(fg);
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw segments
  for (const seg of segData) {
    // Segment arc (outer ring only — donut)
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, rgbCss(lighten(seg.color, 0.08)));
    grad.addColorStop(1, rgbCss(seg.color));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(seg.startA) * innerR, cy + Math.sin(seg.startA) * innerR);
    ctx.arc(cx, cy, outerR, seg.startA, seg.endA);
    ctx.arc(cx, cy, innerR, seg.endA, seg.startA, true);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Separator
    ctx.save();
    ctx.strokeStyle = bgColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(seg.endA) * innerR, cy + Math.sin(seg.endA) * innerR);
    ctx.lineTo(cx + Math.cos(seg.endA) * outerR, cy + Math.sin(seg.endA) * outerR);
    ctx.stroke();
    ctx.restore();
  }

  // Donut center hole fill
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();

  // Center value (hero text)
  let valueFontSize = Math.min(Math.round(innerR * 0.62), Math.round(w * 0.07));
  ctx.fillStyle = rgbCss(accent);
  ctx.font = `900 ${valueFontSize}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = centerLabel ? 'bottom' : 'middle';

  // Auto-shrink if too wide
  while (valueFontSize > 10 && ctx.measureText(centerValue).width > innerR * 1.6) {
    valueFontSize--;
    ctx.font = `900 ${valueFontSize}px Inter, sans-serif`;
  }
  ctx.fillText(centerValue, cx, centerLabel ? cy - 2 : cy);

  if (centerLabel) {
    const labelFontSize = Math.min(Math.round(innerR * 0.22), 14);
    ctx.fillStyle = rgbaCss(fg, 0.55);
    ctx.font = `700 ${labelFontSize}px Inter, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(centerLabel, cx, cy + 4);
  }

  // Legend
  const legendX = x + w - legendW;
  const legendY = plotTop + PAD;
  const rowH = Math.min(36, (plotH - PAD * 2) / Math.max(1, segments.length));
  const dotR = Math.min(7, rowH * 0.22);
  const legendFontSize = Math.min(13, Math.round(rowH * 0.36));

  for (let i = 0; i < segData.length; i++) {
    const seg = segData[i];
    const ly = legendY + i * rowH;

    // Color dot
    ctx.fillStyle = rgbCss(seg.color);
    ctx.beginPath();
    ctx.arc(legendX + dotR, ly + rowH / 2, dotR, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = rgbaCss(fg, 0.9);
    ctx.font = `700 ${legendFontSize}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const pctText = showPct ? ` ${Math.round(seg.frac * 100)}%` : '';
    let legendText = String(seg.label || '') + pctText;
    const maxLW = legendW - dotR * 2 - 10;
    while (legendText.length > 3 && ctx.measureText(legendText).width > maxLW) {
      legendText = legendText.slice(0, -1);
    }
    ctx.fillText(legendText, legendX + dotR * 2 + 6, ly + rowH / 2);
  }
}
