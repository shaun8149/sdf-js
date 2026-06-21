// =============================================================================
// atoms-2d/shapes/cube-grid.js — N×N×N isometric cube grid
// -----------------------------------------------------------------------------
// 17th atom in 2D vector library.
//
// Semantic: a Rubik's-cube-style N×N×N arrangement of small cubes drawn in
// isometric projection. Generic data viz pattern for: component decomposition,
// modular architecture, voxel art, "building blocks of X" visualizations.
//
// Standard CG technique vocabulary — isometric projection (engineering
// drawings, 1960s+), Phong-style face shading (Bui Tuong Phong 1973),
// voxel rendering (1980s+), Rubik's geometry (Ernő Rubik 1974). All public
// domain technique vocabulary.
//
// Args:
//   size       — integer 1-5 (grid dimension, default 3 → 3×3×3 = 27 cubes)
//   colors     — array of [r,g,b]; cycle per cube position. Else palette.colors[0]
//   colorPattern — 'uniform' | 'alternating' | 'corner-accent' | 'top-accent'
//                  (default 'uniform' if 1 color, else cycle if multi)
//   spacing    — 0..0.5 — gap between sub-cubes (default 0.08)
//   highlight  — array of indices (0..size^3-1) to render with accent color
//   title      — optional title (top-left)
//
// Render technique (generic CG):
//   - Isometric projection: 30° angle for top/left/right faces
//   - Z-sort (painter's algorithm): back-to-front
//   - Per cube 3 visible faces: top (lightest, 1.2× lightness), left (medium,
//     1.0× lightness), right (darkest, 0.65× lightness)
//   - Vertical gradient per face for subtle depth shading
//   - Soft drop shadow under entire group
// =============================================================================

import { rgbCss, rgbaCss } from '../renderer.js';

