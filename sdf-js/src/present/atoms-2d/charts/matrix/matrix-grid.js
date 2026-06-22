// =============================================================================
// atoms-2d/charts/matrix/matrix-grid.js — 2x2 / NxM matrix grid
// -----------------------------------------------------------------------------
// 2D pseudo-3D equivalent of matrix-grid-3d. Generic 2x2 framework
// (SWOT / Eisenhower / BCG-style 2x2 strategic matrix).
//
// Args:
//   rows / cols    — grid dimensions (default 2x2)
//   cells          — array of { label, sublabel?, color? } (row-major order)
//   xAxis          — optional { low, high } axis labels (bottom)
//   yAxis          — optional { low, high } axis labels (left)
//   title          — optional title
//   quadrantAxes   — optional { x: string, y: string } — named axis arrows for
//                    BCG-style rendering (draws labeled arrows outside the grid)
//   bubbles        — optional array of { row, col, label?, size? } — filled
//                    circle overlays positioned at cell (row,col) center.
//                    size is 0..1 relative to half the cell's smaller dimension
//                    (default 0.5). Enables BCG product-bubble rendering.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'matrix-grid',
  category: 'charts/matrix',
  description: '2x2 / NxM strategic matrix grid (SWOT / Eisenhower / BCG).',
  args: {
    rows: { type: 'integer 1-4', default: 2 },
    cols: { type: 'integer 1-4', default: 2 },
    cells: {
      type: 'array of { label, sublabel?, color? } in row-major order',
      required: true,
      example: [
        { label: 'Strengths' },
        { label: 'Weaknesses' },
        { label: 'Opportunities' },
        { label: 'Threats' },
      ],
    },
    xAxis: { type: '{ low, high }?', example: { low: 'Low', high: 'High' } },
    yAxis: { type: '{ low, high }?', example: { low: 'Low', high: 'High' } },
    title: { type: 'string?', example: 'SWOT Analysis' },
    quadrantAxes: {
      type: '{ x: string, y: string }?',
      example: { x: 'Market Growth', y: 'Market Share' },
    },
    bubbles: {
      type: 'array of { row, col, label?, size? }?',
      example: [{ row: 0, col: 1, label: 'Stars', size: 0.5 }],
    },
  },
};

