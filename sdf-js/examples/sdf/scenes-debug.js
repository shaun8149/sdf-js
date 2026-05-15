// =============================================================================
// scenes-debug.js —— 用最简单的 silhouette 渲染验证每个场景 SDF 的几何形状
// -----------------------------------------------------------------------------
// 与 cactus.html 同款：每像素求每个 SDF 的距离，按图层顺序 alpha-blend。
// 建筑 SDF 走未反转的标准形式（building shape = negative inside），方便肉眼
// 检查几何对不对。如果这个页面看起来正常但 painted-scenes.html 看不到建筑，
// 说明 SDF 没问题，问题在 BOB 的反转/染色管线。
// =============================================================================

import { makePa, makesdf } from './scenes.js';

const sceneOverride = parseInt(location.hash.slice(1), 10);
const pa = makePa(sceneOverride);
const sdfs = makesdf(pa, { invert: false });                  // 关键：建筑 SDF 不反转

// ---- 渲染参数 -------------------------------------------------------------
const canvas = document.getElementById('c');
const W = canvas.width, H = canvas.height;
const ctx = canvas.getContext('2d');

const SKY_TOP = [219, 198, 175];
const SKY_BOT = [240, 198, 168];

// 给前 8 层 SDF 一个调色板，颜色尽量分得开
const LAYER_COLORS = [
  [248, 232, 195],     // 0 - 月 / 第一层（米黄）
  [196, 138, 92],      // 1 - 地 / 地平线（棕橘）
  [76, 118, 88],       // 2 - 主形状（沙绿）—— 仙人掌、树、建筑、墙
  [54,  36,  28],      // 3 - 副形状（深咖啡）—— 门、船
  [120, 60,  90],      // 4
  [80,  100, 140],     // 5
  [200, 130, 80],      // 6
  [60,  140, 120],     // 7
];

const LAYER_NAMES = {
  1: ['moon', 'ground', 'cactus', 'gate'],
  2: ['moon', 'ground', 'tree', 'boat'],
  3: ['moon', 'ground', 'bridge'],
  4: ['buildings (raw)', 'moon', 'horizon'],
  5: ['buildings (raw)', 'moon', 'horizon'],
  6: ['horizon?', 'wall'],
  7: ['bird'],
};

// ---- 渲染 ------------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const t0 = performance.now();
const img = ctx.createImageData(W, H);
const data = img.data;
const aaWidth = 2 * pa.view / W;

const flipY = pa.yConvention === 'up';     // 每个 scene 在 makePa 里自报

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const wx = (x / W) * 2 * pa.view - pa.view;
    const wy = flipY
      ? pa.view - (y / H) * 2 * pa.view
      : (y / H) * 2 * pa.view - pa.view;

    // 起手：天空垂直渐变（在 Y-down 里：屏幕顶 = y 小 = sky top）
    const skyT = (wy + pa.view) / (2 * pa.view);              // 0(顶) → 1(底)
    let col = lerp3(SKY_TOP, SKY_BOT, skyT);

    // 自底向上叠图层
    for (let i = 0; i < sdfs.length; i++) {
      const d = sdfs[i]([wx, wy]);
      const t = smoothstep(aaWidth, -aaWidth, d);
      col = lerp3(col, LAYER_COLORS[i] || LAYER_COLORS[3], t);
    }

    const idx = (y * W + x) * 4;
    data[idx]     = col[0];
    data[idx + 1] = col[1];
    data[idx + 2] = col[2];
    data[idx + 3] = 255;
  }
}
ctx.putImageData(img, 0, 0);

const elapsed = performance.now() - t0;
document.getElementById('stats').textContent =
  `scene ${pa.scene} · ${W}×${H} · ${elapsed.toFixed(0)} ms · ${sdfs.length} layers`;

// 图例
const names = LAYER_NAMES[pa.scene] || sdfs.map((_, i) => `layer ${i}`);
const legend = document.getElementById('legend');
legend.innerHTML = sdfs.map((_, i) => {
  const c = LAYER_COLORS[i] || LAYER_COLORS[3];
  return `<span class="legend-swatch" style="background:rgb(${c[0]},${c[1]},${c[2]})"></span>${names[i] || `layer ${i}`}`;
}).join(' &nbsp; ');

// ---- 按钮 ------------------------------------------------------------------
document.getElementById('re').addEventListener('click', () => {
  location.hash = '';
  location.reload();
});
document.querySelectorAll('[data-scene]').forEach(btn => {
  btn.addEventListener('click', () => {
    location.hash = btn.dataset.scene;
    location.reload();
  });
});
