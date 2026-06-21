// =============================================================================
// atoms-2d/shapes/circle-stack.js — Stacked / tiered disks (wedding-cake)
// -----------------------------------------------------------------------------
// 2D twin of circle-stack-3d. N tiered disks rendered as isometric ellipses
// stacked vertically with taper. Used for layers / levels / accumulation /
// hierarchy-of-capabilities.
//
// Args:
//   layers — array of { label?, sublabel?, color? } (REQUIRED, length 1-8)
//   title  — optional title (top-left)
//   taper  — 0.5..1.0 (default 0.85) — radius × per disk going up
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'circle-stack',
  category: 'shapes',
  description: 'Stacked / tiered disks (wedding-cake) — layers, levels, accumulation.',
  args: {
    layers: {
      type: 'array of { label?, sublabel?, color? } (1-8)',
      required: true,
      example: [
        { label: 'Foundation' },
        { label: 'Build' },
        { label: 'Scale' },
        { label: 'Optimize' },
      ],
    },
    title: { type: 'string?', example: 'Maturity Stack' },
    taper: { type: 'number (0.5-1.0)', default: 0.85, example: 0.85 },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 480;
  const h = opts.h ?? 380;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const baseColors = palette.colors || [[60, 130, 200]];

  const layers = Array.isArray(args.layers) ? args.layers.slice(0, 8) : [];
  const N = layers.length;
  if (N === 0) return;
  const taper = clamp(Number(args.taper ?? 0.85), 0.5, 1.0);

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.06)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.12;
  }

  const plotBottom = y + h - PAD;
  const plotH = plotBottom - plotTop;
  // Reserve right ~40% for labels
  const hasLabels = layers.some((l) => l && (l.label || l.sublabel));
  const stackW = hasLabels ? w * 0.45 : w - PAD * 2;
  const stackCX = hasLabels ? x + PAD + stackW / 2 : x + w / 2;

  // Disk dimensions
  const diskH = plotH / (N + 1); // vertical pitch (gap + height)
  const diskRY = diskH * 0.32; // ellipse minor axis (iso flattening)
  const bottomRX = Math.min(stackW / 2 - 8, plotH * 0.4); // bottom disk major radius

  // Draw back-to-front (top first, bottom last so foreground overlaps)
  for (let i = N - 1; i >= 0; i--) {
    const layer = layers[i] || {};
    const rx = bottomRX * Math.pow(taper, i);
    const cy = plotBottom - PAD - i * diskH - diskH * 0.5;
    const color = layer.color || baseColors[i % baseColors.length];

    // Side band (visible cylinder side between top and bottom ellipses)
    const bandH = diskH * 0.55;
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.22);
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    const sideGrad = ctx.createLinearGradient(stackCX - rx, 0, stackCX + rx, 0);
    sideGrad.addColorStop(0, rgbCss(darken(color, 0.2)));
    sideGrad.addColorStop(0.5, rgbCss(color));
    sideGrad.addColorStop(1, rgbCss(darken(color, 0.25)));
    ctx.fillStyle = sideGrad;
    ctx.beginPath();
    ctx.moveTo(stackCX - rx, cy);
    ctx.lineTo(stackCX - rx, cy + bandH);
    ctx.ellipse(stackCX, cy + bandH, rx, diskRY, 0, Math.PI, 0, true);
    ctx.lineTo(stackCX + rx, cy);
    ctx.ellipse(stackCX, cy, rx, diskRY, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Top ellipse (lighter)
    ctx.save();
    const topGrad = ctx.createRadialGradient(
      stackCX - rx * 0.3,
      cy - diskRY * 0.3,
      0,
      stackCX,
      cy,
      rx,
    );
    topGrad.addColorStop(0, rgbCss(lighten(color, 0.32)));
    topGrad.addColorStop(1, rgbCss(lighten(color, 0.08)));
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.ellipse(stackCX, cy, rx, diskRY, 0, 0, Math.PI * 2);
    ctx.fill();
    // Thin rim
    ctx.strokeStyle = rgbaCss(darken(color, 0.3), 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(stackCX, cy, rx, diskRY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Label to right of disk
    if (hasLabels && (layer.label || layer.sublabel)) {
      const labelX = x + PAD + stackW + 14;
      const labelY = cy + bandH * 0.4;
      if (layer.label) {
        ctx.fillStyle = rgbCss(fg);
        ctx.font = `700 ${Math.round(h * 0.044)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(layer.label), labelX, labelY - (layer.sublabel ? 8 : 0));
      }
      if (layer.sublabel) {
        ctx.fillStyle = rgbaCss(fg, 0.65);
        ctx.font = `500 ${Math.round(h * 0.034)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(layer.sublabel), labelX, labelY + (layer.label ? 10 : 0));
      }
    }
  }
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

function darken(rgb, amt) {
  return [
    Math.max(0, rgb[0] * (1 - amt)),
    Math.max(0, rgb[1] * (1 - amt)),
    Math.max(0, rgb[2] * (1 - amt)),
  ];
}
