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
const CAPTION_FRAC = 0.2; // reserve for caption text + accent underline bar
const HERO_SIZE_FRAC = 0.55; // shape target size as a fraction of canvas height

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 240;
  const h = opts.h ?? 240;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const color = args.color || palette.colors?.[0] || [60, 100, 200];
  const label = args.label;

  const captionH = label ? h * CAPTION_FRAC : 0;
  const shapeAreaW = w - PAD * 2;
  const shapeAreaH = h - PAD * 2 - captionH;
  const cx = x + w / 2;
  const cy = y + PAD + shapeAreaH / 2;
  const size = Math.min(shapeAreaW, shapeAreaH, h * HERO_SIZE_FRAC);

  drawDiamond(ctx, cx, cy, size, color);

  if (label) {
    drawCaption(ctx, String(label), cx, y, h, captionH, shapeAreaW, fg, color);
  }
}

/**
 * Hero caption: larger Inter 700 type + accent underline bar (shared look
 * with arrow.js — both are single-shape "iconic" atoms).
 */
function drawCaption(ctx, text, cx, y, h, captionH, shapeAreaW, fg, accentColor) {
  const captionSize = Math.max(14, Math.round(h * 0.07));
  ctx.font = `700 ${captionSize}px Inter, system-ui, sans-serif`;
  const textW = ctx.measureText(text).width;
  const textY = y + h - captionH / 2 - captionSize * 0.25;

  ctx.fillStyle = rgbCss(fg);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, textY);

  const underlineW = Math.min(textW + 24, shapeAreaW * 0.6);
  const underlineY = textY + captionSize * 0.62;
  ctx.fillStyle = rgbCss(accentColor);
  ctx.fillRect(cx - underlineW / 2, underlineY, underlineW, 3);
}

function drawDiamond(ctx, cx, cy, size, color) {
  const s = size * 0.42;

  // Ground shadow ellipse beneath gem
  ctx.save();
  const shadowGrad = ctx.createRadialGradient(cx, cy + s * 0.7, 0, cx, cy + s * 0.7, s * 0.65);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.18)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.72, s * 0.62, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.2);
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  // 4 facets for gem-cut bevel:
  // Top facet — brightest (lighten 0.25)
  ctx.fillStyle = rgbCss(lighten(color, 0.25));
  ctx.beginPath();
  ctx.moveTo(cx, cy - s); // top tip
  ctx.lineTo(cx + s, cy); // right tip
  ctx.lineTo(cx, cy); // center
  ctx.lineTo(cx - s, cy); // left tip
  ctx.closePath();
  ctx.fill();

  // Bottom facet — darkest (darken 0.18)
  ctx.fillStyle = rgbCss(darken(color, 0.18));
  ctx.beginPath();
  ctx.moveTo(cx, cy + s); // bottom tip
  ctx.lineTo(cx + s, cy); // right tip
  ctx.lineTo(cx, cy); // center
  ctx.lineTo(cx - s, cy); // left tip
  ctx.closePath();
  ctx.fill();

  // Re-draw top half cleaner: left face upper (lighten 0.12) and right face upper (color)
  // Right-upper facet (top-right triangle, base color)
  ctx.fillStyle = rgbCss(color);
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s, cy);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();

  // Left-upper facet (lightest)
  ctx.fillStyle = rgbCss(lighten(color, 0.22));
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx - s, cy);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();

  // Right-lower facet (darkest)
  ctx.fillStyle = rgbCss(darken(color, 0.22));
  ctx.beginPath();
  ctx.moveTo(cx + s, cy);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();

  // Left-lower facet (slightly dark)
  ctx.fillStyle = rgbCss(darken(color, 0.08));
  ctx.beginPath();
  ctx.moveTo(cx - s, cy);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Thin facet edge lines for gem-cut definition
  ctx.save();
  ctx.strokeStyle = rgbaCss([0, 0, 0], 0.1);
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx, cy + s);
  ctx.moveTo(cx - s, cy);
  ctx.lineTo(cx + s, cy);
  ctx.stroke();
  ctx.restore();

  // Specular highlight — tiny ellipse near upper-left tip
  ctx.save();
  ctx.globalAlpha = 0.55;
  const specGrad = ctx.createRadialGradient(
    cx - s * 0.28,
    cy - s * 0.3,
    0,
    cx - s * 0.28,
    cy - s * 0.3,
    s * 0.14,
  );
  specGrad.addColorStop(0, 'rgba(255,255,255,0.92)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.28, cy - s * 0.3, s * 0.14, s * 0.1, -Math.PI / 5, 0, Math.PI * 2);
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
