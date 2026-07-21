// =============================================================================
// atoms-2d/charts/diagrams/strategy-map.js — Kaplan/Norton Balanced Scorecard
// -----------------------------------------------------------------------------
// 4-perspective strategy map: horizontal strips stacked. Each strip has a
// labelled band on the left + item cards on the right.
//
// Args:
//   title?        — optional heading
//   perspectives  — array of { label, items: string[] } (3-5, REQUIRED)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'strategy-map',
  category: 'charts/diagrams',
  description:
    'Kaplan/Norton balanced scorecard — 4 horizontal perspective rows stacked top-to-bottom with N items each.',
  args: {
    title: { type: 'string?', example: 'Strategic Objectives' },
    perspectives: {
      type: 'array of { label, items: string[] (2-5) } (3-5)',
      required: true,
      example: [
        { label: 'Financial', items: ['Revenue growth 30%', 'Margin expansion'] },
        { label: 'Customer', items: ['NPS 50+', 'Retention 95%', 'Brand'] },
        { label: 'Internal Process', items: ['Ops efficiency', 'Quality', 'Time-to-market'] },
        { label: 'Learning & Growth', items: ['Talent', 'Skills', 'Culture'] },
      ],
    },
  },
};

function fitFontSize(ctx, text, maxW, target, min, specFn) {
  let fs = target;
  while (fs > min) {
    ctx.font = specFn(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return min;
}

// fitFontSize bottoms out at `min` and gives up — long text (e.g. "Learning
// & Growth" in the rotated perspective label, where maxW is bounded by the
// row height) can still overflow past that at the floor size. Truncate with
// an ellipsis as a last resort so it never bleeds into a neighboring row/card.
// Assumes ctx.font is already set to the size being used.
function truncateToWidth(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid) + '…';
    if (ctx.measureText(candidate).width <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + '…' : '…';
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const accent = palette.accent ?? [42, 130, 200];
  const fg = palette.silhouetteColor ?? [20, 28, 50];
  const bg = palette.bg ?? [248, 246, 240];
  const colors = palette.colors || [accent, [80, 160, 80], [200, 120, 60], [140, 80, 200]];
  const persp = Array.isArray(args.perspectives) ? args.perspectives : [];

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const PAD = 16;
  let plotTop = y + PAD;

  // Title
  if (args.title) {
    const titleFs = Math.round(h * 0.07);
    ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, plotTop);
    plotTop += titleFs + PAD * 0.5;
  }

  if (!persp.length) return;

  const LABEL_W = Math.round(w * 0.14);
  const rowH = (y + h - plotTop - PAD) / persp.length;
  const cardAreaW = w - LABEL_W - PAD * 2;

  for (let pi = 0; pi < persp.length; pi++) {
    const p = persp[pi];
    const rowY = plotTop + pi * rowH;
    const color = colors[pi % colors.length];
    const items = Array.isArray(p.items) ? p.items.slice(0, 5) : [];

    // Row background alternating subtle tint
    ctx.fillStyle = rgbaCss(color, pi % 2 === 0 ? 0.05 : 0.02);
    ctx.fillRect(x, rowY, w, rowH);

    // Perspective label band
    ctx.fillStyle = rgbCss(color);
    ctx.fillRect(x, rowY, LABEL_W, rowH);

    // Perspective label text (vertical centering via rotation)
    const labelFs = fitFontSize(
      ctx,
      p.label ?? '',
      rowH - 8, // rotated so maxW = rowH
      Math.round(LABEL_W * 0.3),
      9,
      (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
    );
    ctx.save();
    ctx.translate(x + LABEL_W / 2, rowY + rowH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = `700 ${labelFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss([255, 255, 255]);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelText = truncateToWidth(ctx, p.label ?? '', rowH - 8);
    ctx.fillText(labelText, 0, 0);
    ctx.restore();

    // Item cards in the right area
    if (items.length) {
      const cardGap = 8;
      const cardW = (cardAreaW - cardGap * (items.length - 1)) / items.length;
      const cardH = rowH - PAD;
      const cardY = rowY + PAD / 2;
      const cardX0 = x + LABEL_W + PAD;

      for (let ci = 0; ci < items.length; ci++) {
        const cardX = cardX0 + ci * (cardW + cardGap);

        // Card background
        ctx.fillStyle = rgbCss([255, 255, 255]);
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 4);
        ctx.fill();
        ctx.strokeStyle = rgbaCss(color, 0.4);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Left accent bar
        ctx.fillStyle = rgbCss(lighten(color, 0.2));
        ctx.fillRect(cardX, cardY, 3, cardH);

        // Item text
        const itemText = String(items[ci] || '');
        const textFs = fitFontSize(
          ctx,
          itemText,
          cardW - 12,
          Math.round(cardH * 0.28),
          9,
          (fs) => `600 ${fs}px Inter, system-ui, sans-serif`,
        );
        ctx.font = `600 ${textFs}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = rgbCss(fg);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayItemText = truncateToWidth(ctx, itemText, cardW - 12);
        ctx.fillText(displayItemText, cardX + cardW / 2, cardY + cardH / 2);
      }
    }

    // Divider line between rows
    if (pi < persp.length - 1) {
      ctx.strokeStyle = rgbaCss(fg, 0.1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, rowY + rowH);
      ctx.lineTo(x + w, rowY + rowH);
      ctx.stroke();
    }
  }
}
