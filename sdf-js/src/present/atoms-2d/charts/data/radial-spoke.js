// =============================================================================
// atoms-2d/charts/data/radial-spoke.js — Radial bar / spoke chart
// -----------------------------------------------------------------------------
// 2D twin of radial-spoke-3d. Central hub + N spokes radiating in the plane,
// each spoke's length is DATA-DRIVEN by values[i], tipped with a labeled node.
// Used for radial comparison / wheel / spider-like distributions.
//
// Args:
//   values — number[] (0..1 normalized lengths, REQUIRED)
//   labels — string[]? labels at each spoke tip
//   title  — optional title (top-left)
//   colors — optional [r,g,b][] cycled per spoke
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'radial-spoke',
  category: 'charts/data',
  description: 'Radial spoke chart — hub + N data-driven spokes with labeled tips.',
  args: {
    values: { type: 'number[] (0-1)', required: true, example: [0.6, 0.9, 0.3, 0.75, 0.5, 0.8] },
    labels: { type: 'string[]?', example: ['Speed', 'Power', 'Range', 'Comfort', 'Safety', 'MPG'] },
    title: { type: 'string?', example: 'Vehicle Profile' },
    colors: { type: '[r,g,b][]?', example: [[60, 130, 200]] },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 420;
  const h = opts.h ?? 420;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const baseColors = args.colors || palette.colors || [[60, 130, 200]];
  const accent = baseColors[0];

  const values = Array.isArray(args.values)
    ? args.values.map((v) => clamp(Number(v) || 0, 0, 1))
    : [];
  const labels = Array.isArray(args.labels) ? args.labels : null;
  const N = values.length;
  if (N === 0) return;

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.06)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.12;
  }

  const cx = x + w / 2;
  const cy = plotTop + (y + h - plotTop) / 2;
  // Reserve outer ring for labels
  const labelInset = labels ? 36 : 8;
  const maxR = Math.min(w - PAD * 2, h - plotTop - PAD * 2) / 2 - labelInset;
  const hubR = maxR * 0.1;
  const nodeR = maxR * 0.06;
  const spokeW = Math.max(2, maxR * 0.04);

  // Faint outer guide ring
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.1);
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Spokes — angle from top (-π/2), clockwise
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
    const len = hubR + (maxR - hubR) * values[i];
    const ex = cx + Math.cos(a) * len;
    const ey = cy + Math.sin(a) * len;
    const color = baseColors[i % baseColors.length];

    // Spoke line
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.strokeStyle = rgbCss(color);
    ctx.lineWidth = spokeW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * hubR, cy + Math.sin(a) * hubR);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.restore();

    // Tip node
    ctx.save();
    const grad = ctx.createRadialGradient(ex - nodeR * 0.3, ey - nodeR * 0.3, 0, ex, ey, nodeR);
    grad.addColorStop(0, rgbCss(lighten(color, 0.3)));
    grad.addColorStop(1, rgbCss(color));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ex, ey, nodeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Label at outer edge
    if (labels && labels[i] != null) {
      const labelR = maxR + 18;
      const lx = cx + Math.cos(a) * labelR;
      const ly = cy + Math.sin(a) * labelR;
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `600 ${Math.round(h * 0.038)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center';
      ctx.textBaseline = Math.sin(a) > 0.3 ? 'top' : Math.sin(a) < -0.3 ? 'bottom' : 'middle';
      ctx.fillText(String(labels[i]), lx, ly);
    }

    // Per-spoke value — small dark text placed INLINE along the spoke, just
    // short of the tip node, so it never collides with the outer category
    // label (which sits beyond the tip). White halo keeps it legible over
    // the colored spoke/node.
    if (Number.isFinite(values[i])) {
      const valR = Math.max(hubR + nodeR + 6, len - nodeR - 12);
      const vx = cx + Math.cos(a) * valR;
      const vy = cy + Math.sin(a) * valR;
      const valueText = formatSpokeValue(values[i]);
      ctx.save();
      ctx.font = '700 11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.strokeText(valueText, vx, vy);
      ctx.fillStyle = rgbCss(fg);
      ctx.fillText(valueText, vx, vy);
      ctx.restore();
    }
  }

  // Hub
  ctx.save();
  const hubGrad = ctx.createRadialGradient(cx - hubR * 0.3, cy - hubR * 0.3, 0, cx, cy, hubR);
  hubGrad.addColorStop(0, rgbCss(lighten(accent, 0.3)));
  hubGrad.addColorStop(1, rgbCss(accent));
  ctx.fillStyle = hubGrad;
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.25);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// values[] are 0..1 normalized lengths — display as a percentage.
function formatSpokeValue(v) {
  return `${Math.round(v * 100)}%`;
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
