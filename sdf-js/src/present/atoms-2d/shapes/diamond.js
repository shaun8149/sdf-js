// =============================================================================
// atoms-2d/shapes/diamond.js — Iconic diamond / rhombus
// -----------------------------------------------------------------------------
// Pseudo-3D twin of 3D diamond-3d. Rotated square with right-face/left-face
// shading (gem facet feel). Used for premium / value / quality metaphors.
//
// Args:
//   label — optional caption rendered below
//   color — optional [r,g,b] override (else palette.colors[0])
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'diamond',
  category: 'shapes',
  description: 'Iconic diamond / rhombus with gem-facet shading + optional caption.',
  args: {
    label: { type: 'string?', example: 'Premium' },
    color: { type: '[r,g,b]?', example: [180, 60, 180] },
  },
};

const PAD = 14;
const LABEL_FRAC = 0.18;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 240;
  const h = opts.h ?? 240;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const color = args.color || palette.colors?.[0] || [60, 100, 200];
  const label = args.label;

  const labelH = label ? h * LABEL_FRAC : 0;
  const shapeAreaW = w - PAD * 2;
  const shapeAreaH = h - PAD * 2 - labelH;
  const cx = x + w / 2;
  const cy = y + PAD + shapeAreaH / 2;
  const size = Math.min(shapeAreaW, shapeAreaH);

  drawDiamond(ctx, cx, cy, size, color);

  if (label) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `600 ${Math.min(18, labelH * 0.55)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), cx, y + h - labelH / 2 - PAD / 2);
  }
}

function drawDiamond(ctx, cx, cy, size, color) {
  const s = size * 0.42;
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.25);
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;

  // Right face (darker)
  ctx.fillStyle = rgbCss(darken(color, 0.18));
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s, cy);
  ctx.lineTo(cx, cy + s);
  ctx.closePath();
  ctx.fill();

  // Left face (lighter)
  ctx.fillStyle = rgbCss(lighten(color, 0.12));
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx - s, cy);
  ctx.lineTo(cx, cy + s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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
