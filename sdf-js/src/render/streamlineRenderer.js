// =============================================================================
// streamlineRenderer — Topo: Subscape-style geological renderer (v4)
// -----------------------------------------------------------------------------
// Recipe-only port of Matt DesLauriers "Subscapes" (ArtBlocks #53) per Parts
// 2 + 3 of the public Substack series. Subscape source is closed; this is a
// from-scratch implementation of the algorithm described there.
//
// 三轴正交（Subscape "trait" 系统）:
//   1. STYLE (12 种, 加权抽): acrylic / pencil / warhol / neon / screenprint /
//      lino / riso / minimal / invert / metallic / drift / starfall.
//      每种有 paper + ink palette + compositing 模式 + alpha/width/length mul.
//   2. SURFACE TREATMENT (4 种 + standard, 互斥): standard / brushed / blended
//      / stippled.
//   3. TOP-LEVEL MODE (3 种, 互斥): standard / wireframe (2%) / lattice (9%).
//
// 正交开关:
//   • Patchwork (72%): BSP 切分单位方块, 每块自己的 perlin offset + 方向 bias
//     + 色带 idx.
//   • Scatter mode: Poisson disk (default) / uniform Grid (8%).
//
// 几何核心:
//   • 等距投影 (camera [1,1,1] → origin), 固定不跟用户相机.
//   • 参数化地形 (u,v) → [x, h(x,z), z], 高度采样自 bonsai Rune erosion bake.
//   • UV-space 流场长笔触 (28-56 步, drift 可达 100+).
//   • Lambertian 离散光照 [0, 0.3, 0.75, 1] (Subscape Part 3 原文 4 档).
//   • 背面 culling: surfaceNormal · viewDir < threshold → 跳过.
//   • 底盒线框: 5 层水平 + 4 立柱.
// =============================================================================

import { sampleHeightmap } from './crayonRenderer.js';
import { Random } from '../util/random.js';
import { createPerlin } from '../field/noise.js';

// =============================================================================
// SECTION 1 — Color utilities
// =============================================================================

function oklchToRgb(L, C, h) {
  const Lp = L / 100, Cp = C / 100;
  const hRad = (h * Math.PI) / 180;
  const a = Cp ? Cp * Math.cos(hRad) : 0;
  const b = Cp ? Cp * Math.sin(hRad) : 0;
  const lr = Lp + 0.3963377774 * a + 0.2158037573 * b;
  const lg = Lp - 0.1055613458 * a - 0.0638541728 * b;
  const lb = Lp - 0.0894841775 * a - 1.2914855480 * b;
  const l = lr * lr * lr, m = lg * lg * lg, s = lb * lb * lb;
  const toSrgb = (x) => {
    const c = Math.max(0, Math.min(1, x));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };
  return [
    Math.round(toSrgb(4.0767245293 * l - 3.3072168827 * m + 0.2307590544 * s) * 255),
    Math.round(toSrgb(-1.2681437731 * l + 2.6093323231 * m - 0.3411344290 * s) * 255),
    Math.round(toSrgb(-0.0041119885 * l - 0.7034763098 * m + 1.7068625689 * s) * 255),
  ];
}

function makeOklchPalette(L, C, hue0, hueSweep) {
  const stops = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    stops.push(oklchToRgb(
      L[0] + (L[1] - L[0]) * t,
      C[0] + (C[1] - C[0]) * t,
      hue0 + hueSweep * t,
    ));
  }
  return stops;
}

// Riso-printer ink anchors (approximated from riso-colors npm + paper-colors).
// Used by warhol / neon / riso / metallic / starfall styles.
const RISO_ANCHORS = [
  [255,  40, 130],  // fluorescent pink
  [240,  85,  60],  // orange
  [255, 145,  50],  // marigold
  [255, 230,  85],  // sun yellow
  [120, 220,  90],  // green
  [70,  185, 215],  // sky blue
  [55,   95, 230],  // medium blue
  [125,  60, 215],  // violet
  [225,  60, 180],  // magenta
  [40,   90,  50],  // forest
  [195,  35,  75],  // crimson
  [248, 195, 105],  // sand
  [90,  205, 200],  // teal
  [180, 200, 230],  // pale blue
  [240, 240,  70],  // electric yellow
  [180,  90, 130],  // dusty rose
];

function pickRiso(rng, n) {
  const pool = RISO_ANCHORS.slice();
  const out = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const k = rng.random_int(0, pool.length - 1);
    out.push(pool[k]);
    pool.splice(k, 1);
  }
  return out;
}

// =============================================================================
// SECTION 2 — Style registry. Each style returns:
//   { name, paper, stops[5], composite, alphaMul, widthMul, lengthMul, mono?, metallic? }
// =============================================================================

const STYLE_WEIGHTS = [
  ['acrylic',     24],
  ['pencil',      24],
  ['warhol',       9],
  ['neon',         7],
  ['screenprint',  6],
  ['lino',         4],
  ['riso',         5],
  ['minimal',      6],
  ['invert',       2],
  ['metallic',     4],
  ['drift',        3],
  ['starfall',     1],
];

function rollStyle(rng) {
  const total = STYLE_WEIGHTS.reduce((a, [, w]) => a + w, 0);
  let r = rng.random_dec() * total;
  for (const [name, w] of STYLE_WEIGHTS) {
    r -= w;
    if (r < 0) return name;
  }
  return 'acrylic';
}

