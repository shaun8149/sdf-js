// =============================================================================
// atoms-2d/charts/data/sphere-fill.js — Glass sphere with liquid fill level
// -----------------------------------------------------------------------------
// 16th atom in 2D vector library.
//
// Semantic: a glass sphere (translucent outer shell) containing colored
// "liquid" filled to a percentage level. Pattern is established skeuomorphic
// data-viz vocabulary (Mac OS X Aqua / Vista Glass era, ~2001+) — generic
// CG technique vocabulary (Phong specular + rim light + cap segment).
//
// Use case: percentage progress, capacity/utilization metrics, KPI dashboards
// where you want a "container filling up" visual metaphor.
//
// Args:
//   value      — number 0-100 (fill percentage)
//   label      — optional display text (default: `${value}%`)
//   color      — liquid fill color (rgb tuple); else palette.colors[0]
//   background — 'dark' | 'light' (default 'dark' — affects glass rim contrast)
//
// Render technique (general CG, not specific to any vendor's templates):
//   1. Soft elliptical floor shadow under sphere
//   2. Outer glass shell: dark-to-darker radial gradient (subtle, thin rim)
//   3. Liquid body: cap segment from bottom up to fill height, with
//      vertical liquid gradient (lighter top, darker bottom)
//   4. Liquid top surface: thin ellipse at fill level (perspective)
//   5. Specular highlight: bright white spot upper-left (Phong reflection)
//   6. Centered % text in white with subtle dark outline for legibility
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'sphere-fill',
  category: 'charts/data',
  description:
    'Glass sphere with colored liquid filled to a percentage level. Skeuomorphic % visualization.',
  args: {
    value: { type: 'number (0-100)', required: true, example: 60 },
    label: { type: 'string?', example: '60%' },
    color: { type: '[r,g,b]?', example: [60, 130, 200] },
    background: { type: "'dark'|'light'", default: 'dark', example: 'dark' },
  },
};

