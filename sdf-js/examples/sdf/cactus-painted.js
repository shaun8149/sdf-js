// =============================================================================
// BOB scene 1，渲染逻辑搬自 BOB/sketch.js
// -----------------------------------------------------------------------------
// 改动只有两处必要的：
//   1. SDF 数组改用新 sdf-js 表达（cactus / moon / ground / gate）
//   2. 坐标映射的视野半宽用 pa.view 而非 BOB 硬编码的 1.0
//
// 其它 (buildPattern / buildSegment / drawSegment / drawShape / bend) 几乎
// 逐行 copy 自 BOB/sketch.js，方便对照阅读。
// =============================================================================

import {
  rounded_rectangle, rectangle, circle, line, union,
} from '../../src/index.js';

// ---- 场景 SDFs（与 cactus.js 完全一致）-----------------------------------
const cactus = union(
  rounded_rectangle([0.30, 1.60], [0.15, 0, 0.15, 0]),
  rounded_rectangle([0.20, 0.80], [0.10, 0, 0.10, 0]).translate([ 0.30,  0.10]),
  rounded_rectangle([0.20, 0.80], [0.10, 0, 0.10, 0]).translate([-0.30, -0.10]),
  rounded_rectangle([0.20, 0.20], 0.05).translate([ 0.20, 0.40]),
  rounded_rectangle([0.20, 0.20], 0.05).translate([-0.20, 0.20]),
).scale(1 / 1.5).translate([0, 0.2]);

const moon =
  circle(0.16)
    .difference(circle(0.18).translate([-0.06, 0.04]))
    .translate([-0.65, 0.55]);

const ground = line([0, -1], [0, -0.45]);

const gate =
  rectangle([0.20, 0.20])
    .difference(rectangle([0.16, 0.16]))
    .rotate(Math.PI / 4)
    .scale([0.5, 1])
    .translate([0.85, -0.15]);

// SDF 数组：顺序就是图层叠加顺序（后命中覆盖前 colorBase）
const sdfs = [moon, ground, cactus, gate];

// ---- 参数（BOB pa 的固定子集）+ 调色板 ------------------------------------
const pa = {
  bg:                 '#fdf9f6',
  middleScaleSize:    6,           // scaleSize = 2^6 = 64 px (大块边长)
  smallScaleSize:     2,           // cellSize = 2^2 = 4 px (单元格边长)
  middleRotate:       0.0015,      // 整网轻微旋转
  smallscalevariance: 0.15,        // 大块 cell 数的高斯波动
  layers:             5,           // 每个 cell 叠绘几层
  smallOffset:        4,           // 笔触位置噪声幅度
  smallSegs:          5,           // 每个笔触多边形的边数（5 → 五边形, 2 → 椭圆）
  noiseScale:         0.04,
  rH:                 0.6,         // 层间方向偏移：横
  rV:                 0,           //                竖
  brushSpeed:         2,           // 每帧画 200 * brushSpeed 个 cell
  view:               1.0,         // SDF 坐标半宽（BOB 用 1.0）
};

// 调色板：必须每个相邻索引颜色都明显不同，因为 BOB 的 colorBase 偏移只有
// +1/+2/+3 几档；如果挑同色系（沙漠棕、灰雾），区域无法在视觉上拉开。
// 这里直接用 BOB pigments 数组里两组高对比多色（红/蓝/绿/黄交错）。
const PALETTE  = ["#e44d36","#d999cb","#12a29b","#f7d923","#159014","#713c97","#0e5f4a","#229d38","#103731","#b6d611","#78b9c8","#ede0df"];
const PALETTE2 = ["#09931e","#002baa","#1c77c3","#ff2702","#feec00","#236846","#ff6900","#fcd300","#a3023b","#f20256","#0aa922"];

const SDFTHRESHOLD = -0.001;
const GAP = 0.75;
const MaxSize = 2048;

