// =============================================================================
// spaceCurve —— 空间填充曲线底纹（Hilbert / Gosper / dragon 等）
// -----------------------------------------------------------------------------
// 一笔走完整张画布的连续曲线（fractal 递归生成）。每条曲线本质是 *一条*
// polyline，但因为是 self-similar fractal，密集时视觉上跟 dense hatching
// 难辨。Pasma 早期作品的底纹大量用 Gosper 系（hexagonal triskele 视觉签名）。
//
// 当前实现：
//   - hilbert(depth)：4 路递归方形填充
//   - gosper(depth)：7 路递归六边形填充（Mandelbrot "flowsnake"）
//
// API 与 truchet 平行：computeXxxPolylines → canvas / SVG 双消费。SDF mask
// 支持沿用同一 segment-level 切割机制（curve 是单 polyline，按 mask 把它
// 切成多段保留 inside 部分）。
// =============================================================================

import { SDF2, SDF3 } from '../sdf/core.js';
import { raymarch3 } from '../sdf/raymarch.js';
import { createPerlin } from '../field/noise.js';

// ---- 共用 mask helpers（与 truchet 同模式）---------------------------------

function makeMaskTest(mask, maskInvert, opts) {
  if (!mask) return null;
  if (mask instanceof SDF3) {
    const { yaw = 0.5, pitch = 0.35, cameraDist = 4 } = opts;
    const cy = Math.cos(yaw),   sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const inverseRotate = (p) => {
      const x = p[0] * cy - p[2] * sy;
      const z0 = p[0] * sy + p[2] * cy;
      const y = p[1];
      return [x, y * cp - z0 * sp, y * sp + z0 * cp];
    };
    const camSdf = (p) => mask(inverseRotate(p));
    return (wx, wy) => {
      const t = raymarch3([wx, wy, cameraDist], [0, 0, -1], camSdf, 64, cameraDist * 3, 0.003);
      const inside = t >= 0;
      return maskInvert ? !inside : inside;
    };
  }
  return (wx, wy) => {
    const d = mask([wx, wy]);
    const inside = d < 0;
    return maskInvert ? !inside : inside;
  };
}

// 按 mask 把单 polyline 切成多段 polylines（保留 inside 部分）。
// 不做密度丢弃——curves 是连续空间填充，"密度变化"通过 line width 调制（在 drawPolylines 里）
// 而非 break-up 实现，保持曲线 topology 完整。
function splitByMask(pts, maskTest) {
  if (!maskTest) return [pts];
  const out = [];
  let current = [];
  for (const p of pts) {
    if (maskTest(p[0], p[1])) {
      current.push(p);
    } else {
      if (current.length > 1) out.push(current);
      current = [];
    }
  }
  if (current.length > 1) out.push(current);
  return out;
}

// ---- Hilbert curve ---------------------------------------------------------
// 标准递归构造（Wikipedia / Sierra 的 "An Introduction to Quasi-Random
// Sequences"）。depth N → 4^N 个点，从一个 quadrant 单元出发，4 个旋转/反射
// 的子 quadrant 拼成 self-similar 整体。

/**
 * 生成 Hilbert curve 的世界坐标 polyline，覆盖 [-view, +view]² 方形。
 * @param {number} depth - 递归深度（4-6 推荐；7+ 点数爆炸）
 * @param {number} view  - 世界半宽
 * @returns {Array<[number, number]>}
 */
function hilbertPoints(depth, view) {
  const pts = [];
  function rec(n, x, y, xi, xj, yi, yj) {
    if (n <= 0) {
      pts.push([
        x + (xi + yi) / 2,
        y + (xj + yj) / 2,
      ]);
    } else {
      rec(n - 1, x,               y,               yi / 2, yj / 2, xi / 2, xj / 2);
      rec(n - 1, x + xi / 2,      y + xj / 2,      xi / 2, xj / 2, yi / 2, yj / 2);
      rec(n - 1, x + xi / 2 + yi / 2, y + xj / 2 + yj / 2, xi / 2, xj / 2, yi / 2, yj / 2);
      rec(n - 1, x + xi / 2 + yi, y + xj / 2 + yj,  -yi / 2, -yj / 2, -xi / 2, -xj / 2);
    }
  }
  // 从 (-view, -view) 出发，xi 方向 +2*view（水平），yj 方向 +2*view（垂直）
  rec(depth, -view, -view, 2 * view, 0, 0, 2 * view);
  return pts;
}

