// =============================================================================
// atoms-2d/charts/diagrams/comparison-table.js
// N-column comparison table with feature rows and check/cross/dash values.
//
// Args:
//   title?    — optional title bar
//   columns   — array of { label, highlight? } 2-5 items (REQUIRED)
//   features  — array of { label, values: (boolean|string)[] } 3-12 items (REQUIRED)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';
import { semanticColor } from '../../color.js';

export const spec = {
  type: 'comparison-table',
  category: 'charts/diagrams',
  description:
    'N-column comparison table with feature rows — check (true), cross (false), or text values per cell.',
  args: {
    title: { type: 'string?', example: 'Tier Comparison' },
    columns: {
      type: 'array',
      required: true,
      example: [
        { label: 'Current', highlight: false },
        { label: 'Target', highlight: true },
        { label: 'Future State', highlight: false },
      ],
    },
    features: {
      type: 'array',
      required: true,
      example: [
        { label: 'Automation', values: [false, true, true] },
        { label: 'Real-time data', values: [false, false, true] },
        { label: 'Self-service', values: [false, true, true] },
      ],
    },
  },
};

const TITLE_H_FRAC = 0.1;
const PAD = 12;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 480;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [248, 246, 240];
  const accent = palette.accent || palette.colors?.[0] || [60, 140, 200];

  // 对抗 R2 (2026-07-14): lift LLM 常烤出 name 而非 label — 字段名沉默
  // 失配曾让整张矩阵表头/行标签全空 (validator 不报未知键)。宽容读法。
  const alias = (o) => (o && typeof o === 'object' ? { ...o, label: o.label ?? o.name } : o);
  const cols = Array.isArray(args.columns) ? args.columns.slice(0, 5).map(alias) : [];
  const rows = Array.isArray(args.features) ? args.features.slice(0, 12).map(alias) : [];
  const title = args.title ? String(args.title) : '';

  if (cols.length === 0 || rows.length === 0) return;

  // Background
  ctx.fillStyle = rgbCss(bg);
  ctx.fillRect(x, y, w, h);

  let tableY = y;

  // Title bar
  if (title) {
    const titleH = Math.round(h * TITLE_H_FRAC);
    ctx.save();
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(titleH * 0.5)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + PAD, tableY + titleH / 2);
    ctx.restore();
    tableY += titleH;
  }

  const tableH = h - (tableY - y);
  const colLabelW = Math.round(w * 0.28); // feature label column
  const colW = (w - colLabelW) / cols.length;
  const headerH = Math.round(tableH * 0.14);
  const rowH = (tableH - headerH) / rows.length;
  // Sprint 84 (user: 表格字太小看不清): the 13px cap starved tall rows —
  // let type grow with the row up to 19px; per-cell shrink guards width.
  const fontSize = Math.max(12, Math.min(19, Math.round(rowH * 0.38)));
  const headerFontSize = Math.max(12, Math.min(19, Math.round(headerH * 0.4)));
  const fitWidth = (text, maxW, weight, fs) => {
    let f = fs;
    ctx.font = `${weight} ${f}px Inter, system-ui, sans-serif`;
    while (f > 10 && ctx.measureText(text).width > maxW) {
      f--;
      ctx.font = `${weight} ${f}px Inter, system-ui, sans-serif`;
    }
    return f;
  };

  // Column headers
  for (let c = 0; c < cols.length; c++) {
    const col = cols[c];
    const cx2 = x + colLabelW + c * colW;

    // Header bg — highlight col gets accent
    ctx.save();
    ctx.fillStyle = col.highlight ? rgbCss(accent) : rgbaCss(fg, 0.12);
    ctx.fillRect(cx2, tableY, colW, headerH);
    ctx.restore();

    // Header text
    ctx.save();
    ctx.fillStyle = col.highlight ? 'rgba(255,255,255,0.97)' : rgbCss(fg);
    fitWidth(String(col.label || ''), colW - 12, '700', headerFontSize);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(col.label || ''), cx2 + colW / 2, tableY + headerH / 2);
    ctx.restore();
  }

  // Feature rows
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowY = tableY + headerH + r * rowH;
    const isEven = r % 2 === 0;

    // Row alternating bg
    ctx.save();
    ctx.fillStyle = isEven ? rgbaCss(fg, 0.03) : 'transparent';
    ctx.fillRect(x, rowY, w, rowH);
    ctx.restore();

    // Feature label
    ctx.save();
    ctx.fillStyle = rgbCss(fg);
    fitWidth(String(row.label || ''), colLabelW - PAD * 1.5, '500', fontSize);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(row.label || ''), x + PAD, rowY + rowH / 2);
    ctx.restore();

    // Value cells
    const values = Array.isArray(row.values) ? row.values : [];
    for (let c = 0; c < cols.length; c++) {
      const val = values[c];
      const cellX = x + colLabelW + c * colW;
      const cellCX = cellX + colW / 2;
      const cellCY = rowY + rowH / 2;
      const col = cols[c];
      const isHighlight = Boolean(col.highlight);

      if (val === true || val === 'true' || val === 1) {
        // Green check mark
        drawCheck(
          ctx,
          cellCX,
          cellCY,
          fontSize * 1.1,
          isHighlight ? accent : semanticColor(palette, 'positive'),
        );
      } else if (val === false || val === 'false' || val === 0) {
        // Gray cross
        drawCross(ctx, cellCX, cellCY, fontSize * 0.9, semanticColor(palette, 'neutral'));
      } else if (val != null) {
        // Text value
        ctx.save();
        ctx.fillStyle = isHighlight ? rgbCss(accent) : rgbCss(fg);
        fitWidth(String(val), colW - 10, '600', fontSize);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(val), cellCX, cellCY);
        ctx.restore();
      } else {
        // Dash for missing
        ctx.save();
        ctx.fillStyle = rgbaCss(fg, 0.25);
        ctx.fillRect(cellCX - fontSize * 0.4, cellCY - 1, fontSize * 0.8, 2);
        ctx.restore();
      }
    }

    // Row divider
    ctx.save();
    ctx.strokeStyle = rgbaCss(fg, 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, rowY + rowH);
    ctx.lineTo(x + w, rowY + rowH);
    ctx.stroke();
    ctx.restore();
  }

  // Column dividers
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.1);
  ctx.lineWidth = 1;
  // Divider after label col
  ctx.beginPath();
  ctx.moveTo(x + colLabelW, tableY);
  ctx.lineTo(x + colLabelW, tableY + tableH);
  ctx.stroke();
  for (let c = 1; c < cols.length; c++) {
    const divX = x + colLabelW + c * colW;
    ctx.beginPath();
    ctx.moveTo(divX, tableY);
    ctx.lineTo(divX, tableY + tableH);
    ctx.stroke();
  }
  ctx.restore();

  // Outer border
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.15);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, tableY, w, tableH);
  ctx.restore();
}

function drawCheck(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.strokeStyle = rgbCss(color);
  ctx.lineWidth = Math.max(1.5, size * 0.15);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.38, cy);
  ctx.lineTo(cx - size * 0.1, cy + size * 0.3);
  ctx.lineTo(cx + size * 0.42, cy - size * 0.28);
  ctx.stroke();
  ctx.restore();
}

function drawCross(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.strokeStyle = rgbCss(color);
  ctx.lineWidth = Math.max(1.5, size * 0.15);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.35, cy - size * 0.35);
  ctx.lineTo(cx + size * 0.35, cy + size * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.35, cy - size * 0.35);
  ctx.lineTo(cx - size * 0.35, cy + size * 0.35);
  ctx.stroke();
  ctx.restore();
}
