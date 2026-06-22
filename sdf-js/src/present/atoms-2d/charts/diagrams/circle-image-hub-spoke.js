// =============================================================================
// atoms-2d/charts/diagrams/circle-image-hub-spoke.js — Hub-and-spoke circles
// -----------------------------------------------------------------------------
// Hub-and-spoke layout: a large center circle node + N satellite circles
// arranged at evenly-spaced angles, connected by hairline spoke lines.
//
// Primary use: ecosystem maps ("Atlas integrates with…"), case study orbits,
// competitive landscapes, stakeholder maps.
//
// Args:
//   center     — { label, color? }  (REQUIRED)
//   satellites — array of 3-8 { label, color? }  (REQUIRED)
//   title      — optional title
//
// Render: pseudo-3D
//   - Center circle: palette.colors[0], radial gradient, large drop shadow
//   - Satellite circles: palette.colors[i % N], radial gradient, smaller shadow
//   - Spoke lines: palette.fg alpha 0.4, 1.5px
//   - Labels: Inter 700 white centered (truncated)
//   - Sizes auto-scale to canvas
//
// Per [[atlas-sprint15b-idiom-atoms-plan]] — Sprint 15b Batch B1.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'circle-image-hub-spoke',
  category: 'charts/diagrams',
  description:
    'Hub-and-spoke with circular nodes — center node + N satellite circles connected by spokes.',
  args: {
    center: {
      type: '{ label, color? }',
      required: true,
      example: { label: 'Atlas' },
    },
    satellites: {
      type: 'array of 3-8 { label, color? }',
      required: true,
      example: [
        { label: 'Sketch' },
        { label: 'Notion' },
        { label: 'Loom' },
        { label: 'Figma' },
        { label: 'Slack' },
      ],
    },
    title: { type: 'string?', example: 'Atlas Integrations' },
  },
};

const PAD = 16;
const TITLE_FRAC = 0.1;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 560;
  const h = opts.h ?? 440;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const groupColors = palette.colors || [
    [60, 100, 200],
    [200, 100, 60],
    [60, 180, 100],
    [180, 60, 180],
    [200, 180, 60],
    [60, 160, 180],
    [200, 80, 100],
    [100, 160, 60],
  ];

  const center = args.center || { label: 'Hub' };
  const satellites = Array.isArray(args.satellites) ? args.satellites.slice(0, 8) : [];
  const title = args.title;
  const N = Math.max(satellites.length, 1);

  // ---- Title ----
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.058);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * TITLE_FRAC + PAD;
  }

  // ---- Layout: center of the plot area ----
  const plotH = y + h - plotTop;
  const cx = x + w / 2;
  const cy = plotTop + plotH / 2;

  // Scale radii to fit nicely
  const available = Math.min(w * 0.5, plotH * 0.5) - PAD;
  const centerR = available * 0.22;
  const satR = available * 0.15;
  const orbitR = available * 0.7;

  // ---- Satellite positions (evenly spaced, start from top) ----
  const satPositions = [];
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
    satPositions.push({
      x: cx + orbitR * Math.cos(angle),
      y: cy + orbitR * Math.sin(angle),
    });
  }

  // ---- Draw spoke lines (behind circles) ----
  for (const sp of satPositions) {
    ctx.save();
    ctx.strokeStyle = rgbaCss(fg, 0.4);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(sp.x, sp.y);
    ctx.stroke();
    ctx.restore();
  }

  // ---- Draw satellite circles ----
  for (let i = 0; i < N; i++) {
    const sp = satPositions[i];
    const sat = satellites[i] || { label: '' };
    const color = sat.color || groupColors[(i + 1) % groupColors.length];
    drawCircleNode(ctx, sp.x, sp.y, satR, sat.label || '', color, false);
  }

  // ---- Draw center circle (on top) ----
  const centerColor = center.color || groupColors[0];
  drawCircleNode(ctx, cx, cy, centerR, center.label || '', centerColor, true);
}

// ---------------------------------------------------------------------------
// Draw a single circle node with pseudo-3D gradient + shadow + label
// ---------------------------------------------------------------------------
function drawCircleNode(ctx, cx, cy, radius, label, color, isCenter) {
  ctx.save();

  // Drop shadow
  ctx.shadowColor = rgbaCss([0, 0, 0], isCenter ? 0.22 : 0.15);
  ctx.shadowBlur = isCenter ? 14 : 10;
  ctx.shadowOffsetY = isCenter ? 4 : 3;

  // Radial gradient (10% lighten at highlight, base at edge)
  const gx = cx - radius * 0.3;
  const gy = cy - radius * 0.3;
  const grad = ctx.createRadialGradient(gx, gy, radius * 0.08, cx, cy, radius * 1.05);
  grad.addColorStop(0, rgbCss(lighten(color, isCenter ? 0.18 : 0.12)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Subtle border stroke
  ctx.save();
  ctx.strokeStyle = rgbaCss(darken(color, 0.18), 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Label (Inter 700, white, centered, truncated)
  const fontSize = isCenter
    ? Math.max(11, Math.min(16, radius * 0.38))
    : Math.max(9, Math.min(13, radius * 0.42));
  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,1)';

  const maxW = radius * 1.6;
  const words = label.split(' ');
  if (words.length > 1 && ctx.measureText(label).width > maxW) {
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(' ');
    const line2 = words.slice(mid).join(' ');
    const lineH = fontSize * 1.2;
    ctx.fillText(truncate(line1, maxW, ctx), cx, cy - lineH * 0.5);
    ctx.fillText(truncate(line2, maxW, ctx), cx, cy + lineH * 0.5);
  } else {
    ctx.fillText(truncate(label, maxW, ctx), cx, cy + 1);
  }
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