// ---- Gosper curve (flowsnake) ----------------------------------------------
// L-system 生成（Mandelbrot 命名）：
//   axiom: A
//   A → A-B--B+A++AA+B-
//   B → +A-BB--B-A++A+B
//   旋转角度：60° (Math.PI / 3)
//   A 和 B 都画一步（forward），+/- 是旋转 not draw
//
// depth N → 7^N step 数。depth 3 = 343 / depth 4 = 2401 / depth 5 = 16807。

function gosperPoints(depth, view) {
  // 展开 L-system 字符串
  let s = 'A';
  for (let i = 0; i < depth; i++) {
    let next = '';
    for (const c of s) {
      if (c === 'A') next += 'A-B--B+A++AA+B-';
      else if (c === 'B') next += '+A-BB--B-A++A+B';
      else next += c;
    }
    s = next;
  }
  // walk turtle
  const angle = Math.PI / 3;
  let x = 0, y = 0, dir = 0; // 初始朝右
  const stepLen = 1;
  const pts = [[0, 0]];
  for (const c of s) {
    if (c === 'A' || c === 'B') {
      x += Math.cos(dir) * stepLen;
      y += Math.sin(dir) * stepLen;
      pts.push([x, y]);
    } else if (c === '+') {
      dir += angle;
    } else if (c === '-') {
      dir -= angle;
    }
  }
  // 归一化到 [-view, +view]² —— 找 bbox 后线性映射
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [px, py] of pts) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = Math.min((2 * view) / w, (2 * view) / h);
  // 居中
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  return pts.map(([px, py]) => [
    (px - cx) * scale,
    (py - cy) * scale,
  ]);
}

// ---- Public compute APIs ---------------------------------------------------

export function computeHilbertPolylines(opts = {}) {
  const {
    view = 1.0,
    depth = 5,
    mask = null,
    maskInvert = false,
    yaw, pitch, cameraDist,
  } = opts;
  const pts = hilbertPoints(depth, view);
  const maskTest = opts.maskFn
    ? (maskInvert ? (wx, wy) => !opts.maskFn(wx, wy) : opts.maskFn)
    : makeMaskTest(mask, maskInvert, { yaw, pitch, cameraDist });
  return splitByMask(pts, maskTest);
}

export function computeGosperPolylines(opts = {}) {
  const {
    view = 1.0,
    depth = 4,
    mask = null,
    maskInvert = false,
    yaw, pitch, cameraDist,
  } = opts;
  const pts = gosperPoints(depth, view);
  const maskTest = opts.maskFn
    ? (maskInvert ? (wx, wy) => !opts.maskFn(wx, wy) : opts.maskFn)
    : makeMaskTest(mask, maskInvert, { yaw, pitch, cameraDist });
  return splitByMask(pts, maskTest);
}

// ---- Canvas consumers ------------------------------------------------------

function drawPolylines(ctx, polylines, opts) {
  const {
    view = 1.0,
    color = '#222',
    lineWidth = 0.6,
    background = '#fdf9f6',
    flipY = true,
  } = opts;

  const W = ctx.canvas.width, H = ctx.canvas.height;
  if (background !== null) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);
  }
  const wxToPx = wx => (wx + view) / (2 * view) * W;
  const wyToPx = flipY
    ? wy => (view - wy) / (2 * view) * H
    : wy => (wy + view) / (2 * view) * H;

  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lineWidth;

  // Hilbert/Gosper 是连续曲线，"tile size 变化"需要 adaptive recursion
  // （L-system 难做、Hilbert 可做未来再实现）。当前 uniform stroke，密度变化
  // 只对 Truchet 生效（adaptive quadtree）。
  for (const pts of polylines) {
    if (pts.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(wxToPx(pts[0][0]), wyToPx(pts[0][1]));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(wxToPx(pts[i][0]), wyToPx(pts[i][1]));
    }
    ctx.stroke();
  }
}

/**
 * Hilbert curve 底纹 → canvas。depth 5 = 1024 点，depth 6 = 4096 点。
 */
export function hilbert(ctx, opts = {}) {
  const polylines = computeHilbertPolylines(opts);
  drawPolylines(ctx, polylines, opts);
  return polylines.length;
}

/**
 * Gosper curve (flowsnake) 底纹 → canvas。depth 4 = ~2400 点。
 * Pasma 早期作品签名底纹（hexagonal triskele 视觉）。
 */
export function gosper(ctx, opts = {}) {
  const polylines = computeGosperPolylines(opts);
  drawPolylines(ctx, polylines, opts);
  return polylines.length;
}
