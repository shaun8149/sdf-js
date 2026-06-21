// =============================================================================
// atoms-2d/shapes/gear.js — Iconic gear / cog
// -----------------------------------------------------------------------------
// Pseudo-3D twin of 3D gear-3d. Single 8-tooth cog with center hole, radial
// gradient body. Used for process / mechanism / settings / engineering
// metaphors.
//
// Args:
//   label — optional caption rendered below
//   color — optional [r,g,b] override (else palette.colors[0])
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'gear',
  category: 'shapes',
  description: 'Iconic 8-tooth gear with center hole + optional caption.',
  args: {
    label: { type: 'string?', example: 'Process' },
    color: { type: '[r,g,b]?', example: [200, 130, 40] },
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

  drawGear(ctx, cx, cy, size, color);

  if (label) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `600 ${Math.min(18, labelH * 0.55)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), cx, y + h - labelH / 2 - PAD / 2);
  }
}

function drawGear(ctx, cx, cy, size, color) {
  const outerR = size * 0.42;
  const innerR = outerR * 0.7;
  const teeth = 8;

  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.22);
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  const grad = ctx.createRadialGradient(cx - outerR * 0.2, cy - outerR * 0.2, 0, cx, cy, outerR);
  grad.addColorStop(0, rgbCss(lighten(color, 0.18)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;

  ctx.beginPath();
  const step = (Math.PI * 2) / (teeth * 2);
  for (let i = 0; i < teeth * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = i * step - Math.PI / 2;
    const tx = cx + Math.cos(a) * r;
    const ty = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(tx, ty);
    else ctx.lineTo(tx, ty);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Center hole
  ctx.fillStyle = rgbCss(darken(color, 0.3));
  ctx.beginPath();
  ctx.arc(cx, cy, outerR * 0.25, 0, Math.PI * 2);
  ctx.fill();
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
