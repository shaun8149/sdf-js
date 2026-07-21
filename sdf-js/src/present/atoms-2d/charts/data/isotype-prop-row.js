// =============================================================================
// atoms-2d/charts/data/isotype-prop-row.js — Isotype proportion row atom
// -----------------------------------------------------------------------------
// N copies of a shape in a row, each filled bottom-up to a fill ratio.
// Classic infographic pattern for sustainability/resource metrics (e.g. water
// bottles showing recycling rates by region).
//
// Args:
//   count      — number of shapes in the row (2-10)
//   fillRatios — array of `count` numbers 0..1 indicating fill level
//   propShape  — 'bottle' | 'bulb' | 'drop' | 'circle' (default: 'circle')
//   labels     — optional array of `count` strings (labels below each shape)
//   title      — optional chart title
//
// Per [[atlas-pl-observation-pool-v3]] Batch 3 Finding B — Sprint 15b B3.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'isotype-prop-row',
  category: 'charts/data',
  description:
    'N copies of shape in a row, each filled to a percentage — for sustainability/resource metrics.',
  args: {
    count: { type: 'number 2-10', required: true, example: 5 },
    fillRatios: {
      type: 'array of count numbers 0..1',
      required: true,
      example: [0.9, 0.7, 0.5, 0.3, 0.1],
    },
    propShape: { type: "'bottle'|'bulb'|'drop'|'circle'?", default: 'circle' },
    labels: { type: 'array of count strings?', example: ['90%', '70%', '50%', '30%', '10%'] },
    title: { type: 'string?', example: 'Recycling Rate by Region' },
  },
};

export const SAMPLES = [
  {
    args: {
      count: 5,
      fillRatios: [0.9, 0.7, 0.5, 0.3, 0.1],
      propShape: 'bottle',
      labels: ['North', 'East', 'South', 'West', 'Central'],
      title: 'Recycling Rate by Region',
    },
  },
  {
    args: {
      count: 4,
      fillRatios: [1.0, 0.72, 0.48, 0.21],
      propShape: 'drop',
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      title: 'Water Conservation Progress',
    },
  },
];

