// =============================================================================
// truchet —— Sébastien Truchet (1704) tile pattern，generative art 经典底纹。
// -----------------------------------------------------------------------------
// 当前实现：**Smith arcs** —— 每个方格 cell 内画两条 quarter-circle 弧，连接
// cell 4 条边的中点。每格随机选 2 种朝向之一（A: ↗+↙ / B: ↖+↘）。整张画布
// 上的弧自然 chain 成长 meandering 曲线 → 织物 / 迷宫 / labyrinth 视觉签名。
//
// API 与 hatch 平行：polyline-output 内核，canvas 是一种 consumer；SVG export
// 走同一份 streamlines（复用 hatchSvg 的 path-emit pipeline）。
//
// SDF mask 支持：可选 `mask: (x, y) => number`，pattern 只在 mask < 0（inside）
// 处绘制。配合 `maskInvert: true` 反转——pattern 只在 mask > 0（outside）处。
// 这就解锁了 "pattern fills 全画布除了 subject silhouette 占据的位置" 这种
// surreal scene-composition idiom。
// =============================================================================

import { SDF2, SDF3 } from '../sdf/core.js';
import { raymarch3 } from '../sdf/raymarch.js';

// Mulberry32 PRNG（只用来决定 Smith arc tile 朝向 A/B，不参与 size 决策）
function makeRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 把 SDF3 mask 转成 2D inside-test（用 raymarch silhouette projection）
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
  // 2D SDF: 直接 inside-test
  return (wx, wy) => {
    const d = mask([wx, wy]);
    const inside = d < 0;
    return maskInvert ? !inside : inside;
  };
}

/**
 * 计算 Truchet polyline segments。
 *
 * **架构**：adaptive quadtree subdivision。Root cell = 整个 view；按 noise×field
 * 决定每个 region 是否继续分裂。叶子 cell 渲染一个 Smith arc tile，tile 大小 =
 * 叶子 cell 大小。Pasma 那种"有些大、有些小"效果的本质就是 quadtree depth 不均。
 *
 * - `densityField=null`（uniform 模式）：分到固定 maxDepth → 所有叶子同尺寸 = 经典
 *   uniform Truchet 网格
 * - `densityField` 提供时：每层根据 `field×noise > progress` 决定是否继续分。高
 *   noise/field 区域分得深 → 小 tile；低区域早停 → 大 tile。Perlin noise 保证
 *   adjacent quadrant 的决策 spatially correlated → blobby 平滑过渡
 *
 * `cellSize` 转换成 `maxDepth = ceil(log2(2*view/cellSize))`，决定最细叶子尺寸。
 * `minDepth = maxDepth - 4` 给 4 个 octave 的 size 变化（最大 tile = 最小 × 16）。
 *
 * @returns {Array<Array<[number, number]>>}  polylines in world coords
 */
