// =============================================================================
// motifGrid —— Nijhoff-style multi-band motif library renderer
// -----------------------------------------------------------------------------
// 实现 Reinder Nijhoff 的 Turtletoy plotter art pattern（2026-05-14 user 分享）。
// 核心思想：
//   1. 一组 hand-drawn motif（curated library，按复杂度排序）
//   2. N 个水平 band，自上而下 cell size 几何递减（× 1/bandScale per band）
//   3. 每 band 用 uniform grid sweep，**没有 noise / 没有 quadtree**
//   4. 每个 cell 用一个 motif，motif 选择 = order[col_idx / stride]
//   5. Stride 自下而上几何递增（top band stride=1，next band stride=bandScale, ...）→
//      左→右 复杂度渐变 + 自上而下 size 减半 → Pasma 风 plotter pattern
//
// 完全不 procedural——visual organic feel 来自 motif data 的 hand-drawn imperfection。
//
// API 跟 truchet / spaceCurve 同 pattern（polyline-output → canvas / SVG 双消费）。
// 支持 SDF mask（cell center 测试）让 pattern 只在 subject 之外画。
// =============================================================================

import { SDF2, SDF3 } from '../sdf/core.js';
import { raymarch3 } from '../sdf/raymarch.js';
import { compileMotifLibrary, DEFAULT_MOTIFS, DEFAULT_ORDER } from '../motifs/index.js';

// 把 SDF3/SDF2 mask → boolean inside-test（cell center 用）
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
    const inside = mask([wx, wy]) < 0;
    return maskInvert ? !inside : inside;
  };
}

/**
 * 计算 MotifGrid polylines。Consumer-agnostic（canvas / SVG 都消费）。
 *
 * @param {object} [opts]
 * @param {number} [opts.view=1.0]              - world 半宽
 * @param {Array<Array<Array<[number,number]>>>} [opts.library]
 *   - 预编译 motif library（compileMotifLibrary 输出）。每 motif = polylines 数组，
 *     已归一化到 [-1, 1] bbox。默认使用 Reinder Nijhoff 的 20-motif default set
 * @param {number[]} [opts.order]               - motif 复杂度索引（左→右 col 用的 motif）
 * @param {number} [opts.bands=3]               - 水平 band 数量（自上而下 cell 减小）
 * @param {number} [opts.baseCellSize=0.16]     - band 0 (top) 的 cell size
 * @param {number} [opts.bandScale=2]           - 每 band cellSize = base / bandScale^bandIdx
 * @param {number} [opts.motifMargin=0.85]      - motif 占 cell 的比例（< 1 留间隙）
 * @param {boolean} [opts.flipY=true]
 * @param {Function|SDF2|SDF3|null} [opts.mask]
 * @param {Function|null} [opts.maskFn]         - boolean test 函数（绕过 SDF 转换）
 * @param {boolean} [opts.maskInvert=false]
 * @returns {Array<Array<[number,number]>>}  全部 polylines（多 motif × 多 cell × 多 band 合并）
 */
export function computeMotifGridPolylines(opts = {}) {
  const {
    view = 1.0,
    bands = 3,
    baseCellSize = 0.16,
    bandScale = 2,
    motifMargin = 0.85,
    flipY = true,
    mask = null,
    maskInvert = false,
    yaw, pitch, cameraDist,
  } = opts;

  const library = opts.library ?? compileMotifLibrary();
  const order = opts.order ?? DEFAULT_ORDER;

  const maskTest = opts.maskFn
    ? (maskInvert ? (wx, wy) => !opts.maskFn(wx, wy) : opts.maskFn)
    : makeMaskTest(mask, maskInvert, { yaw, pitch, cameraDist });

  const polylines = [];

  // 把 motif 的 normalized polylines 缩放 + 平移到 cell 中心。
  // flipY: motif 数据来自 Turtletoy y-down 系，sdf-js 默认 y-up，需要翻转 y。
  function placeMotif(motifPolylines, cx, cy, halfSize) {
    const scale = halfSize * motifMargin; // motif 半宽 = cell 半宽 × margin
    const ySign = flipY ? -1 : 1;
    for (const pts of motifPolylines) {
      const placed = pts.map(([mx, my]) => [
        cx + mx * scale,
        cy + my * scale * ySign,
      ]);
      polylines.push(placed);
    }
  }

  // ---- band layout ----------------------------------------------------------
  // Band 自上而下排列。Top y = +view，bottom y = -view（flipY=true 时 world y-up）。
  // 每 band y-extent 相等 = (2 view) / bands。
  // Band b cellSize = baseCellSize / bandScale^b
  // Band b motifStride = bandScale^b （每 stride 列共享一个 motif）
  const bandHeight = (2 * view) / bands;

  for (let b = 0; b < bands; b++) {
    const cellSize = baseCellSize / Math.pow(bandScale, b);
    const halfCell = cellSize / 2;
    const stride = Math.pow(bandScale, b);

    // Band y-range：flipY=true 时 top 在 +view，所以 band 0 是 y ∈ [+view - bandHeight, +view]
    const yTop = flipY ? (view - b * bandHeight) : (-view + b * bandHeight);
    const yBot = flipY ? (yTop - bandHeight) : (yTop + bandHeight);
    const yMin = Math.min(yTop, yBot);
    const yMax = Math.max(yTop, yBot);

    // Grid cell counts
    const cols = Math.ceil((2 * view) / cellSize);
    const rows = Math.ceil(bandHeight / cellSize);

    for (let r = 0; r < rows; r++) {
      const cy = yMin + (r + 0.5) * cellSize;
      if (cy > yMax) break;
      for (let c = 0; c < cols; c++) {
        const cx = -view + (c + 0.5) * cellSize;

        // Mask test：cell 中心在 subject 内则 skip
        if (maskTest && !maskTest(cx, cy)) continue;

        // Pick motif: col c 用 order[(c / stride) % order.length]
        const orderIdx = Math.floor(c / stride) % order.length;
        const motifIdx = order[orderIdx];
        const motifPolylines = library[motifIdx];
        if (!motifPolylines || motifPolylines.length === 0) continue; // empty motif (#0)

        placeMotif(motifPolylines, cx, cy, halfCell);
      }
    }
  }

  return polylines;
}

/**
 * Canvas consumer：MotifGrid 底纹绘制到 ctx。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} [opts]
 * @param {string|null} [opts.background='#fdf9f6']
 * @param {string} [opts.color='#1a1a1a']
 * @param {number} [opts.lineWidth=0.5]
 * @param {number} [opts.view=1.0]
 * @param {boolean} [opts.flipY=true]
 * @param {...} 其余 forwarded 给 computeMotifGridPolylines
 */
export function motifGrid(ctx, opts = {}) {
  const {
    view = 1.0,
    color = '#1a1a1a',
    lineWidth = 0.5,
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

  const polylines = computeMotifGridPolylines(opts);
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
