// =============================================================================
// atoms-2d/shapes/cube-segmented.js — One cube sliced into N parallel slabs
// -----------------------------------------------------------------------------
// 2D twin of cube-segmented-3d. One isometric cube split into N slabs along a
// chosen axis with gaps between slabs (sliced bread / exploded cube look).
//
// Distinct from `cube-grid` atom: cube-grid is N×N×N separate small cubes
// (Rubik), cube-segmented is ONE cube cut into N slabs.
//
// Args:
//   segments  — integer 2-8 (number of slabs, default 4)
//   axis      — 'vertical' (default — slabs stack along Y, slice planes XZ)
//               | 'horizontal' (slabs stack along X, slice planes YZ)
//   gap       — 0..0.3 (default 0.08) gap between slabs as fraction of slab thickness
//   color     — optional [r,g,b]
//   labels    — optional string[] (one per slab)
//   title     — optional title (top-left)
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'cube-segmented',
  category: 'shapes',
  description: 'Isometric cube sliced into N parallel slabs (sliced-bread / exploded view).',
  args: {
    segments: { type: 'integer 2-8', default: 4, example: 4 },
    axis: { type: "'vertical'|'horizontal'", default: 'vertical', example: 'vertical' },
    gap: { type: 'number (0-0.3)', default: 0.08, example: 0.08 },
    color: { type: '[r,g,b]?', example: [60, 130, 200] },
    labels: { type: 'string[]?', example: ['Q1', 'Q2', 'Q3', 'Q4'] },
    title: { type: 'string?', example: 'Quarterly Layers' },
  },
};

const PAD = 14;

