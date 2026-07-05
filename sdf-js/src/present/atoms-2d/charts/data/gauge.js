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

  // Background
  const bgColor = palette.bg ? rgbCss(palette.bg) : '#fafaf8';
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);

  let plotTop = y + PAD;
  if (title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.075)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * 0.16;
  }

  // Reserve room BELOW the dial for the big value readout (+ optional label)
  // before sizing the arc — previously arcRadius greedily ate the full
  // remaining height, pushing the value text (and the pivot itself) off the
  // bottom of the canvas entirely ("no value shown", "pivot displaced").
  const valueFs = Math.round(h * 0.2);
  const labelFs = Math.round(h * 0.055);
  const valueGap = h * 0.05;
  const labelGap = h * 0.02;
  const bottomBlockH =
    valueGap + valueFs * 1.15 + (label ? labelGap + labelFs * 1.2 : 0) + PAD * 0.5;

  const cx = x + w / 2;
  const maxRadiusW = (w - PAD * 2) / 2;
  const maxRadiusH = y + h - PAD - bottomBlockH - plotTop;
  const arcRadius = Math.max(20, Math.min(maxRadiusW, maxRadiusH));
  const cy = plotTop + arcRadius;
  // Arc thickness: 14–16% of radius
  const tube = arcRadius * 0.15;

  // Background arc (full 180°): rgba(0,0,0,0.06) light gray
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = tube;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, arcRadius, Math.PI, 0, false);
  ctx.stroke();
  ctx.restore();

  // Foreground arc: palette.colors[0] with subtle gradient (lighten 0.08)
  const endAngle = Math.PI + value * Math.PI;
  ctx.save();
  const grad = ctx.createLinearGradient(cx - arcRadius, cy, cx + arcRadius, cy);
  grad.addColorStop(0, rgbCss(lighten(accent, 0.08)));
  grad.addColorStop(1, rgbCss(accent));
  ctx.strokeStyle = grad;
  ctx.lineWidth = tube;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, arcRadius, Math.PI, endAngle, false);
  ctx.stroke();
  ctx.restore();

  // Needle: thin 2–3px with center pivot dot (PL style minimal)
  const needleAng = Math.PI + value * Math.PI;
  const needleLen = arcRadius * 0.78;
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.12);
  ctx.shadowBlur = 4;
  ctx.strokeStyle = rgbCss(fg);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needleAng) * needleLen, cy + Math.sin(needleAng) * needleLen);
  ctx.stroke();
  ctx.restore();

  // Center pivot dot
  ctx.save();
  ctx.fillStyle = rgbCss(fg);
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(3, tube * 0.28), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Min / max tick labels
  const tickFont = `500 ${Math.round(h * 0.048)}px Inter, system-ui, sans-serif`;
  if (args.min) {
    ctx.fillStyle = rgbaCss(fg, 0.55);
    ctx.font = tickFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.min), cx - arcRadius, cy + tube * 0.8);
  }
  if (args.max) {
    ctx.fillStyle = rgbaCss(fg, 0.55);
    ctx.font = tickFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.max), cx + arcRadius, cy + tube * 0.8);
  }

  // Big value text: Inter 900, large, centered below the pivot in the
  // reserved bottomBlockH budget (see above — always on-canvas).
  const valueText = format === 'percent' ? `${Math.round(value * 100)}%` : String(value.toFixed(2));
  const valueY = cy + valueGap;
  ctx.fillStyle = rgbCss(fg);
  ctx.font = `900 ${valueFs}px "Inter Display", Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(valueText, cx, valueY);

  // Sublabel: Inter 500, small, below value
  if (label) {
    ctx.fillStyle = rgbaCss(fg, 0.6);
    ctx.font = `500 ${labelFs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(label), cx, valueY + valueFs * 1.15 + labelGap);
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
