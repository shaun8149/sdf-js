// =============================================================================
// atoms-2d/charts/data/gauge.js — KPI gauge / speedometer dial
// -----------------------------------------------------------------------------
// 2D twin of gauge-3d. Semicircular arc + needle pointing to a 0..1 value +
// center hub + big value label. Used for KPI dashboards / cockpit charts /
// scores / utilization.
//
// Args:
//   value  — number 0..1 (needle position, REQUIRED)
//   label  — optional display label below value (e.g. "Utilization")
//   format — 'percent'|'number' (default 'percent', shows value × 100 with %)
//   title  — optional title (top-left)
//   min    — optional axis min label (left tick)
//   max    — optional axis max label (right tick)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'gauge',
  category: 'charts/data',
  description: 'KPI gauge / speedometer dial — arc + needle + center value (0..1).',
  args: {
    value: { type: 'number (0-1)', required: true, example: 0.7 },
    label: { type: 'string?', example: 'Utilization' },
    format: { type: "'percent'|'number'", default: 'percent', example: 'percent' },
    title: { type: 'string?', example: 'Server Load' },
    min: { type: 'string?', example: '0' },
    max: { type: 'string?', example: '100' },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 320;
  const h = opts.h ?? 240;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || [60, 130, 200];

  const value = clamp(Number(args.value ?? 0), 0, 1);
  const format = args.format || 'percent';
  const title = args.title;
  const label = args.label;

  let plotTop = y + PAD;
  if (title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.08)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * 0.16;
  }

  const cx = x + w / 2;
  const arcRadius = Math.min((w - PAD * 2) / 2, h - plotTop - PAD * 2);
  const cy = plotTop + arcRadius + PAD * 0.4;
  const tube = arcRadius * 0.13;

  // Track arc (full semicircle, dimmed)
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.12);
  ctx.lineWidth = tube;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, arcRadius, Math.PI, 0, false);
  ctx.stroke();
  ctx.restore();

  // Filled arc (from left to value)
  const endAngle = Math.PI + value * Math.PI;
  ctx.save();
  const grad = ctx.createLinearGradient(cx - arcRadius, cy, cx + arcRadius, cy);
  grad.addColorStop(0, rgbCss(lighten(accent, 0.2)));
  grad.addColorStop(1, rgbCss(accent));
  ctx.strokeStyle = grad;
  ctx.lineWidth = tube;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, arcRadius, Math.PI, endAngle, false);
  ctx.stroke();
  ctx.restore();

  // Needle (pointing to value angle, from hub outward)
  const needleAng = Math.PI + value * Math.PI;
  const needleLen = arcRadius * 0.92;
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.25);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.strokeStyle = rgbCss(fg);
  ctx.lineWidth = Math.max(2, tube * 0.32);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needleAng) * needleLen, cy + Math.sin(needleAng) * needleLen);
  ctx.stroke();
  ctx.restore();

  // Hub (center dot)
  ctx.fillStyle = rgbCss(fg);
  ctx.beginPath();
  ctx.arc(cx, cy, tube * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Min / max tick labels
  const tickFont = `500 ${Math.round(h * 0.05)}px Inter, system-ui, sans-serif`;
  if (args.min) {
    ctx.fillStyle = rgbaCss(fg, 0.65);
    ctx.font = tickFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.min), cx - arcRadius, cy + tube * 0.8);
  }
  if (args.max) {
    ctx.fillStyle = rgbaCss(fg, 0.65);
    ctx.font = tickFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.max), cx + arcRadius, cy + tube * 0.8);
  }

  // Big value text (below hub, inside the arc)
  const valueText = format === 'percent' ? `${Math.round(value * 100)}%` : String(value.toFixed(2));
  ctx.fillStyle = rgbCss(fg);
  ctx.font = `700 ${Math.round(h * 0.18)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(valueText, cx, cy + tube * 1.6);

  // Optional sub-label
  if (label) {
    ctx.fillStyle = rgbaCss(fg, 0.7);
    ctx.font = `500 ${Math.round(h * 0.06)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(label), cx, cy + tube * 1.6 + h * 0.2);
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
