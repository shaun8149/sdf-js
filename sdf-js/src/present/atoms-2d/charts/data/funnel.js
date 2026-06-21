// =============================================================================
// atoms-2d/charts/data/funnel.js — N-stage funnel chart
// -----------------------------------------------------------------------------
// 2D pseudo-3D equivalent of our 3D funnel-3d atom. Generic sales/conversion
// funnel — textbook pattern (used by Salesforce, HubSpot, every CRM).
//
// Args:
//   stages — array of { label, value? } from TOP (widest) to BOTTOM (narrowest)
//   format — value display format ('number'|'percent'|'currency')
//   title  — optional chart title
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'funnel',
  category: 'charts/data',
  description: 'N-stage funnel chart for sales / conversion pipelines.',
  args: {
    stages: {
      type: 'array of { label, value? } top→bottom',
      required: true,
      example: [
        { label: 'Visitors', value: 10000 },
        { label: 'Trial', value: 1200 },
        { label: 'Active', value: 400 },
        { label: 'Paying', value: 120 },
      ],
    },
    format: { type: "'number'|'percent'|'currency'", default: 'number' },
    title: { type: 'string?', example: 'Sales Funnel' },
  },
};

const PAD = 14;
const STAGE_GAP = 6;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 480;
  const h = opts.h ?? 380;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const colors = palette.colors || [[60, 130, 200]];

  const stages = Array.isArray(args.stages) ? args.stages : [];
  const format = args.format || 'number';
  const n = stages.length;
  if (n === 0) return;

  let plotTop = y + PAD;
  if (args.title) {
    const ts = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${ts}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.13;
  }

  const plotH = y + h - plotTop - PAD;
  const plotW = w - PAD * 2 - 100; // reserve right column for labels
  const cx = x + PAD + plotW / 2;
  const topY = plotTop;
  const botY = plotTop + plotH;
  const stageH = (plotH - STAGE_GAP * (n - 1)) / n;

  // Width tapering: each stage gets narrower top→bottom
  const maxW = plotW * 0.92;
  const minW = plotW * 0.22;
  const widthAt = (i) => {
    // i=0 top (widest), i=n-1 bottom (narrowest); n stages means n+1 edges
    const t0 = i / n;
    const t1 = (i + 1) / n;
    return [maxW + (minW - maxW) * t0, maxW + (minW - maxW) * t1];
  };

  for (let i = 0; i < n; i++) {
    const [wTop, wBot] = widthAt(i);
    const topEdgeY = topY + i * (stageH + STAGE_GAP);
    const botEdgeY = topEdgeY + stageH;
    const color = colors[i % colors.length];
    drawStage(ctx, cx, topEdgeY, botEdgeY, wTop, wBot, color);

    // Label inside stage if room
    const labelText = stages[i].label || '';
    const valueText = stages[i].value != null ? formatValue(stages[i].value, format) : '';

    // Label inside (centered)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `700 ${Math.min(16, stageH * 0.32)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cy = (topEdgeY + botEdgeY) / 2;
    ctx.fillText(labelText, cx, cy - (valueText ? stageH * 0.12 : 0));

    if (valueText) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `500 ${Math.min(12, stageH * 0.22)}px IBM Plex Mono, monospace`;
      ctx.fillText(valueText, cx, cy + stageH * 0.18);
    }

    // Right column annotation (value larger)
    if (valueText) {
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `600 ${Math.min(14, stageH * 0.32)}px IBM Plex Mono, monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(valueText, cx + plotW / 2 + 12, cy);
    }
  }
}

function drawStage(ctx, cx, topY, botY, wTop, wBot, color) {
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.22);
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  const grad = ctx.createLinearGradient(0, topY, 0, botY);
  grad.addColorStop(0, rgbCss(lighten(color, 0.18)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(cx - wTop / 2, topY);
  ctx.lineTo(cx + wTop / 2, topY);
  ctx.lineTo(cx + wBot / 2, botY);
  ctx.lineTo(cx - wBot / 2, botY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Top iso edge accent
  ctx.save();
  ctx.fillStyle = rgbaCss(lighten(color, 0.36), 0.55);
  ctx.beginPath();
  ctx.moveTo(cx - wTop / 2, topY);
  ctx.lineTo(cx + wTop / 2, topY);
  ctx.lineTo(cx + wTop / 2 - 2, topY + 2);
  ctx.lineTo(cx - wTop / 2 + 2, topY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function formatValue(v, format) {
  switch (format) {
    case 'currency':
      return `$${v}`;
    case 'percent':
      return `${v}%`;
    default:
      return Number(v).toLocaleString();
  }
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
