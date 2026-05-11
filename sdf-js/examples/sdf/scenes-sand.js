// =============================================================================
// 沙画风格 SDF 测试器
// -----------------------------------------------------------------------------
// 直接搬用户那段代码的核心 idea：每帧随机抽 N 个点 → 按 SDF 距离上色 → 画
// 1px 小点。不清屏，点会持续堆积，形状从噪声里"渗"出来。
//
// 三色规则：
//   d < -BAND: 该点在某个 SDF 内部 → 用该图层的颜色（越后面的图层覆盖前面）
//   |d| < BAND: 在某个 SDF 边界附近 → 白（高亮轮廓）
//   d > +BAND: 所有 SDF 都在外面 → 橙（背景沙）
// =============================================================================

import { makePa, makesdf } from './scenes.js';

const sceneOverride = parseInt(location.hash.slice(1), 10);
const pa = makePa(sceneOverride);
const sdfs = makesdf(pa, { invert: false });             // 沙画模式不反转

// ---- 调色板（与用户原代码一致 + 多图层扩展）------------------------------
const BG       = '#432';
const OUTSIDE  = '#f80';
const BOUNDARY = '#f5f5f5';
// 每个 SDF 图层一个 inside 颜色
const LAYER_INSIDE = ['#06c', '#0a8', '#dc4', '#92c', '#f60', '#3bd', '#e44', '#aa6'];
const BAND = 0.01;                                        // 边界带宽（与用户一致）
const PER_FRAME = 1000;                                   // 每帧采样点数

const LAYER_NAMES = {
  1: ['moon', 'ground', 'cactus', 'gate'],
  2: ['moon', 'ground', 'tree', 'boat'],
  3: ['moon', 'ground', 'bridge'],
  4: ['buildings', 'moon', 'horizon'],
  5: ['buildings', 'moon', 'horizon'],
  6: ['horizon?', 'wall'],
  7: ['bird'],
};

const R = (a = 1) => Math.random() * a;

// ---- p5 入口 --------------------------------------------------------------
window.setup = () => {
  const c = createCanvas(720, 720);
  c.parent('canvas-host');
  background(BG);
  noStroke();

  // 渲染图例
  const names = LAYER_NAMES[pa.scene] || sdfs.map((_, i) => `layer ${i}`);
  document.getElementById('legend').innerHTML = sdfs.map((_, i) => {
    const col = LAYER_INSIDE[i % LAYER_INSIDE.length];
    return `<span class="legend-swatch" style="background:${col}"></span>${names[i] || `layer ${i}`}`;
  }).join(' &nbsp;&nbsp; ') +
    ` &nbsp;&nbsp;<span class="legend-swatch" style="background:${BOUNDARY}"></span>边界` +
    ` &nbsp;&nbsp;<span class="legend-swatch" style="background:${OUTSIDE}"></span>外部`;

  document.getElementById('stats').textContent =
    `scene ${pa.scene} · ${sdfs.length} SDFs · ${PER_FRAME} pts/frame`;
};

window.draw = () => {
  // 像用户的代码一样：每帧抽 N 个 [-1,1]² 内的随机点
  for (let k = 0; k < PER_FRAME; k++) {
    const wx = R(2) - 1;
    const wy = R(2) - 1;

    // 找到该点所在的最高图层（last-inside-wins），并检测是否在任意边界附近
    let layerIdx = -1;
    let nearBoundary = false;
    for (let i = 0; i < sdfs.length; i++) {
      const d = sdfs[i]([wx, wy]);
      if (d < -BAND) layerIdx = i;
      else if (d < BAND) nearBoundary = true;
    }

    let col;
    if (layerIdx >= 0) col = LAYER_INSIDE[layerIdx % LAYER_INSIDE.length];
    else if (nearBoundary) col = BOUNDARY;
    else col = OUTSIDE;

    fill(col);
    // 与用户原代码同样的世界 → 像素映射；用 1px 圆点
    circle(((wx + 1) * width) / 2, ((wy + 1) * height) / 2, 1);
  }
};

// ---- 按钮 -----------------------------------------------------------------
document.getElementById('re').addEventListener('click', () => {
  location.hash = '';
  location.reload();
});

document.getElementById('clear').addEventListener('click', () => {
  background(BG);
});

document.querySelectorAll('[data-scene]').forEach(btn => {
  btn.addEventListener('click', () => {
    location.hash = btn.dataset.scene;
    location.reload();
  });
});
