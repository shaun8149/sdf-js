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
    style: {
      type: "'gradient'|'section'?",
      default: "'gradient'",
      example: 'section',
    },
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
  const style = args.style || 'gradient';

  // ---- Backdrop: gradient (default) or section (deep accent + accent box behind title) ----
  if (style === 'section') {
    // Deep solid backdrop + decorative title-box behind text (PL D3180/031 pattern)
    ctx.fillStyle = rgbCss(darken(accent, 0.32));
    ctx.fillRect(x, y, w, h);
  } else {
    // Default: subtle diagonal gradient — accent → lighten(accent, 0.20).
    // Sprint 72 (section accents brought LIGHT hues like gold): white title
    // text needs the band to carry it — light accents deepen the gradient
    // instead of switching text to ink, so the hue stays recognizable and
    // the type stays consistent across sections. WCAG luminance gate; dark
    // accents (every pre-spectrum theme) hit the old branch byte-for-byte.
    const lum = (0.2126 * accent[0] + 0.7152 * accent[1] + 0.0722 * accent[2]) / 255;
    const isLight = lum > 0.42;
    const bgGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    bgGrad.addColorStop(0, rgbCss(darken(accent, isLight ? 0.34 : 0.05)));
    bgGrad.addColorStop(1, rgbCss(isLight ? darken(accent, 0.1) : lighten(accent, 0.2)));
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);
  }

  // ---- Thin top-band hairline (stage-strip feel) ----
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.fillRect(x, y, w, 2);
  ctx.restore();

  // ---- Title block — vertical center, left-aligned ----
  // Scale font relative to h but cap so short-strip (h≈100) stays readable.
  // Then SHRINK-TO-FIT the width (Sprint 36 visual audit: long a16z-style
  // titles at 72px ran ~400px past the right edge — cover had no width
  // fitting at all). Floor 20px; at the floor a still-too-long title is the
  // author's problem to shorten, not ours to clip.
  let titleSize = Math.max(18, Math.min(Math.round(h * 0.14), 72));
  {
    const maxW = w - PAD * 2;
    ctx.save();
    for (; titleSize > 20; titleSize--) {
      ctx.font = `900 ${titleSize}px "Inter Display", Inter, system-ui, sans-serif`;
      if (ctx.measureText(String(title)).width <= maxW) break;
    }
    ctx.restore();
  }
  let subtitleSize = Math.max(12, Math.min(Math.round(h * 0.065), 28));
  if (subtitle) {
    const maxW = w - PAD * 2;
    ctx.save();
    for (; subtitleSize > 11; subtitleSize--) {
      ctx.font = `500 ${subtitleSize}px Inter, system-ui, sans-serif`;
      if (ctx.measureText(String(subtitle)).width <= maxW) break;
    }
    ctx.restore();
  }
  const metaSize = Math.max(10, Math.min(Math.round(h * 0.038), 14));

  const titleX = x + PAD;

  // Vertical layout: start from center, nudge up slightly
  const blockH = titleSize + (subtitle ? subtitleSize + 8 : 0);
  const blockTop = y + (h - blockH) / 2 - (h > 160 ? 10 : 0);

  // Title — for section style, draw accent box behind title (PL signature)
  if (style === 'section') {
    ctx.font = `900 ${titleSize}px "Inter Display", Inter, system-ui, sans-serif`;
    const titleW = ctx.measureText(String(title)).width;
    const boxX = titleX - 14;
    const boxY = blockTop - 6;
    const boxW = titleW + 28;
    const boxH = titleSize + 14;
    ctx.fillStyle = `rgba(${lighten(accent, 0.15)
      .map((c) => Math.round(c))
      .join(',')},0.85)`;
    ctx.fillRect(boxX, boxY, boxW, boxH);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.font = `900 ${titleSize}px "Inter Display", Inter, system-ui, sans-serif`;
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
