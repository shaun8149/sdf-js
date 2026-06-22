// =============================================================================
// atoms-2d/shapes/circle-segmented.js — Segmented donut ring
// -----------------------------------------------------------------------------
// 2D twin of circle-segmented-3d. Annulus split into N arc segments by radial
// gaps. Used for equal share split / phases of a cycle / dial.
//
// Distinct from `pie` atom: pie uses data-driven proportions (values array);
// circle-segmented is uniformly N-segmented (count-driven), and optionally
// labeled per segment. The shape is the unit (segment), not the proportion.
//
// Args:
//   segments   — integer 2-12 (default 6)
//   labels     — optional string[] one per segment
//   colors     — optional [r,g,b][] cycled per segment
//   title      — optional title (top-left)
//   innerRatio — 0..0.9 (default 0.55) inner radius / outer radius
//   gap        — 0..0.2 (default 0.04) tangential gap between segments (in radians × fraction)
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'circle-segmented',
  category: 'shapes',
  description: 'Segmented donut ring — equal split, phases of a cycle, dial.',
  args: {
    segments: { type: 'integer 2-12', default: 6, example: 6 },
    labels: {
      type: 'string[]?',
      example: ['Discover', 'Design', 'Build', 'Test', 'Launch', 'Scale'],
    },
    colors: { type: '[r,g,b][]?', example: [[60, 130, 200]] },
    title: { type: 'string?', example: 'Process Phases' },
    innerRatio: { type: 'number (0-0.9)', default: 0.55, example: 0.55 },
    gap: { type: 'number (0-0.2)', default: 0.04, example: 0.04 },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 380;
  const h = opts.h ?? 380;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const baseColors = args.colors || palette.colors || [[60, 130, 200]];

  const N = clamp(Number(args.segments ?? 6) | 0, 2, 12);
  const labels = Array.isArray(args.labels) ? args.labels : null;
  const innerRatio = clamp(Number(args.innerRatio ?? 0.55), 0, 0.9);
  const gap = clamp(Number(args.gap ?? 0.04), 0, 0.2);

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
  const labelGutter = labels ? 32 : 4;
  const outerR = Math.min(w - PAD * 2, y + h - plotTop - PAD * 2) / 2 - labelGutter;
  const innerR = outerR * innerRatio;
  const segLen = (Math.PI * 2) / N;
  const gapAng = segLen * gap;

  // Ground shadow beneath the donut
  ctx.save();
  const shadowGrad = ctx.createRadialGradient(
    cx,
    cy + outerR * 0.08,
    outerR * 0.55,
    cx,
    cy + outerR * 0.08,
    outerR * 1.05,
  );
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.10)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + outerR * 0.08, outerR * 1.02, outerR * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  for (let i = 0; i < N; i++) {
    const color = baseColors[i % baseColors.length];
    // Start at top (-π/2), clockwise
    const a0 = -Math.PI / 2 + i * segLen + gapAng * 0.5;
    const a1 = -Math.PI / 2 + (i + 1) * segLen - gapAng * 0.5;
    const aMid = (a0 + a1) / 2;

    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.14);
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    // 3D bevel: radial gradient upper-left → lower-right (4-stop sphere-like shading)
    const gradX0 = cx + Math.cos(aMid - 0.4) * innerR;
    const gradY0 = cy + Math.sin(aMid - 0.4) * innerR;
    const gradX1 = cx + Math.cos(aMid + 0.4) * outerR;
    const gradY1 = cy + Math.sin(aMid + 0.4) * outerR;
    const grad = ctx.createLinearGradient(gradX0, gradY0, gradX1, gradY1);
    // bright upper-left → base color → darker lower-right
    grad.addColorStop(0, rgbCss(lighten(color, 0.3)));
    grad.addColorStop(0.4, rgbCss(lighten(color, 0.1)));
    grad.addColorStop(0.75, rgbCss(color));
    grad.addColorStop(1, rgbCss(darken(color, 0.12)));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, a0, a1, false);
    ctx.arc(cx, cy, innerR, a1, a0, true);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Hairline segment divider — replace thick white gap with thin alpha line
    if (gapAng < 0.01) {
      // Only draw explicit dividers when gap is tiny (nearly seamless)
      ctx.save();
      ctx.strokeStyle = rgbaCss([255, 255, 255], 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a0) * innerR, cy + Math.sin(a0) * innerR);
      ctx.lineTo(cx + Math.cos(a0) * outerR, cy + Math.sin(a0) * outerR);
      ctx.stroke();
      ctx.restore();
    }

    // Label at outer midpoint (Inter 700)
    if (labels && labels[i] != null) {
      const lr = outerR + 16;
      const lx = cx + Math.cos(aMid) * lr;
      const ly = cy + Math.sin(aMid) * lr;
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `700 ${Math.round(h * 0.04)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = Math.cos(aMid) > 0.3 ? 'left' : Math.cos(aMid) < -0.3 ? 'right' : 'center';
      ctx.textBaseline = Math.sin(aMid) > 0.3 ? 'top' : Math.sin(aMid) < -0.3 ? 'bottom' : 'middle';
      ctx.fillText(String(labels[i]), lx, ly);
    }
  }

  // Specular highlight — upper-left ellipse over the donut
  ctx.save();
  const specR = outerR * 0.38;
  const specGrad = ctx.createRadialGradient(
    cx - outerR * 0.35,
    cy - outerR * 0.35,
    0,
    cx - outerR * 0.35,
    cy - outerR * 0.35,
    specR,
  );
  specGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.ellipse(
    cx - outerR * 0.35,
    cy - outerR * 0.35,
    specR,
    specR * 0.65,
    -Math.PI / 5,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
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

function darken(rgb, amt) {
  return [
    Math.max(0, rgb[0] * (1 - amt)),
    Math.max(0, rgb[1] * (1 - amt)),
    Math.max(0, rgb[2] * (1 - amt)),
  ];
}