function buildStyle(name, rng) {
  switch (name) {
    case 'acrylic': {
      const hue = rng.random_num(0, 360);
      const sweep = rng.random_num(40, 90) * (rng.random_bool(0.5) ? 1 : -1);
      const stops = makeOklchPalette([35, 85], [25, 32], hue, sweep);
      const paper = oklchToRgb(rng.random_num(70, 92), rng.random_num(8, 22), hue + 180);
      return { name, paper, stops, composite: 'source-over', alphaMul: 0.6, widthMul: 1.0, lengthMul: 1.0 };
    }
    case 'pencil': {
      const ink = [45, 40, 55];
      return {
        name, paper: [250, 248, 244],
        stops: [ink, ink, ink, ink, ink],
        composite: 'multiply', alphaMul: 0.65, widthMul: 0.7, lengthMul: 1.0, mono: true,
      };
    }
    case 'warhol': {
      const pair = pickRiso(rng, 2);
      const paper = pickRiso(rng, 1)[0];
      return {
        name, paper,
        stops: [pair[0], pair[0], pair[1], pair[1], pair[0]],
        composite: 'source-over', alphaMul: 0.70, widthMul: 1.05, lengthMul: 1.0,
      };
    }
    case 'neon': {
      const inks = pickRiso(rng, 2);
      return {
        name, paper: [10, 8, 18],
        stops: [inks[0], inks[0], inks[0], inks[1], inks[1]],
        composite: 'screen', alphaMul: 0.55, widthMul: 0.9, lengthMul: 1.0,
      };
    }
    case 'screenprint': {
      const paper = pickRiso(rng, 1)[0];
      const ink = [250, 248, 245];
      return {
        name, paper,
        stops: [ink, ink, ink, ink, ink],
        composite: 'source-over', alphaMul: 0.88, widthMul: 1.1, lengthMul: 1.0, mono: true,
      };
    }
    case 'lino': {
      const paper = pickRiso(rng, 1)[0];
      const ink = [18, 14, 22];
      return {
        name, paper,
        stops: [ink, ink, ink, ink, ink],
        composite: 'source-over', alphaMul: 0.95, widthMul: 1.15, lengthMul: 1.0, mono: true,
      };
    }
    case 'riso': {
      const inks = pickRiso(rng, 4);
      return {
        name, paper: [240, 232, 218],
        stops: [inks[0], inks[1], inks[2], inks[3], inks[0]],
        composite: 'multiply', alphaMul: 0.58, widthMul: 1.0, lengthMul: 1.0,
      };
    }
    case 'minimal': {
      const ink = [22, 20, 26];
      return {
        name, paper: [248, 248, 244],
        stops: [ink, ink, ink, ink, ink],
        composite: 'source-over', alphaMul: 0.62, widthMul: 0.9, lengthMul: 1.0, mono: true,
      };
    }
    case 'invert': {
      const ink = [232, 228, 220];
      return {
        name, paper: [16, 16, 20],
        stops: [ink, ink, ink, ink, ink],
        composite: 'source-over', alphaMul: 0.58, widthMul: 0.9, lengthMul: 1.0, mono: true,
      };
    }
    case 'metallic': {
      const inks = pickRiso(rng, 2);
      return {
        name, paper: [18, 16, 26],
        stops: [[55, 55, 75], [80, 80, 100], inks[0], inks[1], [240, 232, 218]],
        composite: 'screen', alphaMul: 0.60, widthMul: 0.95, lengthMul: 1.0, metallic: true,
      };
    }
    case 'drift': {
      const hue = rng.random_num(0, 360);
      const stops = makeOklchPalette([55, 90], [18, 26], hue, rng.random_num(70, 160));
      return {
        name, paper: oklchToRgb(28, 16, hue + 180),
        stops,
        composite: 'screen', alphaMul: 0.26, widthMul: 0.7, lengthMul: 2.4,
      };
    }
    case 'starfall': {
      const inks = pickRiso(rng, 2);
      return {
        name, paper: [8, 6, 16],
        stops: [[55, 80, 200], [110, 90, 240], inks[0], inks[1], [255, 250, 220]],
        composite: 'screen', alphaMul: 0.65, widthMul: 0.85, lengthMul: 2.0,
      };
    }
  }
  // Fallback
  return buildStyle('acrylic', rng);
}

// =============================================================================
// SECTION 3 — Mode + treatment + scatter rolls
// =============================================================================

function rollMode(rng) {
  const r = rng.random_dec();
  if (r < 0.02) return 'wireframe';
  if (r < 0.02 + 0.09) return 'lattice';
  return 'standard';
}

function rollSurfaceTreatment(rng) {
  // Mutually exclusive: Stippled 8% / Blended 16% / Brushed 18% / Standard 58%
  const r = rng.random_dec();
  if (r < 0.08) return 'stippled';
  if (r < 0.24) return 'blended';
  if (r < 0.42) return 'brushed';
  return 'standard';
}

function rollScatter(rng) {
  return rng.random_dec() < 0.08 ? 'grid' : 'poisson';
}

// =============================================================================
// SECTION 4 — Iso projection + parametric surface + normals
// =============================================================================

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

// Continuous Y-axis rotation. buildView picks θ so the bake's peak (in xz
// relative to bbox center) lands exactly on the -135° back-diagonal, which
// makes peak_iso_x = 0 → peak always at canvas-center horizontally + peak
// is back-most so full mountain front-faces.
function projectIso(world, view) {
  const xRel = world[0] - (view.targetX || 0);
  const zRel = world[2] - (view.targetZ || 0);
  const cosT = view.rotCos ?? 1, sinT = view.rotSin ?? 0;
  const xR = xRel * cosT - zRel * sinT;
  const zR = xRel * sinT + zRel * cosT;
  return [
    view.cx + (xR - zR) * COS30 * view.scale,
    view.cy + ((xR + zR) * SIN30 - world[1]) * view.scale,
  ];
}

function parametricTerrain(u, v, baked, boxSize) {
  const x = (u - 0.5) * 2 * boxSize[0];
  const z = (v - 0.5) * 2 * boxSize[2];
  const y = baked ? sampleHeightmap(baked, boxSize, x, z) : 0;
  return [x, y, z];
}

