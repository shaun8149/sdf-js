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

  // Accept layers as array of objects OR integer shorthand (auto-generate N blank layers)
  let rawLayers = args.layers;
  if (typeof rawLayers === 'number' && rawLayers > 0) {
    rawLayers = Array.from({ length: Math.min(rawLayers, 8) }, () => ({}));
  }
  const layers = Array.isArray(rawLayers) ? rawLayers.slice(0, 8) : [];
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

  // Ground shadow beneath the whole stack (bottom disk only)
  ctx.save();
  const groundShadowGrad = ctx.createRadialGradient(
    stackCX,
    plotBottom,
    0,
    stackCX,
    plotBottom,
    bottomRX * 0.9,
  );
  groundShadowGrad.addColorStop(0, 'rgba(0,0,0,0.13)');
  groundShadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = groundShadowGrad;
  ctx.beginPath();
  ctx.ellipse(stackCX, plotBottom, bottomRX * 0.88, diskRY * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw back-to-front (top first, bottom last so foreground overlaps)
  for (let i = N - 1; i >= 0; i--) {
    const layer = layers[i] || {};
    const rx = bottomRX * Math.pow(taper, i);
    const diskCY = plotBottom - PAD - i * diskH - diskH * 0.5;
    const color = layer.color || baseColors[i % baseColors.length];

    // Side band (visible cylinder side between top and bottom ellipses)
    const bandH = diskH * 0.55;
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.16);
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    const sideGrad = ctx.createLinearGradient(stackCX - rx, 0, stackCX + rx, 0);
    sideGrad.addColorStop(0, rgbCss(darken(color, 0.22)));
    sideGrad.addColorStop(0.45, rgbCss(color));
    sideGrad.addColorStop(1, rgbCss(darken(color, 0.28)));
    ctx.fillStyle = sideGrad;
    ctx.beginPath();
    ctx.moveTo(stackCX - rx, diskCY);
    ctx.lineTo(stackCX - rx, diskCY + bandH);
    ctx.ellipse(stackCX, diskCY + bandH, rx, diskRY, 0, Math.PI, 0, true);
    ctx.lineTo(stackCX + rx, diskCY);
    ctx.ellipse(stackCX, diskCY, rx, diskRY, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Top ellipse (radial gradient from bright upper-left → warm mid)
    ctx.save();
    const topGrad = ctx.createRadialGradient(
      stackCX - rx * 0.35,
      diskCY - diskRY * 0.35,
      0,
      stackCX,
      diskCY,
      rx,
    );
    topGrad.addColorStop(0, rgbCss(lighten(color, 0.38)));
    topGrad.addColorStop(0.5, rgbCss(lighten(color, 0.12)));
    topGrad.addColorStop(1, rgbCss(color));
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.ellipse(stackCX, diskCY, rx, diskRY, 0, 0, Math.PI * 2);
    ctx.fill();
    // Thin rim hairline
    ctx.strokeStyle = rgbaCss(darken(color, 0.25), 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(stackCX, diskCY, rx, diskRY, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Top-edge specular arc (1px, alpha 0.18)
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(stackCX, diskCY, rx * 0.82, diskRY * 0.82, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.restore();

    // Label to right of disk (Inter 700 for label, 500 for sublabel)
    if (hasLabels && (layer.label || layer.sublabel)) {
      const labelX = x + PAD + stackW + 14;
      const labelY = diskCY + bandH * 0.4;
      if (layer.label) {
        ctx.fillStyle = rgbCss(fg);
        ctx.font = `700 ${Math.round(h * 0.044)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(layer.label), labelX, labelY - (layer.sublabel ? 8 : 0));
      }
      if (layer.sublabel) {
        ctx.fillStyle = rgbaCss(fg, 0.6);
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
