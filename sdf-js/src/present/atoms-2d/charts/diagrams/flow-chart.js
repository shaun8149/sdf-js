// =============================================================================
// atoms-2d/charts/diagrams/flow-chart.js — Linear flow diagram
// -----------------------------------------------------------------------------
// 6th atom in 2D vector library (Phase 2a). First diagrams/ atom.
//
// Semantic: N labeled nodes connected by directional arrows, laid out
// horizontally left-to-right. Common pattern for processes, pipelines,
// user journeys, workflow steps.
//
// Args:
//   steps      — string[] (labels for each step, in order)
//   sublabels  — string[]? (optional secondary labels per step)
//   highlight  — number? (index of step to emphasize, e.g. current step)
//   title      — optional chart title above
//   orientation — 'horizontal' | 'vertical' (default 'horizontal')
//
// Render: pseudo-3D (drawPseudo3D)
//   - Each step: rounded rect with gradient + drop shadow + iso edge
//   - Numbered circle in upper-left of each box (1, 2, 3...)
//   - Arrow between consecutive nodes (with arrowhead, color = palette accent)
//   - Highlight step: brighter color + larger / accent stroke
//
// Per [[atlas-sprint14-finance-preset-plan]] — diagram family for tech
// architecture / process docs.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'flow-chart',
  category: 'charts/diagrams',
  description: 'Linear flow of labeled steps connected by directional arrows.',
  args: {
    steps: {
      type: 'string[]',
      required: true,
      example: ['Sign up', 'Verify', 'Onboard', 'Purchase', 'Retain'],
    },
    sublabels: { type: 'string[]?', example: ['Day 0', 'Day 0', 'Day 1', 'Day 3', 'Day 30'] },
    highlight: { type: 'number?', example: 2 },
    title: { type: 'string?', example: 'User Journey' },
    orientation: { type: "'horizontal'|'vertical'", default: 'horizontal' },
  },
};

const PAD = 20;
const TITLE_FRAC = 0.12;
const ARROW_LENGTH = 28;
const NODE_PADDING = 18;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 600;
  const h = opts.h ?? 200;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];
  const accent = palette.colors?.[0] || [60, 100, 200];

  const steps = Array.isArray(args.steps) ? args.steps : [];
  const sublabels = Array.isArray(args.sublabels) ? args.sublabels : [];
  const highlight = typeof args.highlight === 'number' ? args.highlight : -1;
  const title = args.title;
  const orientation = args.orientation || 'horizontal';
  const n = steps.length;
  if (n === 0) return;

  // ---- Title ----
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.08);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * TITLE_FRAC + PAD;
  }

  if (orientation === 'horizontal') {
    drawHorizontal(ctx, steps, sublabels, highlight, x, plotTop, w, y + h - plotTop, {
      fg,
      bg,
      accent,
      palette,
    });
  } else {
    drawVertical(ctx, steps, sublabels, highlight, x, plotTop, w, y + h - plotTop, {
      fg,
      bg,
      accent,
      palette,
    });
  }
}

function drawHorizontal(ctx, steps, sublabels, highlight, x, y, w, h, colorCtx) {
  const n = steps.length;
  const innerW = w - PAD * 2;
  const arrowSpace = ARROW_LENGTH * (n - 1);
  const nodeW = Math.max(60, (innerW - arrowSpace) / n);
  const nodeH = Math.min(80, h - PAD * 2);

  const cx0 = x + PAD;
  const cy = y + h / 2;

  for (let i = 0; i < n; i++) {
    const nx = cx0 + i * (nodeW + ARROW_LENGTH);
    const ny = cy - nodeH / 2;
    drawNode(ctx, nx, ny, nodeW, nodeH, i + 1, steps[i], sublabels[i], i === highlight, colorCtx);

    // Arrow to next node (skip on last)
    if (i < n - 1) {
      const ax0 = nx + nodeW;
      const ax1 = nx + nodeW + ARROW_LENGTH;
      drawArrow(ctx, ax0 + 4, cy, ax1 - 6, cy, colorCtx.accent);
    }
  }
}

