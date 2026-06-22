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

const PAD = 24;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const colors = palette.colors || [
    [60, 100, 200],
    [120, 60, 180],
  ];
  const accent = colors[0];

  const title = args.title || '';
  const subtitle = args.subtitle;
  const author = args.author;
  const date = args.date;
  const version = args.version;

  // ---- Subtle diagonal gradient backdrop ----
  // accent at top-left → lighten(accent, 0.20) bottom-right. Capped saturation.
  const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  bgGrad.addColorStop(0, rgbCss(darken(accent, 0.05)));
  bgGrad.addColorStop(1, rgbCss(lighten(accent, 0.2)));
  ctx.fillStyle = bgGrad;
  ctx.fillRect(x, y, w, h);

  // ---- Thin top-band hairline (stage-strip feel) ----
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.fillRect(x, y, w, 2);
  ctx.restore();

  // ---- Title block — vertical center, left-aligned ----
  // Scale font relative to h but cap so short-strip (h≈100) stays readable.
  const titleSize = Math.max(18, Math.min(Math.round(h * 0.14), 72));
  const subtitleSize = Math.max(12, Math.min(Math.round(h * 0.065), 28));
  const metaSize = Math.max(10, Math.min(Math.round(h * 0.038), 14));

  const titleX = x + PAD;

  // Vertical layout: start from center, nudge up slightly
  const blockH = titleSize + (subtitle ? subtitleSize + 8 : 0);
  const blockTop = y + (h - blockH) / 2 - (h > 160 ? 10 : 0);

  // Title
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.font = `900 ${titleSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(String(title), titleX, blockTop);

  // Subtitle
  if (subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `500 ${subtitleSize}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(String(subtitle), titleX, blockTop + titleSize + 8);
  }

  // ---- Metadata strip — bottom-right ----
  const metaParts = [];
  if (author) metaParts.push(author);
  if (date) metaParts.push(date);
  if (version) metaParts.push(version);
  if (metaParts.length > 0 && h > 80) {
    ctx.fillStyle = 'rgba(255,255,255,0.60)';
    ctx.font = `500 ${metaSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    const sep = '  ·  ';
    ctx.fillText(metaParts.join(sep), x + w - PAD, y + h - PAD * 0.6);
  }
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
