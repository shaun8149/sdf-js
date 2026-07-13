// =============================================================================
// atoms-2d/charts/lists/numbered-grid.js — Grid of numbered cards
// -----------------------------------------------------------------------------
// NxM grid of cells with numbered items. 3 styles: huge / circle / corner.
//
// Args:
//   title?       — optional heading
//   items        — array of { label, sublabel? } (4-12) REQUIRED
//   cols?        — number (auto: 3 for ≤6, else 4)
//   numberStyle? — 'circle'|'corner'|'huge' (default 'huge')
//   numberColor? — [r,g,b] array or omit for palette accent
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { pangu } from '../../cjk-text.js';

export const spec = {
  type: 'numbered-grid',
  category: 'charts/lists',
  description: 'NxM grid of numbered cards — huge/circle/corner number style variants.',
  args: {
    title: { type: 'string?', example: 'Growth Levers' },
    items: {
      type: 'array of { label, sublabel? } (4-12)',
      required: true,
      example: [
        { label: 'Product-led growth', sublabel: 'Freemium → paid conversion' },
        { label: 'Partner channel', sublabel: '40+ resellers' },
        { label: 'Content marketing', sublabel: 'SEO-first blog' },
        { label: 'Enterprise sales', sublabel: 'Direct outbound' },
      ],
    },
    cols: { type: 'number?', default: 'auto (3 for ≤6, else 4)', example: 2 },
    numberStyle: { type: "'circle'|'corner'|'huge'?", default: "'huge'", example: 'huge' },
    numberColor: { type: '[r,g,b]?', example: null },
  },
};

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

