// =============================================================================
// atoms-2d/charts/diagrams/multiple-arrows.js — Multi-arrow flow diagram
// -----------------------------------------------------------------------------
// Renders N arrows in one of three flow patterns:
//   • converge  (N → 1): N arrows from left fan into single right convergence point
//   • diverge   (1 → N): single arrow on left fans out to N arrows on right
//   • parallel  (N → N): N horizontal side-by-side lanes, each pointing right
//
// Pseudo-3D treatment:
//   - Arrow body: filled with vertical gradient (lighter top, base color bottom)
//   - Drop shadow under each arrow
//   - Triangular arrowhead at tip
//   - Per-arrow color from palette.colors[] (or args.arrows[i].color override)
//   - Labels at arrow start (converge) or arrow end (diverge/parallel)
//   - Optional centerLabel box at convergence / divergence point
//   - Optional title top-left
//
// Per [[atlas-atom-taxonomy]] — charts/diagrams family.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'multiple-arrows',
  category: 'charts/diagrams',
  description: 'Multi-arrow flow — N arrows in converge / diverge / parallel pattern with labels.',
  args: {
    mode: { type: "'converge'|'diverge'|'parallel'", required: true, example: 'converge' },
    arrows: {
      type: 'array of { label?: string, color?: [r,g,b] }',
      required: true,
      example: [{ label: 'Input A' }, { label: 'Input B' }, { label: 'Input C' }],
    },
    centerLabel: { type: 'string?', example: 'Output' },
    title: { type: 'string?', example: '3 → 1 Aggregation' },
  },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAD = 16;
const TITLE_FRAC = 0.1;
const BODY_WIDTH_FRAC = 0.055; // arrow body height as fraction of plot height
const HEAD_LEN_FRAC = 0.08; // arrowhead length as fraction of arrow length
const HEAD_HALF_FRAC = 1.6; // arrowhead half-width = bodyW * this
const CENTER_BOX_W_FRAC = 0.18;
const CENTER_BOX_H_FRAC = 0.12;
const LABEL_FONT_FRAC = 0.038;
const SHADOW_ALPHA = 0.22;

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------
function lighten(rgb, amt) {
  return [
    Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * amt)),
    Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * amt)),
    Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * amt)),
  ];
}

function darken(rgb, amt) {
  return [
    Math.max(0, Math.round(rgb[0] * (1 - amt))),
    Math.max(0, Math.round(rgb[1] * (1 - amt))),
    Math.max(0, Math.round(rgb[2] * (1 - amt))),
  ];
}

// ---------------------------------------------------------------------------
// Draw a single horizontal arrow from (x0, cy) to (x1, cy) with given body height.
// The arrow is drawn pointing RIGHT.
// ---------------------------------------------------------------------------
function drawHorizontalArrow(ctx, x0, cy, x1, bodyW, color) {
  const arrowLen = x1 - x0;
  if (arrowLen < 4) return;

  const headLen = Math.min(arrowLen * 0.25, Math.max(14, bodyW * HEAD_HALF_FRAC * 1.2));
  const headHalf = bodyW * HEAD_HALF_FRAC;
  const stemEnd = x1 - headLen;

  // Drop shadow
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${SHADOW_ALPHA})`;
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;

  // Vertical gradient: lighter top → base color
  const grad = ctx.createLinearGradient(0, cy - bodyW, 0, cy + bodyW);
  grad.addColorStop(0, rgbCss(lighten(color, 0.28)));
  grad.addColorStop(1, rgbCss(darken(color, 0.08)));
  ctx.fillStyle = grad;

  // Arrow body + head as single path
  ctx.beginPath();
  // Stem top-left
  ctx.moveTo(x0, cy - bodyW);
  // Stem top-right (where head base starts)
  ctx.lineTo(stemEnd, cy - bodyW);
  // Head top
  ctx.lineTo(stemEnd, cy - headHalf);
  // Arrowhead tip
  ctx.lineTo(x1, cy);
  // Head bottom
  ctx.lineTo(stemEnd, cy + headHalf);
  // Stem bottom-right
  ctx.lineTo(stemEnd, cy + bodyW);
  // Stem bottom-left
  ctx.lineTo(x0, cy + bodyW);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Subtle top highlight stripe
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, cy - bodyW, stemEnd - x0, bodyW * 0.4);
  ctx.fillStyle = `rgba(255,255,255,0.12)`;
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Draw a tapered/diagonal arrow from (x0, y0) → (x1, y1).
// Used in converge/diverge modes for the fan lines.
// This draws a filled polygon that looks like a tapered arrow body.
// ---------------------------------------------------------------------------
function drawDiagonalArrow(ctx, x0, y0, x1, y1, bodyW, headLen, color) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 4) return;

  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular
  const px = -uy;
  const py = ux;

  const headHalf = bodyW * HEAD_HALF_FRAC;
  // Taper: stem starts at half-width at x0 end, full width partway
  const stemHalf = bodyW * 0.6;
  const stemEndX = x1 - ux * headLen;
  const stemEndY = y1 - uy * headLen;

  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${SHADOW_ALPHA})`;
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;

  const grad = ctx.createLinearGradient(
    x0 + px * bodyW,
    y0 + py * bodyW,
    x0 - px * bodyW,
    y0 - py * bodyW,
  );
  grad.addColorStop(0, rgbCss(lighten(color, 0.28)));
  grad.addColorStop(1, rgbCss(darken(color, 0.08)));
  ctx.fillStyle = grad;

  ctx.beginPath();
  // Start (narrow end): two points close together
  ctx.moveTo(x0 + px * stemHalf, y0 + py * stemHalf);
  // Stem — top edge to head base
  ctx.lineTo(stemEndX + px * bodyW, stemEndY + py * bodyW);
  // Head — outer point
  ctx.lineTo(stemEndX + px * headHalf, stemEndY + py * headHalf);
  // Arrowhead tip
  ctx.lineTo(x1, y1);
  // Head — inner point
  ctx.lineTo(stemEndX - px * headHalf, stemEndY - py * headHalf);
  // Stem — bottom edge back to start
  ctx.lineTo(stemEndX - px * bodyW, stemEndY - py * bodyW);
  ctx.lineTo(x0 - px * stemHalf, y0 - py * stemHalf);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Draw a label (background pill + text) at a given anchor