// Scan heightmap twice:
//  Pass 1 → find peakY and peak position
//  Pass 2 → bbox of pixels with h > peakY * 0.20 (tight to mountain body, no
//  water dependency — Subscape just renders the full terrain clamped to ≥ 0).
function computeMountainBounds(baked, boxSize, N = 64) {
  const FALLBACK = {
    bboxCenterX: 0, bboxCenterZ: 0,
    extentX: boxSize[0], extentZ: boxSize[2],
    peakY: boxSize[1],
    peakX: 0, peakZ: 0,
  };
  if (!baked) return FALLBACK;
  let peakY = 0, peakX = 0, peakZ = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const u = (i + 0.5) / N, v = (j + 0.5) / N;
      const x = (u - 0.5) * 2 * boxSize[0];
      const z = (v - 0.5) * 2 * boxSize[2];
      const h = sampleHeightmap(baked, boxSize, x, z);
      if (h > peakY) { peakY = h; peakX = x; peakZ = z; }
    }
  }
  if (peakY <= 0.001) return FALLBACK;
  const threshold = peakY * 0.20;
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let anyLand = false;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const u = (i + 0.5) / N, v = (j + 0.5) / N;
      const x = (u - 0.5) * 2 * boxSize[0];
      const z = (v - 0.5) * 2 * boxSize[2];
      const h = sampleHeightmap(baked, boxSize, x, z);
      if (h > threshold) {
        anyLand = true;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }
    }
  }
  if (!anyLand) {
    // Single-pixel peak — give it minimum extent around the peak position
    return {
      bboxCenterX: peakX, bboxCenterZ: peakZ,
      extentX: 0.08, extentZ: 0.08,
      peakY, peakX, peakZ,
    };
  }
  const bboxCenterX = (minX + maxX) * 0.5;
  const bboxCenterZ = (minZ + maxZ) * 0.5;
  const extentX = Math.max(0.08, (maxX - minX) * 0.5);
  const extentZ = Math.max(0.08, (maxZ - minZ) * 0.5);
  return { bboxCenterX, bboxCenterZ, extentX, extentZ, peakY, peakX, peakZ };
}

function surfaceNormal(baked, boxSize, x, z, eps = 0.012) {
  const hx0 = sampleHeightmap(baked, boxSize, x - eps, z);
  const hx1 = sampleHeightmap(baked, boxSize, x + eps, z);
  const hz0 = sampleHeightmap(baked, boxSize, x, z - eps);
  const hz1 = sampleHeightmap(baked, boxSize, x, z + eps);
  const dhx = (hx1 - hx0) / (2 * eps);
  const dhz = (hz1 - hz0) / (2 * eps);
  const nx = -dhx, ny = 1, nz = -dhz;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return [nx / len, ny / len, nz / len];
}

// =============================================================================
// SECTION 5 — Lambertian + view direction + backface cull
// =============================================================================