function drawVertical(ctx, steps, sublabels, highlight, x, y, w, h, colorCtx) {
  const n = steps.length;
  const innerH = h - PAD * 2;
  const arrowSpace = ARROW_LENGTH * (n - 1);
  const nodeH = Math.max(50, (innerH - arrowSpace) / n);
  const nodeW = Math.min(200, w - PAD * 2);

  const cx = x + w / 2;
  const cy0 = y + PAD;

  for (let i = 0; i < n; i++) {
    const ny = cy0 + i * (nodeH + ARROW_LENGTH);
    const nx = cx - nodeW / 2;
    drawNode(ctx, nx, ny, nodeW, nodeH, i + 1, steps[i], sublabels[i], i === highlight, colorCtx);

    if (i < n - 1) {
      const ay0 = ny + nodeH;
      const ay1 = ny + nodeH + ARROW_LENGTH;
      drawArrow(ctx, cx, ay0 + 4, cx, ay1 - 6, colorCtx.accent);
    }
  }
}

function drawNode(ctx, nx, ny, nw, nh, idx, label, sublabel, isHighlight, colorCtx) {
  const { accent } = colorCtx;
  const radius = 10;

  // Card body — palette.colors[0] fill for all steps (consistent, not rainbow)
  // Highlight: slightly lighter + accent border stroke
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.1);
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;

  const gradient = ctx.createLinearGradient(nx, ny, nx, ny + nh);
  if (isHighlight) {
    gradient.addColorStop(0, rgbCss(lighten(accent, 0.12)));
    gradient.addColorStop(1, rgbCss(accent));
  } else {
    // All non-highlight nodes use accent color with subtle gradient
    gradient.addColorStop(0, rgbCss(lighten(accent, 0.08)));
    gradient.addColorStop(1, rgbCss(accent));
  }
  ctx.fillStyle = gradient;
  roundedRectPath(ctx, nx, ny, nw, nh, radius);
  ctx.fill();
  ctx.restore();

  // Highlight stroke — accent border
  if (isHighlight) {
    ctx.save();
    ctx.strokeStyle = rgbCss(lighten(accent, 0.5));
    ctx.lineWidth = 2.5;
    roundedRectPath(ctx, nx, ny, nw, nh, radius);
    ctx.stroke();
    ctx.restore();
  }

  // Index circle (top-left) — white circle with accent text
  const circleR = 12;
  const circleCx = nx + circleR + NODE_PADDING * 0.5;
  const circleCy = ny + circleR + NODE_PADDING * 0.5;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(circleCx, circleCy, circleR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(idx), circleCx, circleCy + 1);

  // Label — Inter 700 white, centered in remaining space, with generous inner padding
  const textX = nx + circleR * 2 + NODE_PADDING;
  const textY = ny + nh / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.font = `700 ${Math.min(15, nh * 0.22)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = sublabel ? 'bottom' : 'middle';
  ctx.fillText(String(label), textX, sublabel ? textY : textY + 1);

  if (sublabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `400 ${Math.min(12, nh * 0.16)}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(String(sublabel), textX, textY + 4);
  }
}

function drawArrow(ctx, x0, y0, x1, y1, color) {
  const arrowHead = 8;

  // 2.5px stroke, palette.fg alpha 0.5 — clean, not bold black
  ctx.save();
  ctx.strokeStyle = rgbaCss(color, 0.5);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();

  // Arrowhead (filled triangle) — clean triangle, same color alpha 0.6
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular
  const px = -uy;
  const py = ux;

  ctx.fillStyle = rgbaCss(color, 0.6);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(
    x1 - arrowHead * ux + (arrowHead / 2) * px,
    y1 - arrowHead * uy + (arrowHead / 2) * py,
  );
  ctx.lineTo(
    x1 - arrowHead * ux - (arrowHead / 2) * px,
    y1 - arrowHead * uy - (arrowHead / 2) * py,
  );
  ctx.closePath();
  ctx.fill();
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
