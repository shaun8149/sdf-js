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
import { wrapCJK } from '../../cjk-text.js';

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

    // Layer body — softer drop shadow (0.13 alpha, 8px blur)
    ctx.save();
    ctx.shadowColor = rgbaCss([0, 0, 0], 0.12);
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    const sideGrad = ctx.createLinearGradient(stackCX - layerW / 2, 0, stackCX + layerW / 2, 0);
    sideGrad.addColorStop(0, rgbCss(darken(color, 0.15)));
    sideGrad.addColorStop(0.45, rgbCss(color));
    sideGrad.addColorStop(1, rgbCss(darken(color, 0.2)));
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

    // Top-edge highlight — 1px alpha 0.15 (hairline top-light)
    ctx.save();
    const highlightH = Math.max(2, layerH * 0.1);
    const rr = Math.min(8, layerH * 0.18);
    ctx.fillStyle = rgbaCss(lighten(color, 0.45), 0.28);
    roundRect(ctx, stackCX - layerW / 2, layerCY - layerH / 2, layerW, highlightH, rr);
    ctx.fill();
    // 1px hairline white line at very top edge
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(stackCX - layerW / 2 + rr, layerCY - layerH / 2 + 0.5);
    ctx.lineTo(stackCX + layerW / 2 - rr, layerCY - layerH / 2 + 0.5);
    ctx.stroke();
    ctx.restore();

    // Label inside layer center (Inter 700, white) — FITTED to the layer
    // width (Sprint 71: a long CJK label on a narrow tapered layer spilled
    // past the canvas edge; the label never gets to leave its layer)
    if (layer.label) {
      let fs = Math.round(layerH * 0.35);
      ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
      const maxLabelW = layerW - 16;
      while (fs > 11 && ctx.measureText(String(layer.label)).width > maxLabelW) {
        fs -= 1;
        ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
      }
      // 对抗 R4 (2026-07-14): 长 CJK 标签「新增多层次可配置网…」被省略号
      // 腰斩 — 层块够高时折两行 (禁则断行), 实在放不下才回省略号
      let lines = [String(layer.label)];
      if (ctx.measureText(String(layer.label)).width > maxLabelW) {
        if (layerH >= fs * 2.4) {
          lines = wrapCJK(ctx, layer.label, maxLabelW, 2);
        } else {
          let label = String(layer.label);
          while (label.length > 1 && ctx.measureText(label + '…').width > maxLabelW) {
            label = label.slice(0, -1);
          }
          lines = [label + '…'];
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lh = fs * 1.15;
      const y0 = layerCY - ((lines.length - 1) * lh) / 2;
      lines.forEach((ln, li) => ctx.fillText(ln, stackCX, y0 + li * lh));
    }

    // Sublabel to right of stack (Inter 500, softer) — CONFINED to the
    // atom's own box (Sprint 71: unbounded sublabels overflowed the canvas
    // and collided with the neighbouring subject's text), wrapping to two
    // lines at char level (CJK has no spaces to break on)
    if (layer.sublabel) {
      const maxSubW = x + w - PAD - labelX;
      let fs = Math.round(layerH * 0.3);
      ctx.font = `500 ${fs}px Inter, system-ui, sans-serif`;
      const text = String(layer.sublabel);
      while (fs > 11 && ctx.measureText(text).width > maxSubW * 2) {
        fs -= 1;
        ctx.font = `500 ${fs}px Inter, system-ui, sans-serif`;
      }
      const lines = [];
      let chunk = '';
      for (const ch of text) {
        if (chunk && ctx.measureText(chunk + ch).width > maxSubW) {
          lines.push(chunk);
          chunk = ch;
          if (lines.length === 2) break;
        } else {
          chunk += ch;
        }
      }
      if (chunk && lines.length < 2) lines.push(chunk);
      if (lines.length === 2 && chunk && lines[1] !== chunk) {
        let last = lines[1];
        while (last.length > 1 && ctx.measureText(last + '…').width > maxSubW)
          last = last.slice(0, -1);
        lines[1] = last + '…';
      }
      ctx.fillStyle = rgbaCss(fg, 0.65);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const lineH = fs * 1.25;
      const startY = layerCY - ((lines.length - 1) * lineH) / 2;
      lines.forEach((ln, li) => ctx.fillText(ln, labelX, startY + li * lineH));
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