export function drawPseudo3D(ctx, args, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const w = opts.w ?? 360;
  const h = opts.h ?? 360;
  const palette = opts.palette || {};
  const fg = palette.silhouetteColor || [30, 27, 30];
  const color = args.color || palette.colors?.[0] || [60, 130, 200];

  const N = clamp(Number(args.segments ?? 4) | 0, 2, 8);
  const axis = args.axis === 'horizontal' ? 'horizontal' : 'vertical';
  const gap = clamp(Number(args.gap ?? 0.08), 0, 0.3);
  const labels = Array.isArray(args.labels) ? args.labels : null;

  let plotTop = y + PAD;
  if (args.title) {
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${Math.round(h * 0.06)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(args.title, x + PAD, y + PAD);
    plotTop = y + h * 0.12;
  }

  // Iso cube geometry: 30° angle, total cube edge = s
  const plotW = w - PAD * 2;
  const plotH = y + h - plotTop - PAD;
  const labelInset = labels ? 32 : 0;
  // Iso bounding box: width = 2·s·cos30, height = 2·s·sin30 + s
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  const margin = 0.88;
  const s = Math.min(
    (plotW * margin) / (2 * cos30 + (axis === 'horizontal' ? labelInset / plotW : 0)),
    ((plotH - (labels && axis === 'vertical' ? labelInset : 0)) * margin) / (2 * sin30 + 1),
  );
  const cx = x + w / 2;
  const cy = plotTop + plotH / 2 + (labels && axis === 'vertical' ? -labelInset / 2 : 0);

  // Iso basis: +X (right-down), +Y (left-down), +Z (up)
  const ex = [cos30 * s, sin30 * s];
  const ey = [-cos30 * s, sin30 * s];
  const ez = [0, -s];

  // Slab thickness: total cube edge along slice axis = 1 unit;
  // slabT = (1 - (N-1)·gap) / N; stride = slabT + gap
  const slabT = Math.max((1 - (N - 1) * gap) / N, 0.04);
  const stride = slabT + gap;

  // Project (i, j, k) to screen coords. Cube spans [-0.5..0.5]^3 in unit coords.
  function project(px, py, pz) {
    return [cx + px * ex[0] + py * ey[0] + pz * ez[0], cy + px * ex[1] + py * ey[1] + pz * ez[1]];
  }

  // Draw slabs back-to-front along slice axis (so foreground overlaps)
  for (let i = 0; i < N; i++) {
    // Slab i: in slice-axis direction, occupies [start..start+slabT] centered at slice axis origin
    const start = -0.5 + i * stride;
    const end = start + slabT;
    // For vertical slabs along Y: slab is full X (-0.5..0.5), Y (start..end), Z (-0.5..0.5)
    // For horizontal slabs along X: slab is X (start..end), Y full, Z full
    let xRange, yRange, zRange;
    if (axis === 'vertical') {
      xRange = [-0.5, 0.5];
      yRange = [start, end];
      zRange = [-0.5, 0.5];
    } else {
      xRange = [start, end];
      yRange = [-0.5, 0.5];
      zRange = [-0.5, 0.5];
    }
    drawSlab(ctx, project, xRange, yRange, zRange, color);

    // Label
    if (labels && labels[i] != null) {
      let lx, ly;
      if (axis === 'vertical') {
        // Place label to right of slab top
        const mid = (yRange[0] + yRange[1]) / 2;
        [lx, ly] = project(0.5, mid, 0.5);
        lx += 8;
      } else {
        // Place label above slab top
        const mid = (xRange[0] + xRange[1]) / 2;
        [lx, ly] = project(mid, -0.5, 0.5);
        ly -= 8;
      }
      ctx.fillStyle = rgbCss(fg);
      ctx.font = `600 ${Math.round(h * 0.04)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = axis === 'vertical' ? 'left' : 'center';
      ctx.textBaseline = axis === 'vertical' ? 'middle' : 'bottom';
      ctx.fillText(String(labels[i]), lx, ly);
    }
  }
}

function drawSlab(ctx, project, xR, yR, zR, color) {
  // 8 corners
  const c = (px, py, pz) => project(px, py, pz);
  // Visible faces from upper-right-front viewer:
  //  TOP    (y = -0.5 in our convention since +Z up is set by ez=[0,-s];
  //          actually our project uses pz·ez[0] etc; cube extends in 3D unit coords
  //          but we project them — top face is max-Z in cube coords, i.e. pz=0.5)
  // Recall ez=[0,-s] so +Z projects upward on screen. Top = pz=0.5.
  // Visible 3 faces:
  //   TOP   (pz=0.5)
  //   LEFT  (py=-0.5)  via ey
  //   RIGHT (px=0.5)   via ex

  // TOP face corners
  const tNW = c(xR[0], yR[0], zR[1]);
  const tNE = c(xR[1], yR[0], zR[1]);
  const tSE = c(xR[1], yR[1], zR[1]);
  const tSW = c(xR[0], yR[1], zR[1]);

  // LEFT face (py = yR[0])
  const lTN = tNW;
  const lTF = tNE;
  const lBF = c(xR[1], yR[0], zR[0]);
  const lBN = c(xR[0], yR[0], zR[0]);

  // RIGHT face (px = xR[1])
  const rTN = tNE;
  const rTF = tSE;
  const rBF = c(xR[1], yR[1], zR[0]);
  const rBN = c(xR[1], yR[0], zR[0]);

  // Right (darkest)
  fillFace(ctx, [rTN, rBN, rBF, rTF], darken(color, 0.3), darken(color, 0.42));
  // Left (medium)
  fillFace(ctx, [lTN, lBN, lBF, lTF], darken(color, 0.12), darken(color, 0.22));
  // Top (lightest)
  fillFace(ctx, [tNW, tNE, tSE, tSW], lighten(color, 0.2), color);
}

function fillFace(ctx, pts, colorTop, colorBot) {
  const ys = pts.map((p) => p[1]);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const grad = ctx.createLinearGradient(0, yMin, 0, yMax);
  grad.addColorStop(0, rgbCss(colorTop));
  grad.addColorStop(1, rgbCss(colorBot));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgbaCss(darken(colorBot, 0.35), 0.5);
  ctx.lineWidth = 0.6;
  ctx.stroke();
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
