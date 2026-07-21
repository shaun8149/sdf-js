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
  const baseColor = palette.colors?.[0] || [60, 130, 200];

  const stages = Array.isArray(args.stages) ? args.stages : [];
  const format = args.format || 'number';
  const n = stages.length;
  if (n === 0) return;

  // Background
  const bgColor = palette.bg ? rgbCss(palette.bg) : '#fafaf8';
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, h);

  // Monotone gradient: palette.colors[0] lightest at top, darkening down
  const makeStageColor = (i) => {
    const darken = i * 0.08;
    return [
      Math.max(0, Math.round(baseColor[0] * (1 - darken))),
      Math.max(0, Math.round(baseColor[1] * (1 - darken))),
      Math.max(0, Math.round(baseColor[2] * (1 - darken))),
    ];
  };

  let plotTop = y + PAD;
  if (args.title) {
    const ts = Math.round(h * 0.065);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${ts}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.13;
  }

  // Reserve right column for value annotations (value + percentage)
  const rightColW = 110;
  const plotH = y + h - plotTop - PAD;
  const plotW = w - PAD * 2 - rightColW;
  const cx = x + PAD + plotW / 2;
  const topY = plotTop;
  const stageH = (plotH - STAGE_GAP * (n - 1)) / n;

  // Width tapering proportional to value when available, else linear
  const values = stages.map((s) => (s.value != null ? Number(s.value) : null));
  const firstValue = values[0] || 1;
  const maxW = plotW * 0.92;
  const minW = plotW * 0.22;
  const widthAt = (i) => {
    if (values[i] != null && values[0] != null) {
      // Proportional width: sqrt for visual balance
      const ratio = Math.sqrt(values[i] / firstValue);
      const wEdge = minW + (maxW - minW) * ratio;
      // upper edge: width of this stage's value ratio
      const ratioNext =
        i + 1 < n && values[i + 1] != null
          ? Math.sqrt(values[i + 1] / firstValue)
          : ratio * (minW / maxW);
      return [wEdge, minW + (maxW - minW) * ratioNext];
    }
    // Fallback linear
    const t0 = i / n;
    const t1 = (i + 1) / n;
    return [maxW + (minW - maxW) * t0, maxW + (minW - maxW) * t1];
  };

  // Compute geometry for every stage up front, then draw in TWO passes:
  // all trapezoids first, then all labels/value columns/drop-rate chips on
  // top. Previously each stage's trapezoid was drawn interleaved with the
  // *previous* gap's drop-rate chip, so stage i+1's trapezoid (painted right
  // after the i→i+1 chip) silently overdrew the bottom half of that chip —
  // the tiny STAGE_GAP (6px) is smaller than the chip's own text height, so
  // chips always bled into the neighboring trapezoid ("↓ 88%" half-hidden).
  const geoms = [];
  for (let i = 0; i < n; i++) {
    const [wTop, wBot] = widthAt(i);
    const topEdgeY = topY + i * (stageH + STAGE_GAP);
    const botEdgeY = topEdgeY + stageH;
    geoms.push({ wTop, wBot, topEdgeY, botEdgeY, color: makeStageColor(i) });
  }

  for (let i = 0; i < n; i++) {
    const { wTop, wBot, topEdgeY, botEdgeY, color } = geoms[i];
    drawStage(ctx, cx, topEdgeY, botEdgeY, wTop, wBot, color);
  }

  for (let i = 0; i < n; i++) {
    const { topEdgeY, botEdgeY } = geoms[i];
    // Label + value + percentage inside stage
    const labelText = stages[i].label || '';
    const valueText = stages[i].value != null ? formatValue(stages[i].value, format) : '';
    const pctText =
      stages[i].value != null && firstValue > 0 && i > 0
        ? `${Math.round((Number(stages[i].value) / firstValue) * 100)}%`
        : i === 0
          ? '100%'
          : '';

    const stageCy = (topEdgeY + botEdgeY) / 2;
    const hasSubLine = valueText || pctText;
    const labelFont = `700 ${Math.min(15, stageH * 0.3)}px Inter, system-ui, sans-serif`;
    const subFont = `400 ${Math.min(11, stageH * 0.22)}px Inter, system-ui, sans-serif`;

    // Label (white with subtle shadow)
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 2;
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, cx, stageCy - (hasSubLine ? stageH * 0.1 : 0));
    ctx.restore();

    // Value + pct sub-line
    if (hasSubLine) {
      const subText = [valueText, pctText].filter(Boolean).join('  ·  ');
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = subFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(subText, cx, stageCy + stageH * 0.18);
      ctx.restore();
    }

    // Right column: value label
    if (valueText) {
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `600 ${Math.min(13, stageH * 0.3)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(valueText, cx + plotW / 2 + 12, stageCy);
    }

    // Drop-rate annotation between stages: "↓ XX%" chip, drawn in this final
    // pass (after ALL trapezoids) so it always sits on top, with a white
    // chip bg + hairline border so it reads against any stage color.
    if (i < n - 1 && stages[i].value != null && stages[i + 1].value != null) {
      const dropPct = Math.round((1 - Number(stages[i + 1].value) / Number(stages[i].value)) * 100);
      if (!isNaN(dropPct)) {
        const gapY = botEdgeY + STAGE_GAP / 2;
        drawDropChip(ctx, cx, gapY, `↓ ${dropPct}%`, fg);
      }
    }
  }
}

function drawDropChip(ctx, cx, cy, text, fg) {
  const fontSize = 10;
  ctx.save();
  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  const padX = 7;
  const padY = 3;
  const chipW = ctx.measureText(text).width + padX * 2;
  const chipH = fontSize + padY * 2;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = rgbaCss(fg, 0.2);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx - chipW / 2, cy - chipH / 2, chipW, chipH, chipH / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rgbaCss(fg, 0.8);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 0.5);
  ctx.restore();
}

function drawStage(ctx, cx, topY, botY, wTop, wBot, color) {
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.1); // softened: alpha 0.10
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;

  // Inner gradient: lighten 0.08 from top-edge to bottom-edge
  const grad = ctx.createLinearGradient(0, topY, 0, botY);
  grad.addColorStop(0, rgbCss(lighten(color, 0.08)));
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

  // Hairline border: 1.5px, subtle
  ctx.save();
  ctx.strokeStyle = rgbaCss(color, 0.25);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - wTop / 2, topY);
  ctx.lineTo(cx + wTop / 2, topY);
  ctx.lineTo(cx + wBot / 2, botY);
  ctx.lineTo(cx - wBot / 2, botY);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Top iso edge accent (subtle)
  ctx.save();
  ctx.fillStyle = rgbaCss(lighten(color, 0.15), 0.4);
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
