// =============================================================================
// atoms-2d/icons/icon-badge.js — Icon with pseudo-3D circular badge
// -----------------------------------------------------------------------------
// 14th atom in 2D vector library (Phase 4).
//
// Semantic: 24 atlas-icon names (from atlas-icon-library SVG paths) wrapped
// in a pseudo-3D circular badge. Use as iconic content unit: e.g. "users"
// icon with "Engineering" label below.
//
// Args:
//   name   — one of 24 ATLAS_ICON_NAMES (required)
//   label  — optional caption below badge
//   color  — optional badge color override (rgb tuple), else palette.colors[0]
//
// Render: pseudo-3D
//   - Circular badge: radial gradient (lighter top-left, darker bottom-right)
//     + drop shadow + specular highlight
//   - Icon path drawn on top in white (or bg color)
//   - Optional label below in Inter 600
//
// Per [[atlas-sprint14-finance-preset-plan]] — supports prompt-driven
// content with icon affordance.
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

// SVG path data copied from sdf-js/examples/p5-idiom-registry/atlas-icon-library.js
// Heroicons + Tabler MIT-licensed sources, re-coded as drawingContext.Path2D for
// fast in-canvas render. 24 icons grouped by affordance.
const _ICON_PATHS = {
  user: 'M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.4c-3.3 0-9.9 1.7-9.9 4.9v2.5h19.7v-2.5c0-3.3-6.6-4.9-9.8-4.9z',
  users:
    'M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zM8 11c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.6 0-1 .1 1.2.8 2 1.8 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z',
  building:
    'M3 21V7l9-4 9 4v14H3zm2-2h4v-4h6v4h4V8.3L12 5.2 5 8.3V19zm6-6h2v-2h-2v2zm0-4h2V7h-2v2zm4 4h2v-2h-2v2zm0-4h2V7h-2v2zM7 13h2v-2H7v2zm0-4h2V7H7v2z',
  globe:
    'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 2c.7 0 1.9 1 2.7 3.5h-5.4C10.1 5 11.3 4 12 4zm-1.9.4c-.4.7-.8 1.7-1 2.7H6.5c.9-1.2 2.2-2.2 3.6-2.7zm3.8 0c1.4.5 2.7 1.5 3.6 2.7h-2.6c-.2-1-.6-2-1-2.7zM4.7 9h3c-.1.6-.1 1.3-.1 2s0 1.4.1 2h-3c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2zm5 0h4.5c.1.6.1 1.3.1 2s0 1.4-.1 2H9.7C9.6 13.4 9.6 12.7 9.6 12s0-1.4.1-3zm6.5 0h3c.2.6.3 1.3.3 2s-.1 1.4-.3 2h-3c.1-.6.1-1.3.1-2s0-1.4-.1-2zm-9.7 6h2.6c.2 1 .6 2 1 2.7-1.4-.5-2.7-1.5-3.6-2.7zm2.8 0h5.4c-.7 2.5-2 3.5-2.7 3.5s-1.9-1-2.7-3.5zm6.6 0h2.6c-.9 1.2-2.2 2.2-3.6 2.7.4-.7.8-1.7 1-2.7z',
  'chart-bar': 'M3 20h18v1H3v-1zM5 18V8h3v10H5zM10 18V4h3v14h-3zM15 18v-7h3v7h-3z',
  'chart-pie':
    'M11 2v9.6L19.4 16C18.5 19.4 15.5 22 12 22c-5.5 0-10-4.5-10-10 0-4.6 3.1-8.4 7.3-9.6h1.7zm-2 2.1C5.7 5 3 8.2 3 12c0 4.4 3.6 8 8 8 2.6 0 4.9-1.3 6.4-3.2L11 14V4.1zm4 0v6.9l5.9 3.1c.1-.4.1-.7.1-1 0-4.4-3.1-8.1-7-9z',
  database:
    'M12 2c4.9 0 8 1.4 8 3v14c0 1.7-3.1 3-8 3s-8-1.4-8-3V5c0-1.6 3.1-3 8-3zm0 2c-3.7 0-6 .9-6 1s2.3 1 6 1 6-.9 6-1-2.3-1-6-1zm6 3.5c-1.4.7-3.5 1-6 1s-4.6-.4-6-1V12c0 .1 2.3 1 6 1s6-.9 6-1V7.5zm0 6c-1.4.7-3.5 1-6 1s-4.6-.4-6-1V19c0 .1 2.3 1 6 1s6-.9 6-1v-5.5z',
  cloud:
    'M19 18H6a4 4 0 0 1-.6-7.9 5.5 5.5 0 0 1 10.7-1.5A4.5 4.5 0 0 1 19 18zm-3.4-8.1l-.5-1.4a3.5 3.5 0 0 0-6.8 1c0 .1 0 .3.1.6l.2 1.1-1.1.2A2 2 0 0 0 6 16h13a2.5 2.5 0 0 0 0-5h-.4l-.3-.7-.7-.2-.3-.2z',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-up': 'M12 5v14M6 11l6-6 6 6',
  'arrow-down': 'M12 5v14M6 13l6 6 6-6',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
  check: 'M5 13l4 4L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  cube: 'M12 2L3 7v10l9 5 9-5V7l-9-5zM5 8.2l7 3.9 7-3.9M12 12.1V22',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6',
  mail: 'M3 8l9 6 9-6V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8zm0-2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v0l-9 6-9-6v0z',
  star: 'M12 2l3.1 6.3L22 9.3l-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2 2 9.3l6.9-1L12 2z',
  heart:
    'M12 21l-1.5-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1A6 6 0 0 1 16.5 3C19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.5 11.2L12 21z',
  lightning: 'M13 2L3 14h7l-1 8 10-12h-7l1-8z',
  clock:
    'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm.5-13H11v6l5.2 3.1.8-1.3-4.5-2.7V7z',
  shield: 'M12 2L3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5l-9-3z',
  question:
    'M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10zm0-18c4.4 0 8 3.6 8 8s-3.6 8-8 8-8-3.6-8-8 3.6-8 8-8zm-1 13h2v2h-2v-2zm1-10c-2.2 0-4 1.8-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 .9-.5 1.4-1.2 1.9-.6.5-1.8 1.1-1.8 2.6v.5h2v-.5c0-.7.6-1 1.3-1.5.9-.7 1.7-1.4 1.7-2.7 0-2.4-1.6-4.3-4-4.3z',
};

