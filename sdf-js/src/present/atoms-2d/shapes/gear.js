// =============================================================================
// atoms-2d/shapes/gear.js — Iconic gear / cog
// -----------------------------------------------------------------------------
// Pseudo-3D twin of 3D gear-3d. Single 8-tooth cog with center hole, radial
// gradient body. Used for process / mechanism / settings / engineering
// metaphors.
//
// Args:
//   label  — optional caption rendered below
//   color  — optional [r,g,b] override (else palette.colors[0])
//   teeth  — number of teeth (default 12)
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'gear',
  category: 'shapes',
  description: 'Iconic gear with proper teeth, center hub + hole + optional caption.',
  args: {
    label: { type: 'string?', example: 'Process' },
    color: { type: '[r,g,b]?', example: [200, 130, 40] },
    teeth: { type: 'integer?', default: 12, example: 12 },
  },
};

const PAD = 14;
const LABEL_FRAC = 0.18;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 240;
  const h = opts.h ?? 240;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const color = args.color || palette.colors?.[0] || [60, 100, 200];
  const label = args.label;
  const teeth = Math.max(6, Math.min(24, Number(args.teeth ?? 12) | 0));

  const labelH = label ? h * LABEL_FRAC : 0;
  const shapeAreaW = w - PAD * 2;
  const shapeAreaH = h - PAD * 2 - labelH;
  const cx = x + w / 2;
  const cy = y + PAD + shapeAreaH / 2;
  const size = Math.min(shapeAreaW, shapeAreaH);

  drawGear(ctx, cx, cy, size, color, teeth);

  if (label) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `600 ${Math.min(18, labelH * 0.55)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), cx, y + h - labelH / 2 - PAD / 2);
  }
}

function drawGear(ctx, cx, cy, size, color, teeth) {
  const outerR = size * 0.42;
  const innerR = outerR * 0.82; // gear root circle — tight to outer for proper tooth look
  const holeR = outerR * 0.27;
  const hubR = outerR * 0.3;
  const depth = outerR * 0.14; // pseudo-3D extrusion depth

  // 1) Drop shadow
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.22);
  ctx.shadowBlur = depth * 2.0;
  ctx.shadowOffsetY = depth * 0.8;
  ctx.fillStyle = rgbaCss([0, 0, 0], 0);
  drawGearPath(ctx, cx, cy + depth * 0.5, outerR, innerR, teeth);
  ctx.fill();
  ctx.restore();

  // 2) Extrusion side band (shifted down-right, darker color)
  ctx.save();
  ctx.fillStyle = rgbCss(darken(color, 0.32));
  drawGearPath(ctx, cx, cy + depth, outerR, innerR, teeth);
  ctx.fill();
  ctx.restore();

  // 3) Front face with vertical gradient (lighter top → base → slightly darker bottom)
  ctx.save();
  const grad = ctx.createLinearGradient(0, cy - outerR, 0, cy + outerR);
  grad.addColorStop(0, rgbCss(lighten(color, 0.22)));
  grad.addColorStop(0.5, rgbCss(color));
  grad.addColorStop(1, rgbCss(darken(color, 0.1)));
  ctx.fillStyle = grad;
  drawGearPath(ctx, cx, cy, outerR, innerR, teeth);
  ctx.fill();

  // Thin edge stroke for definition
  ctx.strokeStyle = rgbaCss(darken(color, 0.45), 0.55);
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.restore();

  // 4) Center hub (slightly raised disc)
  ctx.save();
  const hubGrad = ctx.createLinearGradient(cx - hubR, cy - hubR, cx + hubR, cy + hubR);
  hubGrad.addColorStop(0, rgbCss(lighten(color, 0.15)));
  hubGrad.addColorStop(1, rgbCss(darken(color, 0.15)));
  ctx.fillStyle = hubGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgbaCss(darken(color, 0.4), 0.5);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();

  // 5) Center hole with inner-shadow gradient
  ctx.save();
  const holeGrad = ctx.createRadialGradient(
    cx - holeR * 0.2,
    cy - holeR * 0.2,
    holeR * 0.1,
    cx,
    cy,
    holeR,
  );
  holeGrad.addColorStop(0, rgbCss(darken(color, 0.35)));
  holeGrad.addColorStop(1, rgbCss(darken(color, 0.58)));
  ctx.fillStyle = holeGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, holeR, 0, Math.PI * 2);
  ctx.fill();
  // Inner rim highlight (top-left arc)
  ctx.strokeStyle = rgbaCss([255, 255, 255], 0.18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, holeR * 0.88, Math.PI * 0.9, Math.PI * 1.6);
  ctx.stroke();
  ctx.restore();

  // 6) Specular highlight (top-left of front face)
  ctx.save();
  ctx.globalAlpha = 0.2;
  const specGrad = ctx.createRadialGradient(
    cx - outerR * 0.32,
    cy - outerR * 0.38,
    0,
    cx - outerR * 0.32,
    cy - outerR * 0.38,
    outerR * 0.52,
  );
  specGrad.addColorStop(0, 'rgba(255,255,255,1)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(cx - outerR * 0.32, cy - outerR * 0.38, outerR * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Proper gear teeth: N teeth with flat tips (not a star — uses 4 points per tooth)
function drawGearPath(ctx, cx, cy, outerR, innerR, teeth) {
  ctx.beginPath();
  const step = (Math.PI * 2) / (teeth * 2);
  const toothFlatFrac = 0.3; // fraction of step as flat tooth tip

  for (let i = 0; i < teeth; i++) {
    const a0 = i * 2 * step - Math.PI / 2;
    const a1 = a0 + step * (1 - toothFlatFrac);
    const a2 = a0 + step;
    const a3 = a0 + step + step * (1 - toothFlatFrac);
    // a4 = next tooth start = a0 + 2*step (implicit at next iteration)

    const p0x = cx + Math.cos(a0) * outerR;
    const p0y = cy + Math.sin(a0) * outerR;
    const p1x = cx + Math.cos(a1) * outerR;
    const p1y = cy + Math.sin(a1) * outerR;
    const p2x = cx + Math.cos(a2) * innerR;
    const p2y = cy + Math.sin(a2) * innerR;
    const p3x = cx + Math.cos(a3) * innerR;
    const p3y = cy + Math.sin(a3) * innerR;

    if (i === 0) ctx.moveTo(p0x, p0y);
    else ctx.lineTo(p0x, p0y);
    ctx.lineTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.lineTo(p3x, p3y);
  }
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
