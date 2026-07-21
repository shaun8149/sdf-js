// =============================================================================
// atoms-2d/shapes/cube.js — Iconic isometric cube
// -----------------------------------------------------------------------------
// Pseudo-3D twin of 3D cube-3d. Single isometric cube rendered at large
// scale as decorative/iconic content (e.g. cube + "Product"). Three visible
// faces with brightness gradient (top lightest, right darkest).
//
// Args:
//   label — optional caption rendered below
//   color — optional [r,g,b] override (else palette.colors[0])
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'cube',
  category: 'shapes',
  description:
    'Iconic isometric cube (3 visible faces, brightness gradient) with optional caption.',
  args: {
    label: { type: 'string?', example: 'Product' },
    color: { type: '[r,g,b]?', example: [60, 100, 200] },
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

  drawCube(ctx, cx, cy, size, color);

  if (label) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `600 ${Math.min(18, labelH * 0.55)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), cx, y + h - labelH / 2 - PAD / 2);
  }
}

function drawCube(ctx, cx, cy, size, color) {
  // True isometric cube: r = half-edge projected length
  // In isometric view: top face is a lozenge, left+right faces are parallelograms.
  // Each face is equal in apparent area (classic isometric illusion).
  //
  // Geometry: cube edge length e in isometric:
  //   dx (horizontal half-span) = e * cos(30°) = e * √3/2
  //   dy_top (top face height)  = e * sin(30°) = e * 0.5
  //   dy_side (side face height) = e  (vertical cube edge)
  //
  // We want the total visible height ≈ size * 0.80, total width ≈ size * 0.80
  // Total width = 2 * dx = e * √3 ≈ 1.732e  → e ≈ size * 0.80 / 1.732
  // We center cube so top-peak is above center and bottom is below center.

  const e = size * 0.44; // edge length
  const dx = e * Math.cos(Math.PI / 6); // ≈ e * 0.866, horizontal projection
  const dyT = e * Math.sin(Math.PI / 6); // ≈ e * 0.5, top lozenge rise
  const dyS = e; // side face height (vertical edge)

  // Cube vertices in isometric:
  //   Top peak:           (cx,       cy - dyT - dyS/2)
  //   Top-left corner:    (cx - dx,  cy - dyS/2)
  //   Top-right corner:   (cx + dx,  cy - dyS/2)
  //   Center bottom:      (cx,       cy + dyT - dyS/2)
  //   Left bottom:        (cx - dx,  cy - dyS/2 + dyS) = (cx - dx, cy + dyS/2)
  //   Right bottom:       (cx + dx,  cy + dyS/2)
  //   Bottom peak:        (cx,       cy + dyT + dyS/2)

  // Shift so cube is centered vertically in available area
  const midOff = dyT / 2; // push up slightly so visual center is at cy
  const ty = cy - midOff; // adjusted vertical center

  const topPeak = { x: cx, y: ty - dyT - dyS / 2 };
  const topLeft = { x: cx - dx, y: ty - dyS / 2 };
  const topRight = { x: cx + dx, y: ty - dyS / 2 };
  const centerMid = { x: cx, y: ty + dyT - dyS / 2 };
  const botLeft = { x: cx - dx, y: ty + dyS / 2 };
  const botRight = { x: cx + dx, y: ty + dyS / 2 };
  const botPeak = { x: cx, y: ty + dyT + dyS / 2 };

  // Ground shadow ellipse (drawn first, behind all faces)
  ctx.save();
  ctx.filter = 'blur(10px)';
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.beginPath();
  ctx.ellipse(cx, botPeak.y + 6, dx * 0.9, dyT * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  // Right-front face (shadow side — slightly darker)
  ctx.fillStyle = rgbCss(darken(color, 0.15));
  ctx.beginPath();
  ctx.moveTo(centerMid.x, centerMid.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(botRight.x, botRight.y);
  ctx.lineTo(botPeak.x, botPeak.y);
  ctx.closePath();
  ctx.fill();

  // Left-front face (mid-tone — base color)
  ctx.fillStyle = rgbCss(color);
  ctx.beginPath();
  ctx.moveTo(centerMid.x, centerMid.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.lineTo(botLeft.x, botLeft.y);
  ctx.lineTo(botPeak.x, botPeak.y);
  ctx.closePath();
  ctx.fill();

  // Top face (brightest — light from above)
  ctx.fillStyle = rgbCss(lighten(color, 0.3));
  ctx.beginPath();
  ctx.moveTo(topPeak.x, topPeak.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.lineTo(centerMid.x, centerMid.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.closePath();
  ctx.fill();

  // Subtle edge outlines to crisp up the 3D look
  ctx.strokeStyle = rgbaCss(darken(color, 0.2), 0.5);
  ctx.lineWidth = 0.5;
  // Top ridge lines
  ctx.beginPath();
  ctx.moveTo(topPeak.x, topPeak.y);
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.lineTo(centerMid.x, centerMid.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(topPeak.x, topPeak.y);
  ctx.stroke();
  // Vertical left/right edges
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(botLeft.x, botLeft.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(topRight.x, topRight.y);
  ctx.lineTo(botRight.x, botRight.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerMid.x, centerMid.y);
  ctx.lineTo(botPeak.x, botPeak.y);
  ctx.stroke();

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
