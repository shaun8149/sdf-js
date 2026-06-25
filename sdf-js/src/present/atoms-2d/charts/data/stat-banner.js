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

  // Value — very large, left-aligned
  const valueFontSize = Math.round(bannerH * 0.58);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.font = `900 ${valueFontSize}px "Inter Display", Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x + PAD, cy);
  ctx.restore();

  // Measure value width to position label after it
  ctx.save();
  ctx.font = `900 ${valueFontSize}px "Inter Display", Inter, system-ui, sans-serif`;
  const valueW = ctx.measureText(value).width;
  ctx.restore();

  const labelPad = PAD * 1.5;
  const labelX = x + PAD + valueW + labelPad;

  // Label — smaller, middle
  const labelFontSize = Math.round(bannerH * 0.2);
  const labelAvailW = trend ? w * 0.45 : w - (labelX - x) - PAD;

  // word-wrap label to fit
  ctx.save();
  ctx.font = `500 ${labelFontSize}px Inter, system-ui, sans-serif`;
  const labelLines = wrapText(ctx, label, labelAvailW, 2);
  ctx.restore();

  const lineH = labelFontSize * 1.3;
  const labelBlockH = labelLines.length * lineH;
  const labelTop = cy - labelBlockH / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `500 ${labelFontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  labelLines.forEach((line, i) => {
    ctx.fillText(line, labelX, labelTop + i * lineH);
  });
  ctx.restore();

  // Trend chip — right-aligned
  if (trend) {
    const chipPad = 10;
    const chipFontSize = Math.round(bannerH * 0.2);
    const chipBg = dir === 'up' ? [50, 200, 130] : dir === 'down' ? [220, 80, 60] : [140, 155, 170];
    const chipText = trend;

    ctx.save();
    ctx.font = `700 ${chipFontSize}px Inter, system-ui, sans-serif`;
    const chipW = ctx.measureText(chipText).width + chipPad * 2.5;
    const chipH = chipFontSize * 1.8;
    const chipX = x + w - PAD - chipW;
    const chipY = cy - chipH / 2;
    const chipR = chipH / 2;

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
    ctx.fillText(chipText, chipX + chipW / 2, cy);
    ctx.restore();
  }
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
