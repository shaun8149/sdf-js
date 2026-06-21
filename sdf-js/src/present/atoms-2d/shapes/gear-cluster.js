// =============================================================================
// atoms-2d/shapes/gear-cluster.js — Multi-gear mechanical cluster
// -----------------------------------------------------------------------------
// 18th atom in 2D vector library.
//
// Semantic: 2-N interlocking gears arranged to convey mechanical / process /
// "things working together" metaphor. Generic industry pattern (predates
// PowerPoint by centuries — exists in engineering schematics from 1800s).
//
// Standard CG technique vocabulary:
//   - Extruded 2D shape (front face + thin extrusion band) for cheap 3D look
//   - Phong-style face shading (Bui Tuong Phong 1973)
//   - Center hole for visible "shaft" hint
//   - Drop shadow for elevation
//
// Args:
//   gears      — array of { x, y, radius, teeth, color?, highlight? }
//                positions in [0,1] normalized coords. If omitted, default
//                preset of 3 gears at standard "two-row triangle" layout.
//   thickness  — 0..0.3 — extrusion depth proportional to gear radius (default 0.18)
//   title      — optional title
//
// Render technique:
//   - Each gear: front face (top, lighter) + extruded band (bottom-right)
//   - Front face: N-tooth gear shape via inner/outer radius alternation
//   - Drop shadow from extruded depth direction
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'gear-cluster',
  category: 'shapes',
  description:
    'Cluster of interlocking gears. Generic mechanical / process / "working together" metaphor.',
  args: {
    gears: {
      type: 'array of { x, y, radius, teeth, color?, highlight? }',
      example: [
        { x: 0.32, y: 0.55, radius: 0.32, teeth: 12 },
        { x: 0.66, y: 0.42, radius: 0.22, teeth: 10 },
        { x: 0.78, y: 0.7, radius: 0.16, teeth: 9 },
      ],
    },
    thickness: { type: '0..0.3', default: 0.18, example: 0.18 },
    title: { type: 'string?', example: 'Process Engine' },
  },
};

const PAD = 14;
const DEFAULT_GEARS = [
  { x: 0.32, y: 0.55, radius: 0.32, teeth: 12 },
  { x: 0.66, y: 0.42, radius: 0.22, teeth: 10 },
  { x: 0.78, y: 0.7, radius: 0.16, teeth: 9 },
];

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 400;
  const h = opts.h ?? 320;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const baseColor = palette.colors?.[0] || [170, 170, 175];
  const accentColor = palette.colors?.[1] || [60, 130, 200];

  const gears = Array.isArray(args.gears) && args.gears.length > 0 ? args.gears : DEFAULT_GEARS;
  const thickness = Math.max(0, Math.min(0.3, args.thickness ?? 0.18));
  const title = args.title;

  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.08);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * 0.13;
  }

  const plotW = w - PAD * 2;
  const plotH = y + h - plotTop - PAD;
  const baseRadius = Math.min(plotW, plotH);

  // Z-sort: larger gears in back, smaller in front (perceived depth)
  const ordered = [...gears].sort((a, b) => (b.radius || 0.2) - (a.radius || 0.2));

  for (const gear of ordered) {
    const gx = x + PAD + (gear.x ?? 0.5) * plotW;
    const gy = plotTop + (gear.y ?? 0.5) * plotH;
    const gr = (gear.radius ?? 0.2) * baseRadius;
    const teeth = gear.teeth || 10;
    const color = gear.highlight ? accentColor : gear.color || baseColor;
    const depth = gr * thickness;
    drawGear(ctx, gx, gy, gr, teeth, color, depth);
  }
}

// ============================================================================
// Single gear with pseudo-3D extrusion
// ============================================================================

function drawGear(ctx, cx, cy, outerR, teeth, color, depth) {
  const innerR = outerR * 0.82;
  const holeR = outerR * 0.27;

  // 1) Drop shadow (soft ellipse below)
  ctx.save();
  ctx.shadowColor = rgbaCss([0, 0, 0], 0.3);
  ctx.shadowBlur = depth * 1.5;
  ctx.shadowOffsetY = depth * 0.6;
  // Placeholder fill (transparent) to cast shadow shape
  ctx.fillStyle = rgbaCss([0, 0, 0], 0);
  drawGearPath(ctx, cx, cy + depth, outerR, innerR, teeth);
  ctx.fill();
  ctx.restore();

  // 2) Extrusion band (side wall — visible bottom + right side of teeth)
  ctx.save();
  ctx.fillStyle = rgbCss(darken(color, 0.3));
  // Side wall = sweep from front face down+right by depth
  // Quick approx: draw same gear path shifted down by depth, with a darker fill
  drawGearPath(ctx, cx, cy + depth, outerR, innerR, teeth);
  ctx.fill();
  // Overlay: between two gear paths (offset), but a simple way is just the
  // shifted darker disk that shows below the front face
  ctx.restore();

  // 3) Front face — gradient gear (top lighter, bottom slightly darker)
  ctx.save();
  const grad = ctx.createLinearGradient(0, cy - outerR, 0, cy + outerR);
  grad.addColorStop(0, rgbCss(lighten(color, 0.22)));
  grad.addColorStop(0.5, rgbCss(color));
  grad.addColorStop(1, rgbCss(darken(color, 0.1)));
  ctx.fillStyle = grad;
  drawGearPath(ctx, cx, cy, outerR, innerR, teeth);
  ctx.fill();

  // Thin edge stroke for definition
  ctx.strokeStyle = rgbaCss(darken(color, 0.45), 0.6);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();

  // 4) Center hole (with inner shadow / depth)
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
  holeGrad.addColorStop(1, rgbCss(darken(color, 0.55)));
  ctx.fillStyle = holeGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, holeR, 0, Math.PI * 2);
  ctx.fill();
  // Inner rim highlight (top-left to suggest depression)
  ctx.strokeStyle = rgbaCss([255, 255, 255], 0.18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, holeR * 0.92, Math.PI * 0.9, Math.PI * 1.6);
  ctx.stroke();
  ctx.restore();

  // 5) Specular highlight on front face (top-left, generic Phong)
  ctx.save();
  ctx.globalAlpha = 0.18;
  const specGrad = ctx.createRadialGradient(
    cx - outerR * 0.35,
    cy - outerR * 0.4,
    0,
    cx - outerR * 0.35,
    cy - outerR * 0.4,
    outerR * 0.5,
  );
  specGrad.addColorStop(0, 'rgba(255,255,255,1)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(cx - outerR * 0.35, cy - outerR * 0.4, outerR * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGearPath(ctx, cx, cy, outerR, innerR, teeth) {
  // Star path: alternate outer/inner radius around teeth*2 vertices
  ctx.beginPath();
  const step = (Math.PI * 2) / (teeth * 2);
  // Soften tooth tips with small flat regions (more realistic gear look)
  const toothFlatFrac = 0.3; // fraction of step taken as a flat tooth tip
  for (let i = 0; i < teeth; i++) {
    const a0 = i * 2 * step;
    const a1 = a0 + step * (1 - toothFlatFrac);
    const a2 = a0 + step;
    const a3 = a0 + step + step * (1 - toothFlatFrac);
    const a4 = a0 + 2 * step;
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
