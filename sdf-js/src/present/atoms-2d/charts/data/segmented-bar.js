// =============================================================================
// atoms-2d/charts/data/segmented-bar.js — Single horizontal segmented bar
// -----------------------------------------------------------------------------
// One horizontal bar split into N colored segments proportional to values.
// Use cases: market share, budget allocation, time allocation.
//
// Args:
//   title?    — optional heading
//   segments  — array of { label, value, color? } (2-8) REQUIRED
//   total?    — custom total (default: sum of values)
//   showPct?  — show percentage (default: true)
//   format?   — 'pct' | 'value' (default: 'pct')
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'segmented-bar',
  category: 'charts/data',
  description:
    'Single horizontal bar split into N colored segments. Market share / budget allocation / time breakdown.',
  args: {
    title: { type: 'string?', example: 'Budget Allocation' },
    segments: {
      type: 'array of { label, value, color? } (2-8)',
      required: true,
      example: [
        { label: 'Eng', value: 45 },
        { label: 'Sales', value: 30 },
        { label: 'Marketing', value: 15 },
        { label: 'Other', value: 10 },
      ],
    },
    total: { type: 'number?', example: 100 },
    showPct: { type: 'boolean?', default: true },
    format: { type: "'pct'|'value'?", default: "'pct'" },
  },
};

const BAR_CORNER = 8;
const MIN_LABEL_W = 60;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 380;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const accent = palette.accent || palette.colors?.[0] || [60, 100, 200];
  const colors = palette.colors || [accent, [80, 160, 200], [200, 120, 60], [140, 200, 80]];

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  const rawSegs = Array.isArray(args.segments) ? args.segments.slice(0, 8) : [];
  if (rawSegs.length === 0) return;

  const segs = rawSegs.map((s, i) => ({
    label: String(s.label || ''),
    value: Number(s.value) || 0,
    color: s.color || colors[i % colors.length],
  }));

  const total = args.total != null ? Number(args.total) : segs.reduce((a, s) => a + s.value, 0);
  const showPct = args.showPct !== false;
  const format = args.format || 'pct';

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

  const PAD = 24;
  const barX = x + PAD;
  const barW = w - PAD * 2;
  const barH = Math.round(h * 0.18);
  const barY = plotTop + (h - (plotTop - y) - barH) / 3; // upper third of remaining

  // Total label above-right
  const totalFontSize = Math.round(h * 0.05);
  if (total > 0) {
    ctx.fillStyle = rgbaCss(fg, 0.45);
    ctx.font = `500 ${totalFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`Total: ${total}`, x + w - PAD, barY - 6);
  }

  // Draw bar segments
  let curX = barX;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const frac = total > 0 ? s.value / total : 1 / segs.length;
    const segW = Math.round(barW * frac);
    const isFirst = i === 0;
    const isLast = i === segs.length - 1;

    ctx.save();
    ctx.fillStyle = Array.isArray(s.color) ? rgbCss(s.color) : s.color;

    // Rounded corners only on first and last segment
    ctx.beginPath();
    const r = BAR_CORNER;
    if (isFirst && isLast) {
      // Full rounded
      ctx.moveTo(curX + r, barY);
      ctx.lineTo(curX + segW - r, barY);
      ctx.quadraticCurveTo(curX + segW, barY, curX + segW, barY + r);
      ctx.lineTo(curX + segW, barY + barH - r);
      ctx.quadraticCurveTo(curX + segW, barY + barH, curX + segW - r, barY + barH);
      ctx.lineTo(curX + r, barY + barH);
      ctx.quadraticCurveTo(curX, barY + barH, curX, barY + barH - r);
      ctx.lineTo(curX, barY + r);
      ctx.quadraticCurveTo(curX, barY, curX + r, barY);
    } else if (isFirst) {
      ctx.moveTo(curX + r, barY);
      ctx.lineTo(curX + segW, barY);
      ctx.lineTo(curX + segW, barY + barH);
      ctx.lineTo(curX + r, barY + barH);
      ctx.quadraticCurveTo(curX, barY + barH, curX, barY + barH - r);
      ctx.lineTo(curX, barY + r);
      ctx.quadraticCurveTo(curX, barY, curX + r, barY);
    } else if (isLast) {
      ctx.moveTo(curX, barY);
      ctx.lineTo(curX + segW - r, barY);
      ctx.quadraticCurveTo(curX + segW, barY, curX + segW, barY + r);
      ctx.lineTo(curX + segW, barY + barH - r);
      ctx.quadraticCurveTo(curX + segW, barY + barH, curX + segW - r, barY + barH);
      ctx.lineTo(curX, barY + barH);
    } else {
      ctx.rect(curX, barY, segW, barH);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Segment label inside bar (if wide enough)
    if (segW >= MIN_LABEL_W) {
      const inFontSize = Math.round(barH * 0.3);
      const pctStr =
        format === 'value'
          ? String(s.value)
          : total > 0
            ? `${Math.round((s.value / total) * 100)}%`
            : '0%';
      const displayStr = `${s.label} ${pctStr}`;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `700 ${inFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Clip to segment so text doesn't bleed
      ctx.beginPath();
      ctx.rect(curX, barY, segW, barH);
      ctx.clip();
      ctx.fillText(displayStr, curX + segW / 2, barY + barH / 2);
      ctx.restore();
    }

    // Subtle 1px white divider between segments (not before first)
    if (!isFirst) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(curX, barY + 2);
      ctx.lineTo(curX, barY + barH - 2);
      ctx.stroke();
      ctx.restore();
    }

    curX += segW;
  }

  // Legend row below bar
  const legendY = barY + barH + 18;
  const legendFontSize = Math.round(h * 0.042);
  const dotR = legendFontSize * 0.45;
  const itemW = (w - PAD * 2) / segs.length;

  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const lx = barX + i * itemW;
    const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
    const valueStr = format === 'value' ? String(s.value) : `${pct}%`;

    // Color dot
    ctx.save();
    ctx.fillStyle = Array.isArray(s.color) ? rgbCss(s.color) : s.color;
    ctx.beginPath();
    ctx.arc(lx + dotR, legendY + legendFontSize / 2, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Label
    ctx.save();
    ctx.fillStyle = rgbaCss(fg, 0.75);
    ctx.font = `500 ${legendFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${s.label}  ${valueStr}`, lx + dotR * 2 + 6, legendY + legendFontSize / 2);
    ctx.restore();
  }
}
