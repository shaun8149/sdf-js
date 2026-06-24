// =============================================================================
// atoms-2d/charts/matrix/nine-field-matrix.js — GE/McKinsey 9-cell priority matrix
// -----------------------------------------------------------------------------
// 3x3 grid with diagonal priority-band coloring:
//   GREEN  (top-left triangle)  — row 0 col 0, row 0 col 1, row 1 col 0 → Invest/Grow
//   YELLOW (anti-diagonal)      — row 0 col 2, row 1 col 1, row 2 col 0 → Selective
//   RED    (bottom-right)       — row 1 col 2, row 2 col 1, row 2 col 2 → Harvest/Divest
//
// Args:
//   cells     — array of 9 { label, sublabel? } in row-major order (required)
//   xAxis     — optional string, label for x-axis (Business Strength)
//   yAxis     — optional string, label for y-axis (Industry Attractiveness)
//   title     — optional string title above grid
//   bubbles   — optional array of { row, col, label?, size? } circle overlays
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { resolveIcon } from '../../../../icons/index.js';

export const spec = {
  type: 'nine-field-matrix',
  category: 'charts/matrix',
  description:
    'GE/McKinsey 9-cell priority matrix — 3x3 grid with diagonal red/yellow/green priority bands.',
  args: {
    cells: {
      type: 'array of 9 { label: string, sublabel?: string } in row-major order (top-left to bottom-right)',
      required: true,
      example: [
        { label: 'Invest' },
        { label: 'Invest' },
        { label: 'Selective' },
        { label: 'Invest' },
        { label: 'Selective' },
        { label: 'Harvest' },
        { label: 'Selective' },
        { label: 'Harvest' },
        { label: 'Divest' },
      ],
    },
    xAxis: { type: 'string?', example: 'Business Strength' },
    yAxis: { type: 'string?', example: 'Industry Attractiveness' },
    title: { type: 'string?', example: 'GE/McKinsey Matrix' },
    bubbles: {
      type: 'array of { row, col, label?, size? }?',
      example: [{ row: 0, col: 0, label: 'A', size: 0.6 }],
    },
  },
};

// Priority band assignment: 9 cells in row-major order (3x3)
// Index = row * 3 + col
//  0(0,0) 1(0,1) 2(0,2)
//  3(1,0) 4(1,1) 5(1,2)
//  6(2,0) 7(2,1) 8(2,2)
const BAND = ['green', 'green', 'yellow', 'green', 'yellow', 'red', 'yellow', 'red', 'red'];

