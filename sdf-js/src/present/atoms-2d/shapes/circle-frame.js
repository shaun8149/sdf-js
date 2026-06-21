// =============================================================================
// atoms-2d/shapes/circle-frame.js — Round photo / avatar frame
// -----------------------------------------------------------------------------
// 2D twin of circle-frame-3d. A circular ring frame around a backing disk
// (or an open ring). Used as team / profile / "drop image here" placeholder.
//
// Args:
//   label — optional center text (e.g. initials "JC" or a short caption)
//   color — optional ring color [r,g,b] (else palette.colors[0])
//   back  — boolean (default true); when false renders open ring only
//   title — optional title (top-left)
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'circle-frame',
  category: 'shapes',
  description: 'Round photo / avatar frame — ring + optional backing disk + center label.',
  args: {
    label: { type: 'string?', example: 'JC' },
    color: { type: '[r,g,b]?', example: [60, 130, 200] },
    back: { type: 'boolean', default: true, example: true },
    title: { type: 'string?', example: 'Jane Chen' },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 280;
  const h = opts.h ?? 280;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const color = args.color || palette.colors?.[0] || [60, 130, 200];
  const back = args.back !== false;

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.06)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.13;
  }

  const cx = x + w / 2;
  const cy = plotTop + (y + h - plotTop) / 2;
  const outerR = Math.min(w - PAD * 2, y + h - plotTop - PAD * 2) / 2;
  const frameW = outerR * 0.14;
  const innerR = outerR - frameW;

  // Soft drop shadow under the disk
  ctx.save();
  const fGrad = ctx.createRadialGradient(
    cx,
    cy + outerR * 0.85,
    1,
    cx,
    cy + outerR * 0.85,
    outerR * 0.75,
  );
  fGrad.addColorStop(0, rgbaCss([0, 0, 0], 0.22));
  fGrad.addColorStop(1, rgbaCss([0, 0, 0], 0));
  ctx.fillStyle = fGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + outerR * 0.85, outerR * 0.75, outerR * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Backing disk (filled, gradient interior)
  if (back) {
    ctx.save();
    const bg = ctx.createRadialGradient(cx - innerR * 0.3, cy - innerR * 0.3, 0, cx, cy, innerR);
    bg.addColorStop(0, rgbCss(lighten(color, 0.35)));
    bg.addColorStop(1, rgbCss(color));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Ring frame (outer stroke band)
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.strokeStyle = rgbCss(darken(color, 0.12));
  ctx.lineWidth = frameW;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR - frameW / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Subtle inner highlight (upper-left)
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = rgbCss(lighten(color, 0.4));
  ctx.lineWidth = frameW * 0.35;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR - frameW * 0.3, Math.PI * 0.85, Math.PI * 1.55, false);
  ctx.stroke();
  ctx.restore();

  // Center label
  if (args.label) {
    ctx.fillStyle = back ? 'white' : rgbCss(fg);
    const fontSize = Math.min(outerR * 0.75, h * 0.32);
    ctx.font = `700 ${Math.round(fontSize)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(args.label), cx, cy);
  }
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
