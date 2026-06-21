// =============================================================================
// atoms-2d/shapes/circle-loop.js — Cycle / loop arrows around a ring
// -----------------------------------------------------------------------------
// 2D twin of circle-loop-3d. A ring + N arrowheads tangent around it forming
// a clockwise cycle. Used for PDCA / lifecycle / process cycle / iteration.
//
// Args:
//   segments — integer 2-8 (number of arrowheads, default 4)
//   labels   — optional string[] (one per segment, placed between arrows)
//   title    — optional title (top-left)
//   color    — optional [r,g,b] override
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'circle-loop',
  category: 'shapes',
  description: 'Loop arrows around a ring — PDCA, lifecycle, process cycle, iteration.',
  args: {
    segments: { type: 'integer 2-8', default: 4, example: 4 },
    labels: { type: 'string[]?', example: ['Plan', 'Do', 'Check', 'Act'] },
    title: { type: 'string?', example: 'PDCA Cycle' },
    color: { type: '[r,g,b]?', example: [60, 130, 200] },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 360;
  const h = opts.h ?? 360;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const color = args.color || palette.colors?.[0] || [60, 130, 200];

  const N = clamp(Number(args.segments ?? 4) | 0, 2, 8);
  const labels = Array.isArray(args.labels) ? args.labels : null;

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
  const labelGutter = labels ? 28 : 0;
  const radius = Math.min(w - PAD * 2, y + h - plotTop - PAD * 2) / 2 - labelGutter;
  const tube = Math.max(4, radius * 0.08);
  const headLen = radius * 0.32;
  const headW = radius * 0.18;
  const gapAng = headLen / radius + 0.1; // angular gap between segments for arrowhead

  // Draw N arc segments + arrowheads, going clockwise from top
  for (let i = 0; i < N; i++) {
    const segLen = (Math.PI * 2) / N;
    // start angle from top (-π/2), clockwise
    const a0 = -Math.PI / 2 + i * segLen + gapAng * 0.5;
    const a1 = -Math.PI / 2 + (i + 1) * segLen - gapAng * 0.5;

    // Arc segment
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    ctx.strokeStyle = rgbCss(color);
    ctx.lineWidth = tube;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, a0, a1, false);
    ctx.stroke();
    ctx.restore();

    // Arrowhead at end of arc, pointing tangentially clockwise
    const ax = cx + Math.cos(a1) * radius;
    const ay = cy + Math.sin(a1) * radius;
    const tangentAng = a1 + Math.PI / 2; // clockwise tangent
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(tangentAng);
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    const grad = ctx.createLinearGradient(0, -headW, 0, headW);
    grad.addColorStop(0, rgbCss(lighten(color, 0.2)));
    grad.addColorStop(1, rgbCss(darken(color, 0.05)));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -headW);
    ctx.lineTo(headLen, 0);
    ctx.lineTo(0, headW);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Label outside the segment midpoint
    if (labels && labels[i] != null) {
      const aMid = (a0 + a1) / 2;
      const lr = radius + tube + 18;
      const lx = cx + Math.cos(aMid) * lr;
      const ly = cy + Math.sin(aMid) * lr;
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `600 ${Math.round(h * 0.045)}px Inter, system-ui, sans-serif`;
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

function darken(rgb, amt) {
  return [
    Math.max(0, rgb[0] * (1 - amt)),
    Math.max(0, rgb[1] * (1 - amt)),
    Math.max(0, rgb[2] * (1 - amt)),
  ];
}
