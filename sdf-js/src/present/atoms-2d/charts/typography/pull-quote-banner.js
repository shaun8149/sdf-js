// =============================================================================
// atoms-2d/charts/typography/pull-quote-banner.js — Full-bleed hero quote banner
// -----------------------------------------------------------------------------
// Full-width banner with accent/dark/gradient background + large white quote +
// attribution. "Hero quote slide" pattern — contrast with quote-pull (white bg).
//
// Args:
//   quote        — the quote text (REQUIRED)
//   author?      — author name
//   attribution? — author title/org
//   bg?          — 'accent' | 'dark' | 'gradient' (default: 'accent')
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'pull-quote-banner',
  category: 'charts/typography',
  description:
    'Full-bleed hero quote banner — accent/dark/gradient bg, large white centered quote + attribution. Hero quote slide.',
  args: {
    quote: {
      type: 'string',
      required: true,
      example: "We don't just sell software — we transform how teams work.",
    },
    author: { type: 'string?', example: 'Sarah Chen' },
    attribution: { type: 'string?', example: 'CEO, Meridian Analytics' },
    bg: { type: "'accent'|'dark'|'gradient'?", default: "'accent'", example: 'accent' },
  },
};

const PAD = 48;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const accent = palette.accent || palette.colors?.[0] || [60, 100, 200];
  const colors = palette.colors || [accent];
  const bgMode = args.bg || 'accent';

  // Full-bleed background
  if (bgMode === 'gradient' && colors.length >= 2) {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, rgbCss(colors[0]));
    grad.addColorStop(1, rgbCss(colors[Math.min(colors.length - 1, 2)]));
    ctx.fillStyle = grad;
  } else if (bgMode === 'dark') {
    ctx.fillStyle = 'rgb(18,20,28)';
  } else {
    // accent
    ctx.fillStyle = rgbCss(accent);
  }
  ctx.fillRect(x, y, w, h);

  // Decorative large opening quote mark (subtle, back-layer)
  const markSize = Math.round(h * 0.6);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.font = `900 ${markSize}px Georgia, serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('"', x + PAD * 0.5, y - markSize * 0.15);
  ctx.restore();

  const quoteText = String(args.quote || '');
  const author = args.author ? String(args.author) : '';
  const attribution = args.attribution ? String(args.attribution) : '';

  // Quote text — centered, auto-shrink for long quotes, word-wrap max 4 lines
  let quoteFontSize = Math.round(h * 0.13);
  const maxQuoteW = w - PAD * 2;
  const maxLines = 4;

  // Iteratively shrink until 4 lines fit
  ctx.font = `500 ${quoteFontSize}px Inter, system-ui, sans-serif`;
  let lines = wrapText(ctx, quoteText, maxQuoteW, maxLines);
  while (quoteFontSize > 18 && lines.length > maxLines) {
    quoteFontSize--;
    ctx.font = `500 ${quoteFontSize}px Inter, system-ui, sans-serif`;
    lines = wrapText(ctx, quoteText, maxQuoteW, maxLines);
  }

  const lineH = quoteFontSize * 1.35;
  const totalTextH =
    lines.length * lineH +
    (author ? quoteFontSize * 0.15 + h * 0.06 : 0) +
    (attribution ? h * 0.04 : 0) +
    (author ? h * 0.04 : 0);
  const textBlockTop = y + (h - totalTextH) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `500 ${quoteFontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + w / 2, textBlockTop + i * lineH);
  });
  ctx.restore();

  // Accent rule
  const ruleY = textBlockTop + lines.length * lineH + h * 0.025;
  const ruleW = 60;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(x + w / 2 - ruleW / 2, ruleY, ruleW, 3);
  ctx.restore();

  // Author
  const authorY = ruleY + 3 + h * 0.025;
  if (author) {
    const authorFontSize = Math.round(h * 0.06);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = `700 ${authorFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(author, x + w / 2, authorY);
    ctx.restore();

    // Attribution
    if (attribution) {
      const attrFontSize = Math.round(h * 0.04);
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = `500 ${attrFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(attribution, x + w / 2, authorY + Math.round(h * 0.06) * 1.4);
      ctx.restore();
    }
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
      if (lines.length >= maxLines) return lines;
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}
