// =============================================================================
// atoms-2d/charts/data/venn.js — Venn diagram (overlapping sets)
// -----------------------------------------------------------------------------
// 2D twin of venn-3d. 2-5 overlapping ring outlines + labels. Filled with
// translucent color so overlap lenses read clearly. Used for set intersection
// / commonality / shared attributes.
//
// Args:
//   sets    — array of { label, color?, sublabel? } (length 2-5, REQUIRED)
//   overlap — 0 (touching) .. 1 (concentric); default 0.45
//   title   — optional title (top-left)
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'venn',
  category: 'charts/data',
  description: 'Venn diagram — 2-5 overlapping translucent rings with set labels.',
  args: {
    sets: {
      type: 'array of { label, color?, sublabel? } (2-5 sets)',
      required: true,
      example: [{ label: 'Engineering' }, { label: 'Design' }, { label: 'Product' }],
    },
    overlap: { type: 'number (0-1)', default: 0.45, example: 0.45 },
    title: { type: 'string?', example: 'Cross-functional Work' },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 480;
  const h = opts.h ?? 420;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const baseColors = palette.colors || [
    [60, 130, 200],
    [200, 80, 120],
    [70, 180, 100],
    [200, 150, 50],
    [150, 90, 200],
  ];

  const sets = Array.isArray(args.sets) ? args.sets.slice(0, 5) : [];
  const N = sets.length;
  if (N < 2) return;
  const overlap = clamp(Number(args.overlap ?? 0.45), 0, 0.95);

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.06)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.12;
  }

  const cx = x + w / 2;
  const cy = plotTop + (y + h - plotTop) / 2;
  // Layout: place sets on a circle of radius layoutR, ring radius = ringR
  // Adjust so overall bounding box fits with margin.
  const labelGutter = 36;
  const availW = w - PAD * 2 - labelGutter * 2;
  const availH = y + h - plotTop - PAD - labelGutter;
  // For N=2: ringR + layoutR + labelGutter must fit
  // Use ringR = 0.55 * min, layoutR = ringR * (1 - overlap)
  const baseR = Math.min(availW, availH) * 0.32;
  const layoutR = N === 1 ? 0 : baseR * (1 - overlap);

  // Draw filled translucent rings first (so labels go on top)
  for (let i = 0; i < N; i++) {
    const s = sets[i] || {};
    const a = N === 2 ? Math.PI + i * Math.PI : (i / N) * Math.PI * 2 - Math.PI / 2;
    const rx = cx + Math.cos(a) * layoutR;
    const ry = cy + Math.sin(a) * layoutR;
    const color = s.color || baseColors[i % baseColors.length];

    ctx.save();
    // Translucent fill
    ctx.fillStyle = rgbaCss(color, 0.32);
    ctx.beginPath();
    ctx.arc(rx, ry, baseR, 0, Math.PI * 2);
    ctx.fill();
    // Stroke (ring outline)
    ctx.strokeStyle = rgbaCss(darken(color, 0.15), 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, ry, baseR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Labels — place outside each ring, in the direction from center
  for (let i = 0; i < N; i++) {
    const s = sets[i] || {};
    const a = N === 2 ? Math.PI + i * Math.PI : (i / N) * Math.PI * 2 - Math.PI / 2;
    const rx = cx + Math.cos(a) * layoutR;
    const ry = cy + Math.sin(a) * layoutR;

    // Label vector from center of all sets to this ring's center + push outward
    const lx = rx + Math.cos(a) * (baseR + 14);
    const ly = ry + Math.sin(a) * (baseR + 14);

    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.045)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center';
    ctx.textBaseline = Math.sin(a) > 0.3 ? 'top' : Math.sin(a) < -0.3 ? 'bottom' : 'middle';
    ctx.fillText(String(s.label || ''), lx, ly);

    if (s.sublabel) {
      ctx.fillStyle = rgbaCss(fg, 0.7);
      ctx.font = `500 ${Math.round(h * 0.034)}px Inter, system-ui, sans-serif`;
      // sublabel just below label
      const subOffsetY = Math.sin(a) >= 0 ? Math.round(h * 0.052) : -Math.round(h * 0.052);
      ctx.fillText(String(s.sublabel), lx, ly + subOffsetY);
    }
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function darken(rgb, amt) {
  return [
    Math.max(0, rgb[0] * (1 - amt)),
    Math.max(0, rgb[1] * (1 - amt)),
    Math.max(0, rgb[2] * (1 - amt)),
  ];
}