// Sun direction (world space): top-front-left
const LIGHT_DIR = (() => {
  const v = [-0.45, 0.85, -0.25];
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

// View direction (world frame → camera) depends on rotation theta. Camera is
// fixed at (+1, +1, +1) in rotated frame; inverse-rotate to get world dir.
const SQRT3 = Math.sqrt(3);
function makeViewDir(cosT, sinT) {
  // R(-θ) acting on (1, _, 1): xz = (cos·1 + sin·1, -sin·1 + cos·1) = (cos+sin, cos-sin)
  return [
    (cosT + sinT) / SQRT3,
    1 / SQRT3,
    (cosT - sinT) / SQRT3,
  ];
}

// Subscape Part 3 explicitly: discrete Lambert levels [0, 0.3, 0.75, 1].
const LAMBERT_LEVELS = [0, 0.30, 0.75, 1.0];

function lambertDiscrete(n) {
  const dot = Math.max(0, n[0] * LIGHT_DIR[0] + n[1] * LIGHT_DIR[1] + n[2] * LIGHT_DIR[2]);
  // Map continuous dot → nearest level
  let best = 0;
  for (let i = 0; i < LAMBERT_LEVELS.length; i++) {
    if (dot >= LAMBERT_LEVELS[i] - 0.001) best = i;
  }
  return LAMBERT_LEVELS[best];
}

function isBackFacing(n, viewDir, threshold = -0.55) {
  // Subscape uses real raycasting; we approximate with very permissive
  // backface cull (only cull near-vertical-down normals, which can't happen
  // in a single-valued heightmap anyway). Painter's algorithm + back-to-front
  // sort handles the actual depth ordering. Earlier −0.05 was too aggressive
  // for multi-peak bakes where one peak's back becomes another's front.
  const dot = n[0] * viewDir[0] + n[1] * viewDir[1] + n[2] * viewDir[2];
  return dot < threshold;
}

// =============================================================================
// SECTION 6 — Quadtree split (Patchwork)
// =============================================================================

function quadtreeSplit(rng, rect, depth = 3, minSize = 0.14, splitJitter = 0.5) {
  const [[x0, y0], [x1, y1]] = rect;
  const w = x1 - x0, h = y1 - y0;
  if (depth <= 0 || (w < minSize && h < minSize)) return [rect];
  const horiz = rng.random_dec() < (h > w ? 0.65 : 0.35);
  const split = 0.5 + (rng.random_dec() - 0.5) * splitJitter;
  let r1, r2;
  if (horiz) {
    const cy = y0 + h * split;
    r1 = [[x0, y0], [x1, cy]];
    r2 = [[x0, cy], [x1, y1]];
  } else {
    const cx = x0 + w * split;
    r1 = [[x0, y0], [cx, y1]];
    r2 = [[cx, y0], [x1, y1]];
  }
  return [
    ...quadtreeSplit(rng, r1, depth - 1, minSize, splitJitter),
    ...quadtreeSplit(rng, r2, depth - 1, minSize, splitJitter),
  ];
}

// =============================================================================
// SECTION 7 — Seed scatter: Poisson disk (Bridson) + uniform Grid
// =============================================================================

function poissonDisk2D(rng, rect, radius, k = 18) {
  const [[x0, y0], [x1, y1]] = rect;
  const cell = radius / Math.SQRT2;
  const gw = Math.max(1, Math.ceil((x1 - x0) / cell));
  const gh = Math.max(1, Math.ceil((y1 - y0) / cell));
  const grid = new Array(gw * gh).fill(null);
  const active = [];
  const points = [];

  function inBounds(p) { return p[0] >= x0 && p[0] < x1 && p[1] >= y0 && p[1] < y1; }
  function gridXY(p) { return [
    Math.min(gw - 1, Math.max(0, Math.floor((p[0] - x0) / cell))),
    Math.min(gh - 1, Math.max(0, Math.floor((p[1] - y0) / cell))),
  ]; }
  function farFromAll(p) {
    const [gx, gy] = gridXY(p);
    for (let yy = Math.max(0, gy - 2); yy <= Math.min(gh - 1, gy + 2); yy++) {
      for (let xx = Math.max(0, gx - 2); xx <= Math.min(gw - 1, gx + 2); xx++) {
        const q = grid[yy * gw + xx];
        if (q) {
          const dx = q[0] - p[0], dy = q[1] - p[1];
          if (dx * dx + dy * dy < radius * radius) return false;
        }
      }
    }
    return true;
  }

  const p0 = [rng.random_num(x0, x1), rng.random_num(y0, y1)];
  const [g0x, g0y] = gridXY(p0);
  grid[g0y * gw + g0x] = p0;
  active.push(p0); points.push(p0);

  let safety = 6000;
  while (active.length && safety-- > 0) {
    const idx = rng.random_int(0, active.length - 1);
    const base = active[idx];
    let placed = false;
    for (let i = 0; i < k; i++) {
      const ang = rng.random_num(0, Math.PI * 2);
      const r = rng.random_num(radius, 2 * radius);
      const cand = [base[0] + Math.cos(ang) * r, base[1] + Math.sin(ang) * r];
      if (inBounds(cand) && farFromAll(cand)) {
        const [gx, gy] = gridXY(cand);
        grid[gy * gw + gx] = cand;
        active.push(cand);
        points.push(cand);
        placed = true;
        break;
      }
    }
    if (!placed) active.splice(idx, 1);
  }
  return points;
}

function uniformGrid2D(rng, rect, cellSize) {
  const [[x0, y0], [x1, y1]] = rect;
  const points = [];
  const jitter = cellSize * 0.18;
  for (let y = y0 + cellSize * 0.5; y < y1; y += cellSize) {
    for (let x = x0 + cellSize * 0.5; x < x1; x += cellSize) {
      points.push([x + rng.random_num(-jitter, jitter), y + rng.random_num(-jitter, jitter)]);
    }
  }
  return points;
}

// =============================================================================
// SECTION 8 — UV-space flow stroke
// =============================================================================

function traceUVStroke(u0, v0, panel, params) {
  const { perlinFn, baked, boxSize, freq, stepLen, maxSteps,
          angleBias, perlinOffsetU, perlinOffsetV } = params;
  const [[uMin, vMin], [uMax, vMax]] = panel;
  const path = [];
  let u = u0, v = v0;
  for (let i = 0; i < maxSteps; i++) {
    if (u < uMin || u > uMax || v < vMin || v > vMax) break;
    if (u < 0.005 || u > 0.995 || v < 0.005 || v > 0.995) break;
    const wp = parametricTerrain(u, v, baked, boxSize);
    // Per Subscape: clamp height ≥ 0 (no water cut). Strokes draw on the full
    // terrain so peak-to-base reads as one connected mass.
    if (wp[1] < 0) wp[1] = 0;
    path.push({ wp, u, v });
    const n = perlinFn(u * freq + perlinOffsetU, v * freq + perlinOffsetV);
    const angle = (2 * n - 1) * Math.PI + angleBias;
    u += Math.cos(angle) * stepLen;
    v += Math.sin(angle) * stepLen;
  }
  return path;
}

function projectStrokePath(strokePath, baked, boxSize, view, doBackfaceCull) {
  if (strokePath.length < 2) return null;
  const w2 = view.W + 60, h2 = view.H + 60;
  const out = [];
  for (const step of strokePath) {
    if (doBackfaceCull) {
      const n = surfaceNormal(baked, boxSize, step.wp[0], step.wp[2]);
      if (isBackFacing(n, view.viewDir)) continue;
    }
    const [sx, sy] = projectIso(step.wp, view);
    if (sx < -60 || sx > w2 || sy < -60 || sy > h2) continue;
    out.push([sx, sy]);
  }
  return out.length >= 2 ? out : null;
}

// =============================================================================
// SECTION 9 — Internal canvas (sibling)
// =============================================================================

function getOrCreateTopoCanvas() {
  let cv = document.getElementById('c-topo');
  if (cv) return cv;
  const ref = document.getElementById('c-gpu');
  if (!ref) throw new Error('[topo] #c-gpu not found — cannot create sibling');
  cv = document.createElement('canvas');
  cv.id = 'c-topo';
  cv.style.cssText = ref.style.cssText || '';
  cv.style.display = 'none';
  cv.width = ref.width; cv.height = ref.height;
  if (ref.parentNode) ref.parentNode.insertBefore(cv, ref.nextSibling);
  return cv;
}

// =============================================================================
// SECTION 10 — Renderer factory
// =============================================================================

export function createStreamlineRenderer({ canvas, getControls, onFps }) {
  const topoCanvas = getOrCreateTopoCanvas();
  const ctx = topoCanvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('[topo] Canvas2D context unavailable');

  let baked = null;
  let camState = { position: [0, 0.5, -3], yaw: 0, pitch: 0 };
  let boxSize = [0.5, 1.0, 0.5];
  // Recomputed each time the bake is replaced (new tokenHash → new bonsai shape).
  let mountainBounds = {
    bboxCenterX: 0, bboxCenterZ: 0,
    extentX: 0.5, extentZ: 0.5,
    peakY: 1.0, peakX: 0, peakZ: 0,
  };
  // Box base depth (under the terrain): Subscape draws ~5 stacked horizontal
  // slices below the terrain floor at y=0.
  const BOX_BASE_DEPTH = 0.18;

  function resizeIfNeeded() {
    const ref = document.getElementById('c-gpu');
    if (ref && (topoCanvas.width !== ref.width || topoCanvas.height !== ref.height)) {
      topoCanvas.width = ref.width;
      topoCanvas.height = ref.height;
    }
  }

  function buildView() {
    const W = topoCanvas.width, H = topoCanvas.height;
    // Projection target = bbox center; rotation puts peak at -135° back diag.
    const tx = mountainBounds.bboxCenterX;
    const tz = mountainBounds.bboxCenterZ;
    const pxRel = mountainBounds.peakX - tx;
    const pzRel = mountainBounds.peakZ - tz;
    const peakDist = Math.sqrt(pxRel * pxRel + pzRel * pzRel);
    const TARGET_ANGLE = -3 * Math.PI / 4;
    const peakAngle = peakDist > 0.01 ? Math.atan2(pzRel, pxRel) : TARGET_ANGLE;
    const theta = TARGET_ANGLE - peakAngle;
    const cosT = Math.cos(theta), sinT = Math.sin(theta);

    // Box base wraps the mountain bbox (not full footprint) so the box and
    // mountain look like one unit. Add small padding so strokes near bbox
    // edge meet the box wall, not protrude past it.
    const padK = 1.10;
    const boxEx = mountainBounds.extentX * padK;
    const boxEz = mountainBounds.extentZ * padK;

    // Sample heightmap WITHIN bbox-padded area (where strokes actually draw)
    // plus the 8 box corners (4 top y=0, 4 bottom y=-depth) to find true iso
    // extents. Auto-center on this iso bounding box.
    let minIsoX = Infinity, maxIsoX = -Infinity;
    let minIsoY = Infinity, maxIsoY = -Infinity;
    const projectSample = (x, y, z) => {
      const xRel = x - tx, zRel = z - tz;
      const xR = xRel * cosT - zRel * sinT;
      const zR = xRel * sinT + zRel * cosT;
      const ix = (xR - zR) * COS30;
      const iy = (xR + zR) * SIN30 - y;
      if (ix < minIsoX) minIsoX = ix;
      if (ix > maxIsoX) maxIsoX = ix;
      if (iy < minIsoY) minIsoY = iy;
      if (iy > maxIsoY) maxIsoY = iy;
    };
    if (baked) {
      const Ns = 24;
      const xMin = tx - boxEx, xMax = tx + boxEx;
      const zMin = tz - boxEz, zMax = tz + boxEz;
      for (let i = 0; i <= Ns; i++) {
        for (let j = 0; j <= Ns; j++) {
          const t1 = i / Ns, t2 = j / Ns;
          const x = xMin + t1 * (xMax - xMin);
          const z = zMin + t2 * (zMax - zMin);
          const h = Math.max(0, sampleHeightmap(baked, boxSize, x, z));
          projectSample(x, h, z);
        }
      }
    }
    // Box-base corners (bbox-padded, at y=0 and y=-depth)
    for (const [cx0, cz0] of [[tx+boxEx, tz+boxEz], [tx-boxEx, tz+boxEz],
                               [tx-boxEx, tz-boxEz], [tx+boxEx, tz-boxEz]]) {
      projectSample(cx0, 0, cz0);
      projectSample(cx0, -BOX_BASE_DEPTH, cz0);
    }

    const xSpan = Math.max(0.5, maxIsoX - minIsoX);
    const ySpan = Math.max(0.5, maxIsoY - minIsoY);
    const scaleX = (W * 0.84) / xSpan;
    const scaleY = (H * 0.84) / ySpan;
    const scale = Math.min(scaleX, scaleY);
    const isoCenterX = (minIsoX + maxIsoX) * 0.5;
    const isoCenterY = (minIsoY + maxIsoY) * 0.5;
    const cx = W * 0.5 - isoCenterX * scale;
    const cy = H * 0.5 - isoCenterY * scale;

    return {
      cx, cy, scale, W, H,
      targetX: tx, targetZ: tz,
      // Box base wraps mountain area + small padding → mountain visually
      // sits inside its own platform regardless of where bake placed it.
      boxExtentX: boxEx, boxExtentZ: boxEz,
      rotCos: cosT, rotSin: sinT,
      viewDir: makeViewDir(cosT, sinT),
    };
  }

  function paintBackground(style) {
    const c = style.paper;
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    ctx.fillRect(0, 0, topoCanvas.width, topoCanvas.height);
  }

  function paperContrastColor(style, factor = 0.6) {
    // Darker version of paper for box base lines on light, lighter on dark
    const p = style.paper;
    const lum = (p[0] + p[1] + p[2]) / 3;
    const dir = lum > 130 ? -1 : 1;
    const amt = Math.round(110 * factor);
    return [
      Math.max(0, Math.min(255, p[0] + dir * amt)),
      Math.max(0, Math.min(255, p[1] + dir * amt)),
      Math.max(0, Math.min(255, p[2] + dir * amt)),
    ];
  }

  // ---------------------------------------------------------------------------
  // Box base — 5 stacked horizontals + 4 corner posts.
  // ---------------------------------------------------------------------------
  function drawBoxBase(view, style) {
    // Box base sits UNDER the terrain — Subscape draws ~5 horizontal slices
    // descending from y=0 (terrain floor) down to y=-BOX_BASE_DEPTH. The top
    // layer at y=0 visually meets the lowest terrain sample.
    const ex = view.boxExtentX, ez = view.boxExtentZ;
    const cx = view.targetX, cz = view.targetZ;
    const layerYs = [
      0.0,
      -BOX_BASE_DEPTH * 0.25,
      -BOX_BASE_DEPTH * 0.5,
      -BOX_BASE_DEPTH * 0.75,
      -BOX_BASE_DEPTH,
    ];
    const corners = (y) => [
      projectIso([cx - ex, y, cz - ez], view),
      projectIso([cx + ex, y, cz - ez], view),
      projectIso([cx + ex, y, cz + ez], view),
      projectIso([cx - ex, y, cz + ez], view),
    ];
    const ink = paperContrastColor(style, 0.55);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';

    for (let i = 0; i < layerYs.length; i++) {
      const pts = corners(layerYs[i]);
      // Strongest line at the top (y=0, terrain meets base); fade going down
      const alpha = i === 0 ? 0.55 : 0.35 - i * 0.05;
      ctx.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},${alpha})`;
      ctx.lineWidth = i === 0 ? 1.4 : 0.7;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let j = 1; j < 4; j++) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.closePath();
      ctx.stroke();
    }

    const top = corners(0.0);
    const bot = corners(-BOX_BASE_DEPTH);
    ctx.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},0.45)`;
    ctx.lineWidth = 1.0;
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.moveTo(bot[j][0], bot[j][1]);
      ctx.lineTo(top[j][0], top[j][1]);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------------------
  // Patch builder — collect strokes / stipple dots / blended polylines.
  // Returns { specs: [...], type } where type drives the draw routine.
  // ---------------------------------------------------------------------------
  function buildPatchPrimitives(panel, ctxParams) {
    const { rng, perlinFn, view, style, isPatchwork, treatment, scatterMode, mode } = ctxParams;

    // Per-patch flow params
    const perlinOffsetU = rng.random_num(0, 100);
    const perlinOffsetV = rng.random_num(0, 100);
    const angleBias = isPatchwork ? rng.random_num(0, Math.PI * 2) : 0;
    const freq = rng.random_num(1.6, 4.2);

    // Stroke length — Drift / Starfall stretch much longer
    const baseMaxSteps = rng.random_int(28, 56);
    const maxSteps = Math.round(baseMaxSteps * style.lengthMul);
    const stepLen = rng.random_num(0.006, 0.012);

    // Per-patch color band index (Patchwork "color by region")
    const patchBandIdx = isPatchwork ? rng.random_int(0, 4) : -1;

    // Seed scatter — Poisson default, Grid 8% of tokens.
    // density = target seeds per unit area; ~50% will land below water /
    // backface, so we set density high to keep visible-front populated.
    const density = treatment === 'stippled'
      ? rng.random_int(14000, 22000)
      : (treatment === 'brushed' ? rng.random_int(5000, 8500) : rng.random_int(9000, 15000));
    const area = (panel[1][0] - panel[0][0]) * (panel[1][1] - panel[0][1]);
    const targetN = Math.max(20, Math.round(area * density));
    // Bridson 2D packing density ≈ 1 / (2·√3·r²) → invert for r given target.
    const poissonR = Math.max(0.004, Math.sqrt(area / (3.464 * Math.max(1, targetN))) * 1.05);

    let seeds;
    if (scatterMode === 'grid') {
      const cellSize = Math.max(0.008, Math.sqrt(area / Math.max(1, targetN)) * 1.0);
      seeds = uniformGrid2D(rng, panel, cellSize);
    } else {
      seeds = poissonDisk2D(rng, panel, poissonR, 16);
    }

    const specs = [];

    if (treatment === 'stippled') {
      // Pointillism: project each seed point as a small filled dot.
      for (const [u, v] of seeds) {
        const wp = parametricTerrain(u, v, baked, boxSize);
        if (wp[1] < 0) wp[1] = 0;
        const n = surfaceNormal(baked, boxSize, wp[0], wp[2]);
        if (isBackFacing(n, view.viewDir)) continue;
        const [sx, sy] = projectIso(wp, view);
        if (sx < -10 || sx > view.W + 10 || sy < -10 || sy > view.H + 10) continue;
        const lam = lambertDiscrete(n);
        const lamMul = 0.4 + lam * 0.6;
        const altNorm = Math.max(0, Math.min(1, wp[1] / mountainBounds.peakY));
        const bandIdx = patchBandIdx >= 0 ? patchBandIdx : Math.min(4, Math.floor(altNorm * 5));
        const color = style.stops[bandIdx];
        const alpha = style.alphaMul * lamMul;
        const radius = (style.widthMul * (1.2 + rng.random_num(0, 0.7)));
        // Painter's depth in ROTATED frame (camera direction is rotated, so
        // unrotated x+z gives wrong back-to-front order).
        const xRelDot = wp[0] - view.targetX, zRelDot = wp[2] - view.targetZ;
        const xRDot = xRelDot * view.rotCos - zRelDot * view.rotSin;
        const zRDot = xRelDot * view.rotSin + zRelDot * view.rotCos;
        specs.push({ kind: 'dot', sx, sy, color, alpha, radius, depth: -(xRDot + zRDot) });
      }
      return specs;
    }

    // Stroke-based treatments (standard / brushed / blended)
    for (const [u0, v0] of seeds) {
      const startWp = parametricTerrain(u0, v0, baked, boxSize);
      if (startWp[1] < 0) startWp[1] = 0;
      // Quick backface skip at seed (cheap pre-filter)
      const nSeed = surfaceNormal(baked, boxSize, startWp[0], startWp[2]);
      if (isBackFacing(nSeed, view.viewDir)) continue;

      const strokeRaw = traceUVStroke(u0, v0, panel, {
        perlinFn, baked, boxSize, freq, stepLen, maxSteps,
        angleBias, perlinOffsetU, perlinOffsetV,
      });
      if (strokeRaw.length < 3) continue;

      const screenPath = projectStrokePath(strokeRaw, baked, boxSize, view, /*backfaceCull*/ true);
      if (!screenPath) continue;

      const midRaw = strokeRaw[Math.floor(strokeRaw.length / 2)].wp;
      const nMid = surfaceNormal(baked, boxSize, midRaw[0], midRaw[2]);
      const lam = lambertDiscrete(nMid);
      const lamMul = 0.45 + lam * 0.55;

      const altNorm = Math.max(0, Math.min(1, startWp[1] / mountainBounds.peakY));
      const bandIdx = patchBandIdx >= 0 ? patchBandIdx : Math.min(4, Math.floor(altNorm * 5));
      const color = style.stops[bandIdx];

      const baseW = style.widthMul * (treatment === 'brushed' ? 2.4 : 0.7);
      const lineWidth = baseW + rng.random_num(0, treatment === 'brushed' ? 1.6 : 0.3);
      const alpha = style.alphaMul * lamMul * (treatment === 'brushed' ? 0.7 : 1.0);

      // Painter's depth in ROTATED frame
      const xRelD = midRaw[0] - view.targetX, zRelD = midRaw[2] - view.targetZ;
      const xRD = xRelD * view.rotCos - zRelD * view.rotSin;
      const zRD = xRelD * view.rotSin + zRelD * view.rotCos;
      const depth = -(xRD + zRD);

      if (treatment === 'blended') {
        // Color interpolates start→end based on invisible "diffuse" — sample a
        // second color from the palette (cycled), draw as gradient polyline
        // approximation (segment-by-segment lerp).
        const altColor = style.stops[(bandIdx + 2) % style.stops.length];
        specs.push({
          kind: 'blendedLine', screenPath, color, altColor,
          alpha, lineWidth, depth,
        });
      } else {
        specs.push({
          kind: 'line', screenPath, color,
          alpha, lineWidth, depth,
        });
      }
    }
    return specs;
  }

  function drawSpec(s) {
    if (s.kind === 'dot') {
      ctx.fillStyle = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.sx, s.sy, s.radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (s.kind === 'line') {
      const pts = s.screenPath;
      ctx.strokeStyle = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${s.alpha})`;
      ctx.lineWidth = s.lineWidth;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      return;
    }
    if (s.kind === 'blendedLine') {
      const pts = s.screenPath;
      const N = pts.length;
      ctx.lineWidth = s.lineWidth;
      for (let i = 0; i < N - 1; i++) {
        const t = i / Math.max(1, N - 1);
        const r = Math.round(s.color[0] * (1 - t) + s.altColor[0] * t);
        const g = Math.round(s.color[1] * (1 - t) + s.altColor[1] * t);
        const b = Math.round(s.color[2] * (1 - t) + s.altColor[2] * t);
        ctx.strokeStyle = `rgba(${r},${g},${b},${s.alpha})`;
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        ctx.stroke();
      }
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Wireframe mode (2%): render parametric mesh as quad outlines.
  // ---------------------------------------------------------------------------
  function renderWireframe(rng, view, style) {
    if (!baked) return 0;
    const N = rng.random_int(34, 56);  // mesh resolution
    const ink = style.stops[2];
    const alpha = style.alphaMul * 0.9;
    ctx.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},${alpha})`;
    ctx.lineWidth = style.widthMul * 0.7;
    ctx.lineCap = 'round';

    // Wireframe over bbox-padded area so the mesh matches the box base.
    const xMin = view.targetX - view.boxExtentX;
    const xMax = view.targetX + view.boxExtentX;
    const zMin = view.targetZ - view.boxExtentZ;
    const zMax = view.targetZ + view.boxExtentZ;
    const dx = (xMax - xMin) / N;
    const dz = (zMax - zMin) / N;

    let count = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x0 = xMin + i * dx, z0 = zMin + j * dz;
        const x1 = x0 + dx,        z1 = z0 + dz;
        const ha = sampleHeightmap(baked, boxSize, x0, z0);
        const hb = sampleHeightmap(baked, boxSize, x1, z0);
        const hc = sampleHeightmap(baked, boxSize, x1, z1);
        const hd = sampleHeightmap(baked, boxSize, x0, z1);
        // Subscape convention: clamp negative heights to 0; no water cut.
        const a = [x0, Math.max(0, ha), z0];
        const b = [x1, Math.max(0, hb), z0];
        const c = [x1, Math.max(0, hc), z1];
        const d = [x0, Math.max(0, hd), z1];
        // Backface cull center
        const ccx = (a[0] + b[0] + c[0] + d[0]) / 4;
        const ccz = (a[2] + b[2] + c[2] + d[2]) / 4;
        const n = surfaceNormal(baked, boxSize, ccx, ccz);
        if (isBackFacing(n, view.viewDir, 0)) continue;
        const pa = projectIso(a, view), pb = projectIso(b, view);
        const pc = projectIso(c, view), pd = projectIso(d, view);
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
        ctx.lineTo(pc[0], pc[1]);
        ctx.lineTo(pd[0], pd[1]);
        ctx.closePath();
        ctx.stroke();
        count++;
      }
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Lattice mode (9%): quantize one UV axis to random cell size + 50% holes
  // per cell. Strokes still drawn but UV snapped → blocky stripe glitches.
  // ---------------------------------------------------------------------------
  function buildLatticeFilter(rng) {
    const axis = rng.random_bool(0.5) ? 'u' : 'v';
    const cellCount = rng.random_int(8, 22);
    const cellSize = 1 / cellCount;
    // Hole map: which cells render
    const holes = new Set();
    for (let i = 0; i < cellCount; i++) {
      if (rng.random_bool(0.5)) holes.add(i);
    }
    return { axis, cellSize, holes, cellCount };
  }

  function latticeSnap(u, v, filter) {
    if (filter.axis === 'u') {
      const cell = Math.floor(u / filter.cellSize);
      if (filter.holes.has(cell)) return null;
      return [Math.floor(u / filter.cellSize) * filter.cellSize + filter.cellSize * 0.5, v];
    } else {
      const cell = Math.floor(v / filter.cellSize);
      if (filter.holes.has(cell)) return null;
      return [u, Math.floor(v / filter.cellSize) * filter.cellSize + filter.cellSize * 0.5];
    }
  }

  return {
    render(_sdfArg, _compiled) {
      const urlHash = (() => {
        try { return new URLSearchParams(window.location.search).get('tokenHash'); }
        catch (_) { return null; }
      })();
      const seedHash = urlHash
        || '0xa3f1c92b48d6e077152834f9b62d8e1c93a4f7b528e6c1d09f3b475a682c9e1d';
      const rng = new Random(seedHash);

      // ── Trait rolls ────────────────────────────────────────────────────────
      const styleName = rollStyle(rng);
      const style = buildStyle(styleName, rng);
      const perlinSeed = rng.random_int(0, 100000);
      const perlinFn = createPerlin(perlinSeed);
      const mode = rollMode(rng);
      const isPatchwork = rng.random_dec() < 0.72 && mode === 'standard';
      const treatment = mode === 'standard' ? rollSurfaceTreatment(rng) : 'standard';
      const scatterMode = rollScatter(rng);

      // ── Compositing setup ──────────────────────────────────────────────────
      topoCanvas.style.display = 'block';
      resizeIfNeeded();
      ctx.globalCompositeOperation = 'source-over';
      paintBackground(style);
      const view = buildView();
      // Strokes use the style's composite (multiply / screen / source-over)
      ctx.globalCompositeOperation = style.composite || 'source-over';

      const t0 = performance.now();
      let primCount = 0;
      let panelCount = 0;

      if (!baked) {
        drawBoxBase(view, style);
        return { bytes: 0, style: style.name, treatment, mode, panelCount: 0, primCount: 0 };
      }

      // Box base is paper-contrast — draw with normal compositing
      ctx.globalCompositeOperation = 'source-over';
      drawBoxBase(view, style);
      ctx.globalCompositeOperation = style.composite || 'source-over';

      if (mode === 'wireframe') {
        primCount = renderWireframe(rng, view, style);
        panelCount = 1;
      } else {
        // BSP root = bbox-padded uv region (matches what box base wraps).
        // Heights still clamp to 0; strokes near bbox edge sit at y=0 = box top.
        const uMin = (view.targetX - view.boxExtentX) / boxSize[0] * 0.5 + 0.5;
        const uMax = (view.targetX + view.boxExtentX) / boxSize[0] * 0.5 + 0.5;
        const vMin = (view.targetZ - view.boxExtentZ) / boxSize[2] * 0.5 + 0.5;
        const vMax = (view.targetZ + view.boxExtentZ) / boxSize[2] * 0.5 + 0.5;
        const rootRect = [
          [Math.max(0, uMin), Math.max(0, vMin)],
          [Math.min(1, uMax), Math.min(1, vMax)],
        ];
        const panels = isPatchwork
          ? quadtreeSplit(rng, rootRect, 3, 0.14, 0.5)
          : [rootRect];
        panelCount = panels.length;

        const allSpecs = [];
        const ctxParams = { rng, perlinFn, view, style, isPatchwork, treatment, scatterMode, mode };
        for (const panel of panels) {
          const patchSpecs = buildPatchPrimitives(panel, ctxParams);
          for (const s of patchSpecs) allSpecs.push(s);
        }
        // Painter's algorithm — back-to-front
        allSpecs.sort((a, b) => a.depth - b.depth);

        // Lattice: filter by holes
        let specs = allSpecs;
        if (mode === 'lattice') {
          // Pre-build lattice filter once; apply to each spec's first point.
          // For lattice we re-seed strokes from snapped UV — but here we
          // approximate by filtering out specs whose center column-cell is a
          // hole.
          const filter = buildLatticeFilter(rng);
          specs = [];
          for (const s of allSpecs) {
            // Determine cell from screenPath/sx — approximate via screen x or y
            const pivotX = s.kind === 'dot' ? s.sx : s.screenPath[0][0];
            const pivotY = s.kind === 'dot' ? s.sy : s.screenPath[0][1];
            // Map screen back to a fake UV via canvas extent (loose; good enough)
            const ratio = filter.axis === 'u'
              ? (pivotX / view.W)
              : (pivotY / view.H);
            const cell = Math.min(filter.cellCount - 1, Math.max(0, Math.floor(ratio * filter.cellCount)));
            if (!filter.holes.has(cell)) specs.push(s);
          }
        }

        for (const s of specs) drawSpec(s);
        primCount = specs.length;
      }

      // Reset compositing for any subsequent renders
      ctx.globalCompositeOperation = 'source-over';

      const elapsedMs = performance.now() - t0;
      if (onFps) onFps(elapsedMs > 0 ? 1000 / elapsedMs : 60);

      return {
        bytes: 0,
        style: style.name,
        treatment,
        mode,
        patchwork: isPatchwork,
        scatter: scatterMode,
        panelCount,
        primCount,
      };
    },
    unmount() { topoCanvas.style.display = 'none'; },
    canRender(_sdf) { return true; },
    setRuneHeightmap(b) {
      baked = b;
      if (b) {
        boxSize = [0.5, 1.0, 0.5];
        mountainBounds = computeMountainBounds(b, boxSize, 64);
      } else {
        mountainBounds = { centerX: 0, centerZ: 0, extentX: 0.5, extentZ: 0.5, peakY: 1.0 };
      }
    },
    setPaletteOpts(_opts) { /* iso/style are hash-driven; external palette ignored */ },
    setCamState(patch) {
      if (patch.position) camState.position = [...patch.position];
      if (patch.yaw != null) camState.yaw = patch.yaw;
      if (patch.pitch != null) camState.pitch = patch.pitch;
    },
    getCamState() { return { ...camState, position: [...camState.position] }; },
  };
}
