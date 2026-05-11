// =============================================================================
// painted —— BOB 签名风格：嵌套网格 + Perlin bend + 多层笔触叠绘
// -----------------------------------------------------------------------------
// 机制（完整对照 BOB/sketch.js）：
//   1. buildPattern: 把画布切成 bigDIM × bigDIM 大块，每块再切 cellcount² 小 cell
//      每个 cell 用 Perlin noise 做位置 bend、整网做 middleRotate 微旋转
//   2. buildSegment: 对每个 cell 算所有 SDF 命中，按命中模式 + (i,j) 奇偶给
//      colorBase（palette index）；每个 SDF 占 3 格独立调色板窗口
//   3. drawSegment (generator): 每个 cell 叠绘 `layers` 个笔触（n 边形或椭圆），
//      偶数层用 palette、奇数用 palette2；位置加 Perlin 噪声 + 层间偏移
//   4. drawShape: n 边形用 curveVertex 走 Catmull-Rom 曲线，前后补 control 让
//      闭合处也是曲线（不是棱角）
//
// 与 silhouette / bands / sandFrame 的关键区别：
//   - 强依赖 p5（noise / randomGaussian / curveVertex / push/pop 等）
//   - 返回生成器，caller 用 raf/draw 循环 .next() 渐进式渲染
//   - 不接 ctx；通过 p5 的绘图状态接画板（caller 用 createCanvas 设置好即可）
// =============================================================================

/**
 * 启动 BOB painted 渲染。返回生成器 —— caller 在 p5 draw 里反复 .next()。
 *
 * @param {object} p - p5 实例（global mode 传 window）。需要：
 *   noise, fill, push, pop, translate, ellipse, beginShape, curveVertex, endShape,
 *   random, randomGaussian, PI, TAU, width
 * @param {Function[]} sdfs - SDF 数组（顺序 = 图层叠加顺序）
 * @param {object} [options]
 * @param {string[]} [options.palette]    - 偶数 layer 调色板（默认 BOB pigments 高对比组 1）
 * @param {string[]} [options.palette2]   - 奇数 layer 调色板（默认 BOB pigments 高对比组 2）
 * @param {number} [options.startIndex=0] - 起始 palette 偏移
 * @param {number} [options.maxSize=2048] - 缩放基准（BOB 用 2048）
 * @param {number} [options.middleScaleSize=6] - 大块边长 log2（6 → 64px）
 * @param {number} [options.smallScaleSize=2] - 单元格边长 log2（2 → 4px）
 * @param {number} [options.middleRotate=0.0015] - 整网微旋转
 * @param {number} [options.layers=5]     - 每 cell 叠绘层数
 * @param {number} [options.smallOffset=4]- 笔触位置噪声幅度（像素）
 * @param {number} [options.smallSegs=5]  - 笔触多边形顶点数（2 = 椭圆）
 * @param {number} [options.noiseScale=0.04] - Perlin 频率
 * @param {number} [options.rH=0.6]       - 层间横向偏移
 * @param {number} [options.rV=0]         - 层间纵向偏移
 * @param {number} [options.brushSpeed=2] - 每次 yield 间隔的 cell 数 = 200 * brushSpeed
 * @param {number} [options.view=1.0]     - SDF 坐标半宽
 * @param {boolean} [options.flipY=true]  - +Y up（与 silhouette / bands 一致）
 * @param {number} [options.sdfThreshold=-0.001] - SDF 命中阈值
 * @param {number} [options.gap=0.75]     - 笔触半径 vs cellSize 比例
 * @returns {Generator}
 */
