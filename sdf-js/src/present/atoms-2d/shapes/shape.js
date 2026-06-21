// =============================================================================
// atoms-2d/shapes/shape.js — Iconic decorative shapes
// -----------------------------------------------------------------------------
// 13th atom in 2D vector library (Phase 3).
//
// Semantic: standalone iconic shape rendered at large scale, used as
// decorative/iconic content (e.g. big arrow + "+127% growth", cube +
// "Product", cylinder + "Database").
//
// Single atom with `kind` param (vs. 6 separate atom files) because all
// kinds are simple parameterized Canvas2D paths sharing the same pseudo-3D
// treatment (gradient + shadow + iso edge accent).
//
// Args:
//   kind   — 'cube' | 'sphere' | 'diamond' | 'arrow' | 'gear' | 'cylinder'
//   label  — optional caption rendered below or inside the shape
//   color  — optional color override (rgb tuple); else uses palette.colors[0]
//   direction — for 'arrow' kind: 'right' | 'up' | 'left' | 'down' (default 'right')
//
// Render: pseudo-3D
//   - Each kind uses gradient + drop shadow + iso edge accent
//   - Cube: isometric projection (3 visible faces with different brightness)
//   - Sphere: radial gradient circle (lit from upper-left)
//   - Diamond: rotated square with gradient + iso edge
//   - Arrow: big arrowhead pointing direction, gradient body
//   - Gear: 8-tooth cog with center hole
//   - Cylinder: oval top + rect body (database-like)
//
// Per [[atlas-sprint14-finance-preset-plan]] — shape primitives for
// decorative composition.
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const SHAPE_KINDS = ['cube', 'sphere', 'diamond', 'arrow', 'gear', 'cylinder'];