const PAD = 14;
const AXIS_LABEL_H = 32; // height reserved below grid for xAxis label
const AXIS_LABEL_W = 46; // width reserved left of grid for yAxis label

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 480;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];

  // Priority band colors — prefer palette overrides, fall back to GE convention
  const BAND_GREEN = palette.bandGreen || [80, 170, 100];
  const BAND_YELLOW = palette.bandYellow || [220, 180, 70];
  const BAND_RED = palette.bandRed || [210, 90, 90];
  const bandColorMap = { green: BAND_GREEN, yellow: BAND_YELLOW, red: BAND_RED };

  const cells = Array.isArray(args.cells) ? args.cells : [];

  // -- Title --
  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.06)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.title), x + PAD, y + PAD);
    plotTop = y + h * 0.1;
  }

  const hasXAxis = Boolean(args.xAxis);
  const hasYAxis = Boolean(args.yAxis);
  const yAxisW = hasYAxis ? AXIS_LABEL_W : 0;
  const xAxisH = hasXAxis ? AXIS_LABEL_H : 0;

  const gridL = x + PAD + yAxisW;
  const gridR = x + w - PAD;
  const gridT = plotTop + PAD;
  const gridB = y + h - PAD - xAxisH;

  const ROWS = 3;
  const COLS = 3;
  const cellW = (gridR - gridL) / COLS;
  const cellH = (gridB - gridT) / ROWS;

  // -- Draw cells --
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      const cell = cells[idx] || {};
      const bandName = BAND[idx];
      const color = bandColorMap[bandName];
      const cx = gridL + c * cellW;
      const cy = gridT + r * cellH;
      drawCell(
        ctx,
        cx + 4,
        cy + 4,
        cellW - 8,
        cellH - 8,
        cell.label,
        cell.sublabel,
        color,
        cell.icon,
      );
    }
  }

  // -- Band legend ticks: subtle diagonal dividers (optional visual hint) --
  // Draw a faint grid border overlay so cell separation is clear
  ctx.strokeStyle = rgbaCss(fg, 0.12);
  ctx.lineWidth = 1;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(gridL, gridT + r * cellH);
    ctx.lineTo(gridR, gridT + r * cellH);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(gridL + c * cellW, gridT);
    ctx.lineTo(gridL + c * cellW, gridB);
    ctx.stroke();
  }

  // -- X-axis label: "Business Strength  ← High ... Low →" --
  if (hasXAxis) {
    const arrowSize = 6;
    const ay = gridB + 14;
    ctx.save();
    ctx.strokeStyle = rgbaCss(fg, 0.5);
    ctx.fillStyle = rgbaCss(fg, 0.7);
    ctx.lineWidth = 1.5;
    ctx.font = `600 ${Math.round(h * 0.04)}px Inter, system-ui, sans-serif`;

    // Arrow line left→right
    ctx.beginPath();
    ctx.moveTo(gridL, ay);
    ctx.lineTo(gridR, ay);
    ctx.stroke();
    // Arrowhead at right end
    ctx.beginPath();
    ctx.moveTo(gridR, ay);
    ctx.lineTo(gridR - arrowSize, ay - arrowSize / 2);
    ctx.lineTo(gridR - arrowSize, ay + arrowSize / 2);
    ctx.closePath();
    ctx.fill();

    // Axis label centered below arrow
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(args.xAxis), gridL + (gridR - gridL) / 2, ay + 5);
    ctx.restore();
  }

  // -- Y-axis label: "Industry Attractiveness" rotated, arrow pointing up --
  if (hasYAxis) {
    const arrowSize = 6;
    const ax = x + PAD + 10;
    const midY = gridT + (gridB - gridT) / 2;
    const span = gridB - gridT;

    ctx.save();
    ctx.translate(ax, midY);
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = rgbaCss(fg, 0.5);
    ctx.fillStyle = rgbaCss(fg, 0.7);
    ctx.lineWidth = 1.5;

    // Arrow line bottom→top (in rotated space, left→right = bottom→top)
    ctx.beginPath();
    ctx.moveTo(-span / 2, 0);
    ctx.lineTo(span / 2, 0);
    ctx.stroke();
    // Arrowhead at top (right in rotated space)
    ctx.beginPath();
    ctx.moveTo(span / 2, 0);
    ctx.lineTo(span / 2 - arrowSize, -arrowSize / 2);
    ctx.lineTo(span / 2 - arrowSize, arrowSize / 2);
    ctx.closePath();
    ctx.fill();

    // Label centered along axis
    ctx.font = `600 ${Math.round(h * 0.04)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(args.yAxis), 0, -5);
    ctx.restore();
  }

  // -- Bubbles overlay --
  if (Array.isArray(args.bubbles) && args.bubbles.length > 0) {
    // Use a contrasting set for bubbles — white with border works over colored cells
    const bubbleBaseColors = palette.colors || [
      [255, 255, 255],
      [240, 240, 255],
      [255, 240, 220],
    ];
    for (let bi = 0; bi < args.bubbles.length; bi++) {
      const b = args.bubbles[bi];
      const bRow = clamp(Number(b.row) || 0, 0, ROWS - 1);
      const bCol = clamp(Number(b.col) || 0, 0, COLS - 1);
      const sizeFrac = clamp(b.size != null ? Number(b.size) : 0.5, 0.05, 1);

      const cellCx = gridL + bCol * cellW + cellW / 2;
      const cellCy = gridT + bRow * cellH + cellH / 2;
      const bubbleR = (Math.min(cellW, cellH) / 2) * sizeFrac * 0.7;

      const bandName = BAND[bRow * COLS + bCol];
      const bandColor = bandColorMap[bandName];
      // Bubble: white fill with subtle ring in band color for contrast
      ctx.save();
      ctx.shadowColor = rgbaCss([0, 0, 0], 0.28);
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
      grad.addColorStop(0, rgbaCss([255, 255, 255], 0.97));
      grad.addColorStop(1, rgbaCss(lighten(bandColor, 0.5), 0.9));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cellCx, cellCy, bubbleR, 0, Math.PI * 2);
      ctx.fill();

      // Ring border in band color
      ctx.strokeStyle = rgbaCss(bandColor, 0.8);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Bubble label in dark text (legible over white bubble)
      if (b.label) {
        ctx.fillStyle = rgbaCss(fg, 0.92);
        const labelSize = Math.max(9, Math.round(bubbleR * 0.5));
        ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.label), cellCx, cellCy);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawCell(ctx, x, y, w, h, label, sublabel, color, iconName) {
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, rgbCss(lighten(color, 0.22)));
  grad.addColorStop(1, rgbCss(color));
  ctx.fillStyle = grad;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.restore();

  // Top iso accent strip
  ctx.fillStyle = rgbaCss(lighten(color, 0.45), 0.5);
  roundRect(ctx, x, y, w, 3, 8);
  ctx.fill();

  // Sprint 18: small icon in top-left corner of cell
  if (iconName) {
    const resolved = resolveIcon(iconName);
    const viewBox = resolved.source === 'brand' ? 24 : 256;
    const iconSize = Math.min(h * 0.28, w * 0.28, 24);
    ctx.save();
    try {
      ctx.translate(x + 6, y + 8);
      ctx.scale(iconSize / viewBox, iconSize / viewBox);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      if (resolved.path) ctx.fill(resolved.path);
    } catch (_) {
      /* Path2D unavailable (Node) */
    }
    ctx.restore();
  }

  // Label
  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = `700 ${Math.min(20, h * 0.2)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = sublabel ? 'bottom' : 'middle';
    ctx.fillText(String(label), x + w / 2, sublabel ? y + h / 2 - 4 : y + h / 2);
  }
  if (sublabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = `500 ${Math.min(12, h * 0.1)}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(String(sublabel), x + w / 2, y + h / 2 + 6);
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