// Auto-shrink font size until text fits in maxW (no truncation). Returns the
// font-size that fits. Caller still must `ctx.font = ...` before measuring/drawing.
function fitFontSize(ctx, text, maxW, targetFs, minFs, fontSpec) {
  let fs = targetFs;
  while (fs > minFs) {
    ctx.font = fontSpec(fs);
    if (ctx.measureText(text).width <= maxW) return fs;
    fs--;
  }
  return minFs;
}

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const items = Array.isArray(args.items) ? args.items : [];
  const accent = palette.accent ?? [30, 80, 180];
  const themeFg = palette.silhouetteColor ?? [20, 28, 50];
  const fgLum = (0.2126 * themeFg[0] + 0.7152 * themeFg[1] + 0.0722 * themeFg[2]) / 255;
  const fg = fgLum > 0.55 ? [42, 44, 50] : themeFg; // Sprint 87: 白卡钉深墨

  const bgColor = palette.bg ?? [248, 246, 240];
  const numberStyle = args.numberStyle ?? 'huge';
  const numColor = Array.isArray(args.numberColor) ? args.numberColor : accent;

  // Background
  ctx.fillStyle = rgbCss(bgColor);
  ctx.fillRect(x, y, w, h);

  const PAD = 24;
  let plotTop = y + PAD;

  // Title
  if (args.title) {
    const titleFs = Math.round(h * 0.07);
    ctx.font = `700 ${titleFs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbCss(fg);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + w / 2, plotTop);
    plotTop += titleFs + PAD;
  }

  if (!items.length) return;

  const cols = args.cols ?? (items.length <= 6 ? 3 : 4);
  const rows = Math.ceil(items.length / cols);
  const colW = (w - PAD * 2) / cols;
  const availH = h - (plotTop - y) - PAD;
  const rowH = availH / rows;

  // Sprint 74 redesign (user: 末页不够美观, 颜色也不好): cards rotate
  // through the theme hues — tinted wash + hue top-bar + hue number chip —
  // and an incomplete last row centres itself instead of leaving a hole.
  const hues = (palette.colors || []).filter(Array.isArray);
  const hueOf = (i) => (hues.length > 1 ? hues[i % hues.length] : numColor);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const inLastRow = row === rows - 1;
    const lastRowCount = items.length - (rows - 1) * cols;
    const rowShift = inLastRow && lastRowCount < cols ? ((cols - lastRowCount) * colW) / 2 : 0;
    const cellX = x + PAD + col * colW + rowShift;
    const cellY = plotTop + row * rowH;
    const cellPad = 12;
    const cardMargin = 6;
    const cardX = cellX + cardMargin;
    const cardY = cellY + cardMargin;
    const cardW = colW - cardMargin * 2;
    const cardH = rowH - cardMargin * 2;
    const numLabel = String(i + 1);
    const hue = hueOf(i);

    // Card: soft hue-tinted wash + hairline + hue top-bar
    ctx.fillStyle = rgbaCss(hue, 0.07);
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.strokeStyle = rgbaCss(hue, 0.22);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 8);
    ctx.clip();
    ctx.fillStyle = rgbaCss(hue, 0.85);
    ctx.fillRect(cardX, cardY, cardW, 4);
    ctx.restore();

    if (numberStyle === 'huge') {
      const numFontSize = Math.min(Math.round(rowH * 0.45), 72);
      ctx.font = `900 ${numFontSize}px "Inter Display", Inter, system-ui`;
      ctx.fillStyle = rgbaCss(hue, 0.9);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const numX = cellX + cellPad + numFontSize * 0.05;
      const numY = cellY + cellPad;
      // Reserve the number column's ACTUAL measured width (was a fixed
      // numFontSize*0.65 guess that didn't match glyph metrics — digits like
      // "2"/"4" at 900 weight measure wider than that, so the label text
      // started underneath the glyph instead of after it).
      const numW = ctx.measureText(numLabel).width;
      ctx.fillText(numLabel, numX, numY);

      const textX = numX + numW + 8;
      const textMaxW = cellX + colW - cardMargin - cellPad - textX;
      const labelTarget = Math.round(rowH * 0.14);
      const labelFs = fitFontSize(
        ctx,
        pangu(item.label ?? ''),
        textMaxW,
        labelTarget,
        10,
        (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
      );
      ctx.font = `700 ${labelFs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = rgbCss(fg);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(pangu(item.label ?? ''), textX, cellY + cellPad + Math.round(rowH * 0.12));

      if (item.sublabel) {
        const subTarget = Math.round(rowH * 0.1);
        const subFs = fitFontSize(
          ctx,
          pangu(item.sublabel),
          textMaxW,
          subTarget,
          9,
          (fs) => `500 ${fs}px Inter, system-ui`,
        );
        ctx.font = `500 ${subFs}px Inter, system-ui`;
        ctx.fillStyle = rgbaCss(fg, 0.5);
        ctx.fillText(
          pangu(item.sublabel),
          textX,
          cellY + cellPad + Math.round(rowH * 0.12) + labelFs + 4,
        );
      }
    } else if (numberStyle === 'circle') {
      const circleR = Math.min(rowH * 0.2, colW * 0.14, 28);
      const circleCX = cellX + cellPad + circleR;
      const circleCY = cellY + cellPad + circleR;
      ctx.fillStyle = rgbCss(hue);
      ctx.beginPath();
      ctx.arc(circleCX, circleCY, circleR, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `700 ${Math.round(circleR * 1.1)}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(numLabel, circleCX, circleCY);

      const cx = cellX + colW / 2;
      const textMaxW = cardW - cellPad * 2;
      const labelTarget = Math.round(rowH * 0.14);
      const labelFs = fitFontSize(
        ctx,
        pangu(item.label ?? ''),
        textMaxW,
        labelTarget,
        10,
        (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
      );
      ctx.font = `700 ${labelFs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = rgbCss(fg);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelY = circleCY + circleR + 8;
      ctx.fillText(pangu(item.label ?? ''), cx, labelY);

      if (item.sublabel) {
        const subTarget = Math.round(rowH * 0.1);
        const subFs = fitFontSize(
          ctx,
          pangu(item.sublabel),
          textMaxW,
          subTarget,
          9,
          (fs) => `500 ${fs}px Inter, system-ui`,
        );
        ctx.font = `500 ${subFs}px Inter, system-ui`;
        ctx.fillStyle = rgbaCss(fg, 0.5);
        ctx.fillText(pangu(item.sublabel), cx, labelY + labelFs + 4);
      }
    } else if (numberStyle === 'corner') {
      // Badge top-right
      const badgeW = 26;
      const badgeH = 22;
      const badgeX = cardX + cardW - cellPad - badgeW;
      const badgeY = cardY + cellPad;
      ctx.fillStyle = rgbCss(numColor);
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeH / 2);
      ctx.fill();
      ctx.font = `700 11px Inter, system-ui`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(numLabel, badgeX + badgeW / 2, badgeY + badgeH / 2);

      // Label centered vertically
      const cx = cardX + cardW / 2;
      const textMaxW = cardW - cellPad * 2;
      const labelTarget = Math.round(rowH * 0.14);
      const labelFs = fitFontSize(
        ctx,
        pangu(item.label ?? ''),
        textMaxW,
        labelTarget,
        10,
        (fs) => `700 ${fs}px Inter, system-ui, sans-serif`,
      );
      const centerY = cardY + cardH / 2;
      ctx.font = `700 ${labelFs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = rgbCss(fg);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pangu(item.label ?? ''), cx, item.sublabel ? centerY - labelFs * 0.4 : centerY);

      if (item.sublabel) {
        const subTarget = Math.round(rowH * 0.1);
        const subFs = fitFontSize(
          ctx,
          pangu(item.sublabel),
          textMaxW,
          subTarget,
          9,
          (fs) => `500 ${fs}px Inter, system-ui`,
        );
        ctx.font = `500 ${subFs}px Inter, system-ui`;
        ctx.fillStyle = rgbaCss(fg, 0.5);
        ctx.textBaseline = 'top';
        ctx.fillText(pangu(item.sublabel), cx, centerY + labelFs * 0.2);
      }
    }
  }
}
