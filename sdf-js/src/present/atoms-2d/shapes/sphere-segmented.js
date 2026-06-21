// =============================================================================
// atoms-2d/shapes/sphere-segmented.js — Pie wedges (solid disc split into N)
// -----------------------------------------------------------------------------
// 2D twin of sphere-segmented-3d. Solid disc split into N pie wedges with
// gaps between them. Used for divisions / equal partition / "orange slices"
// of a whole.
//
// Distinct from:
//   - `pie` atom (data-driven proportions; uses values array)
//   - `circle-segmented` atom (donut/annulus with inner hole; equal segments)
// sphere-segmented is a SOLID disc with EQUAL wedges (count-driven) + visible
// gaps. Use it for "X parts of one whole" where each part is equal.
//
// Args:
//   segments — integer 2-12 (default 6)
//   labels   — optional string[] one per segment
//   colors   — optional [r,g,b][] cycled per segment
//   explode  — 0..0.25 radial gap (default 0.04)
//   title    — optional title (top-left)
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'sphere-segmented',
  category: 'shapes',
  description: 'Solid disc split into N equal pie wedges with radial gaps (orange-slice viz).',
  args: {
    segments: { type: 'integer 2-12', default: 6, example: 6 },
    labels: { type: 'string[]?', example: ['North', 'South', 'East', 'West'] },
    colors: { type: '[r,g,b][]?', example: [[60, 130, 200]] },
    explode: { type: 'number (0-0.25)', default: 0.04, example: 0.04 },
    title: { type: 'string?', example: 'Regions' },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 400;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const baseColors = args.colors || palette.colors || [[60, 130, 200]];

  const N = clamp(Number(args.segments ?? 6) | 0, 2, 12);
  const labels = Array.isArray(args.labels) ? args.labels : null;
  const explode = clamp(Number(args.explode ?? 0.04), 0, 0.25);

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
  const labelGutter = labels ? 30 : 4;
  const radius = Math.min(w - PAD * 2, y + h - plotTop - PAD * 2) / 2 - labelGutter;
  // explode = radial outward shift per wedge as fraction of radius
  const explodeR = radius * explode;
  const segLen = (Math.PI * 2) / N;

  for (let i = 0; i < N; i++) {
    const color = baseColors[i % baseColors.length];
    const a0 = -Math.PI / 2 + i * segLen;
    const a1 = -Math.PI / 2 + (i + 1) * segLen;
    const aMid = (a0 + a1) / 2;
    // Wedge center = origin shifted outward along bisector by explodeR
    const wx = cx + Math.cos(aMid) * explodeR;
    const wy = cy + Math.sin(aMid) * explodeR;

    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.22);
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    const grad = ctx.createRadialGradient(wx - radius * 0.3, wy - radius * 0.3, 0, wx, wy, radius);
    grad.addColorStop(0, rgbCss(lighten(color, 0.28)));
    grad.addColorStop(1, rgbCss(color));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.arc(wx, wy, radius, a0, a1, false);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Label at outer wedge midpoint
    if (labels && labels[i] != null) {
      const lr = radius + explodeR + 14;
      const lx = cx + Math.cos(aMid) * lr;
      const ly = cy + Math.sin(aMid) * lr;
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `600 ${Math.round(h * 0.04)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = Math.cos(aMid) > 0.3 ? 'left' : Math.cos(aMid) < -0.3 ? 'right' : 'center';
      ctx.textBaseline = Math.sin(aMid) > 0.3 ? 'top' : Math.sin(aMid) < -0.3 ? 'bottom' : 'middle';
      ctx.fillText(String(labels[i]), lx, ly);
    }
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
