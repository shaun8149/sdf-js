// =============================================================================
// atoms-2d/charts/data/break-even.js — Break-even analysis chart
// -----------------------------------------------------------------------------
// Shows three lines on a units-sold × cost/revenue canvas:
//   1. Fixed cost — horizontal line at y = fixedCost
//   2. Total cost — sloped line: fixedCost + variableCostPerUnit * x
//   3. Revenue    — sloped line: pricePerUnit * x (steeper than total cost)
//
// Crossover marker + callout at the break-even point.
// Shaded loss zone (left) and profit zone (right) for quick scan.
//
// Args:
//   fixedCost           — number (e.g. 50000)
//   variableCostPerUnit — number (e.g. 25)
//   pricePerUnit        — number (e.g. 50)
//   maxUnits            — number? (default 5000)
//   title               — string?
//   currency            — string? (default '$')
//
// Per Sprint 15a Task 4.1 — break-even atom for Atlas Present finance preset.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'break-even',
  category: 'charts/data',
  description: 'Break-even chart — fixed cost (horizontal), total cost + revenue (lines crossing).',
  args: {
    fixedCost: { type: 'number', required: true, example: 50000 },
    variableCostPerUnit: { type: 'number', required: true, example: 25 },
    pricePerUnit: { type: 'number', required: true, example: 50 },
    maxUnits: { type: 'number?', default: 5000 },
    title: { type: 'string?', example: 'Break-Even Analysis' },
    currency: { type: 'string?', default: '$' },
  },
};

const TITLE_FRAC = 0.14;
const X_LABEL_FRAC = 0.1;
const PAD = 14;