const PAD = 14;
const AXIS_W = 50;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 480;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const colors = palette.colors || [
    [60, 130, 200],
    [180, 90, 90],
    [60, 170, 110],
    [180, 130, 60],
  ];

  const rows = clamp(args.rows | 0 || 2, 1, 4);
  const cols = clamp(args.cols | 0 || 2, 1, 4);
  const cells = Array.isArray(args.cells) ? args.cells : [];
  const xAxis = args.xAxis;
  const yAxis = args.yAxis;

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.06)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.1;
  }

  const yAxisW = yAxis ? AXIS_W : 0;
  const xAxisH = xAxis ? 24 : 0;
  const gridL = x + PAD + yAxisW;
  const gridR = x + w - PAD;
  const gridT = plotTop + PAD;
  const gridB = y + h - PAD - xAxisH;
  const cellW = (gridR - gridL) / cols;
  const cellH = (gridB - gridT) / rows;

  // Draw cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const cell = cells[idx] || {};
      const color = cell.color || colors[idx % colors.length];
      const cx = gridL + c * cellW;
      const cy = gridT + r * cellH;
      drawCell(ctx, cx + 4, cy + 4, cellW - 8, cellH - 8, cell.label, cell.sublabel, color);
    }
  }

  // Axes
  if (xAxis) {
    ctx.fillStyle = rgbaCss(fg, 0.7);
    ctx.font = `600 ${Math.round(h * 0.04)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(xAxis.low || '', gridL, gridB + 6);
    ctx.textAlign = 'right';
    ctx.fillText(xAxis.high || '', gridR, gridB + 6);
    // Axis line + arrow
    ctx.strokeStyle = rgbaCss(fg, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gridL, gridB);
    ctx.lineTo(gridR, gridB);
    ctx.stroke();
  }
  if (yAxis) {
    ctx.fillStyle = rgbaCss(fg, 0.7);
    ctx.font = `600 ${Math.round(h * 0.04)}px Inter, system-ui, sans-serif`;
    ctx.save();
    ctx.translate(x + PAD + 8, gridB);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(yAxis.low || '', 0, 0);
    ctx.textAlign = 'right';
    ctx.fillText(yAxis.high || '', gridB - gridT, 0);
    ctx.restore();
  }

  // ---- quadrantAxes — named arrow labels for BCG-style rendering ----
  // Draw after cells so arrows appear on top of grid borders
  if (args.quadrantAxes) {
    const qa = args.quadrantAxes;
    const arrowSize = 6;
    const labelFontSize = Math.round(h * 0.042);
    ctx.save();
    ctx.strokeStyle = rgbaCss(fg, 0.65);
    ctx.fillStyle = rgbaCss(fg, 0.65);
    ctx.lineWidth = 1.5;
    ctx.font = `600 ${labelFontSize}px Inter, system-ui, sans-serif`;

    // X-axis arrow: below grid, left→right
    if (qa.x) {
      const ay = gridB + 14;
      ctx.beginPath();
      ctx.moveTo(gridL, ay);
      ctx.lineTo(gridR, ay);
      ctx.stroke();
      // Arrow head right
      ctx.beginPath();
      ctx.moveTo(gridR, ay);
      ctx.lineTo(gridR - arrowSize, ay - arrowSize / 2);
      ctx.lineTo(gridR - arrowSize, ay + arrowSize / 2);
      ctx.closePath();
      ctx.fill();
      // Label centered below arrow
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(qa.x), gridL + (gridR - gridL) / 2, ay + 4);
    }

    // Y-axis arrow: left of grid, bottom→top (rotated)
    if (qa.y) {
      const ax = gridL - 14;
      ctx.save();
      ctx.translate(ax, gridT + (gridB - gridT) / 2);
      ctx.rotate(-Math.PI / 2);
      // Arrow (pointing up = left after rotation)
      ctx.beginPath();
      ctx.moveTo(-(gridB - gridT) / 2, 0);
      ctx.lineTo((gridB - gridT) / 2, 0);
      ctx.stroke();
      // Arrow head (pointing "up" = positive y direction)
      ctx.beginPath();
      ctx.moveTo((gridB - gridT) / 2, 0);
      ctx.lineTo((gridB - gridT) / 2 - arrowSize, -arrowSize / 2);
      ctx.lineTo((gridB - gridT) / 2 - arrowSize, arrowSize / 2);
      ctx.closePath();
      ctx.fill();
      // Label
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(qa.y), 0, -4);
      ctx.restore();
    }
    ctx.restore();
  }

  // ---- bubbles — filled circle overlays per cell (BCG product units) ----
  if (Array.isArray(args.bubbles) && args.bubbles.length > 0) {
    const bubbleColors = palette.colors || colors;
    for (let bi = 0; bi < args.bubbles.length; bi++) {
      const b = args.bubbles[bi];
      const bRow = clamp(Number(b.row) || 0, 0, rows - 1);
      const bCol = clamp(Number(b.col) || 0, 0, cols - 1);
      const sizeFrac = clamp(b.size != null ? Number(b.size) : 0.5, 0.05, 1);

      // Cell center
      const cellCx = gridL + bCol * cellW + cellW / 2;
      const cellCy = gridT + bRow * cellH + cellH / 2;
      const bubbleR = (Math.min(cellW, cellH) / 2) * sizeFrac * 0.7;

      const bubbleColor = bubbleColors[(bRow * cols + bCol) % bubbleColors.length];

      ctx.save();
      ctx.shadowColor = rgbaCss([0, 0, 0], 0.25);
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      const grad = ctx.createRadialGradient(
        cellCx - bubbleR * 0.25,
        cellCy - bubbleR * 0.25,
        0,
        cellCx,
        cellCy,
        bubbleR,
      );
      grad.addColorStop(0, rgbaCss(lighten(bubbleColor, 0.3), 0.92));
      grad.addColorStop(1, rgbaCss(bubbleColor, 0.88));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cellCx, cellCy, bubbleR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Bubble label
      if (b.label) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        const labelSize = Math.max(9, Math.round(bubbleR * 0.45));
        ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.label), cellCx, cellCy);
      }
    }
  }
}

function drawCell(ctx, x, y, w, h, label, sublabel, color) {
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, rgbCss(lighten(color, 0.18)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.restore();

  // Top iso accent
  ctx.fillStyle = rgbaCss(lighten(color, 0.4), 0.5);
  roundRect(ctx, x, y, w, 3, 8);
  ctx.fill();

  // Label
  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = `700 ${Math.min(20, h * 0.18)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = sublabel ? 'bottom' : 'middle';
    ctx.fillText(label, x + w / 2, sublabel ? y + h / 2 - 4 : y + h / 2);
  }
  if (sublabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = `500 ${Math.min(13, h * 0.1)}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(sublabel, x + w / 2, y + h / 2 + 6);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
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

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
