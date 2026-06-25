// =============================================================================
// atoms-2d/charts/data/kpi-water-drop.js — Water-drop fill KPI atom
// -----------------------------------------------------------------------------
// Teardrop / water-drop shape with internal fill level — for sustainability,
// water, resource, or any "fill to target" KPI.
//
// Visual language: the outer teardrop acts as a container; the fill climbs
// from the bottom up to `value` fraction with a sine-wave "water surface"
// and a vertical gradient. A specular highlight and drop shadow complete the
// skeuomorphic glass-water look.
//
// Args:
//   value        — number 0..1 (fill ratio), required
//   label        — primary label, required
//   sublabel     — optional small caption below label
//   format       — 'percent' | 'number' | 'currency' (default 'percent')
//   displayValue — optional string override (bypasses format)
//
// Render: drawPseudo3D
//   - Outer teardrop path drawn with cubic bezier curves
//   - Empty zone: faint accent tint (alpha 0.08)
//   - Fill zone: accent gradient from bottom up; sine wave at water surface
//   - Specular highlight: white ellipse upper-left
//   - Drop shadow under entire shape
//   - Hero value centred in upper half (Inter 900); label + sublabel below
//
// Per Sprint 15b B4 — "special-flow" diagrams + special data batch.
// =============================================================================

import { rgbCss, rgbaCss } from '../../renderer.js';

export const spec = {
  type: 'kpi-water-drop',
  category: 'charts/data',
  description:
    'Water-drop shape with internal fill level — for sustainability / water / resource KPIs.',
  args: {
    value: { type: 'number 0..1', required: true, example: 0.72 },
    label: { type: 'string', required: true, example: 'Water Recycled' },
    sublabel: { type: 'string?', example: 'Q3 2026' },
    format: { type: "'percent'|'number'|'currency'?", default: 'percent' },
    displayValue: { type: 'string? (override format)', example: '72%' },
  },
};

// SAMPLES for browser demo / gallery
export const SAMPLES = [
  {
    args: { value: 0.72, label: 'Water Recycled', sublabel: 'Q3 2026', format: 'percent' },
  },
  {
    args: { value: 0.45, label: 'Green Energy', sublabel: 'Target 80%', displayValue: '45%' },
  },
];

