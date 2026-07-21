// =============================================================================
// atoms-2d/charts/data/stat-banner.js
// One-line highlight banner: big number + label + optional trend chip.
// Full-width banner with accent-color background.
//
// Args:
//   value          — metric value string e.g. "$24M" (REQUIRED)
//   label          — descriptive label e.g. "Annual Recurring Revenue" (REQUIRED)
//   trend?         — trend text e.g. "+117%" or "↑ 32 pts"
//   trendDirection? — 'up' | 'down' | 'flat'
//   bg?            — override banner bg [r,g,b]
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { semanticColor } from '../../color.js';

export const spec = {
  type: 'stat-banner',
  category: 'charts/data',
  description:
    'One-line highlight banner — large value, label, and optional trend chip on accent background.',
  args: {
    value: { type: 'string', required: true, example: '$24M' },
    label: { type: 'string', required: true, example: 'Annual Recurring Revenue' },
    trend: { type: 'string?', example: '+117% YoY' },
    trendDirection: { type: "'up'|'down'|'flat'?", default: "'up'", example: 'up' },
    bg: { type: 'array?', example: null },
  },
};

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const bgColor = palette.bg || [248, 246, 240];
  const accent = palette.accent || palette.colors?.[0] || [42, 184, 168];

  const value = String(args.value || '—');
  const label = String(args.label || '');
  const trend = args.trend ? String(args.trend) : '';
  const dir = args.trendDirection || 'up';

  // Banner fills entire canvas area — acts as a full-bleed highlight
  const bannerH = Math.round(h * 0.35);
  const bannerY = y + Math.round((h - bannerH) / 2);

  // Outer page background
  ctx.fillStyle = rgbCss(bgColor);
  ctx.fillRect(x, y, w, h);

  // Accent banner background
  const bannerColor = Array.isArray(args.bg) ? args.bg : accent;
  ctx.fillStyle = rgbCss(bannerColor);
  ctx.fillRect(x, bannerY, w, bannerH);

  const PAD = Math.round(w * 0.04);
  const cy = bannerY + bannerH / 2;

  // Value — very large, left-aligned, FITTED to the banner width (Sprint 64:
  // a live financial deck put "Record Quarter" in a 392px sidebar banner and
  // sailed past the canvas edge — the value never gets to leave the banner)
  let valueFontSize = Math.round(bannerH * 0.58);
  const valueFont = () => `900 ${valueFontSize}px "Inter Display", Inter, system-ui, sans-serif`;
  ctx.save();
  ctx.font = valueFont();
  let valueW = ctx.measureText(value).width;
  while (valueW > w - PAD * 2 && valueFontSize > 14) {
    valueFontSize -= 2;
    ctx.font = valueFont();
    valueW = ctx.measureText(value).width;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x + PAD, cy);
  ctx.restore();

  const labelPad = PAD * 1.5;
  const labelX = x + PAD + valueW + labelPad;

  // Trend chip metrics computed FIRST (chip size only depends on trend text,
  // not on the label) so the label can reserve exactly the space that's left
  // over — previously labelAvailW was a fixed w*0.45 guess that had no
  // relation to the chip's actual width/position, so long labels ("Annual
  // Recurring Revenue") ran straight under the chip.
  const chipPad = 10;
  const chipFontSize = Math.round(bannerH * 0.2);
  const chipGap = PAD * 0.6;
  let chipW = 0;
  let chipH = 0;
  if (trend) {
    ctx.save();
    ctx.font = `700 ${chipFontSize}px Inter, system-ui, sans-serif`;
    chipW = ctx.measureText(trend).width + chipPad * 2.5;
    chipH = chipFontSize * 1.8;
    ctx.restore();
  }

  // Label — smaller, middle. Shrink font (down to labelMinFs) until it fits
  // the space before the chip; if it STILL doesn't fit at min size, fall
  // back to moving the chip to the top-right corner (above the label) so
  // the label can reclaim the full row width.
  const labelTarget = Math.round(bannerH * 0.2);
  const labelMinFs = 11;
  const inlineAvailW = trend ? x + w - PAD - chipW - chipGap - labelX : w - (labelX - x) - PAD;

  let { fs: labelFontSize, lines: labelLines } = fitLabelSize(
    ctx,
    label,
    inlineAvailW,
    labelTarget,
    labelMinFs,
    2,
  );

  let chipMode = 'inline';
  if (trend) {
    ctx.save();
    ctx.font = `500 ${labelFontSize}px Inter, system-ui, sans-serif`;
    const stillOverlaps = labelLines.some((l) => ctx.measureText(l).width > inlineAvailW);
    ctx.restore();
    if (stillOverlaps) {
      chipMode = 'top-right';
      const fullAvailW = w - (labelX - x) - PAD;
      ({ fs: labelFontSize, lines: labelLines } = fitLabelSize(
        ctx,
        label,
        fullAvailW,
        labelTarget,
        labelMinFs,
        2,
      ));
    }
  }

  const lineH = labelFontSize * 1.3;
  const labelBlockH = labelLines.length * lineH;
  const topPad = 6;
  const chipYInline = cy - chipH / 2;
  const labelTop =
    chipMode === 'top-right'
      ? Math.max(cy - labelBlockH / 2, bannerY + topPad + chipH + 6)
      : cy - labelBlockH / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `500 ${labelFontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  labelLines.forEach((line, i) => {
    ctx.fillText(line, labelX, labelTop + i * lineH);
  });
  ctx.restore();

  // Trend chip — right-aligned; inline (vertically centered) unless the
  // label collided even at min font size, in which case it moves to the
  // top-right corner, above the label line.
  if (trend) {
    const chipBg =
      dir === 'up'
        ? semanticColor(palette, 'positive')
        : dir === 'down'
          ? semanticColor(palette, 'negative')
          : semanticColor(palette, 'neutral');
    const chipText = trend;
    const chipX = x + w - PAD - chipW;
    const chipY = chipMode === 'top-right' ? bannerY + topPad : chipYInline;
    const chipR = chipH / 2;

    ctx.save();
    // Rounded pill
    ctx.fillStyle = rgbCss(chipBg);
    ctx.beginPath();
    ctx.moveTo(chipX + chipR, chipY);
    ctx.lineTo(chipX + chipW - chipR, chipY);
    ctx.arc(chipX + chipW - chipR, chipY + chipR, chipR, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(chipX + chipR, chipY + chipH);
    ctx.arc(chipX + chipR, chipY + chipR, chipR, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = `700 ${chipFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chipText, chipX + chipW / 2, chipY + chipH / 2);
    ctx.restore();
  }
}

// Auto-shrink label font size (down to minFs) until wrapText produces lines
// that all fit within maxW without dropping words. Returns { fs, lines }.
function fitLabelSize(ctx, label, maxW, targetFs, minFs, maxLines) {
  const totalWords = String(label).split(/\s+/).filter(Boolean).length;
  let best = null;
  // A short banner (small h → targetFs < minFs) must still return a fit —
  // clamp so the loop always runs at least once; found via a 14-page news
  // deck whose PPTX export crashed on one h=100 stat-banner (Sprint 31).
  for (let fs = Math.max(targetFs, minFs); fs >= minFs; fs--) {
    ctx.save();
    ctx.font = `500 ${fs}px Inter, system-ui, sans-serif`;
    const lines = wrapText(ctx, label, maxW, maxLines);
    const allFit = lines.every((l) => ctx.measureText(l).width <= maxW);
    const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
    ctx.restore();
    best = { fs, lines };
    if (allFit && consumedWords >= totalWords) return best;
  }
  return best;
}

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
