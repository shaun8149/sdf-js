// =============================================================================
// atoms-2d/shapes/arrow.js — Iconic directional arrow
// -----------------------------------------------------------------------------
// Pseudo-3D twin of 3D arrow-3d. Single large arrow rendered as decorative/
// iconic content (e.g. arrow + "+127% Growth"). Direction param.
//
// Args:
//   label     — optional caption rendered below
//   color     — optional [r,g,b] override (else palette.colors[0])
//   direction — 'right' | 'up' | 'left' | 'down' (default 'right')
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'arrow',
  category: 'shapes',
  description: 'Iconic directional arrow with gradient body + optional caption.',
  args: {
    label: { type: 'string?', example: '+127% Growth' },
    color: { type: '[r,g,b]?', example: [40, 160, 100] },
    direction: { type: "'right'|'up'|'left'|'down'", default: 'right', example: 'up' },
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

  drawArrow(ctx, cx, cy, size, color, args.direction || 'right');

  if (label) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `600 ${Math.min(18, labelH * 0.55)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), cx, y + h - labelH / 2 - PAD / 2);
  }
}

function drawArrow(ctx, cx, cy, size, color, direction) {
  const s = size * 0.4;
  const angleByDir = { right: 0, up: -Math.PI / 2, left: Math.PI, down: Math.PI / 2 };
  const rotation = angleByDir[direction] ?? 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.25);
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;

  const stemW = s * 1.4;
  const stemH = s * 0.4;
  const headW = s * 0.6;
  const headH = s * 0.8;

  const gradient = ctx.createLinearGradient(0, -headH / 2, 0, headH / 2);
  gradient.addColorStop(0, rgbCss(lighten(color, 0.18)));
  gradient.addColorStop(1, rgbCss(color));
  ctx.fillStyle = gradient;

  ctx.beginPath();
  ctx.moveTo(-stemW / 2, -stemH / 2);
  ctx.lineTo(stemW / 2 - headW, -stemH / 2);
  ctx.lineTo(stemW / 2 - headW, -headH / 2);
  ctx.lineTo(stemW / 2, 0);
  ctx.lineTo(stemW / 2 - headW, headH / 2);
  ctx.lineTo(stemW / 2 - headW, stemH / 2);
  ctx.lineTo(-stemW / 2, stemH / 2);
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