export const spec = {
  type: 'cube-grid',
  category: 'shapes',
  description:
    'N×N×N isometric cube grid. Generic decomposition / component / "building blocks" visualization.',
  args: {
    size: { type: 'integer 1-5', default: 3, example: 3 },
    colors: { type: '[r,g,b][]?', example: [[60, 130, 200]] },
    colorPattern: {
      type: "'uniform'|'alternating'|'corner-accent'|'top-accent'",
      default: 'uniform',
      example: 'top-accent',
    },
    spacing: { type: '0..0.5', default: 0.08, example: 0.08 },
    highlight: { type: 'integer[]?', example: [0, 13, 26] },
    title: { type: 'string?', example: 'Architecture' },
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
  const baseColors = args.colors || palette.colors || [[60, 130, 200]];
  const size = clamp(Number(args.size ?? 3) | 0, 1, 5);
  const spacing = clamp(Number(args.spacing ?? 0.08), 0, 0.5);
  const colorPattern = args.colorPattern || 'uniform';
  const highlight = Array.isArray(args.highlight) ? new Set(args.highlight) : null;
  const accent = palette.colors?.[0] || [60, 130, 200];

  const title = args.title;
  let plotTop = y + PAD;
  if (title) {
    const titleSize = Math.round(h * 0.07);
    ctx.fillStyle = rgbCss(fg);
    ctx.font = `700 ${titleSize}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, x + PAD, y + PAD);
    plotTop = y + h * 0.13;
  }

  // Plot area
  const plotW = w - PAD * 2;
  const plotH = y + h - plotTop - PAD;
  const cx = x + w / 2;
  const cy = plotTop + plotH / 2;

  // Compute small-cube edge length such that the whole iso projection fits.
  // Iso bounding box for an N×N×N cube of unit-1 sub-cubes (with spacing):
  //   width:  2 * N * (1 + spacing) * cos(30°) × s
  //   height: (2 * N * (1 + spacing) * sin(30°) + N * (1 + spacing)) × s
  // Solve for s = edge length so bbox fits in plot area with margin.
  const unit = 1 + spacing;
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  const isoW = 2 * size * unit * cos30;
  const isoH = 2 * size * unit * sin30 + size * unit;
  const margin = 0.85; // leave some breathing room
  const s = Math.min((plotW * margin) / isoW, (plotH * margin) / isoH);

  // Iso vector basis
  const ex = [cos30 * s, sin30 * s]; // +X axis maps to (right + down)
  const ey = [-cos30 * s, sin30 * s]; // +Y axis maps to (left + down)
  const ez = [0, -s]; // +Z axis maps to (up) for "stacking"

  // Project (i, j, k) integer voxel coords to screen point relative to center.
  function project(i, j, k) {
    // Center the grid at (0,0,0). i ranges 0..size-1, shift by -(size-1)/2.
    const ii = i - (size - 1) / 2;
    const jj = j - (size - 1) / 2;
    const kk = k - (size - 1) / 2;
    return [
      cx + ii * unit * ex[0] + jj * unit * ey[0] + kk * unit * ez[0],
      cy + ii * unit * ex[1] + jj * unit * ey[1] + kk * unit * ez[1],
    ];
  }

  // Soft floor shadow under the whole grid
  const floorY = cy + (size * 0.5 * unit + 0.5) * s;
  ctx.save();
  const fgrad = ctx.createRadialGradient(cx, floorY, 1, cx, floorY, isoW * s * 0.6);
  fgrad.addColorStop(0, rgbaCss([0, 0, 0], 0.28));
  fgrad.addColorStop(0.6, rgbaCss([0, 0, 0], 0.1));
  fgrad.addColorStop(1, rgbaCss([0, 0, 0], 0));
  ctx.fillStyle = fgrad;
  ctx.beginPath();
  ctx.ellipse(cx, floorY, isoW * s * 0.6, isoW * s * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Z-sort: back-to-front. In our basis, "back" = high i AND high j AND low k
  // (further from viewer). Simple depth = i + j - k (lower = further).
  // We sort ascending → far cubes drawn first, near cubes drawn last (overlap).
  const cubes = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      for (let k = 0; k < size; k++) {
        const idx = i * size * size + j * size + k;
        const depth = size - 1 - i + (size - 1 - j) + k; // higher = nearer
        // Actually for painter's algo (back→front): use NEGATIVE depth-from-viewer
        // sortKey = i + j - k means smaller is farther (back). Larger nearer.
        const sortKey = -i - j + k;
        cubes.push({ i, j, k, idx, sortKey, depth });
      }
    }
  }
  cubes.sort((a, b) => a.sortKey - b.sortKey);

  // Draw each cube
  for (const cube of cubes) {
    let color;
    if (highlight && highlight.has(cube.idx)) {
      color = accent;
    } else {
      color = pickColor(baseColors, colorPattern, cube, size, accent);
    }
    drawSmallCube(ctx, cube.i, cube.j, cube.k, project, ex, ey, ez, s, color);
  }
}

// ============================================================================
// Color picking by pattern
// ============================================================================

function pickColor(baseColors, pattern, cube, size, accent) {
  // baseColors is at least 1 element
  if (pattern === 'alternating' && baseColors.length >= 2) {
    const parity = (cube.i + cube.j + cube.k) & 1;
    return baseColors[parity % baseColors.length];
  }
  if (pattern === 'corner-accent') {
    // Corners (i,j,k each in {0, size-1}) → accent; rest → first color
    const isCorner =
      (cube.i === 0 || cube.i === size - 1) &&
      (cube.j === 0 || cube.j === size - 1) &&
      (cube.k === 0 || cube.k === size - 1);
    return isCorner ? accent : baseColors[0];
  }
  if (pattern === 'top-accent') {
    // Top layer (max k) → accent; rest → first color
    return cube.k === size - 1 ? accent : baseColors[0];
  }
  if (pattern === 'uniform') {
    return baseColors[0];
  }
  // Fallback: cycle by position
  return baseColors[cube.idx % baseColors.length];
}

// ============================================================================
// Single cube rendering — 3 visible faces in isometric
// ============================================================================

function drawSmallCube(ctx, i, j, k, project, ex, ey, ez, s, color) {
  // 8 corners of the unit cube at (i, j, k)
  // Using "minimum" corner = (i, j, k), "max" = (i+1, j+1, k+1) BUT we project
  // the CENTER-based offsets. So use offsets (-0.5..+0.5) around the center.

  const cornerProj = (di, dj, dk) => {
    // di, dj, dk in {-0.5, 0.5}
    const baseI = i + di + 0.5;
    const baseJ = j + dj + 0.5;
    const baseK = k + dk + 0.5;
    return project(baseI - 1, baseJ - 1, baseK - 1);
  };

  // Compute the 4 vertices of each visible face.
  // Visible faces (looking from upper-right-front):
  //   TOP face: kk = +0.5 (highest z)
  //   LEFT face: jj = -0.5 (left side in iso)
  //   RIGHT face: ii = +0.5 (right side in iso)

  // TOP face corners (lightest)
  const topNW = cornerProj(-0.5, -0.5, 0.5);
  const topNE = cornerProj(0.5, -0.5, 0.5);
  const topSE = cornerProj(0.5, 0.5, 0.5);
  const topSW = cornerProj(-0.5, 0.5, 0.5);

  // LEFT face: jj = -0.5
  const leftBN = cornerProj(-0.5, -0.5, -0.5);
  const leftBF = cornerProj(0.5, -0.5, -0.5);
  // leftTF = topNE, leftTN = topNW

  // RIGHT face: ii = +0.5
  const rightBF = cornerProj(0.5, -0.5, -0.5);
  const rightBN = cornerProj(0.5, 0.5, -0.5);
  // rightTN = topSE, rightTF = topNE

  // Draw RIGHT face (darkest) — far edges first by painter's
  fillFace(ctx, [topNE, rightBF, rightBN, topSE], darken(color, 0.32), darken(color, 0.42));
  // Draw LEFT face (medium dark)
  fillFace(ctx, [topNW, leftBN, leftBF, topNE], darken(color, 0.15), darken(color, 0.25));
  // Draw TOP face (lightest) — drawn last so it's on top
  fillFaceGradient(ctx, [topNW, topNE, topSE, topSW], lighten(color, 0.22), color);
}

function fillFace(ctx, pts, colorTop, colorBot) {
  // Vertical gradient from top-edge to bottom-edge of the face's screen bbox
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
  // Thin edge stroke for definition
  ctx.strokeStyle = rgbaCss(darken(colorBot, 0.35), 0.55);
  ctx.lineWidth = 0.4;
  ctx.stroke();
}

function fillFaceGradient(ctx, pts, colorTop, colorBot) {
  fillFace(ctx, pts, colorTop, colorBot);
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