const PAD = 20;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 280;
  const h = opts.h ?? 360;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const accent = palette.colors?.[0] || [0, 140, 200];

  const value = clamp(Number(args.value ?? 0), 0, 1);
  const label = args.label != null ? String(args.label) : '';
  const sublabel = args.sublabel != null ? String(args.sublabel) : null;
  const format = args.format || 'percent';
  let displayValue = args.displayValue != null ? String(args.displayValue) : null;
  if (!displayValue) {
    if (format === 'percent') displayValue = `${Math.round(value * 100)}%`;
    else if (format === 'currency') displayValue = `$${(value * 100).toFixed(1)}`;
    else displayValue = String((value * 100).toFixed(1));
  }

  // Drop shape geometry
  // Layout: centre horizontally, reserve bottom strip for label text
  const labelZoneH = Math.round(h * 0.22);
  const dropAvailH = h - PAD * 2 - labelZoneH;
  const dropAvailW = w - PAD * 2;
  const dropH = Math.min(dropAvailH, dropAvailW * 1.4);
  const dropW = dropH / 1.4;

  const cx = x + w / 2;
  // Position drop centred in the non-label zone
  const dropTop = y + PAD;
  const dropBot = dropTop + dropH;
  const dropCY = (dropTop + dropBot) / 2;

  // Teardrop bezier control points.
  // Anatomy: pointed tip at top, wide belly in middle, round bottom.
  //   tipY     = dropTop (pointy end)
  //   bulgeY   = dropTop + dropH * 0.55 (widest cross-section)
  //   bottomY  = dropBot
  const tipX = cx;
  const tipY = dropTop;
  const bulgeY = dropTop + dropH * 0.55;
  const bottomY = dropBot;
  const halfW = dropW / 2;

  // Build teardrop path using cubic beziers
  // From tip → left bulge → bottom → right bulge → tip
  function buildDropPath() {
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    // tip → left side: control pts angle outward
    ctx.bezierCurveTo(
      tipX - halfW * 0.8,
      tipY + dropH * 0.2,
      tipX - halfW,
      bulgeY - dropH * 0.1,
      tipX - halfW,
      bulgeY,
    );
    // left side → bottom arc
    ctx.bezierCurveTo(
      tipX - halfW,
      bottomY - dropH * 0.08,
      tipX - halfW * 0.5,
      bottomY,
      tipX,
      bottomY,
    );
    // bottom arc → right side
    ctx.bezierCurveTo(
      tipX + halfW * 0.5,
      bottomY,
      tipX + halfW,
      bottomY - dropH * 0.08,
      tipX + halfW,
      bulgeY,
    );
    // right side → tip
    ctx.bezierCurveTo(
      tipX + halfW,
      bulgeY - dropH * 0.1,
      tipX + halfW * 0.8,
      tipY + dropH * 0.2,
      tipX,
      tipY,
    );
    ctx.closePath();
  }

  // ---- 1) Drop shadow ----
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  // Render a faint filled drop just for shadow
  buildDropPath();
  ctx.fillStyle = 'rgba(0,0,0,0.01)'; // near-transparent; shadow still casts
  ctx.fill();
  ctx.restore();

  // ---- 2) Empty zone (very faint tint inside drop) ----
  ctx.save();
  buildDropPath();
  ctx.clip();
  ctx.fillStyle = rgbaCss(accent, 0.08);
  ctx.fillRect(cx - halfW, tipY, dropW, dropH + 2);
  ctx.restore();

  // ---- 3) Filled zone (from bottom up to fill height) ----
  if (value > 0) {
    const fillHeight = dropH * value;
    const fillTopY = bottomY - fillHeight;

    ctx.save();
    buildDropPath();
    ctx.clip();

    // Vertical gradient for liquid
    const grad = ctx.createLinearGradient(0, fillTopY, 0, bottomY);
    grad.addColorStop(0, rgbCss(lighten(accent, 0.25)));
    grad.addColorStop(1, rgbCss(darken(accent, 0.12)));
    ctx.fillStyle = grad;
    ctx.fillRect(cx - halfW, fillTopY, dropW, fillHeight + 4);

    // Sine wave water surface
    ctx.fillStyle = rgbCss(lighten(accent, 0.3));
    ctx.beginPath();
    const waveCycles = 4;
    const waveAmp = Math.min(4, dropH * 0.015);
    const startX = cx - halfW;
    const endX = cx + halfW;
    const waveWidth = endX - startX;
    ctx.moveTo(startX, fillTopY);
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const wx = startX + t * waveWidth;
      const wy = fillTopY + Math.sin(t * Math.PI * 2 * waveCycles) * waveAmp;
      ctx.lineTo(wx, wy);
    }
    ctx.lineTo(endX, bottomY + 4);
    ctx.lineTo(startX, bottomY + 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ---- 4) Outer drop stroke ----
  ctx.save();
  buildDropPath();
  ctx.strokeStyle = rgbaCss(darken(accent, 0.15), 0.9);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // ---- 5) Specular highlight (upper-left) ----
  ctx.save();
  const specCx = cx - halfW * 0.28;
  const specCy = tipY + dropH * 0.18;
  const specRx = halfW * 0.22;
  const specRy = dropH * 0.1;
  const specGrad = ctx.createRadialGradient(specCx, specCy, 0, specCx, specCy, specRx * 1.5);
  specGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
  specGrad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  buildDropPath();
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(specCx, specCy, specRx, specRy, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- 6) Hero value text ----
  if (displayValue) {
    // Position text near upper portion of fill area (or centre of drop if empty)
    const fillTopY = value > 0.05 ? bottomY - dropH * value : dropCY - dropH * 0.05;
    const textY = Math.max(tipY + dropH * 0.28, Math.min(fillTopY + dropH * 0.18, dropCY));
    const textSize = Math.round(Math.min(dropW * 0.32, dropH * 0.18, 36));
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.font = `900 ${textSize}px "Inter Display", Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayValue, cx, textY);
    ctx.restore();
  }

  // ---- 7) Label + sublabel below drop ----
  const labelY = dropBot + 14;
  const labelSize = Math.round(Math.min(w * 0.055, 16));
  ctx.fillStyle = rgbCss(fg);
  ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, cx, labelY);

  if (sublabel) {
    ctx.fillStyle = rgbaCss(fg, 0.55);
    ctx.font = `500 ${Math.round(labelSize * 0.78)}px Inter, system-ui, sans-serif`;
    ctx.fillText(sublabel, cx, labelY + labelSize + 4);
  }
}

// ============================================================================
// Helpers
// ============================================================================

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