const PAD = 14;
const FLOOR_SHADOW_FRAC = 0.08;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 280;
  const h = opts.h ?? 280;
  const palette = opts.palette || {};
  const color = args.color || palette.colors?.[0] || [60, 130, 200];
  const value = clamp(Number(args.value ?? 0), 0, 100);
  const label = args.label != null ? String(args.label) : `${Math.round(value)}%`;
  const background = args.background || 'dark';

  // Reserve floor shadow space at bottom
  const cx = x + w / 2;
  const cy = y + (h - h * FLOOR_SHADOW_FRAC) / 2 + PAD / 2;
  const radius = Math.min(w - PAD * 2, h - PAD * 2 - h * FLOOR_SHADOW_FRAC) / 2;

  // ---- 1) Floor shadow (elliptical) ----
  const floorY = y + h - h * FLOOR_SHADOW_FRAC * 0.4;
  ctx.save();
  const floorGrad = ctx.createRadialGradient(cx, floorY, 1, cx, floorY, radius * 0.95);
  floorGrad.addColorStop(0, rgbaCss([0, 0, 0], background === 'dark' ? 0.45 : 0.22));
  floorGrad.addColorStop(0.7, rgbaCss([0, 0, 0], 0.1));
  floorGrad.addColorStop(1, rgbaCss([0, 0, 0], 0));
  ctx.fillStyle = floorGrad;
  ctx.beginPath();
  ctx.ellipse(cx, floorY, radius * 0.95, radius * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- 2) Outer glass shell (translucent dark base + rim) ----
  ctx.save();
  const glassBaseGrad = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
  if (background === 'dark') {
    glassBaseGrad.addColorStop(0, rgbaCss([20, 20, 20], 0.85));
    glassBaseGrad.addColorStop(0.7, rgbaCss([10, 10, 10], 0.85));
    glassBaseGrad.addColorStop(1, rgbaCss([0, 0, 0], 0.92));
  } else {
    glassBaseGrad.addColorStop(0, rgbaCss([235, 235, 235], 0.6));
    glassBaseGrad.addColorStop(1, rgbaCss([200, 200, 205], 0.85));
  }
  ctx.fillStyle = glassBaseGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- 3) Liquid fill (cap segment + colored body) ----
  if (value > 0) {
    const fillRatio = value / 100;
    // Liquid surface y: top of liquid (smaller fillRatio = lower)
    const fillTopY = cy + radius - 2 * radius * fillRatio;
    drawLiquidBody(ctx, cx, cy, radius, fillTopY, color);
    drawLiquidSurface(ctx, cx, fillTopY, radius, cy, color);
  }

  // ---- 4) Glass overlay (outer rim — only outline, not refill) ----
  ctx.save();
  ctx.strokeStyle = rgbaCss(background === 'dark' ? [255, 255, 255] : [120, 120, 130], 0.18);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // ---- 5) Specular highlight (Phong-style bright spot, upper area) ----
  ctx.save();
  ctx.globalAlpha = 0.55;
  const specCx = cx - radius * 0.25;
  const specCy = cy - radius * 0.45;
  const specR = radius * 0.32;
  const specGrad = ctx.createRadialGradient(specCx, specCy, 0, specCx, specCy, specR);
  specGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
  specGrad.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.ellipse(specCx, specCy, specR, specR * 0.7, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Secondary tiny pin-prick highlight
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.beginPath();
  ctx.arc(cx - radius * 0.15, cy - radius * 0.6, radius * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- 6) Centered % text (white with subtle dark outline) ----
  if (label) {
    const textSize = Math.round(radius * 0.36);
    ctx.font = `900 ${textSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // text centered ON the liquid surface (more readable)
    const liquidVisible = value > 8;
    const textY = liquidVisible
      ? cy + radius - 2 * radius * (value / 100) + radius * 0.18 // slightly below surface
      : cy + radius * 0.4; // empty sphere: anchor lower-center

    // Soft drop shadow for legibility on glass
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.55);
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fillText(label, cx, textY);
    ctx.restore();
  }
}

// ============================================================================
// Helpers — liquid body + surface
// ============================================================================

function drawLiquidBody(ctx, cx, cy, radius, fillTopY, color) {
  // Liquid = portion of sphere below fillTopY, with a vertical gradient
  // showing depth (lighter near surface, darker at bottom).
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
  ctx.clip();

  const grad = ctx.createLinearGradient(0, fillTopY, 0, cy + radius);
  grad.addColorStop(0, rgbCss(lighten(color, 0.18)));
  grad.addColorStop(1, rgbCss(darken(color, 0.18)));
  ctx.fillStyle = grad;

  // Fill the entire clipped circle bottom half (anything below fillTopY)
  ctx.fillRect(cx - radius, fillTopY, radius * 2, radius * 2);

  // Add subtle inner side specular (vertical highlight on right side suggesting
  // light reflection through liquid)
  const sideGrad = ctx.createLinearGradient(cx - radius * 0.5, 0, cx + radius * 0.7, 0);
  sideGrad.addColorStop(0, rgbaCss(lighten(color, 0.4), 0));
  sideGrad.addColorStop(0.85, rgbaCss(lighten(color, 0.4), 0));
  sideGrad.addColorStop(1, rgbaCss(lighten(color, 0.4), 0.35));
  ctx.fillStyle = sideGrad;
  ctx.fillRect(cx - radius, fillTopY, radius * 2, radius * 2);
  ctx.restore();
}

function drawLiquidSurface(ctx, cx, fillTopY, sphereR, sphereCy, color) {
  // Top surface of liquid = ellipse at fillTopY with rx scaled by sphere
  // cross-section at that height. Perspective makes the front of the ellipse
  // curve toward viewer.
  const dy = fillTopY - sphereCy;
  const crossR = Math.sqrt(Math.max(0, sphereR * sphereR - dy * dy));
  if (crossR < 2) return;

  ctx.save();
  // Slight outer rim line on top edge
  ctx.strokeStyle = rgbaCss(darken(color, 0.4), 0.65);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, fillTopY, crossR, crossR * 0.18, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Fill ellipse with light-to-dark vertical gradient (front edge lighter)
  const grad = ctx.createLinearGradient(0, fillTopY - crossR * 0.18, 0, fillTopY + crossR * 0.18);
  grad.addColorStop(0, rgbCss(darken(color, 0.12)));
  grad.addColorStop(0.5, rgbCss(color));
  grad.addColorStop(1, rgbCss(lighten(color, 0.08)));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, fillTopY, crossR, crossR * 0.18, 0, 0, Math.PI * 2);
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
