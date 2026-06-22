// =============================================================================
// atoms-2d/charts/diagrams/seven-s-model.js — McKinsey 7S Framework
// -----------------------------------------------------------------------------
// Renders the McKinsey 7S Framework: a central hexagon (Shared Values) with
// 6 satellite hexagons (Strategy, Structure, Systems, Style, Staff, Skills)
// arranged in a hexagonal ring.
//
// Connections:
//   • Spoke lines: center → each satellite
//   • Ring lines: adjacent satellites → adjacent satellites (6 edges)
//
// Render: pseudo-3D
//   - Hexagons with radial gradient (lighter top-left) + drop shadow
//   - Center hex: larger + stronger accent color
//   - Satellite hexes: palette.colors cycled
//   - Labels: Inter 600, centered; optional sub-label in smaller text
//
// Per [[atlas-atom-taxonomy]] — charts/diagrams family.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'seven-s-model',
  category: 'charts/diagrams',
  description:
    'McKinsey 7S Framework — Shared Values center + 6 satellites (Strategy, Structure, Systems, Style, Staff, Skills).',
  args: {
    center: { type: 'string', default: 'Shared Values' },
    satellites: {
      type: 'array of 6 { label: string, description?: string }',
      required: true,
      example: [
        { label: 'Strategy' },
        { label: 'Structure' },
        { label: 'Systems' },
        { label: 'Style' },
        { label: 'Staff' },
        { label: 'Skills' },
      ],
    },
    title: { type: 'string?', example: '7S Framework' },
  },
};

const PAD = 14;
const TITLE_FRAC = 0.09;

// ---------------------------------------------------------------------------
// Hex geometry helper — pointy-top orientation
// ---------------------------------------------------------------------------
function drawHexagon(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6; // pointy-top
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Draw a single hexagon with pseudo-3D gradient + shadow + label(s)
// ---------------------------------------------------------------------------
function drawHex(ctx, cx, cy, r, label, subLabel, color, fg, isCenter) {
  ctx.save();

  // Shadow
  ctx.shadowColor = rgbaCss([0, 0, 0], isCenter ? 0.28 : 0.18);
  ctx.shadowBlur = isCenter ? 10 : 6;
  ctx.shadowOffsetY = isCenter ? 3 : 2;

  // Radial gradient — lighter top-left to base color
  const gx = cx - r * 0.35;
  const gy = cy - r * 0.35;
  const grad = ctx.createRadialGradient(gx, gy, r * 0.05, cx, cy, r * 1.05);
  grad.addColorStop(0, rgbCss(lighten(color, isCenter ? 0.32 : 0.22)));
  grad.addColorStop(1, rgbCss(color));

  drawHexagon(ctx, cx, cy, r);
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle border
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  drawHexagon(ctx, cx, cy, r);
  ctx.strokeStyle = rgbaCss(darken(color, 0.15), 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();

  // Label
  const labelColor = 'rgba(255,255,255,1)';
  const fontSize = isCenter
    ? Math.max(10, Math.min(14, r * 0.38))
    : Math.max(9, Math.min(13, r * 0.38));

  ctx.fillStyle = labelColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (subLabel) {
    // Two lines: label above, subLabel below
    const mainSize = fontSize;
    const subSize = Math.max(8, mainSize * 0.75);
    const gap = mainSize * 0.6;
    ctx.font = `700 ${mainSize}px Inter, system-ui, sans-serif`;
    ctx.fillText(truncate(label, r, ctx), cx, cy - gap * 0.5);
    ctx.font = `400 ${subSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(truncate(subLabel, r * 0.9, ctx), cx, cy + gap * 0.7);
  } else {
    ctx.font = `${isCenter ? 700 : 600} ${fontSize}px Inter, system-ui, sans-serif`;
    // Wrap long labels across two lines if needed
    const words = label.split(' ');
    if (words.length > 1 && ctx.measureText(label).width > r * 1.5) {
      const mid = Math.ceil(words.length / 2);
      const line1 = words.slice(0, mid).join(' ');
      const line2 = words.slice(mid).join(' ');
      const lineH = fontSize * 1.15;
      ctx.fillText(truncate(line1, r * 1.6, ctx), cx, cy - lineH * 0.5);
      ctx.fillText(truncate(line2, r * 1.6, ctx), cx, cy + lineH * 0.5);
    } else {
      ctx.fillText(truncate(label, r * 1.6, ctx), cx, cy + 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Draw a connector line between two points
// ---------------------------------------------------------------------------
function drawConnector(ctx, x0, y0, x1, y1, color, alpha, lineWidth) {
  ctx.save();
  ctx.strokeStyle = rgbaCss(color, alpha);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 600;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || [60, 100, 200];
  const groupColors = palette.colors || [
    [60, 100, 200],
    [200, 100, 60],
    [60, 180, 100],
    [180, 60, 180],
    [200, 180, 60],
    [60, 160, 180],
  ];

  const centerLabel = typeof args.center === 'string' ? args.center : 'Shared Values';
  const satellites = Array.isArray(args.satellites) ? args.satellites.slice(0, 6) : [];
  const title = args.title;

  // ---- Title ----
  let plotTop = y;
  if (title) {
    const titleSize = Math.round(h * 0.058);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * TITLE_FRAC + PAD;
  }

  // ---- Layout parameters ----
  const plotH = y + h - plotTop;
  const cx = x + w / 2;
  const cy = plotTop + plotH / 2;
  // Outer radius of the arrangement (center to satellite centers)
  const R = Math.min(w, plotH) * 0.5 * 0.62;

  const centerHexR = R * 0.19; // center hex radius
  const satHexR = R * 0.16; // satellite hex radius
  const orbitR = R * 0.56; // distance from center to satellite centers

  // ---- Satellite positions (0° = top-right, 60° steps, pointy-top hex ring) ----
  // We use 30°, 90°, 150°, 210°, 270°, 330° so satellites sit at flat-edge midpoints
  const satPositions = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 30 + 60 * i;
    const angle = (angleDeg * Math.PI) / 180;
    satPositions.push({
      x: cx + orbitR * Math.cos(angle),
      y: cy + orbitR * Math.sin(angle),
    });
  }

  // ---- Draw ring connectors (adjacent satellites) — behind everything ----
  for (let i = 0; i < 6; i++) {
    const a = satPositions[i];
    const b = satPositions[(i + 1) % 6];
    drawConnector(ctx, a.x, a.y, b.x, b.y, accent, 0.22, 1);
  }

  // ---- Draw spoke connectors (center → satellite) ----
  for (let i = 0; i < satPositions.length; i++) {
    const sp = satPositions[i];
    drawConnector(ctx, cx, cy, sp.x, sp.y, accent, 0.55, 1.5);
  }

  // ---- Draw satellite hexagons ----
  for (let i = 0; i < satPositions.length; i++) {
    const sp = satPositions[i];
    const sat = satellites[i] || { label: '' };
    const color = groupColors[i % groupColors.length];
    drawHex(ctx, sp.x, sp.y, satHexR, sat.label || '', sat.description || null, color, fg, false);
  }

  // ---- Draw center hexagon (on top) ----
  drawHex(ctx, cx, cy, centerHexR, centerLabel, null, accent, fg, true);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
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

function truncate(text, maxWidth, ctx) {
  const s = String(text);
  if (ctx.measureText(s).width <= maxWidth) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + '…';
}
