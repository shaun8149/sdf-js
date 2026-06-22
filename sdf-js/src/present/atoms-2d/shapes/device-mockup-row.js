// =============================================================================
// atoms-2d/shapes/device-mockup-row.js — Row of N device mockups side-by-side
// -----------------------------------------------------------------------------
// Responsive design showcase: 2-5 device frames arranged horizontally with
// proportional sizing. Watch = 0.6×, laptop = 1.4×, phone/tablet = 1×.
//
// Primary use: "Available on every platform", multi-form-factor product
// showcases, responsive design walkthroughs, cross-device feature comparisons.
//
// Args:
//   devices — array of 2-5 { kind: 'phone'|'tablet'|'laptop'|'watch', label?, content? }
//             (REQUIRED)
//   title   — optional title above the row
//
// Render: pseudo-3D
//   - Horizontal row of devices, evenly distributed with scale weights
//   - watch=0.6x, phone=1x, tablet=1x, laptop=1.4x (width weights)
//   - Labels per device below each frame in Inter 600
//   - Shared accent from palette.colors[i % N]
//   - Padding: 20-24px; title in Inter 700
//
// Per [[atlas-sprint15b-idiom-atoms-plan]] — Sprint 15b Batch B2.
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';
import { drawDevice } from './device-mockup-frame.js';

export const spec = {
  type: 'device-mockup-row',
  category: 'shapes',
  description: 'Row of N device mockups side-by-side (responsive design / multi-platform display).',
  args: {
    devices: {
      type: "array of 2-5 { kind: 'phone'|'tablet'|'laptop'|'watch', label?, content? }",
      required: true,
      example: [
        { kind: 'watch', label: 'Apple Watch' },
        { kind: 'phone', label: 'iPhone' },
        { kind: 'tablet', label: 'iPad' },
      ],
    },
    title: { type: 'string?', example: 'Atlas on every device' },
  },
};

// Weight multipliers by device kind (affects allocated column width)
const KIND_WEIGHT = {
  watch: 0.6,
  phone: 1.0,
  tablet: 1.0,
  laptop: 1.4,
};

const PAD = 20;
const TITLE_FRAC = 0.1;
const LABEL_H_FRAC = 0.08; // fraction of plot height for device labels below

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 720;
  const h = opts.h ?? 420;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const groupColors = palette.colors || [
    [60, 100, 200],
    [200, 100, 60],
    [60, 180, 100],
    [180, 60, 180],
    [200, 180, 60],
  ];

  const devices = Array.isArray(args.devices) ? args.devices.slice(0, 5) : [];
  const title = args.title;
  const N = devices.length;
  if (N === 0) return;

  // ---- Title ----
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.max(14, Math.round(h * 0.055));
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(title), x + w / 2, y + PAD);
    plotTop = y + h * TITLE_FRAC + PAD;
  }

  const plotH = h - (plotTop - y) - PAD;
  const plotW = w - PAD * 2;

  // ---- Compute weighted column widths ----
  const weights = devices.map((d) => KIND_WEIGHT[d.kind] ?? 1.0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Reserve space for labels below each device
  const labelH = plotH * LABEL_H_FRAC;
  const deviceAreaH = plotH - labelH;

  // Gap between columns (small fixed gap)
  const GAP = Math.min(12, plotW * 0.02);
  const totalGap = GAP * (N - 1);
  const weightUnit = (plotW - totalGap) / totalWeight;

  // ---- Draw each device ----
  let colX = x + PAD;
  for (let i = 0; i < N; i++) {
    const dev = devices[i];
    const kind = dev.kind || 'phone';
    const colW = weights[i] * weightUnit;
    const accentColor = groupColors[i % groupColors.length];

    // Draw the device frame within this column, vertically centered in device area
    drawDevice(ctx, kind, colX, plotTop, colW, deviceAreaH, accentColor, dev.content || null);

    // ---- Label below device ----
    if (dev.label) {
      const labelFontSize = Math.max(10, Math.min(13, labelH * 0.45));
      ctx.save();
      ctx.fillStyle = rgbaCss(fg, 0.8);
      ctx.font = `600 ${labelFontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelText = String(dev.label);
      const labelX = colX + colW / 2;
      const labelY = plotTop + deviceAreaH + labelH / 2;
      const maxLabelW = colW - 8;
      // Truncate if needed
      if (ctx.measureText(labelText).width > maxLabelW) {
        let out = labelText;
        while (out.length > 1 && ctx.measureText(out + '…').width > maxLabelW) {
          out = out.slice(0, -1);
        }
        ctx.fillText(out + '…', labelX, labelY);
      } else {
        ctx.fillText(labelText, labelX, labelY);
      }
      ctx.restore();
    }

    colX += colW + GAP;
  }

  // ---- Subtle separator line under device area ----
  ctx.save();
  ctx.strokeStyle = rgbaCss(fg, 0.08);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + PAD, plotTop + deviceAreaH + labelH * 0.15);
  ctx.lineTo(x + PAD + plotW, plotTop + deviceAreaH + labelH * 0.15);
  ctx.stroke();
  ctx.restore();
}