// ---------------------------------------------------------------------------
function drawLabel(ctx, text, cx, cy, fontSize, fg, bgColor, placement) {
  if (!text) return;
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  const metrics = ctx.measureText(text);
  const tw = metrics.width;
  const th = fontSize;
  const pillPadX = fontSize * 0.5;
  const pillPadY = fontSize * 0.28;
  const pillW = tw + pillPadX * 2;
  const pillH = th + pillPadY * 2;

  // Position pill depending on placement: 'left', 'right', 'above'
  let px, py;
  switch (placement) {
    case 'right':
      px = cx + 6;
      py = cy - pillH / 2;
      break;
    case 'above':
      px = cx - pillW / 2;
      py = cy - pillH - 4;
      break;
    case 'left':
    default:
      px = cx - pillW - 6;
      py = cy - pillH / 2;
      break;
  }

  // Pill background
  const bg = bgColor || [245, 245, 245];
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = rgbCss(bg);
  const r = pillH / 2;
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.arcTo(px + pillW, py, px + pillW, py + pillH, r);
  ctx.arcTo(px + pillW, py + pillH, px, py + pillH, r);
  ctx.arcTo(px, py + pillH, px, py, r);
  ctx.arcTo(px, py, px + pillW, py, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Text
  ctx.fillStyle = rgbCss(fg);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillText(text, px + pillPadX, py + pillPadY);
}

// ---------------------------------------------------------------------------
// Draw centerLabel box (rounded rect + text)
// ---------------------------------------------------------------------------
function drawCenterBox(ctx, cx, cy, bw, bh, label, accentColor, fg) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;

  const grad = ctx.createLinearGradient(cx - bw / 2, cy - bh / 2, cx - bw / 2, cy + bh / 2);
  grad.addColorStop(0, rgbCss(lighten(accentColor, 0.22)));
  grad.addColorStop(1, rgbCss(accentColor));
  ctx.fillStyle = grad;

  const rx = 8;
  const x = cx - bw / 2;
  const y = cy - bh / 2;
  ctx.beginPath();
  ctx.moveTo(x + rx, y);
  ctx.arcTo(x + bw, y, x + bw, y + bh, rx);
  ctx.arcTo(x + bw, y + bh, x, y + bh, rx);
  ctx.arcTo(x, y + bh, x, y, rx);
  ctx.arcTo(x, y, x + bw, y, rx);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Text inside box
  if (label) {
    const fs = Math.max(11, Math.min(16, bh * 0.4));
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), cx, cy);
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 560;
  const h = opts.h ?? 340;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || [60, 100, 200];

  const defaultColors = palette.colors || [
    [60, 100, 200],
    [200, 100, 60],
    [60, 180, 100],
    [180, 60, 180],
    [200, 180, 60],
    [60, 160, 180],
  ];

  const mode = args.mode || 'parallel';
  const arrows = Array.isArray(args.arrows) ? args.arrows : [];
  const N = Math.max(1, arrows.length);
  const centerLabel = args.centerLabel || null;
  const title = args.title || null;

  // ---- Title ----
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.058);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(title), x + PAD, y + PAD);
    plotTop = y + h * TITLE_FRAC + PAD;
  }

  const plotH = y + h - plotTop - PAD;
  const plotW = w - PAD * 2;
  const plotX = x + PAD;
  const plotY = plotTop;

  const bodyW = Math.max(6, Math.min(18, plotH * BODY_WIDTH_FRAC));
  const fontSize = Math.max(10, Math.min(14, h * LABEL_FONT_FRAC));
  const centerBoxW = plotW * CENTER_BOX_W_FRAC;
  const centerBoxH = plotH * CENTER_BOX_H_FRAC;

  // ---- CONVERGE mode (N → 1) ----
  if (mode === 'converge') {
    // Arrow starts on left side at evenly spaced y positions
    // All converge to center-right point
    const convergX = plotX + plotW * 0.82;
    const convergY = plotY + plotH / 2;
    const startX = plotX + plotW * 0.04;

    const rowH = plotH / N;
    const headLen = Math.min(plotW * HEAD_LEN_FRAC, bodyW * 2.5);

    for (let i = 0; i < N; i++) {
      const rowY = plotY + rowH * i + rowH / 2;
      const color = arrows[i]?.color || defaultColors[i % defaultColors.length];

      drawDiagonalArrow(ctx, startX, rowY, convergX, convergY, bodyW, headLen, color);

      // Label at left (arrow start)
      const labelText = arrows[i]?.label || '';
      if (labelText) {
        drawLabel(ctx, labelText, startX, rowY, fontSize, fg, lighten(color, 0.78), 'right');
      }
    }

    // Center box at convergence point
    if (centerLabel) {
      drawCenterBox(
        ctx,
        convergX + centerBoxW * 0.5,
        convergY,
        centerBoxW,
        centerBoxH,
        centerLabel,
        accent,
        fg,
      );
    }
  }

  // ---- DIVERGE mode (1 → N) ----
  else if (mode === 'diverge') {
    // Single source on left center → N arrows fan to right
    const sourceX = plotX + plotW * 0.18;
    const sourceY = plotY + plotH / 2;
    const endX = plotX + plotW * 0.96;

    const rowH = plotH / N;
    const headLen = Math.min(plotW * HEAD_LEN_FRAC, bodyW * 2.5);

    // Center box at source
    if (centerLabel) {
      drawCenterBox(
        ctx,
        sourceX - centerBoxW * 0.5,
        sourceY,
        centerBoxW,
        centerBoxH,
        centerLabel,
        accent,
        fg,
      );
    }

    for (let i = 0; i < N; i++) {
      const rowY = plotY + rowH * i + rowH / 2;
      const color = arrows[i]?.color || defaultColors[i % defaultColors.length];

      drawDiagonalArrow(ctx, sourceX, sourceY, endX, rowY, bodyW, headLen, color);

      // Label at right (arrow end)
      const labelText = arrows[i]?.label || '';
      if (labelText) {
        drawLabel(ctx, labelText, endX, rowY, fontSize, fg, lighten(color, 0.78), 'right');
      }
    }
  }

  // ---- PARALLEL mode (N → N lanes) ----
  else {
    // N arrows stacked vertically, each pointing right, each with own label
    const startX = plotX + plotW * 0.02;
    const endX = plotX + plotW * 0.88;
    const rowH = plotH / N;

    for (let i = 0; i < N; i++) {
      const rowY = plotY + rowH * i + rowH / 2;
      const color = arrows[i]?.color || defaultColors[i % defaultColors.length];

      drawHorizontalArrow(ctx, startX, rowY, endX, bodyW, color);

      // Label above arrow (centered) or at left if not enough space
      const labelText = arrows[i]?.label || '';
      if (labelText) {
        // Render label above arrow body center
        const midX = startX + (endX - startX) * 0.18;
        drawLabel(
          ctx,
          labelText,
          midX,
          rowY - bodyW - 2,
          fontSize,
          fg,
          lighten(color, 0.78),
          'right',
        );
      }
    }

    // In parallel mode, centerLabel appears as a title on the right endpoint
    if (centerLabel) {
      drawCenterBox(
        ctx,
        endX + centerBoxW * 0.5 + 4,
        plotY + plotH / 2,
        centerBoxW,
        Math.min(centerBoxH * 1.2, rowH * N * 0.8),
        centerLabel,
        accent,
        fg,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Utility re-exports for consumers that need them (tests, etc.)
// ---------------------------------------------------------------------------
export { spec as default };
