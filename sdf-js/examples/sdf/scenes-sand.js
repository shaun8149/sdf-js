// =============================================================================
// 沙画风格 SDF 测试器
// -----------------------------------------------------------------------------
// 渲染走 src/render/sandFrame —— 每帧画 N 个随机点，三色规则：
//   inside layer / boundary / outside。点持续堆积，形状从噪声里"渗"出来。
// 这个 demo 现在只剩"场景定义 + 一行 sandFrame 调用 + UI 装配"。
// =============================================================================

import { render } from '../../src/index.js';
import { makePa, makesdf } from './scenes.js';

const sceneOverride = parseInt(location.hash.slice(1), 10);
const pa = makePa(sceneOverride);
const sdfs = makesdf(pa, { invert: false });             // 沙画模式不反转

// ---- 调色板（与用户原代码一致 + 多图层扩展）------------------------------
const BG       = '#432';
const OUTSIDE  = '#f80';
const BOUNDARY = '#f5f5f5';
const LAYER_INSIDE = ['#06c', '#0a8', '#dc4', '#92c', '#f60', '#3bd', '#e44', '#aa6'];

const LAYER_NAMES = {
  1: ['moon', 'ground', 'cactus', 'gate'],
  2: ['moon', 'ground', 'tree', 'boat'],
  3: ['moon', 'ground', 'bridge'],
  4: ['buildings', 'moon', 'horizon'],
  5: ['buildings', 'moon', 'horizon'],
  6: ['horizon?', 'wall'],
  7: ['bird'],
};

// 把并行的 sdfs[] + LAYER_INSIDE[] 拉成 render API 期望的 [{sdf, color}, ...]
const layers = sdfs.map((sdf, i) => ({
  sdf,
  color: LAYER_INSIDE[i % LAYER_INSIDE.length],
}));

// ---- p5 入口 --------------------------------------------------------------
window.setup = () => {
  const c = createCanvas(720, 720);
  c.parent('canvas-host');
  background(BG);
  noStroke();

  // 渲染图例
  const names = LAYER_NAMES[pa.scene] || sdfs.map((_, i) => `layer ${i}`);
  document.getElementById('legend').innerHTML = layers.map((_, i) =>
    `<span class="legend-swatch" style="background:${layers[i].color}"></span>${names[i] || `layer ${i}`}`
  ).join(' &nbsp;&nbsp; ') +
    ` &nbsp;&nbsp;<span class="legend-swatch" style="background:${BOUNDARY}"></span>boundary` +
    ` &nbsp;&nbsp;<span class="legend-swatch" style="background:${OUTSIDE}"></span>outside`;

  document.getElementById('stats').textContent =
    `scene ${pa.scene} · ${sdfs.length} SDFs · 1000 pts/frame`;
};

window.draw = () => {
  // p5 的 drawingContext 就是底层 Canvas2D ctx。
  render.sandFrame(drawingContext, layers, {
    view: 1,
    samples: 1000,
    outsideColor: OUTSIDE,
    boundaryColor: BOUNDARY,
    band: 0.01,
    dotRadius: 0.5,
  });
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