// ---- 状态 -----------------------------------------------------------------
let csize, elements, mainGen;
let startIndex = 0;

// 数组洗牌（BOB 的 shuf）：Fisher–Yates
const shuf = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
};

// ---- p5 入口（global mode，window.setup / window.draw）-------------------
window.setup = () => {
  pixelDensity(2);
  csize = 720;
  const canvas = createCanvas(csize, csize);
  canvas.parent('canvas-host');
  noStroke();
  background(pa.bg);

  shuf(PALETTE);
  shuf(PALETTE2);
  startIndex = Math.floor(Math.random() * PALETTE.length);

  setupToken();
  mainGen = drawSegment();
  document.getElementById('stats').textContent =
    `${elements.length} cells × ${pa.layers} layers, painting…`;
};

window.draw = () => {
  const r = mainGen.next();
  if (r.done) {
    document.getElementById('stats').textContent =
      `done · ${elements.length} cells × ${pa.layers} layers`;
    noLoop();
  }
};

// ===========================================================================
// 以下 5 个函数搬自 BOB/sketch.js，只在必要处加注释
// ===========================================================================

const setupToken = () => {
  const scaleSize = Math.pow(2, pa.middleScaleSize);
  const factor = csize / MaxSize;
  const grids = buildPattern(scaleSize * factor);
  elements = buildSegment(grids);
};

// 嵌套网格：bigDIM × bigDIM 的"大块"，每块再细分 cellcount × cellcount 的小 cell
const buildPattern = (newScale) => {
  let dx = 0, dy = 0;
  const bigDIM = Math.floor(csize / newScale);
  const grids = new Array(bigDIM * bigDIM).fill(0).map((cell, index) => {
    const l = Math.floor(index / bigDIM);
    const k = index % bigDIM;
    const cellSize = Math.pow(2, pa.smallScaleSize);
    // BOB sketch.js 的 `Math.max(1, Math.min(2,))` typo 让 scaleModifier 永远 = 2。
    // 这是 load-bearing：cells 占据 2x block 大小 → 邻 block 完全重叠 → 4x 密度、
    // 没有可见的 block 边界。修掉 typo 反而会出"小方块"。
    const scaleModifier = 2;
    const modifiedNewScale = newScale * scaleModifier;
    const cellcount = Math.floor(modifiedNewScale / cellSize);
    const colorIndex = startIndex;
    const cells = new Array(cellcount * cellcount).fill(0).map((cell, cellindex) => {
      const j = Math.floor(cellindex / cellcount);
      const i = cellindex % cellcount;
      let x = dx + l * newScale + cellSize * i;
      let y = dy + k * newScale + cellSize * j;
      x = x * Math.cos(pa.middleRotate) - y * Math.sin(pa.middleRotate);
      y = x * Math.sin(pa.middleRotate) + y * Math.cos(pa.middleRotate);
      const d = bend(x, y);
      x += d[0];
      y += d[1];
      return {
        x, y, i, j, l, k,
        bigDIM,
        cellcount,
        colorBase: colorIndex,
        cellSize,
        layer: new Array(pa.layers).fill(0),
        sdf: new Array(sdfs.length).fill(false),
      };
    });
    return cells;
  }).flat();
  return grids;
};