export function* painted(p, sdfs, options = {}) {
  const {
    palette         = DEFAULT_PALETTE,
    palette2        = DEFAULT_PALETTE_2,
    startIndex      = 0,
    maxSize         = 2048,
    middleScaleSize = 6,
    smallScaleSize  = 2,
    middleRotate    = 0.0015,
    layers          = 5,
    smallOffset     = 4,
    smallSegs       = 5,
    noiseScale      = 0.04,
    rH              = 0.6,
    rV              = 0,
    brushSpeed      = 2,
    view            = 1.0,
    flipY           = true,
    sdfThreshold    = -0.001,
    gap             = 0.75,
  } = options;

  const csize = p.width;
  const scaleSize = Math.pow(2, middleScaleSize) * (csize / maxSize);
  const cellSize = Math.pow(2, smallScaleSize);

  // ---- buildPattern: 嵌套网格 + Perlin bend + 微旋转 ---------------------
  // bend(x, y): Perlin 给的二维偏移，把规则网格手绘化
  const bend = (x, y) => {
    const x1 = p.noise(x * noiseScale, y * noiseScale) * 4 - 2;
    const y1 = p.noise(x * noiseScale + 1000, y * noiseScale + 1000) * 4 - 2;
    return [x1, y1];
  };

  const bigDIM = Math.floor(csize / scaleSize);
  // BOB sketch.js 的 `Math.max(1, Math.min(2,))` typo 让 scaleModifier 永远 = 2。
  // 这是 load-bearing：cells 占 2x block → 邻 block 完全重叠 → 4x 密度、无可见 block 边界。
  const scaleModifier = 2;
  const modifiedScaleSize = scaleSize * scaleModifier;
  const cellcount = Math.floor(modifiedScaleSize / cellSize);

  const elements = [];
  for (let blockIdx = 0; blockIdx < bigDIM * bigDIM; blockIdx++) {
    const l = Math.floor(blockIdx / bigDIM);
    const k = blockIdx % bigDIM;
    for (let cellIdx = 0; cellIdx < cellcount * cellcount; cellIdx++) {
      const j = Math.floor(cellIdx / cellcount);
      const i = cellIdx % cellcount;
      let x = l * scaleSize + cellSize * i;
      let y = k * scaleSize + cellSize * j;
      // 整网微旋转（BOB 原版 bug：第二行用了已改过的 x，等价于剪切 + 旋转复合，保留）
      x = x * Math.cos(middleRotate) - y * Math.sin(middleRotate);
      y = x * Math.sin(middleRotate) + y * Math.cos(middleRotate);
      const [dx, dy] = bend(x, y);
      x += dx; y += dy;
      elements.push({ x, y, i, j, colorBase: startIndex });
    }
  }

  // ---- buildSegment: SDF 命中 → colorBase --------------------------------
  // 像素 → SDF 世界坐标，按 flipY 决定是否翻 y
  const pxToWorld = (px, py) => {
    const wx = (px / csize) * 2 * view - view;
    const wy = flipY
      ? -((py / csize) * 2 * view - view)
      : (py / csize) * 2 * view - view;
    return [wx, wy];
  };

  for (const e of elements) {
    const wp = pxToWorld(e.x, e.y);
    sdfs.forEach((sdf, index) => {
      if (sdf(wp) < sdfThreshold) {
        // BOB 原版 colorBase 公式（修正版：每个 SDF 占 3 格独立窗口，加 +1 防止与
        // "未命中"的 startIndex 撞色）
        const colorOffset =
          index === 0 ? 0 :
          index === 1 ? (e.i % 2 !== 0 ? 0 : 1) :
                        (e.i % 2 !== 0 ? 0 : (e.j % 2 === 0 ? 1 : 2));
        e.colorBase = startIndex + index * 3 + colorOffset + 1;
      }
    });
  }

  // ---- drawSegment: 渐进式画。yield 让 caller 在 raf/draw 里推进 -----------
  const yieldEvery = 200 * brushSpeed;
  for (let i = 0; i < elements.length; i++) {
    if ((i % yieldEvery) === 0) yield;
    const e = elements[i];
    for (let layerIdx = 0; layerIdx < layers; layerIdx++) {
      const pal = (layerIdx % 2 === 0) ? palette : palette2;
      p.fill(pal[(e.colorBase + layerIdx) % pal.length]);
      const xoffset = (p.noise(e.x * noiseScale, e.y * noiseScale, layerIdx) - 0.5) * smallOffset;
      const yoffset = (p.noise(e.x * noiseScale + 1000, e.y * noiseScale + 1000, layerIdx) - 0.5) * smallOffset;
      const layerOffset = layerIdx + 0.5 - layers / 2;
      drawBrush(p, e.x + xoffset + layerOffset * rH, e.y + yoffset + layerOffset * rV,
                cellSize * gap / 2, smallSegs);
    }
  }
}

// ---- 单个笔触：n 边形（n=2 → 椭圆），手抖 + Catmull-Rom 闭合 -----------------
// curveVertex 是 Catmull-Rom，需要前后 control 计算切线。
// 端点没 control → 闭合处出棱角。修法：前补 V[n-1]、后补 V[0] 和 V[1]。
function drawBrush(p, x, y, r, n) {
  p.push();
  p.translate(x, y);
  if (n === 2) {
    p.ellipse(0, 0, 2 * r, 2 * r);
  } else {
    const verts = [];
    const randomStart = p.random() * p.PI;
    for (let i = 0; i < n; i++) {
      const angle = (p.TAU * i) / n + randomStart;
      const cx = Math.cos(angle) * r * p.randomGaussian(1, 0.1);
      const cy = Math.sin(angle) * r * p.randomGaussian(1, 0.1);
      verts.push([cx, cy]);
    }
    p.beginShape();
    p.curveVertex(verts[n - 1][0], verts[n - 1][1]);
    for (let i = 0; i < n; i++) p.curveVertex(verts[i][0], verts[i][1]);
    p.curveVertex(verts[0][0], verts[0][1]);
    p.curveVertex(verts[1][0], verts[1][1]);
    p.endShape();
  }
  p.pop();
}

// BOB pigments 高对比组 1（红/蓝/绿/黄交错）
const DEFAULT_PALETTE = [
  '#e44d36', '#d999cb', '#12a29b', '#f7d923', '#159014', '#713c97',
  '#0e5f4a', '#229d38', '#103731', '#b6d611', '#78b9c8', '#ede0df',
];
// 高对比组 2
const DEFAULT_PALETTE_2 = [
  '#09931e', '#002baa', '#1c77c3', '#ff2702', '#feec00', '#236846',
  '#ff6900', '#fcd300', '#a3023b', '#f20256', '#0aa922',
];
