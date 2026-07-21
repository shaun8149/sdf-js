// =============================================================================
// atoms-2d/charts/hierarchy/pyramid.js — Stacked pyramid (layers from base to apex)
// -----------------------------------------------------------------------------
// 12th atom in 2D vector library. First in charts/hierarchy/ family.
//
// Semantic: stacked trapezoidal layers showing hierarchy from broad base to
// narrow apex. Use for: Maslow hierarchy, value pyramid, marketing funnel
// (inverted), team structure.
//
// ORIENTATION CONVENTION (canonical):
//   layers[0] = BASE (widest, rendered at BOTTOM of canvas)
//   layers[n-1] = APEX (narrowest, rendered at TOP of canvas)
//   Set inverted=true to flip (apex at bottom, funnel-like).
//
// Args:
//   layers     — array of { label, sublabel?, value?, color? } from BASE (index 0) to APEX
//   title      — optional chart title
//   inverted   — bool, draw upside-down (funnel-like, apex at bottom)
//
// Render: pseudo-3D
//   - Each layer: trapezoid with subtle gradient (lighten 0.08) + drop shadow
//     (alpha 0.10) + iso edge accent
//   - Color: monotone gradient using palette.colors[0] hue, darkening per layer
//   - Label centered in each layer (Inter 700, white + dark shadow for legibility)
//   - Optional sublabel below label
//   - Optional value (right-aligned, Inter 600)
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
    // NOTE: example intentionally false (matches default). The all-atoms
    // gallery builds its demo args straight from each arg's `example` field
    // (see demoArgsFor in all-atoms-gallery.html), so an `example: true` here
    // would silently force every gallery render into the inverted/funnel
    // orientation and hide the canonical base-at-bottom layout this atom
    // defaults to. Toggle to `true` locally if you want to eyeball the
    // inverted variant instead.
    inverted: { type: 'boolean?', default: false, example: false },
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
  const bg = palette.bg || null;
  const accent = palette.colors?.[0] || [60, 100, 200];

  // Monotone gradient: same hue as accent, darkening per layer
  // Each layer i gets accent darkened by i * 0.07 (base stays near full, apex darkest)
  const makeMonoColors = (base, count) => {
    const result = [];
    for (let i = 0; i < count; i++) {
      const darken = i * 0.07;
      result.push([
        Math.max(0, Math.round(base[0] * (1 - darken))),
        Math.max(0, Math.round(base[1] * (1 - darken))),
        Math.max(0, Math.round(base[2] * (1 - darken))),
      ]);
    }
    return result;
  };

  const layers = Array.isArray(args.layers) ? args.layers : [];
  const title = args.title;
  const inverted = !!args.inverted;
  const n = layers.length;
  if (n === 0) return;

  // Background
  if (bg) {
    ctx.fillStyle = rgbCss(bg);
    ctx.fillRect(x, y, w, h);
  } else {
    ctx.fillStyle = '#fafaf8';
    ctx.fillRect(x, y, w, h);
  }

  const layerColors = makeMonoColors(accent, n);

  // Title
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.065);
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
  const rightEdge = x + w - PAD;
  const layerH = (pyramidH - LAYER_GAP * (n - 1)) / n;

  // Width tapering by BOUNDARY (not by pixel row): boundary k=0 is the outer
  // base edge (widest), boundary k=n is the apex tip (narrowest). This is a
  // property of layer identity (layers[0]=base=widest ... layers[n-1]=apex=
  // narrowest) and is independent of `inverted` — inverted only changes where
  // the base/apex land vertically on the canvas, not which layer is wide.
  const minWidthFrac = 0.18;
  const maxWidthFrac = 1.0;
  const boundaryWidth = (k) => pyramidW * (maxWidthFrac - (k / n) * (maxWidthFrac - minWidthFrac));

  // Draw layers. layers[0] = BASE → bottom of canvas + widest (default) or
  // top of canvas + widest (inverted, funnel-like). layers[n-1] = APEX →
  // opposite end + narrowest.
  for (let i = 0; i < n; i++) {
    const pixelRowFromTop = inverted ? i : n - 1 - i;
    const top = plotTop + pixelRowFromTop * (layerH + LAYER_GAP);
    const bottom = top + layerH;
    // Within each trapezoid, the edge closer to the base is wider than the
    // edge closer to the apex — this holds regardless of orientation because
    // boundaryWidth(i) [base-side of layer i] > boundaryWidth(i+1) [apex-side].
    const topW = boundaryWidth(inverted ? i : i + 1);
    const botW = boundaryWidth(inverted ? i + 1 : i);
    const color = layerColors[i % layerColors.length];

    drawLayer(ctx, cx, top, bottom, topW, botW, color, layers[i], { fg, bg, i, n, rightEdge });
  }
}

