// =============================================================================
// atoms-2d/charts/layers/magazine-column-grid.js — N-column mosaic by category
// -----------------------------------------------------------------------------
// Magazine-style N-column layout: each column has a colored header band with
// category name + a list of items below with label/value pairs.
//
// Primary use: department snapshots, quarterly dashboards, competitive
// benchmarks, side-by-side category comparisons.
//
// Args:
//   categories — array of 2-5 { name: string, items: [{ label, value? }] } (REQUIRED)
//   title      — optional title
//
// Render: pseudo-3D
//   - N vertical columns of equal width
//   - Hairline column dividers (fg alpha 0.15, 1px)
//   - Header band per column (palette.colors[i], ~18% of height)
//     - Category name: Inter 700, white, centered
//   - Item rows below:
//     - label: Inter 600, fg, left
//     - value: Inter 700/900 (900 for short values), right-aligned accent color
//   - Padding 20-24px; background warm off-white fallback
//
// Per [[atlas-sprint15b-idiom-atoms-plan]] — Sprint 15b Batch B1.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'magazine-column-grid',
  category: 'charts/layers',
  description:
    'N-column mosaic by category — each column has header band + list of label/value items.',
  args: {
    categories: {
      type: 'array of 2-5 { name: string, items: [{ label, value? }] }',
      required: true,
      example: [
        {
          name: 'Sales',
          items: [
            { label: 'Revenue', value: '$3.4M' },
            { label: 'Leads', value: '1,200' },
          ],
        },
        {
          name: 'Product',
          items: [
            { label: 'Releases', value: '8' },
            { label: 'NPS', value: '72' },
          ],
        },
        {
          name: 'Eng',
          items: [
            { label: 'PRs', value: '340' },
            { label: 'Uptime', value: '99.9%' },
          ],
        },
      ],
    },
    title: { type: 'string?', example: 'Q3 Department Snapshot' },
  },
};

