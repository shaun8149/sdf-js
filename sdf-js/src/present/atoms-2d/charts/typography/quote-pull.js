// =============================================================================
// atoms-2d/charts/typography/quote-pull.js — Large pull quote atom
// -----------------------------------------------------------------------------
// Text-only large pull quote. A decorative opening quote mark, the quote text
// word-wrapped to ~3 lines, author attribution line, optional title/org line,
// and an optional accent rule. No portrait image — text-forward slide.
//
// Args:
//   quote         — the quote text (REQUIRED)
//   author        — author name (e.g. "Peter Drucker")
//   attribution   — author title/org (e.g. "Management Consultant")
//   align         — 'left' (default) | 'center'
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'quote-pull',
  category: 'charts/typography',
  description:
    'Large pull quote — decorative quote mark, bold quote text, author + attribution line.',
  args: {
    quote: { type: 'string', required: true, example: 'Culture eats strategy for breakfast.' },
    author: { type: 'string?', example: 'Peter Drucker' },
    attribution: { type: 'string?', example: 'Management Consultant & Author' },
    align: { type: "'left'|'center'?", default: "'left'", example: 'left' },
  },
};

const PAD = 32;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 380;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const accent = palette.accent || palette.colors?.[0] || [60, 100, 200];
  const align = args.align === 'center' ? 'center' : 'left';

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const quoteText = String(args.quote || '');
  const author = args.author ? String(args.author) : '';
  const attribution = args.attribution ? String(args.attribution) : '';

  // Layout constants
  const markSize = Math.round(h * 0.25);
  const markX = align === 'center' ? x + w / 2 : x + PAD;
  const markY = y + PAD + markSize * 0.8; // baseline of the big quote mark

  // Decorative opening quotation mark
  ctx.save();
  ctx.fillStyle = rgbaCss(accent, 0.35);
  ctx.font = `900 ${markSize}px Georgia, serif`;
  ctx.textAlign = align === 'center' ? 'center' : 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('“', markX, markY);
  ctx.restore();

  // Quote text — large, below the mark
  const quoteFontSize = Math.round(h * 0.07);
  const quoteLeft = align === 'center' ? x + PAD : x + PAD;
  const quoteRight = x + w - PAD;
  const quoteMaxW = quoteRight - quoteLeft;
  const quoteTop = y + PAD + markSize * 0.55;

  ctx.save();
  ctx.fillStyle = rgbCss(fg);
  ctx.font = `500 ${quoteFontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;

  const quoteLines = wrapText(ctx, quoteText, quoteMaxW, 3);
  const lineH = quoteFontSize * 1.4;
  const quoteAnchorX = align === 'center' ? x + w / 2 : quoteLeft;
  quoteLines.forEach((line, i) => {
    ctx.fillText(line, quoteAnchorX, quoteTop + i * lineH);
  });
  ctx.restore();

  // Author line
  const authorTop = quoteTop + quoteLines.length * lineH + h * 0.05;
  if (author) {
    const authorFontSize = Math.round(h * 0.045);
    ctx.save();
    ctx.fillStyle = rgbCss(accent);
    ctx.font = `700 ${authorFontSize}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = align;
    ctx.fillText(author, quoteAnchorX, authorTop);
    ctx.restore();

    // Attribution (title/org) below author
    if (attribution) {
      const attrFontSize = Math.round(h * 0.032);
      ctx.save();
      ctx.fillStyle = rgbaCss(fg, 0.55);
      ctx.font = `500 ${attrFontSize}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.textAlign = align;
      ctx.fillText(attribution, quoteAnchorX, authorTop + authorFontSize * 1.4);
      ctx.restore();
    }

    // Accent rule below attribution (or author if no attribution)
    const ruleY =
      authorTop +
      (author ? Math.round(h * 0.045) * 1.4 : 0) +
      (attribution ? Math.round(h * 0.032) * 1.4 : 0) +
      h * 0.025;
    const ruleW = 80;
    const ruleX = align === 'center' ? x + w / 2 - ruleW / 2 : quoteLeft;
    ctx.save();
    ctx.fillStyle = rgbCss(accent);
    ctx.fillRect(ruleX, ruleY, ruleW, 3);
    ctx.restore();
  }
}

// Wrap text to maxLines. Returns array of line strings.
function wrapText(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      if (lines.length >= maxLines) break;
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}
