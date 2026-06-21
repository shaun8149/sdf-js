// =============================================================================
// atoms-2d/charts/hierarchy/pyramid.js — Stacked pyramid (layers from base to apex)
// -----------------------------------------------------------------------------
// 12th atom in 2D vector library. First in charts/hierarchy/ family.
//
// Semantic: stacked trapezoidal layers showing hierarchy from broad base to
// narrow apex. Use for: Maslow hierarchy, value pyramid, marketing funnel
// (inverted), team structure.
//
// Args:
//   layers     — array of { label, sublabel?, value?, color? } from BASE (index 0) to APEX
//   title      — optional chart title
//   inverted   — bool, draw upside-down (funnel-like, apex at bottom)
//
// Render: pseudo-3D
//   - Each layer: trapezoid (wider at bottom, narrower at top) with gradient
//     + drop shadow + iso edge accent
//   - Color cycles through palette.colors (or single-color gradient if mono)
//   - Label centered in each layer (Inter 600, scales with layer height)
//   - Optional sublabel below label
//   - Optional value (right-aligned, IBM Plex Mono, e.g. "$10M" or "40%")
//
// Per [[atlas-sprint14-finance-preset-plan]] — hierarchy family.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'pyramid',
  category: 'charts/hierarchy',
  description:
    'Stacked pyramid (trapezoidal layers). Base at bottom by default, optional inverted.',
  args: {
    layers: {
      type: 'array of { label, sublabel?, value? } base→apex',
      required: true,
      example: [
        { label: 'Physiological', sublabel: 'food, water, sleep' },
        { label: 'Safety' },
        { label: 'Belonging' },
        { label: 'Esteem' },
        { label: 'Self-Actualization' },
      ],
    },
    title: { type: 'string?', example: "Maslow's Hierarchy" },
    inverted: { type: 'boolean?', default: false, example: true },
  },
};

const PAD = 14;
const TITLE_FRAC = 0.1;
const LAYER_GAP = 4;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 500;
  const h = opts.h ?? 400;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const bg = palette.bg || [247, 244, 224];
  const accent = palette.colors?.[0] || [60, 100, 200];
  const layerColors = palette.colors || [
    [60, 100, 200],
    [200, 100, 60],
    [60, 180, 100],
    [180, 60, 180],
    [200, 180, 60],
    [120, 120, 120],
  ];

  const layers = Array.isArray(args.layers) ? args.layers : [];
  const title = args.title;
  const inverted = !!args.inverted;
  const n = layers.length;
  if (n === 0) return;

  // Title
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * TITLE_FRAC + PAD;
  }

  const pyramidH = y + h - plotTop - PAD;
  const pyramidW = w - PAD * 2;
  const cx = x + w / 2;
  const layerH = (pyramidH - LAYER_GAP * (n - 1)) / n;

  // Width tapering: bottom layer = pyramidW * 1.0, top layer = pyramidW * 0.2
  // (taper exponentially for more visual interest)
  const minWidthFrac = 0.18;
  const maxWidthFrac = 1.0;
  const widthAtLayer = (i) => {
    // i=0 is base (bottom), i=n-1 is apex (top), unless inverted
    const tIdx = inverted ? i : n - 1 - i; // tIdx=0 is apex (narrow)
    const t = n === 1 ? 0.5 : tIdx / (n - 1);
    return pyramidW * (minWidthFrac + (1 - t) * (maxWidthFrac - minWidthFrac));
  };

  // Draw layers (bottom → top in pixel space; layer index 0 is base by spec
  // → at bottom when not inverted, at top when inverted)
  for (let i = 0; i < n; i++) {
    const pixelRowFromTop = inverted ? i : n - 1 - i;
    const top = plotTop + pixelRowFromTop * (layerH + LAYER_GAP);
    const bottom = top + layerH;
    const topW = widthAtLayer(inverted ? i + 1 : i); // upper edge width
    const botW = widthAtLayer(inverted ? i : i + 1); // lower edge width
    const color = layerColors[i % layerColors.length];

    drawLayer(ctx, cx, top, bottom, topW, botW, color, layers[i], { fg, bg, i, n });
  }
}

function drawLayer(ctx, cx, top, bottom, topW, botW, color, layer, info) {
  const { fg, bg } = info;

  // Trapezoid path
  const trapezoid = () => {
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2, top);
    ctx.lineTo(cx + topW / 2, top);
    ctx.lineTo(cx + botW / 2, bottom);
    ctx.lineTo(cx - botW / 2, bottom);
    ctx.closePath();
  };

  // Drop shadow + gradient body
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.18);
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, rgbCss(lighten(color, 0.16)));
  gradient.addColorStop(1, rgbCss(color));
  ctx.fillStyle = gradient;
  trapezoid();
  ctx.fill();
  ctx.restore();

  // Top iso edge accent (lighter strip just below top edge)
  ctx.save();
  ctx.fillStyle = rgbaCss(lighten(color, 0.32), 0.55);
  ctx.beginPath();
  ctx.moveTo(cx - topW / 2, top);
  ctx.lineTo(cx + topW / 2, top);
  ctx.lineTo(cx + topW / 2 - 2, top + 2);
  ctx.lineTo(cx - topW / 2 + 2, top + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Label (centered)
  const layerH = bottom - top;
  ctx.fillStyle = 'rgba(255,255,255,1)';
  const labelSize = Math.min(15, layerH * 0.32);
  ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = layer.sublabel ? 'bottom' : 'middle';
  const cy = (top + bottom) / 2;
  ctx.fillText(String(layer.label || ''), cx, layer.sublabel ? cy : cy + 2);

  if (layer.sublabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `400 ${Math.min(11, layerH * 0.2)}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(String(layer.sublabel), cx, cy + 4);
  }

  // Value (right side if present, slightly indented from edge)
  if (layer.value !== undefined && layer.value !== null) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '600 11px IBM Plex Mono, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(layer.value), cx + botW / 2 - 10, cy);
  }
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
