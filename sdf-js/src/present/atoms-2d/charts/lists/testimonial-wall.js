// =============================================================================
// atoms-2d/charts/lists/testimonial-wall.js — 3 customer testimonial cards
// -----------------------------------------------------------------------------
// Social proof page: 3 cards in a row, each with pull-quote + name + role.
// PL "What our customers say" pattern. Different from quote-pull (single hero
// quote) — this is N cards in a grid for comparative social proof.
//
// Args:
//   title        — optional heading
//   testimonials — array of { quote, name, role? } (2-4) REQUIRED
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'testimonial-wall',
  category: 'charts/lists',
  description:
    '3 customer testimonial cards in a row. Each: quote + name + role. PL social proof / "what customers say" pattern.',
  args: {
    title: { type: 'string?', example: 'What Our Customers Say' },
    testimonials: {
      type: 'array of { quote, name, role? } (2-4)',
      required: true,
      example: [
        {
          quote: 'Cut our deployment time from 2 weeks to 2 hours.',
          name: 'Sarah Chen',
          role: 'VP Engineering, Acme Corp',
        },
        {
          quote: 'The dashboard is the first thing my team opens every morning.',
          name: 'Marcus Johnson',
          role: 'CFO, BrightWave',
        },
        {
          quote: "Onboarding was the easiest we've ever done. 3 days to value.",
          name: 'Priya Sharma',
          role: 'COO, Meridian',
        },
      ],
    },
  },
};

function wrapText(ctx, text, maxW, maxLines = 5) {
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

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor ?? [20, 28, 50];
  const bgColor = palette.bg ?? [248, 246, 240];
  const accent = palette.accent ?? [30, 80, 180];
  const colors = palette.colors ?? [
    [30, 80, 180],
    [60, 180, 140],
    [200, 120, 60],
  ];
  const testimonials = Array.isArray(args.testimonials) ? args.testimonials : [];

  ctx.fillStyle = rgbCss(bgColor);
  ctx.fillRect(x, y, w, h);

  const PAD = 20;
  let plotTop = y + PAD;

  if (args.title) {
    const titleFs = Math.round(h * 0.07);
    ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + w / 2, plotTop);
    plotTop += titleFs + PAD;
  }

  if (!testimonials.length) return;

  const n = Math.min(4, Math.max(2, testimonials.length));
  const GAP = 14;
  const colW = (w - PAD * 2 - GAP * (n - 1)) / n;
  const availH = h - (plotTop - y) - PAD;
  const CARD_PAD = 16;

  for (let i = 0; i < n; i++) {
    const t = testimonials[i] || {};
    const colX = x + PAD + i * (colW + GAP);
    const colY = plotTop;
    const cardColor = colors[i % colors.length] || accent;

    // Card background
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.10)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(colX, colY, colW, availH, 8);
    ctx.fill();
    ctx.restore();

    // Left accent border (3px)
    ctx.save();
    ctx.fillStyle = rgbCss(cardColor);
    ctx.beginPath();
    ctx.roundRect(colX, colY, 4, availH, [4, 0, 0, 4]);
    ctx.fill();
    ctx.restore();

    let curY = colY + CARD_PAD;

    // Decorative quote mark
    const markSize = Math.round(availH * 0.18);
    ctx.save();
    ctx.fillStyle = rgbaCss(accent, 0.25);
    ctx.font = `900 ${markSize}px Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('"', colX + CARD_PAD + 6, curY - 4);
    ctx.restore();
    curY += Math.round(markSize * 0.55);

    // Quote text
    const quoteFs = Math.min(Math.round(availH * 0.058), 14);
    ctx.font = `500 ${quoteFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (t.quote) {
      const lines = wrapText(ctx, t.quote, colW - CARD_PAD * 2, 5);
      for (const line of lines) {
        ctx.fillText(line, colX + colW / 2, curY);
        curY += quoteFs * 1.4;
      }
    }

    // Name
    const nameFs = Math.min(Math.round(availH * 0.05), 14);
    ctx.font = `700 ${nameFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(cardColor);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    if (t.name) {
      ctx.fillText(t.name, colX + colW / 2, colY + availH - CARD_PAD - (t.role ? nameFs * 1.4 : 0));
    }

    // Role/company
    if (t.role) {
      const roleFs = Math.min(Math.round(availH * 0.036), 11);
      ctx.font = `500 ${roleFs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = rgbaCss(fg, 0.5);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(t.role, colX + colW / 2, colY + availH - CARD_PAD);
    }
  }
}
