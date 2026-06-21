// =============================================================================
// atoms-2d/charts/diagrams/timeline.js — Horizontal timeline of events
// -----------------------------------------------------------------------------
// 11th atom in 2D vector library (Phase 2c part 2).
//
// Semantic: linear horizontal timeline with date markers and labeled events.
// Different from flow-chart (which has equal-weight steps) — timeline events
// can be at arbitrary positions along an axis.
//
// Args:
//   events  — array of { date, label, sublabel? }
//   title   — optional chart title
//   axisLabel — optional label for the time axis (e.g. "2024-2026")
//
// Render: pseudo-3D
//   - Horizontal axis line with shadow
//   - Date markers (small circles with gradient) on axis
//   - Alternating events above/below to avoid overlap
//   - Connector line from event marker to event card
//   - Event card: date + label + sublabel (Inter typography)
//
// Per [[atlas-sprint14-finance-preset-plan]] — diagram family.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'timeline',
  category: 'charts/diagrams',
  description: 'Horizontal timeline of dated events. Alternating above/below for clarity.',
  args: {
    events: {
      type: 'array of { date, label, sublabel? }',
      required: true,
      example: [
        { date: '2024 Q1', label: 'Seed Round' },
        { date: '2024 Q4', label: 'Product Launch', sublabel: '$1M ARR' },
        { date: '2025 Q3', label: 'Series A' },
      ],
    },
    title: { type: 'string?', example: 'Company Milestones' },
    axisLabel: { type: 'string?', example: '2024-2026' },
  },
};

const PAD = 14;
const TITLE_FRAC = 0.1;
const MARKER_RADIUS = 8;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 240;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];
  const accent = palette.colors?.[0] || [60, 100, 200];

  const events = Array.isArray(args.events) ? args.events : [];
  const title = args.title;
  const axisLabel = args.axisLabel;
  if (events.length === 0) return;

  // Title
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.1);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * TITLE_FRAC + PAD;
  }

  // Layout: axis at vertical center of remaining space
  const axisY = plotTop + (y + h - plotTop) / 2;
  const axisLeft = x + PAD + 16;
  const axisRight = x + w - PAD - 16;
  const axisLength = axisRight - axisLeft;

  // ---- Draw axis line ----
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.15);
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.strokeStyle = rgbaCss(fg, 0.4);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(axisLeft, axisY);
  ctx.lineTo(axisRight, axisY);
  ctx.stroke();
  ctx.restore();

  // ---- Axis label ----
  if (axisLabel) {
    ctx.fillStyle = rgbaCss(fg, 0.5);
    ctx.font = '500 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(axisLabel, axisRight, axisY + 22);
  }

  // ---- Markers + events ----
  const n = events.length;
  const cardW = Math.min(140, axisLength / n - 12);
  const cardH = Math.min(60, (y + h - plotTop) * 0.4);
  const cardOffsetY = 36;

  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const mx = axisLeft + t * axisLength;
    const above = i % 2 === 0; // alternate above/below

    // Marker on axis
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.2);
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    const grad = ctx.createRadialGradient(
      mx - MARKER_RADIUS * 0.3,
      axisY - MARKER_RADIUS * 0.3,
      MARKER_RADIUS * 0.1,
      mx,
      axisY,
      MARKER_RADIUS,
    );
    grad.addColorStop(0, rgbCss(lighten(accent, 0.2)));
    grad.addColorStop(1, rgbCss(accent));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(mx, axisY, MARKER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Connector line from marker to card
    const cardCy = above ? axisY - cardOffsetY - cardH / 2 : axisY + cardOffsetY + cardH / 2;
    ctx.strokeStyle = rgbaCss(accent, 0.4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mx, axisY + (above ? -MARKER_RADIUS : MARKER_RADIUS));
    ctx.lineTo(mx, cardCy + (above ? cardH / 2 : -cardH / 2));
    ctx.stroke();

    // Event card
    drawEventCard(ctx, mx, cardCy, cardW, cardH, events[i], { fg, bg, accent });
  }
}

function drawEventCard(ctx, cx, cy, w, h, event, colorCtx) {
  const { fg, bg, accent } = colorCtx;
  const nx = cx - w / 2;
  const ny = cy - h / 2;
  const radius = 6;

  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.12);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  const gradient = ctx.createLinearGradient(nx, ny, nx, ny + h);
  gradient.addColorStop(0, rgbCss(bg));
  gradient.addColorStop(1, rgbCss(darken(bg, 0.04)));
  ctx.fillStyle = gradient;
  roundedRectPath(ctx, nx, ny, w, h, radius);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = rgbaCss(fg, 0.15);
  ctx.lineWidth = 1;
  roundedRectPath(ctx, nx, ny, w, h, radius);
  ctx.stroke();

  // Date (top, accent color, IBM Plex Mono)
  if (event.date) {
    ctx.fillStyle = rgbCss(accent);
    ctx.font = '600 11px IBM Plex Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(event.date), cx, ny + 6);
  }
  // Label (middle, Inter 600)
  if (event.label) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `600 ${Math.min(13, h * 0.22)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = event.sublabel ? 'middle' : 'middle';
    ctx.fillText(String(event.label), cx, ny + h * (event.sublabel ? 0.5 : 0.55));
  }
  // Sublabel (bottom, faded)
  if (event.sublabel) {
    ctx.fillStyle = rgbaCss(fg, 0.6);
    ctx.font = `400 ${Math.min(11, h * 0.18)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(event.sublabel), cx, ny + h - 6);
  }
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