export const spec = {
  type: 'shape',
  category: 'shapes',
  description:
    'Iconic decorative shape (cube/sphere/diamond/arrow/gear/cylinder) at large scale with optional caption.',
  args: {
    kind: { type: SHAPE_KINDS.join('|'), required: true, example: 'cube' },
    label: { type: 'string?', example: 'Product' },
    color: { type: '[r,g,b]?', example: [60, 100, 200] },
    direction: { type: "'right'|'up'|'left'|'down'", default: 'right', example: 'right' },
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
  const kind = args.kind || 'cube';
  const label = args.label;

  // Reserve bottom for label if present
  const labelH = label ? h * LABEL_FRAC : 0;
  const shapeArea = { x: x + PAD, y: y + PAD, w: w - PAD * 2, h: h - PAD * 2 - labelH };
  const cx = shapeArea.x + shapeArea.w / 2;
  const cy = shapeArea.y + shapeArea.h / 2;
  const size = Math.min(shapeArea.w, shapeArea.h);

  // Dispatch by kind
  switch (kind) {
    case 'cube':
      drawCube(ctx, cx, cy, size, color);
      break;
    case 'sphere':
      drawSphere(ctx, cx, cy, size, color);
      break;
    case 'diamond':
      drawDiamond(ctx, cx, cy, size, color);
      break;
    case 'arrow':
      drawArrow(ctx, cx, cy, size, color, args.direction || 'right');
      break;
    case 'gear':
      drawGear(ctx, cx, cy, size, color);
      break;
    case 'cylinder':
      drawCylinder(ctx, cx, cy, size, color);
      break;
    default:
      drawCube(ctx, cx, cy, size, color); // graceful fallback
  }

  // Label below
  if (label) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `600 ${Math.min(18, labelH * 0.55)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), cx, y + h - labelH / 2 - PAD / 2);
  }
}

// ============================================================================
// Shape implementations
// ============================================================================

function drawCube(ctx, cx, cy, size, color) {
  // Isometric cube: 3 faces visible (top, left, right)
  const s = size * 0.42; // cube half-edge
  const angle = Math.PI / 6; // 30° iso angle
  const dx = Math.cos(angle) * s;
  const dy = Math.sin(angle) * s;

  // Drop shadow first
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.25);
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;

  // Right face (darkest)
  ctx.fillStyle = rgbCss(darken(color, 0.2));
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + dx, cy - dy);
  ctx.lineTo(cx + dx, cy - dy + s * 2);
  ctx.lineTo(cx, cy + s * 2);
  ctx.closePath();
  ctx.fill();

  // Left face (medium)
  ctx.fillStyle = rgbCss(color);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - dx, cy - dy);
  ctx.lineTo(cx - dx, cy - dy + s * 2);
  ctx.lineTo(cx, cy + s * 2);
  ctx.closePath();
  ctx.fill();

  // Top face (lightest)
  ctx.fillStyle = rgbCss(lighten(color, 0.2));
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - dx, cy - dy);
  ctx.lineTo(cx, cy - dy * 2);
  ctx.lineTo(cx + dx, cy - dy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSphere(ctx, cx, cy, size, color) {
  const r = size * 0.42;
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.28);
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;

  // Radial gradient lit from upper-left
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  grad.addColorStop(0, rgbCss(lighten(color, 0.4)));
  grad.addColorStop(1, rgbCss(darken(color, 0.1)));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Specular highlight (small light spot upper-left)
  ctx.save();
  ctx.globalAlpha = 0.35;
  const hg = ctx.createRadialGradient(
    cx - r * 0.35,
    cy - r * 0.35,
    r * 0.02,
    cx - r * 0.35,
    cy - r * 0.35,
    r * 0.35,
  );
  hg.addColorStop(0, 'rgba(255,255,255,1)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDiamond(ctx, cx, cy, size, color) {
  const s = size * 0.42;
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.25);
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;

  // Diamond body (rotated square): right half darker, left half lighter
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

function drawArrow(ctx, cx, cy, size, color, direction) {
  // Arrow pointing in direction (default 'right')
  const s = size * 0.4;
  const angleByDir = { right: 0, up: -Math.PI / 2, left: Math.PI, down: Math.PI / 2 };
  const rotation = angleByDir[direction] ?? 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.25);
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;

  // Arrow shape (in local coords, points right)
  //    ┌─────┐
  //    │     │\
  //    │     │ \
  //    │     │  >
  //    │     │ /
  //    │     │/
  //    └─────┘
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

function drawGear(ctx, cx, cy, size, color) {
  // 8-tooth gear with center hole
  const outerR = size * 0.42;
  const innerR = outerR * 0.7;
  const toothH = outerR - innerR;
  const teeth = 8;

  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.22);
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  // Body: build tooth + valley pattern
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

function drawCylinder(ctx, cx, cy, size, color) {
  // Database-like cylinder: oval top + rect body
  const halfW = size * 0.32;
  const halfH = size * 0.4;
  const ellipseRy = halfW * 0.3; // top ellipse vertical radius

  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.22);
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;

  // Body (rect)
  const grad = ctx.createLinearGradient(cx - halfW, 0, cx + halfW, 0);
  grad.addColorStop(0, rgbCss(lighten(color, 0.2)));
  grad.addColorStop(0.5, rgbCss(color));
  grad.addColorStop(1, rgbCss(darken(color, 0.15)));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy - halfH + ellipseRy);
  ctx.lineTo(cx - halfW, cy + halfH - ellipseRy);
  // Bottom oval (half)
  ctx.ellipse(cx, cy + halfH - ellipseRy, halfW, ellipseRy, 0, Math.PI, 0, true);
  ctx.lineTo(cx + halfW, cy - halfH + ellipseRy);
  // Top oval (half — back side, not visible, just to close path)
  ctx.ellipse(cx, cy - halfH + ellipseRy, halfW, ellipseRy, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Top oval (lighter, visible)
  ctx.fillStyle = rgbCss(lighten(color, 0.25));
  ctx.beginPath();
  ctx.ellipse(cx, cy - halfH + ellipseRy, halfW, ellipseRy, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// Helpers
// ============================================================================

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
