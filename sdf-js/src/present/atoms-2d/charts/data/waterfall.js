// =============================================================================
// atoms-2d/charts/data/waterfall.js — Waterfall (financial decomposition) chart
// -----------------------------------------------------------------------------
// 2D pseudo-3D equivalent of waterfall-3d. Classic financial viz showing how
// a starting value flows through positive/negative changes to an ending value.
//
// Args:
//   bars   — array of { label, value, kind?: 'start'|'positive'|'negative'|'end' }
//   format — 'currency'|'number'|'percent'
//   title  — optional title
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'waterfall',
  category: 'charts/data',
  description: 'Waterfall chart — financial decomposition (start → +/- changes → end).',
  args: {
    bars: {
      type: "array of { label, value, kind?: 'start'|'positive'|'negative'|'end' }",
      required: true,
      example: [
        { label: 'Q1', value: 100, kind: 'start' },
        { label: 'New Sales', value: 30, kind: 'positive' },
        { label: 'Churn', value: -8, kind: 'negative' },
        { label: 'Upsell', value: 12, kind: 'positive' },
        { label: 'Q2', value: 134, kind: 'end' },
      ],
    },
    format: { type: "'currency'|'number'|'percent'", default: 'currency' },
    title: { type: 'string?', example: 'Q1 → Q2 Revenue Bridge' },
  },
};

const PAD = 22;
const COLOR_POSITIVE = [76, 175, 129]; // #4caf81 green accent
const COLOR_NEGATIVE = [224, 92, 92]; // #e05c5c red accent
const COLOR_TOTAL = null; // resolved at draw time from palette.colors[0]

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 560;
  const h = opts.h ?? 360;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];

  const colorTotal = palette.colors?.[0] || [80, 100, 130];
  const bars = Array.isArray(args.bars) ? args.bars : [];
  const format = args.format || 'currency';
  const n = bars.length;
  if (n === 0) return;

  // Background fill
  const bgColor = palette.bg ? rgbCss(palette.bg) : '#fafaf8';
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);

  // Title
  let plotTop = y + PAD;
  if (args.title) {
    const ts = Math.round(h * 0.065);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${ts}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.12;
  }

  // Compute cumulative for positioning. Start at 0; running tracks current top.
  // Each bar's bottom = running, top = running + value (or value itself for totals).
  let running = 0;
  const positions = [];
  let minV = 0;
  let maxV = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const v = Number(b.value || 0);
    const kind =
      b.kind || (i === 0 ? 'start' : i === n - 1 ? 'end' : v >= 0 ? 'positive' : 'negative');
    let bottom, top;
    if (kind === 'start' || kind === 'end') {
      bottom = 0;
      top = v;
      running = v;
    } else if (v >= 0) {
      bottom = running;
      top = running + v;
      running = top;
    } else {
      bottom = running + v; // v is negative
      top = running;
      running = bottom;
    }
    positions.push({ ...b, bottom, top, kind, displayValue: v });
    if (bottom < minV) minV = bottom;
    if (top > maxV) maxV = top;
  }

  const xLabelH = h * 0.1;
  const valueLabelH = h * 0.05;
  const plotBottom = y + h - PAD - xLabelH;
  const plotTopY = plotTop + PAD + valueLabelH;
  const plotH = plotBottom - plotTopY;
  const plotL = x + PAD;
  const plotR = x + w - PAD;
  const plotW = plotR - plotL;
  const range = maxV - minV || 1;
  const baselineY = plotBottom - ((0 - minV) / range) * plotH;
  const yFor = (v) => plotBottom - ((v - minV) / range) * plotH;

  // Axis hairline (1px, alpha 0.35)
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.35);
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(plotL, plotBottom);
  ctx.lineTo(plotR, plotBottom);
  ctx.stroke();
  ctx.restore();

  // Zero baseline (dashed, only if minV < 0)
  if (minV < 0) {
    ctx.save();
    ctx.strokeStyle = rgbaCss(fg, 0.2);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(plotL, baselineY);
    ctx.lineTo(plotR, baselineY);
    ctx.stroke();
    ctx.restore();
  }

  const slotW = plotW / n;
  const barW = Math.min(56, slotW * 0.7);

  for (let i = 0; i < n; i++) {
    const p = positions[i];
    const cx = plotL + slotW * (i + 0.5);
    const yTop = yFor(p.top);
    const yBot = yFor(p.bottom);
    const colorBase =
      p.kind === 'start' || p.kind === 'end'
        ? colorTotal
        : p.kind === 'positive'
          ? COLOR_POSITIVE
          : COLOR_NEGATIVE;
    drawBar(ctx, cx - barW / 2, yTop, barW, yBot - yTop, colorBase);

    // Connector dashed line: thin gray from top-of-this-bar to bottom-of-next-bar
    if (i < n - 1) {
      const next = positions[i + 1];
      const nextCx = plotL + slotW * (i + 1.5);
      const nextStartY = yFor(
        next.kind === 'start' || next.kind === 'end'
          ? 0
          : next.kind === 'positive'
            ? next.bottom
            : next.top,
      );
      const leaveY = yFor(p.kind === 'negative' ? p.bottom : p.top);
      ctx.save();
      ctx.strokeStyle = rgbaCss(fg, 0.28);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx + barW / 2, leaveY);
      ctx.lineTo(nextCx - barW / 2, nextStartY);
      ctx.stroke();
      ctx.restore();
    }

    // Value label above bar: Inter 700, proportional size
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.035)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const vText = formatValue(p.displayValue, format, p.kind);
    ctx.fillText(vText, cx, yTop - 4);

    // X label below
    ctx.fillStyle = rgbaCss(fg, 0.7);
    ctx.font = `400 ${Math.round(h * 0.038)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(p.label || '', cx, plotBottom + 6);
  }
}

function drawBar(ctx, x, y, w, h, color) {
  if (w <= 0 || Math.abs(h) < 1) return;
  const top = h >= 0 ? y : y + h;
  const ht = Math.abs(h);
  const radius = Math.min(w / 2, 5);

  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.1); // softened: alpha 0.10
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  const grad = ctx.createLinearGradient(0, top, 0, top + ht);
  grad.addColorStop(0, rgbCss(lighten(color, 0.08))); // reduced: 0.08 max
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;
  roundRect(ctx, x, top, w, ht, radius);
  ctx.fill();
  ctx.restore();

  // Top edge highlight (subtle)
  ctx.save();
  ctx.fillStyle = rgbaCss(lighten(color, 0.15), 0.45);
  roundRect(ctx, x, top, w, 2, radius);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function formatValue(v, format, kind) {
  const abs = Math.abs(v);
  const prefix = kind === 'positive' && v > 0 ? '+' : kind === 'negative' ? '-' : '';
  let body;
  switch (format) {
    case 'currency':
      body = `$${abs}`;
      break;
    case 'percent':
      body = `${abs}%`;
      break;
    default:
      body = String(abs);
  }
  return prefix + body;
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