// 给每个 cell 打 SDF 命中标记并按层覆盖染色
//
// 与 BOB 原版相比，唯一改动是 colorBase 公式从
//     startIndex + colorIndex + 1                         // BOB: 4 个形状全挤在 +1~+3
// 改成
//     startIndex + index * 3 + colorIndex                  // 每个 SDF 占 3 格独立窗口
// 让每个 SDF 在 palette 里占一段独立区间，形状之间色彩明显分开。
// （palette 长度 ≥ sdfs.length * 3 才不溢出回前段；不够时会 mod 回去也无妨）
const buildSegment = (grids) => {
  grids.forEach((e) => {
    // 像素坐标 → SDF 坐标 [-view, view]，注意 Y 翻转 (p5 像素 Y 朝下)
    const x = (e.x / csize) * 2 * pa.view - pa.view;
    const y = -((e.y / csize) * 2 * pa.view - pa.view);
    sdfs.forEach((sdf, index) => {
      if (sdf([x, y]) < SDFTHRESHOLD) {
        e.sdf[index] = true;
        const colorIndex = (() => {
          if (index === 0) return 0;
          else if (index === 1) return e.i % 2 !== 0 ? 0 : 1;
          else return e.i % 2 !== 0 ? 0 : (e.j % 2 === 0 ? 1 : 2);
        })();
        // +1 让 index=0 形状和"未命中"的默认 startIndex 至少差 1 格调色板（否则同色不可见）
        e.colorBase = startIndex + index * 3 + colorIndex + 1;
      }
    });
  });
  return grids;
};

// 实际绘制循环：每个 cell 按 layer 数叠绘多遍。生成器风格 → 边画边显示
function* drawSegment() {
  for (let i = 0; i < elements.length; i++) {
    if ((i % (200 * pa.brushSpeed)) === 0) yield 1;
    const e = elements[i];
    for (let index = 0; index < e.layer.length; index++) {
      const palette = (index % 2 === 0) ? PALETTE : PALETTE2;
      fill(palette[(e.colorBase + index) % palette.length]);
      const xoffset = (noise(e.x * pa.noiseScale, e.y * pa.noiseScale, index) - 0.5) * pa.smallOffset;
      const yoffset = (noise(e.x * pa.noiseScale + 1000, e.y * pa.noiseScale + 1000, index) - 0.5) * pa.smallOffset;
      const layerOffset = index + 0.5 - e.layer.length / 2;
      const xshift = layerOffset * pa.rH;
      const yshift = layerOffset * pa.rV;
      drawShape(e.x + xoffset + xshift, e.y + yoffset + yshift, e.cellSize * GAP / 2, pa.smallSegs);
    }
  }
}

// 画一个 n 边形（n=2 → 椭圆）；curveVertex + wrap-around 控制点给柔和有机的闭合轮廓
//
// curveVertex 用 Catmull-Rom：每段曲线需要前后各一个相邻 control 才能算切线。
// 直接 curveVertex(V0..Vn-1) + endShape(CLOSE) 会让端点没有合法 control → 闭合处出现棱角。
// 修法：前补 V[n-1] 当起点 control，后补 V[0] 和 V[1] 把闭合也走成曲线。
const drawShape = (x, y, r, n) => {
  push();
  translate(x, y);
  if (n === 2) {
    ellipse(0, 0, 2 * r, 2 * r);
  } else {
    // 先把所有顶点算出来（带高斯波动模拟手抖）
    const verts = [];
    const randomStart = random() * PI;
    for (let i = 0; i < n; i++) {
      const angle = (TAU * i) / n + randomStart;
      const cx = Math.cos(angle) * r * randomGaussian(1, 0.1);
      const cy = Math.sin(angle) * r * randomGaussian(1, 0.1);
      verts.push([cx, cy]);
    }
    beginShape();
    // 前置 control：用最后一个顶点
    curveVertex(verts[n - 1][0], verts[n - 1][1]);
    // 主体顶点
    for (let i = 0; i < n; i++) curveVertex(verts[i][0], verts[i][1]);
    // 后置 control：回到第 0 和第 1 个，让闭合也走曲线
    curveVertex(verts[0][0], verts[0][1]);
    curveVertex(verts[1][0], verts[1][1]);
    endShape();
  }
  pop();
};

// Perlin 噪声给坐标加二维偏移；让规则网格看起来手绘化
const bend = (x, y) => {
  const ns = pa.noiseScale;
  const x1 = noise(x * ns, y * ns) * 4 - 2;
  const y1 = noise(x * ns + 1000, y * ns + 1000) * 4 - 2;
  return [x1, y1];
};
