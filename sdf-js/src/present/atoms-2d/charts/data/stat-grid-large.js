// =============================================================================
// atoms-2d/charts/data/stat-grid-large.js — Hero giant-metric strip
// -----------------------------------------------------------------------------
// 2-5 GIANT numbers in a single row. PL hero metric strip — much larger than
// dashboard-multi-kpi-composite. Use when ONE ROW of headline metrics should
// dominate the slot.
//
// Args:
//   title?  — optional heading above strip
//   stats   — array of { value, label, trend?, trendDirection? } (2-5) REQUIRED
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'stat-grid-large',
  category: 'charts/data',
  description:
    'Hero giant-metric strip — 2-5 enormous numbers in a single row with labels and optional trend chips.',
  args: {
    title: { type: 'string?', example: 'Q3 Highlights' },
    stats: {
      type: 'array of { value, label, trend?, trendDirection? } (2-5)',
      required: true,
      example: [
        { value: '$24M', label: 'ARR', trend: '↑117% YoY', trendDirection: 'up' },
        { value: '12.5K', label: 'DAU' },
        { value: '92%', label: 'Retention D30' },
      ],
    },
  },
};

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

  const rawStats = Array.isArray(args.stats) ? args.stats.slice(0, 5) : [];
  const stats = rawStats.map((s) => {
    if (typeof s === 'string') return { value: s, label: '' };
    return {
      value: String(s.value || '—'),
      label: String(s.label || ''),
      trend: s.trend ? String(s.trend) : '',
      trendDirection: s.trendDirection || 'up',
    };
  });
  const N = stats.length;
  if (N === 0) return;

  // Title bar
  let plotTop = y + 16;
  if (args.title) {
    const titleFontSize = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.title), x + 24, plotTop);
    plotTop += titleFontSize + 16;
  }

  const availH = h - (plotTop - y) - 16;
  const colW = w / N;

  // Value font — giant, auto-sized
  const valueFontSize = Math.min(Math.round(availH * 0.52), Math.round(colW * 0.38));
  const labelFontSize = Math.round(availH * 0.1);
  const chipFontSize = Math.round(availH * 0.08);

  const blockH = valueFontSize + labelFontSize + (chipFontSize + 4) + 12;
  const blockTop = plotTop + (availH - blockH) / 2;

  for (let i = 0; i < N; i++) {
    const s = stats[i];
    const cx = x + colW * i + colW / 2;

    // Subtle divider between columns (not after last)
    if (i > 0) {
      ctx.save();
      ctx.strokeStyle = rgbaCss(accent, 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + colW * i, plotTop + availH * 0.15);
      ctx.lineTo(x + colW * i, plotTop + availH * 0.85);
      ctx.stroke();
      ctx.restore();
    }

    // Giant value — auto-shrink to fit col width
    const targetValueFontSize = Math.min(Math.round(availH * 0.52), Math.round(colW * 0.38));
    let vFontSize = targetValueFontSize;
    ctx.font = `900 ${vFontSize}px "Inter Display", Inter, system-ui, sans-serif`;
    while (vFontSize > 16 && ctx.measureText(s.value).width > colW * 0.85) {
      vFontSize--;
      ctx.font = `900 ${vFontSize}px "Inter Display", Inter, system-ui, sans-serif`;
    }

    ctx.save();
    ctx.fillStyle = rgbCss(accent);
    ctx.font = `900 ${vFontSize}px "Inter Display", Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(s.value, cx, blockTop);
    ctx.restore();

    const labelTop = blockTop + vFontSize + 6;

    // Label
    ctx.save();
    ctx.fillStyle = rgbaCss(fg, 0.6);
    ctx.font = `700 ${labelFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(fitText(ctx, s.label, colW - 16), cx, labelTop);
    ctx.restore();

    // Trend chip
    if (s.trend) {
      const chipTop = labelTop + labelFontSize + 4;
      const chipPad = 8;
      ctx.save();
      ctx.font = `700 ${chipFontSize}px Inter, system-ui, sans-serif`;
      const chipTextW = ctx.measureText(s.trend).width;
      const chipW = chipTextW + chipPad * 2;
      const chipH = chipFontSize * 1.6;
      const chipX = cx - chipW / 2;
      const chipR = chipH / 2;
      const dir = s.trendDirection || 'up';
      const chipBg =
        dir === 'up' ? [50, 200, 130] : dir === 'down' ? [220, 80, 60] : [140, 155, 170];

      ctx.fillStyle = rgbCss(chipBg);
      ctx.beginPath();
      ctx.moveTo(chipX + chipR, chipTop);
      ctx.lineTo(chipX + chipW - chipR, chipTop);
      ctx.arc(chipX + chipW - chipR, chipTop + chipR, chipR, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(chipX + chipR, chipTop + chipH);
      ctx.arc(chipX + chipR, chipTop + chipR, chipR, Math.PI / 2, -Math.PI / 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      ctx.font = `700 ${chipFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.trend, cx, chipTop + chipH / 2);
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
