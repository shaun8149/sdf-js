// =============================================================================
// atoms-2d/charts/layers/layer-stack.js — Stacked layers / strata
// -----------------------------------------------------------------------------
// 2D twin of layer-stack-3d. N wide flat slabs stacked vertically with gaps —
// OSI layers / tech stack / geological strata / hierarchy of layers.
//
// Distinct from `cube-segmented` (one cube cut into slabs) — these are
// INDEPENDENT wide layers with per-layer data + labels.
//
// Args:
//   layers    — array of { label, sublabel?, color? } (REQUIRED, 1-10)
//   title     — optional title (top-left)
//   direction — 'top-down' (1st layer on top) | 'bottom-up' (1st layer on bottom, OSI-style)
//               default 'bottom-up'
//   taper     — optional 0.6..1.0 (default 1.0) — width × per layer going up
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'layer-stack',
  category: 'charts/layers',
  description: 'Stacked layers / strata — tech stack, OSI, geology, hierarchy of layers.',
  args: {
    layers: {
      type: 'array of { label, sublabel?, color? } (1-10)',
      required: true,
      example: [
        { label: 'Physical', sublabel: 'Layer 1' },
        { label: 'Data Link', sublabel: 'Layer 2' },
        { label: 'Network', sublabel: 'Layer 3' },
        { label: 'Transport', sublabel: 'Layer 4' },
        { label: 'Session', sublabel: 'Layer 5' },
        { label: 'Presentation', sublabel: 'Layer 6' },
        { label: 'Application', sublabel: 'Layer 7' },
      ],
    },
    title: { type: 'string?', example: 'OSI Model' },
    direction: { type: "'top-down'|'bottom-up'", default: 'bottom-up', example: 'bottom-up' },
    taper: { type: 'number (0.6-1.0)', default: 1.0, example: 1.0 },
  },
};

const PAD = 16;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 480;
  const h = opts.h ?? 440;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const baseColors = palette.colors || [[60, 130, 200]];

  const layers = Array.isArray(args.layers) ? args.layers.slice(0, 10) : [];
  const N = layers.length;
  if (N === 0) return;
  const direction = args.direction === 'top-down' ? 'top-down' : 'bottom-up';
  const taper = clamp(Number(args.taper ?? 1.0), 0.6, 1.0);

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.07)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.13;
  }

  const plotH = y + h - plotTop - PAD;
  const layerH = (plotH / N) * 0.86; // 86% layer, 14% gap
  const gap = (plotH / N) * 0.14;

  // Right side reserved for labels
  const stackMaxW = Math.min(w * 0.5, plotH * 1.3);
  const stackCX = x + PAD + stackMaxW / 2;
  const labelX = x + PAD + stackMaxW + 20;

  for (let i = 0; i < N; i++) {
    const visualIdx = direction === 'bottom-up' ? i : N - 1 - i;
    const layer = layers[i] || {};
    const tier = direction === 'bottom-up' ? i : N - 1 - i; // 0=bottom (widest if taper<1)
    const layerW = stackMaxW * Math.pow(taper, tier);
    const layerCY = plotTop + plotH - (visualIdx + 0.5) * (layerH + gap) + gap / 2;
    const color = layer.color || baseColors[i % baseColors.length];

    // Side band (visible cylinder side)
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.22);
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    const sideGrad = ctx.createLinearGradient(stackCX - layerW / 2, 0, stackCX + layerW / 2, 0);
    sideGrad.addColorStop(0, rgbCss(darken(color, 0.18)));
    sideGrad.addColorStop(0.5, rgbCss(color));
    sideGrad.addColorStop(1, rgbCss(darken(color, 0.22)));
    ctx.fillStyle = sideGrad;
    roundRect(
      ctx,
      stackCX - layerW / 2,
      layerCY - layerH / 2,
      layerW,
      layerH,
      Math.min(8, layerH * 0.18),
    );
    ctx.fill();
    ctx.restore();

    // Top highlight band (suggests light from above)
    ctx.save();
    ctx.fillStyle = rgbaCss(lighten(color, 0.4), 0.35);
    roundRect(
      ctx,
      stackCX - layerW / 2,
      layerCY - layerH / 2,
      layerW,
      Math.max(2, layerH * 0.12),
      Math.min(8, layerH * 0.18),
    );
    ctx.fill();
    ctx.restore();

    // Label inside layer center
    if (layer.label) {
      ctx.fillStyle = 'white';
      ctx.font = `700 ${Math.round(layerH * 0.35)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(layer.label), stackCX, layerCY);
    }

    // Sublabel to right of stack
    if (layer.sublabel) {
      ctx.fillStyle = rgbaCss(fg, 0.75);
      ctx.font = `500 ${Math.round(layerH * 0.32)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(layer.sublabel), labelX, layerCY);
    }
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
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