export function computeTruchetPolylines(opts = {}) {
  const {
    view = 1.0,
    cellSize = 0.01,
    seed = 42,
    mask = null,
    maskInvert = false,
    yaw, pitch, cameraDist,
  } = opts;

  const maskTest = opts.maskFn
    ? (maskInvert ? (wx, wy) => !opts.maskFn(wx, wy) : opts.maskFn)
    : makeMaskTest(mask, maskInvert, { yaw, pitch, cameraDist });
  const densityField = opts.densityField || null;
  const rng = makeRng(seed);

  // 分到何深由 cellSize 决定（最细叶子尺寸）
  // 例：view=1.2, cellSize=0.01 → maxDepth = ceil(log2(240)) = 8
  const maxDepth = Math.max(1, Math.ceil(Math.log2(2 * view / cellSize)));
  // 有 field 时：minDepth = maxDepth - 6 → 理论 6 octave / 64× tile size 范围
  // （之前 -4 = 16×，实际 p1/p99 只有 5× 因为 minDepth 一定 subdivide，两端被压）
  const minDepth = densityField ? Math.max(1, maxDepth - 6) : maxDepth;

  const polylines = [];

  function subdivide(cx, cy, halfSize, depth) {
    // ---- 决定是否继续 subdivide ----
    // 纯线性 field 驱动：score = densityField(cx, cy)。没有 noise / fBm 干扰。
    // TL → BR 对角线方向：field 从 1 平滑降到 1-variation → quadtree 从 maxDepth
    // 平滑减到 minDepth → tile size 从最小线性增大到最大。Pasma 那张图就是这个。
    let shouldSubdivide = depth < maxDepth;
    if (densityField && depth >= minDepth) {
      const progress = (depth - minDepth) / Math.max(1, maxDepth - minDepth);
      shouldSubdivide = densityField(cx, cy) > progress;
    }

    if (shouldSubdivide) {
      const newHalf = halfSize / 2;
      subdivide(cx - newHalf, cy - newHalf, newHalf, depth + 1);
      subdivide(cx + newHalf, cy - newHalf, newHalf, depth + 1);
      subdivide(cx - newHalf, cy + newHalf, newHalf, depth + 1);
      subdivide(cx + newHalf, cy + newHalf, newHalf, depth + 1);
      return;
    }

    // ---- 叶子：emit Smith arc tile ----
    if (maskTest && !maskTest(cx, cy)) return;

    // 纯 field-driven continuous scale：消除 quadtree depth 离散感
    // 在 depth N 内：field=1（TL）→ scale=0.5（小一点）；field=0（BR）→ scale=1（满格）
    // 跨 depth: depth N×[0.5-1] = [0.5, 1] × halfSize_N，相邻 depth 在 [0.5, 1] 区间内重叠
    // → radius 真正线性连续变化（不是 fBm 那种 noise 感）
    let scale = 1;
    if (densityField) {
      const f = densityField(cx, cy);
      scale = 1 - 0.5 * f; // f=0 → 1，f=1 → 0.5
    }
    const r = halfSize * scale;

    const arcSegs = r < 0.0025 ? 2 : r < 0.0075 ? 4 : 8;

    // 2 种 Smith arc 朝向（rng 选）。arc center 在 (cx ± r, cy ± r)，绕 cell center 缩放
    const tileType = rng() < 0.5 ? 'A' : 'B';

    if (tileType === 'A') {
      polylines.push(quarterArc(cx + r, cy + r, r, Math.PI, 1.5 * Math.PI, arcSegs));
      polylines.push(quarterArc(cx - r, cy - r, r, 0, 0.5 * Math.PI, arcSegs));
    } else {
      polylines.push(quarterArc(cx - r, cy + r, r, 1.5 * Math.PI, 2 * Math.PI, arcSegs));
      polylines.push(quarterArc(cx + r, cy - r, r, 0.5 * Math.PI, Math.PI, arcSegs));
    }
  }

  // root cell：(-view, -view) 到 (+view, +view)，center=(0,0)，halfSize=view
  subdivide(0, 0, view, 0);
  return polylines;
}

// 圆心 (cx, cy), 半径 r, 从 a0 到 a1（弧度），离散化成 n+1 个点的 polyline
function quarterArc(cx, cy, r, a0, a1, n) {
  const pts = new Array(n + 1);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const a = a0 + (a1 - a0) * t;
    pts[k] = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  return pts;
}

/**
 * Canvas consumer：Truchet 底纹绘制到 ctx。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} [opts]
 * @param {number}  [opts.view=1.0]
 * @param {number}  [opts.cellSize=0.08]  - 世界单位 / cell（小 = 密）
 * @param {string}  [opts.color='#222']   - stroke color
 * @param {number}  [opts.lineWidth=0.6]
 * @param {string|null} [opts.background='#fdf9f6']  - null = 透明（不 fillRect）
 * @param {boolean} [opts.flipY=true]
 * @param {number}  [opts.seed=42]
 * @param {Function|SDF2|SDF3|null} [opts.mask=null]  - 可选 SDF mask
 * @param {boolean} [opts.maskInvert=false]           - pattern 只在 mask outside
 * @param {number}  [opts.arcSegments=8]
 */
export function truchet(ctx, opts = {}) {
  const {
    view = 1.0,
    color = '#222',
    lineWidth = 0.6,
    background = '#fdf9f6',
    flipY = true,
  } = opts;

  const canvas = ctx.canvas;
  const W = canvas.width, H = canvas.height;

  if (background !== null) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, W, H);
  }

  const wxToPx = wx => (wx + view) / (2 * view) * W;
  const wyToPx = flipY
    ? wy => (view - wy) / (2 * view) * H
    : wy => (wy + view) / (2 * view) * H;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const polylines = computeTruchetPolylines(opts);
  for (const pts of polylines) {
    if (pts.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(wxToPx(pts[0][0]), wyToPx(pts[0][1]));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(wxToPx(pts[i][0]), wyToPx(pts[i][1]));
    }
    ctx.stroke();
  }
  return polylines.length;
}