export const ICON_BADGE_NAMES = Object.keys(_ICON_PATHS);

export const spec = {
  type: 'icon-badge',
  category: 'icons',
  description:
    '24 atlas icons (Heroicons + Tabler) wrapped in pseudo-3D circular badge with optional caption.',
  args: {
    name: {
      type: ICON_BADGE_NAMES.slice(0, 6).join('|') + '|... (24 total)',
      required: true,
      example: 'users',
    },
    label: { type: 'string?', example: 'Engineering' },
    color: { type: '[r,g,b]?', example: [60, 100, 200] },
  },
};

const PAD = 14;
const LABEL_FRAC = 0.18;
const SVG_VIEWBOX = 24;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 200;
  const h = opts.h ?? 200;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];
  const color = args.color || palette.colors?.[0] || [60, 100, 200];
  const name = args.name || 'star';
  const label = args.label;

  const pathData = _ICON_PATHS[name];
  if (!pathData) {
    if (typeof console !== 'undefined') console.warn('[icon-badge] unknown name:', name);
    return;
  }

  const labelH = label ? h * LABEL_FRAC : 0;
  const cx = x + w / 2;
  const cy = y + PAD + (h - PAD * 2 - labelH) / 2;
  const radius = Math.min(w - PAD * 2, h - PAD * 2 - labelH) / 2;

  // ---- Pseudo-3D badge body ----
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.28);
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;

  const grad = ctx.createRadialGradient(
    cx - radius * 0.35,
    cy - radius * 0.35,
    radius * 0.1,
    cx,
    cy,
    radius,
  );
  grad.addColorStop(0, rgbCss(lighten(color, 0.3)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- Specular highlight (small light spot upper-left) ----
  ctx.save();
  ctx.globalAlpha = 0.32;
  const hg = ctx.createRadialGradient(
    cx - radius * 0.4,
    cy - radius * 0.4,
    0,
    cx - radius * 0.4,
    cy - radius * 0.4,
    radius * 0.4,
  );
  hg.addColorStop(0, 'rgba(255,255,255,1)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(cx - radius * 0.4, cy - radius * 0.4, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- Draw icon path on top in white ----
  try {
    const scale = (radius * 1.3) / SVG_VIEWBOX;
    ctx.save();
    ctx.translate(cx - (SVG_VIEWBOX * scale) / 2, cy - (SVG_VIEWBOX * scale) / 2);
    ctx.scale(scale, scale);
    ctx.strokeStyle = 'rgba(255,255,255,0.96)';
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.lineWidth = 2 / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const path = new Path2D(pathData);
    // Heroicons + Tabler icons mix filled glyphs and stroked outlines.
    // Most icons look better STROKED; fill as fallback if path was filled.
    ctx.stroke(path);
    ctx.restore();
  } catch (e) {
    // Path2D unavailable (Node test env) — silently skip icon glyph
  }

  // ---- Label below ----
  if (label) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `600 ${Math.min(18, labelH * 0.55)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), cx, y + h - labelH / 2 - PAD / 2);
  }
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
