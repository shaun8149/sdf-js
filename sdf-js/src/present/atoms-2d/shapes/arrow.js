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

function buildArrowPoints(stemW, stemH, headW, headH) {
  // Returns the 7-point arrow polygon centered at origin, pointing right
  return [
    [-stemW / 2, -stemH / 2],
    [stemW / 2 - headW, -stemH / 2],
    [stemW / 2 - headW, -headH / 2],
    [stemW / 2, 0],
    [stemW / 2 - headW, headH / 2],
    [stemW / 2 - headW, stemH / 2],
    [-stemW / 2, stemH / 2],
  ];
}

function drawArrow(ctx, cx, cy, size, color, direction) {
  const s = size * 0.4;
  const angleByDir = { right: 0, up: -Math.PI / 2, left: Math.PI, down: Math.PI / 2 };
  const rotation = angleByDir[direction] ?? 0;

  const stemW = s * 1.4;
  const stemH = s * 0.4;
  const headW = s * 0.6;
  const headH = s * 0.8;

  const depth = s * 0.18; // extrusion depth

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  // ── 1) Drop shadow ──────────────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.2);
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = depth * 0.5;
  ctx.shadowOffsetY = depth * 1.0;
  ctx.fillStyle = rgbaCss([0, 0, 0], 0);
  const pts = buildArrowPoints(stemW, stemH, headW, headH);
  ctx.beginPath();
  ctx.moveTo(pts[0][0] + depth, pts[0][1] + depth);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0] + depth, pts[i][1] + depth);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ── 2) Extrusion side wall (bottom-right offset copy, darker) ───────────────
  ctx.save();
  ctx.fillStyle = rgbCss(darken(color, 0.28));
  const pts2 = buildArrowPoints(stemW, stemH, headW, headH);
  ctx.beginPath();
  ctx.moveTo(pts2[0][0] + depth, pts2[0][1] + depth);
  for (let i = 1; i < pts2.length; i++) {
    ctx.lineTo(pts2[i][0] + depth, pts2[i][1] + depth);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ── 3) Front face with vertical gradient ────────────────────────────────────
  const gradient = ctx.createLinearGradient(0, -headH / 2, 0, headH / 2);
  gradient.addColorStop(0, rgbCss(lighten(color, 0.22)));
  gradient.addColorStop(0.45, rgbCss(color));
  gradient.addColorStop(1, rgbCss(darken(color, 0.12)));
  ctx.fillStyle = gradient;

  const pts3 = buildArrowPoints(stemW, stemH, headW, headH);
  ctx.beginPath();
  ctx.moveTo(pts3[0][0], pts3[0][1]);
  for (let i = 1; i < pts3.length; i++) {
    ctx.lineTo(pts3[i][0], pts3[i][1]);
  }
  ctx.closePath();
  ctx.fill();

  // Thin edge stroke for definition
  ctx.strokeStyle = rgbaCss(darken(color, 0.42), 0.5);
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // ── 4) Specular highlight strip along top edge ───────────────────────────────
  ctx.save();
  ctx.strokeStyle = rgbaCss([255, 255, 255], 0.3);
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Top edge of stem (left to where stem meets head shoulder)
  ctx.moveTo(-stemW / 2 + 4, -stemH / 2 + 1);
  ctx.lineTo(stemW / 2 - headW - 2, -stemH / 2 + 1);
  ctx.stroke();
  // Top edge of head (shoulder down-left to tip)
  ctx.beginPath();
  ctx.moveTo(stemW / 2 - headW + 2, -headH / 2 + 2);
  ctx.lineTo(stemW / 2 - 3, 0);
  ctx.stroke();
  ctx.restore();

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