function drawLayer(ctx, cx, top, bottom, topW, botW, color, layer, info) {
  const { fg, bg, rightEdge } = info;

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
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.1); // softened: alpha 0.10
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  gradient.addColorStop(0, rgbCss(lighten(color, 0.08))); // lighten 0.08 max
  gradient.addColorStop(1, rgbCss(color));
  ctx.fillStyle = gradient;
  trapezoid();
  ctx.fill();
  ctx.restore();

  // Top iso edge accent (subtle)
  ctx.save();
  ctx.fillStyle = rgbaCss(lighten(color, 0.15), 0.45);
  ctx.beginPath();
  ctx.moveTo(cx - topW / 2, top);
  ctx.lineTo(cx + topW / 2, top);
  ctx.lineTo(cx + topW / 2 - 2, top + 2);
  ctx.lineTo(cx - topW / 2 + 2, top + 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Label — Inter 700 white with 2px dark shadow, centered inside the
  // trapezoid IF it fits; otherwise fall back to a dark label BESIDE the
  // pyramid (right of the widest edge) with a connector tick, so tiny apex
  // layers never render illegible white-on-sliver text.
  const layerH = bottom - top;
  const cy = (top + bottom) / 2;
  const labelText = String(layer.label || '');
  const insideFs = Math.min(15, layerH * 0.32);
  const avgW = (topW + botW) / 2;
  const innerMaxW = avgW - 16;
  ctx.font = `700 ${insideFs}px Inter, system-ui, sans-serif`;
  const fitsInside = labelText === '' || ctx.measureText(labelText).width <= innerMaxW;

  if (fitsInside) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.font = `700 ${insideFs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = layer.sublabel ? 'bottom' : 'middle';
    ctx.fillText(labelText, cx, layer.sublabel ? cy : cy + 2);
    ctx.restore();

    if (layer.sublabel) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 2;
      ctx.fillStyle = 'rgba(255,255,255,0.80)';
      ctx.font = `500 ${Math.min(11, layerH * 0.2)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(layer.sublabel), cx, cy + 4);
      ctx.restore();
    }
  } else {
    const edgeX = cx + Math.max(topW, botW) / 2;
    const tickLen = 10;
    const textX = edgeX + tickLen + 4;
    const maxLabelW = Math.max(20, rightEdge - textX);
    let fs = insideFs;
    ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
    while (fs > 9 && ctx.measureText(labelText).width > maxLabelW) {
      fs--;
      ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
    }

    ctx.save();
    ctx.strokeStyle = rgbaCss(fg, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(edgeX, cy);
    ctx.lineTo(edgeX + tickLen, cy);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = layer.sublabel ? 'bottom' : 'middle';
    ctx.fillText(labelText, textX, layer.sublabel ? cy : cy + 1);
    ctx.restore();

    if (layer.sublabel) {
      ctx.save();
      ctx.fillStyle = rgbaCss(fg, 0.6);
      ctx.font = `500 ${Math.max(9, fs - 3)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(layer.sublabel), textX, cy + 3);
      ctx.restore();
    }
  }

  // Value (right side if present, slightly indented from edge)
  if (layer.value !== undefined && layer.value !== null) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 2;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `600 ${Math.min(12, layerH * 0.25)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(layer.value), cx + botW / 2 - 10, cy);
    ctx.restore();
  }
}

function lighten(rgb, amt) {
  return [
    Math.min(255, rgb[0] + (255 - rgb[0]) * amt),
    Math.min(255, rgb[1] + (255 - rgb[1]) * amt),
    Math.min(255, rgb[2] + (255 - rgb[2]) * amt),
  ];
}
