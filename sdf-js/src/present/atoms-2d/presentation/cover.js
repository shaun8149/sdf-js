// =============================================================================
// atoms-2d/presentation/cover.js — Deck cover / title page
// -----------------------------------------------------------------------------
// 15th atom in 2D vector library (Phase 4 closes batch).
//
// Semantic: a deck's title page — big title + subtitle + optional metadata
// (author / date / version). Decorative gradient backdrop. Used for the
// FIRST visual of an Atlas Present deck.
//
// Args:
//   title    — string, required (the deck title)
//   subtitle — optional secondary title
//   author   — optional author/team name
//   date     — optional date string
//   version  — optional version tag (e.g. "v1.0", "Q3 2025")
//
// Render: pseudo-3D
//   - Gradient backdrop using palette.colors (multi-color sweep)
//   - Decorative iso-3D shape in corner (cube or sphere)
//   - Large title (Inter 900) centered
//   - Subtitle below (Inter 500, lighter)
//   - Metadata strip at bottom (author / date / version, IBM Plex Mono)
//
// Per [[atlas-sprint14-finance-preset-plan]] — deck-level structural atom.
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'cover',
  category: 'presentation',
  description: 'Deck cover / title page. Big title + subtitle + optional metadata strip.',
  args: {
    title: { type: 'string', required: true, example: 'Q3 2025 Board Review' },
    subtitle: { type: 'string?', example: 'Acme Corporation' },
    author: { type: 'string?', example: 'Sarah Chen, CEO' },
    date: { type: 'string?', example: 'November 2025' },
    version: { type: 'string?', example: 'v1.0' },
  },
};

const PAD = 32;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];
  const colors = palette.colors || [
    [60, 100, 200],
    [120, 60, 180],
  ];
  const accent = colors[0];
  const accent2 = colors[1] || lighten(accent, 0.25);

  const title = args.title || '';
  const subtitle = args.subtitle;
  const author = args.author;
  const date = args.date;
  const version = args.version;

  // ---- Gradient backdrop ----
  // Diagonal gradient from accent2 (top-left) → accent (bottom-right)
  const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  bgGrad.addColorStop(0, rgbCss(lighten(accent2, 0.05)));
  bgGrad.addColorStop(1, rgbCss(darken(accent, 0.1)));
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  // ---- Decorative iso shape (top-right corner) ----
  drawCornerDecoration(ctx, x + w - 100, y + 80, 60, accent);

  // ---- Title block (center-left) ----
  const titleX = x + PAD;
  const titleY = y + h / 2 - 24;
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.font = `900 ${Math.round(h * 0.16)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(String(title), titleX, titleY);

  // ---- Subtitle (below title) ----
  if (subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = `500 ${Math.round(h * 0.075)}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(String(subtitle), titleX, titleY + 12);
  }

  // ---- Metadata strip (bottom) ----
  const metaParts = [];
  if (author) metaParts.push(author);
  if (date) metaParts.push(date);
  if (version) metaParts.push(version);
  if (metaParts.length > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = `500 ${Math.round(h * 0.04)}px IBM Plex Mono, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const sep = '  ·  ';
    ctx.fillText(metaParts.join(sep), titleX, y + h - PAD);
  }
}

function drawCornerDecoration(ctx, cx, cy, size, color) {
  // Iso cube as decorative element
  const s = size * 0.42;
  const angle = Math.PI / 6;
  const dx = Math.cos(angle) * s;
  const dy = Math.sin(angle) * s;

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.25);
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;

  ctx.fillStyle = 'rgba(255,255,255,1)';
  // Right face
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + dx, cy - dy);
  ctx.lineTo(cx + dx, cy - dy + s * 2);
  ctx.lineTo(cx, cy + s * 2);
  ctx.closePath();
  ctx.fill();
  // Left face
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - dx, cy - dy);
  ctx.lineTo(cx - dx, cy - dy + s * 2);
  ctx.lineTo(cx, cy + s * 2);
  ctx.closePath();
  ctx.fill();
  // Top face
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - dx, cy - dy);
  ctx.lineTo(cx, cy - dy * 2);
  ctx.lineTo(cx + dx, cy - dy);
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

function darken(rgb, amt) {
  return [
    Math.max(0, rgb[0] * (1 - amt)),
    Math.max(0, rgb[1] * (1 - amt)),
    Math.max(0, rgb[2] * (1 - amt)),
  ];
}
