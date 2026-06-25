// =============================================================================
// atoms-2d/charts/lists/number-list.js — Large numbered vertical list
// -----------------------------------------------------------------------------
// Big number column on left + label/sublabel. PL "1. 2. 3. 4." pattern.
// Different from agenda-list (which has small numbered chips).
//
// Args:
//   title?        — optional heading
//   items         — array of { label, sublabel? } (3-9) REQUIRED
//   numberStyle   — 'circle'|'plain'|'outline'? (default 'circle')
//   numberColor   — string? CSS rgb (default palette.accent)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'number-list',
  category: 'charts/lists',
  description:
    'Large numbered vertical list — big number column on left (circle/plain/outline), label + sublabel.',
  args: {
    title: { type: 'string?', example: 'Top Priorities' },
    items: {
      type: 'array of { label, sublabel? } (3-9)',
      required: true,
      example: [
        { label: 'Define the problem space', sublabel: 'Research & discovery' },
        { label: 'Prototype rapidly', sublabel: 'Build-measure-learn' },
        { label: 'Ship and iterate', sublabel: 'Continuous delivery' },
      ],
    },
    numberStyle: { type: "'circle'|'plain'|'outline'?", default: "'circle'", example: 'circle' },
    numberColor: { type: 'string?', example: null },
  },
};

const PAD = 20;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 380;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const accent = palette.accent || palette.colors?.[0] || [60, 100, 200];

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const rawItems = Array.isArray(args.items) ? args.items.slice(0, 9) : [];
  const items = rawItems.map((it) => {
    if (typeof it === 'string') return { label: it };
    if (!it || typeof it !== 'object') return { label: '' };
    return {
      label: it.label || it.text || it.name || it.title || '',
      sublabel: it.sublabel || it.subtitle || it.description || '',
    };
  });
  const N = items.length;
  if (N === 0) return;

  const numStyle = args.numberStyle || 'circle';

  // Title bar
  let plotTop = y + PAD;
  if (args.title) {
    const titleFontSize = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.title), x + PAD, plotTop);
    plotTop += titleFontSize + 14;
  }

  const availH = h - (plotTop - y) - PAD;
  const rowH = availH / N;

  // Number column width: ~15% of total height (design spec), capped
  const numColW = Math.min(Math.round(h * 0.15), Math.round(rowH * 0.9), 80);
  const textX = x + PAD + numColW + 18;
  const textRight = x + w - PAD;

  for (let i = 0; i < N; i++) {
    const it = items[i];
    const rowTop = plotTop + i * rowH;
    const rowCY = rowTop + rowH / 2;
    const numLabel = String(i + 1);

    // Number column
    const numFontSize = Math.round(rowH * 0.55);
    const circleR = Math.min(rowH * 0.35, numColW * 0.48);
    const numCX = x + PAD + numColW / 2;

    if (numStyle === 'circle') {
      // Filled circle with white number
      ctx.save();
      ctx.fillStyle = rgbCss(accent);
      ctx.beginPath();
      ctx.arc(numCX, rowCY, circleR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      ctx.font = `700 ${Math.round(circleR * 1.1)}px "Inter Display", Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(numLabel, numCX, rowCY);
      ctx.restore();
    } else if (numStyle === 'outline') {
      // Stroked circle with accent number
      ctx.save();
      ctx.strokeStyle = rgbCss(accent);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(numCX, rowCY, circleR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = rgbCss(accent);
      ctx.font = `700 ${Math.round(circleR * 1.1)}px "Inter Display", Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(numLabel, numCX, rowCY);
      ctx.restore();
    } else {
      // plain — just big number in accent color
      ctx.save();
      ctx.fillStyle = rgbCss(accent);
      ctx.font = `900 ${numFontSize}px "Inter Display", Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(numLabel, numCX, rowCY);
      ctx.restore();
    }

    // Label
    const hasSub = Boolean(it.sublabel);
    const labelFontSize = Math.round(rowH * 0.28);
    const subFontSize = Math.round(rowH * 0.2);
    const maxTextW = textRight - textX;

    const labelY = hasSub ? rowCY - labelFontSize * 0.55 : rowCY;

    ctx.save();
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${labelFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, String(it.label), maxTextW), textX, labelY);
    ctx.restore();

    if (hasSub) {
      ctx.save();
      ctx.fillStyle = rgbaCss(fg, 0.55);
      ctx.font = `500 ${subFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        fitText(ctx, String(it.sublabel), maxTextW),
        textX,
        rowCY + labelFontSize * 0.55,
      );
      ctx.restore();
    }

    // Thin divider (not after last row)
    if (i < N - 1) {
      ctx.save();
      ctx.strokeStyle = rgbaCss(fg, 0.1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(textX, plotTop + (i + 1) * rowH);
      ctx.lineTo(textRight, plotTop + (i + 1) * rowH);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