const PAD = 20;
const TITLE_FRAC = 0.1;
const HEADER_FRAC = 0.18; // fraction of plot height for column headers
const ITEM_PAD_X = 14;
const ITEM_PAD_Y = 10;
const DIVIDER_W = 1;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 620;
  const h = opts.h ?? 420;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [250, 250, 248];
  const groupColors = palette.colors || [
    [60, 100, 200],
    [200, 100, 60],
    [60, 180, 100],
    [180, 60, 180],
    [200, 180, 60],
  ];

  const categories = Array.isArray(args.categories) ? args.categories.slice(0, 5) : [];
  const title = args.title;
  const N = categories.length;
  if (N === 0) return;

  // ---- Title ----
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.058);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * TITLE_FRAC + PAD;
  }

  const plotH = y + h - plotTop - PAD;
  const colW = (w - PAD * 2) / N;
  const headerH = plotH * HEADER_FRAC;
  const bodyTop = plotTop + headerH;
  const bodyH = plotH - headerH;

  // ---- Draw column backgrounds (alternating subtle tint) ----
  for (let i = 0; i < N; i++) {
    const colX = x + PAD + i * colW;
    if (i % 2 === 1) {
      ctx.save();
      ctx.fillStyle = rgbaCss(fg, 0.03);
      ctx.fillRect(colX, plotTop, colW, plotH);
      ctx.restore();
    }
  }

  // ---- Draw column dividers (hairlines) ----
  for (let i = 1; i < N; i++) {
    const divX = x + PAD + i * colW;
    ctx.save();
    ctx.strokeStyle = rgbaCss(fg, 0.15);
    ctx.lineWidth = DIVIDER_W;
    ctx.beginPath();
    ctx.moveTo(divX, plotTop);
    ctx.lineTo(divX, plotTop + plotH);
    ctx.stroke();
    ctx.restore();
  }

  // ---- Draw each column ----
  for (let i = 0; i < N; i++) {
    const cat = categories[i];
    const colX = x + PAD + i * colW;
    const color = groupColors[i % groupColors.length];

    // ---- Header band ----
    ctx.save();
    // Subtle gradient on header
    const headerGrad = ctx.createLinearGradient(colX, plotTop, colX, plotTop + headerH);
    headerGrad.addColorStop(0, rgbCss(lighten(color, 0.1)));
    headerGrad.addColorStop(1, rgbCss(color));
    ctx.fillStyle = headerGrad;
    ctx.fillRect(colX, plotTop, colW, headerH);
    ctx.restore();

    // Header category name
    const headerFontSize = Math.max(11, Math.min(16, headerH * 0.38));
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.font = `700 ${headerFontSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const catName = String(cat.name || '');
    ctx.fillText(
      truncate(catName, colW - ITEM_PAD_X * 2, ctx),
      colX + colW / 2,
      plotTop + headerH / 2,
    );

    // ---- Item rows ----
    const items = Array.isArray(cat.items) ? cat.items : [];
    const maxItems = Math.floor(bodyH / (ITEM_PAD_Y * 2 + 20));
    const visibleItems = items.slice(0, maxItems);

    // Compute even vertical spacing for items
    const itemSlotH = bodyH / Math.max(visibleItems.length, 1);
    const itemFontSize = Math.max(10, Math.min(13, Math.min(itemSlotH * 0.35, 13)));
    const valueFontSizeBase = itemFontSize + 2;

    for (let j = 0; j < visibleItems.length; j++) {
      const item = visibleItems[j];
      const itemY = bodyTop + j * itemSlotH + itemSlotH / 2;
      const itemLabel = String(item.label || '');
      const itemValue = item.value != null ? String(item.value) : null;

      // Subtle separator line between items
      if (j > 0) {
        ctx.save();
        ctx.strokeStyle = rgbaCss(fg, 0.08);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(colX + ITEM_PAD_X, bodyTop + j * itemSlotH);
        ctx.lineTo(colX + colW - ITEM_PAD_X, bodyTop + j * itemSlotH);
        ctx.stroke();
        ctx.restore();
      }

      if (itemValue) {
        // Two-line layout: value above (hero), label below (caption)
        // Value font weight: 900 for short values (≤6 chars), 700 otherwise
        const isShort = itemValue.length <= 6;
        const valueFontSize = isShort
          ? Math.max(12, Math.min(valueFontSizeBase + 2, 18))
          : Math.max(11, Math.min(valueFontSizeBase, 16));
        const valueWeight = isShort ? 900 : 700;
        const lineGap = valueFontSize * 0.3;
        const totalH = valueFontSize + itemFontSize + lineGap;
        const valueY = itemY - totalH / 2 + valueFontSize * 0.5;
        const labelY = valueY + valueFontSize * 0.6 + lineGap + itemFontSize * 0.5;

        // Value (Inter 700/900, color accent)
        ctx.fillStyle = rgbCss(color);
        ctx.font = `${valueWeight} ${valueFontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(truncate(itemValue, colW - ITEM_PAD_X * 2, ctx), colX + ITEM_PAD_X, valueY);

        // Label (Inter 600, fg alpha 0.75)
        ctx.fillStyle = rgbaCss(fg, 0.75);
        ctx.font = `600 ${itemFontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(truncate(itemLabel, colW - ITEM_PAD_X * 2, ctx), colX + ITEM_PAD_X, labelY);
      } else {
        // Label only — centered vertically
        ctx.fillStyle = rgbaCss(fg, 0.85);
        ctx.font = `600 ${itemFontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(truncate(itemLabel, colW - ITEM_PAD_X * 2, ctx), colX + ITEM_PAD_X, itemY);
      }
    }
  }

  // ---- Outer border ----
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.12);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + PAD, plotTop, w - PAD * 2, plotH);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}

function truncate(text, maxWidth, ctx) {
  const s = String(text);
  if (ctx.measureText(s).width <= maxWidth) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + '…';
}