const PAD = 20;
const MUTED_COLOR = [180, 180, 175];

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 480;
  const h = opts.h ?? 320;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg ? rgbCss(palette.bg) : '#fafaf8';
  const accent = palette.colors?.[0] || [60, 130, 200];

  const count = Math.max(2, Math.min(10, Math.round(args.count ?? 5)));
  const fillRatios = Array.isArray(args.fillRatios) ? args.fillRatios : [];
  const propShape = args.propShape || 'circle';
  const labels = Array.isArray(args.labels) ? args.labels : [];
  const title = args.title;

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  // Title
  let contentY = y + PAD;
  if (title) {
    ctx.save();
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.07)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, contentY);
    contentY += Math.round(h * 0.1);
    ctx.restore();
  }

  // Reserve label space at bottom
  const labelH = labels.length > 0 ? Math.round(h * 0.1) : 0;
  const shapeBottom = y + h - PAD - labelH;
  const shapeAreaH = shapeBottom - contentY;

  const cellW = (w - PAD * 2) / count;
  const shapePad = cellW * 0.12;
  const shapeW = cellW - shapePad * 2;
  const shapeH = shapeAreaH;

  for (let i = 0; i < count; i++) {
    const ratio = Math.max(0, Math.min(1, fillRatios[i] ?? 0));
    const cellX = x + PAD + i * cellW;
    const cx = cellX + cellW / 2;
    const shapeTop = contentY;

    // Draw shape twice: full muted bg, then clipped fill
    drawShape(ctx, propShape, cx, shapeTop, shapeW, shapeH, MUTED_COLOR, 0.25);
    if (ratio > 0) {
      drawShapeWithFill(ctx, propShape, cx, shapeTop, shapeW, shapeH, accent, ratio);
    }

    // Label below shape
    if (labels[i]) {
      ctx.save();
      ctx.fillStyle = rgbaCss(fg, 0.75);
      ctx.font = `600 ${Math.round(h * 0.055)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(labels[i]), cx, shapeBottom + 6);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------
// Shape drawing — path builders for each prop shape
// ---------------------------------------------------------------------------

function buildShapePath(ctx, propShape, cx, top, sw, sh) {
  const hw = sw / 2;

  ctx.beginPath();
  if (propShape === 'bottle') {
    // Rounded rect body with narrower neck at top
    const neckW = hw * 0.55;
    const neckH = sh * 0.22;
    const bodyTop = top + neckH;
    const r = hw * 0.35;
    // neck
    ctx.moveTo(cx - neckW, top);
    ctx.lineTo(cx + neckW, top);
    ctx.lineTo(cx + neckW, bodyTop);
    // body right side (rounded bottom-right)
    ctx.lineTo(cx + hw, bodyTop);
    ctx.lineTo(cx + hw, top + sh - r);
    ctx.quadraticCurveTo(cx + hw, top + sh, cx + hw - r, top + sh);
    ctx.lineTo(cx - hw + r, top + sh);
    ctx.quadraticCurveTo(cx - hw, top + sh, cx - hw, top + sh - r);
    ctx.lineTo(cx - hw, bodyTop);
    ctx.lineTo(cx - neckW, bodyTop);
    ctx.closePath();
  } else if (propShape === 'bulb') {
    // Light bulb: circle top + tapered rectangular base
    const bulbR = hw * 0.88;
    const bulbCy = top + bulbR;
    const baseH = sh * 0.3;
    const baseTop = top + bulbR * 1.6;
    // bulb circle
    ctx.arc(cx, bulbCy, bulbR, 0, Math.PI * 2);
    ctx.closePath();
    // base rectangle (as separate path — drawn after)
  } else if (propShape === 'drop') {
    // Teardrop: pointed top, round bottom
    ctx.moveTo(cx, top);
    ctx.bezierCurveTo(cx + hw * 0.85, top + sh * 0.35, cx + hw, top + sh * 0.6, cx, top + sh);
    ctx.bezierCurveTo(cx - hw, top + sh * 0.6, cx - hw * 0.85, top + sh * 0.35, cx, top);
    ctx.closePath();
  } else {
    // circle (default)
    const r = Math.min(hw, sh / 2) * 0.88;
    const circleCy = top + sh / 2;
    ctx.arc(cx, circleCy, r, 0, Math.PI * 2);
    ctx.closePath();
  }
}

function drawShape(ctx, propShape, cx, top, sw, sh, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  if (propShape === 'bulb') {
    drawBulbShape(ctx, cx, top, sw, sh, color, 1.0);
  } else {
    buildShapePath(ctx, propShape, cx, top, sw, sh);
    ctx.fillStyle = rgbCss(color);
    ctx.fill();
  }
  ctx.restore();
}

function drawBulbShape(ctx, cx, top, sw, sh, color, alpha) {
  const hw = sw / 2;
  const bulbR = hw * 0.8;
  const bulbCy = top + bulbR + sh * 0.05;
  const baseH = sh * 0.28;
  const baseTop = bulbCy + bulbR * 0.7;
  const baseW = hw * 0.6;
  const capsH = baseH * 0.18;

  ctx.fillStyle = rgbCss(color);
  // bulb
  ctx.beginPath();
  ctx.arc(cx, bulbCy, bulbR, 0, Math.PI * 2);
  ctx.fill();
  // base body
  ctx.beginPath();
  ctx.moveTo(cx - baseW, baseTop);
  ctx.lineTo(cx + baseW, baseTop);
  ctx.lineTo(cx + baseW * 0.85, baseTop + baseH - capsH);
  ctx.lineTo(cx - baseW * 0.85, baseTop + baseH - capsH);
  ctx.closePath();
  ctx.fill();
  // cap
  ctx.beginPath();
  ctx.moveTo(cx - baseW * 0.85, baseTop + baseH - capsH);
  ctx.lineTo(cx + baseW * 0.85, baseTop + baseH - capsH);
  ctx.lineTo(cx + baseW * 0.7, baseTop + baseH);
  ctx.lineTo(cx - baseW * 0.7, baseTop + baseH);
  ctx.closePath();
  ctx.fill();
}

function drawShapeWithFill(ctx, propShape, cx, top, sw, sh, accent, ratio) {
  ctx.save();

  // Clip to the shape outline
  ctx.beginPath();
  if (propShape === 'bulb') {
    const hw = sw / 2;
    const bulbR = hw * 0.8;
    const bulbCy = top + bulbR + sh * 0.05;
    const baseH = sh * 0.28;
    const baseTop = bulbCy + bulbR * 0.7;
    const baseW = hw * 0.6;
    const capsH = baseH * 0.18;
    ctx.arc(cx, bulbCy, bulbR, 0, Math.PI * 2);
    ctx.moveTo(cx - baseW, baseTop);
    ctx.lineTo(cx + baseW, baseTop);
    ctx.lineTo(cx + baseW * 0.85, baseTop + baseH - capsH);
    ctx.lineTo(cx - baseW * 0.85, baseTop + baseH - capsH);
    ctx.closePath();
    ctx.moveTo(cx - baseW * 0.85, baseTop + baseH - capsH);
    ctx.lineTo(cx + baseW * 0.85, baseTop + baseH - capsH);
    ctx.lineTo(cx + baseW * 0.7, baseTop + baseH);
    ctx.lineTo(cx - baseW * 0.7, baseTop + baseH);
    ctx.closePath();
  } else {
    buildShapePath(ctx, propShape, cx, top, sw, sh);
  }
  ctx.clip();

  // Fill bottom-up: fillY is the top of the filled area
  const fillY = top + sh * (1 - ratio);
  const grad = ctx.createLinearGradient(cx, fillY, cx, top + sh);
  grad.addColorStop(0, rgbaCss(lighten(accent, 0.1), 0.95));
  grad.addColorStop(1, rgbaCss(darken(accent, 0.1), 0.95));
  ctx.fillStyle = grad;

  // Drop shadow inside the fill
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.1);
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillRect(cx - sw / 2 - 2, fillY, sw + 4, sh * ratio + 2);
  ctx.restore();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

function darken(rgb, amt) {
  return [
    Math.max(0, rgb[0] * (1 - amt)),
    Math.max(0, rgb[1] * (1 - amt)),
    Math.max(0, rgb[2] * (1 - amt)),
  ];
}