/** Format large numbers compactly (50000 → "$50K") */
function fmtMoney(currency, v) {
  if (Math.abs(v) >= 1_000_000) return `${currency}${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${currency}${(v / 1_000).toFixed(0)}K`;
  return `${currency}${Math.round(v)}`;
}

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 520;
  const h = opts.h ?? 300;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];

  // Line colours: fixed=accent0, totalCost=accent1, revenue=accent2
  const colFixed = palette.colors?.[0] || [100, 120, 200];
  const colCost = palette.colors?.[1] || [200, 100, 60];
  const colRevenue = palette.colors?.[2] || [60, 170, 110];

  const fixedCost = Number(args.fixedCost) || 0;
  const variableCostPerUnit = Number(args.variableCostPerUnit) || 0;
  const pricePerUnit = Number(args.pricePerUnit) || 0;
  const maxUnits = Number(args.maxUnits) || 5000;
  const title = args.title;
  const currency = args.currency ?? '$';

  // Break-even calculation
  const margin = pricePerUnit - variableCostPerUnit;
  const hasBreakEven = margin > 0;
  const beUnits = hasBreakEven ? fixedCost / margin : null;
  const beRevenue = hasBreakEven ? pricePerUnit * beUnits : null;

  // Y-axis extent: max of totalCost and revenue at maxUnits
  const maxCost = fixedCost + variableCostPerUnit * maxUnits;
  const maxRevenue = pricePerUnit * maxUnits;
  const maxY = Math.max(maxCost, maxRevenue, fixedCost + 1);

  // ---- Title ----
  let chartTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    chartTop = y + h * TITLE_FRAC;
  }

  // ---- Plot area ----
  const xLabelH = h * X_LABEL_FRAC;
  const plotBottom = y + h - xLabelH - PAD;
  const plotTop = chartTop + PAD;
  const plotLeft = x + PAD + Math.round(h * 0.12); // left margin for Y labels
  const plotRight = x + w - PAD;
  const plotW = plotRight - plotLeft;
  const plotH = Math.max(40, plotBottom - plotTop);

  // Helpers: unit ↔ pixel
  const ux = (units) => plotLeft + (units / maxUnits) * plotW;
  const uy = (val) => plotBottom - (val / maxY) * plotH;

  // ---- Faint grid (4 horizontal lines) ----
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.08);
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const gy = plotTop + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(plotLeft, gy);
    ctx.lineTo(plotRight, gy);
    ctx.stroke();
  }
  ctx.restore();

  // ---- Y-axis labels (0, 25%, 50%, 75%, 100%) ----
  ctx.font = `500 ${Math.round(h * 0.042)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgbaCss(fg, 0.55);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const val = (maxY * i) / 4;
    const gy = plotBottom - (plotH * i) / 4;
    ctx.fillText(fmtMoney(currency, val), plotLeft - 4, gy);
  }

  // ---- Zone shading (loss / profit) — only when break-even is in view ----
  if (hasBreakEven && beUnits <= maxUnits && beUnits >= 0) {
    const bx = ux(beUnits);

    // Loss zone (left of break-even) — subtle red tint
    ctx.save();
    ctx.fillStyle = rgbaCss([220, 60, 60], 0.07);
    ctx.fillRect(plotLeft, plotTop, bx - plotLeft, plotH);
    ctx.restore();

    // Profit zone (right of break-even) — subtle green tint
    ctx.save();
    ctx.fillStyle = rgbaCss([60, 170, 80], 0.07);
    ctx.fillRect(bx, plotTop, plotRight - bx, plotH);
    ctx.restore();
  }

  // ---- Helper: draw a line from (x0, y0) to (x1, y1) with drop shadow ----
  function drawLine(x0, y0, x1, y1, color, dashed = false) {
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.15);
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
    ctx.strokeStyle = rgbCss(color);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    if (dashed) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  // ---- Fixed cost line (horizontal, dashed) ----
  drawLine(plotLeft, uy(fixedCost), plotRight, uy(fixedCost), colFixed, true);

  // ---- Total cost line (from (0, fixedCost) to (maxUnits, maxCost)) ----
  drawLine(plotLeft, uy(fixedCost), plotRight, uy(maxCost), colCost);

  // ---- Revenue line (from (0, 0) to (maxUnits, maxRevenue)) ----
  drawLine(plotLeft, uy(0), plotRight, uy(maxRevenue), colRevenue);

  // ---- Legend (top-right inside plot) ----
  const legendItems = [
    { label: 'Fixed Cost', color: colFixed },
    { label: 'Total Cost', color: colCost },
    { label: 'Revenue', color: colRevenue },
  ];
  const legendFontSize = Math.round(h * 0.042);
  ctx.font = `500 ${legendFontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  const legendLineLen = 16;
  const legendGap = 6;
  const legendRowH = legendFontSize + 6;
  let legendY = plotTop + 8;
  for (const item of legendItems) {
    const lx = plotRight - legendLineLen - legendGap - ctx.measureText(item.label).width - 4;
    // Line swatch
    ctx.save();
    ctx.strokeStyle = rgbCss(item.color);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(lx, legendY);
    ctx.lineTo(lx + legendLineLen, legendY);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = rgbaCss(fg, 0.75);
    ctx.textAlign = 'left';
    ctx.fillText(item.label, lx + legendLineLen + legendGap, legendY);
    legendY += legendRowH;
  }

  // ---- Break-even marker + callout ----
  if (!hasBreakEven) {
    // Warning: no break-even (margin <= 0)
    const warnSize = Math.round(h * 0.055);
    ctx.font = `600 ${warnSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = rgbaCss([200, 60, 60], 0.85);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No break-even: price ≤ variable cost', plotLeft + plotW / 2, plotTop + plotH / 2);
  } else if (beUnits <= maxUnits && beUnits >= 0) {
    const bx = ux(beUnits);
    const by = uy(beRevenue);

    // Vertical dashed reference line from bottom to marker
    ctx.save();
    ctx.strokeStyle = rgbaCss(fg, 0.2);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(bx, by + 8);
    ctx.lineTo(bx, plotBottom);
    ctx.stroke();
    ctx.restore();

    // Filled circle with drop shadow
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.25);
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = rgbCss(fg);
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = rgbCss(bg);
    ctx.beginPath();
    ctx.arc(bx, by, 3, 0, Math.PI * 2);
    ctx.fill();

    // Callout label
    const calloutText = `Break-even: ${Math.round(beUnits).toLocaleString()} units, ${fmtMoney(currency, beRevenue)}`;
    const calloutSize = Math.round(h * 0.046);
    ctx.font = `600 ${calloutSize}px Inter, system-ui, sans-serif`;
    const textW = ctx.measureText(calloutText).width;
    // Position callout above/right of marker, clamped inside plot
    let cx = bx - textW / 2;
    if (cx < plotLeft) cx = plotLeft;
    if (cx + textW > plotRight) cx = plotRight - textW;
    const cy = by - 18;

    // Callout background pill
    const cpx = cx - 6;
    const cpy = cy - calloutSize / 2 - 3;
    const cpw = textW + 12;
    const cph = calloutSize + 8;
    const r = 4;
    ctx.save();
    ctx.fillStyle = rgbaCss(fg, 0.9);
    ctx.beginPath();
    ctx.moveTo(cpx + r, cpy);
    ctx.arcTo(cpx + cpw, cpy, cpx + cpw, cpy + cph, r);
    ctx.arcTo(cpx + cpw, cpy + cph, cpx, cpy + cph, r);
    ctx.arcTo(cpx, cpy + cph, cpx, cpy, r);
    ctx.arcTo(cpx, cpy, cpx + cpw, cpy, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = rgbCss(bg);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(calloutText, cx, cy);
  }

  // ---- X-axis labels (0 and maxUnits) ----
  ctx.font = `500 ${Math.round(h * 0.045)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = rgbaCss(fg, 0.55);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('0', plotLeft, plotBottom + 5);
  ctx.textAlign = 'right';
  ctx.fillText(`${maxUnits.toLocaleString()} units`, plotRight, plotBottom + 5);
}
