// =============================================================================
// streamline-scenes.js —— BOB 7 个场景 SDF + 新 render.hatch
// -----------------------------------------------------------------------------
// 跟 scenes-debug.js 同一 SDF 输入，但渲染走 contour-following hatching
// 而非 filled silhouette。验证 sdf-js 在同一组 SDF 上能切换 visual register。
// =============================================================================

import { makePa, makesdf } from './scenes.js';
import { render } from '../../src/index.js';

// 3D scenes (15, 16) 跳转到 test-pasma-capsules（专门的 3D streamline 调控页面）
// 原则："don't split branches"——3D streamline 调控只有一个页面，统一抽象 + UI
const sceneOverride = parseInt(location.hash.slice(1), 10);
if (sceneOverride === 15 || sceneOverride === 16) {
  location.href = `./test-pasma-capsules.html#${sceneOverride}`;
  // 中止本页加载，跳转后会重新执行 test-pasma-capsules 的代码
  throw new Error('redirected to test-pasma-capsules');
}

// 线稿用的暗色调色板（比 silhouette 那套更"墨水"）
// 扩到 12 个 slot，covered through seurat 的 11 层
const LAYER_COLORS = [
  '#8a8678',  '#3a2a1c',  '#1f3a28',  '#0e0e0e',
  '#4a2030',  '#2a3a4a',  '#5a2e1e',  '#1a3a3a',
  '#503a2a',  '#3a2e22',  '#28202a',  '#222020',
];

// 每层 dsep —— 月 / 地这种"大覆盖"层稀一点，主体密一点
const LAYER_DSEP = [
  0.030,  0.028,  0.018,  0.014,
  0.022,  0.022,  0.022,  0.022,
  0.020,  0.020,  0.020,  0.020,
];

const pa = makePa(sceneOverride);
const sdfs = makesdf(pa, { invert: false });
const layers = sdfs.map((sdf, i) => ({
  sdf,
  color: LAYER_COLORS[i] ?? LAYER_COLORS[3],
  dsep:  LAYER_DSEP[i]   ?? 0.020,
  lineWidth: 0.6,
}));
const view = pa.view;
const bg = pa.bg;
const flipY = pa.yConvention === 'up';
const statsScene = pa.scene;

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const t0 = performance.now();
const counts = render.hatch(ctx, layers, { view, background: bg, flipY });
const elapsed = performance.now() - t0;

const total = counts.reduce((a, b) => a + b, 0);
document.getElementById('stats').textContent =
  `scene ${statsScene} · ${sdfs.length} layers · ${counts.join('+')} = ${total} streamlines · ${elapsed.toFixed(0)} ms`;

const LAYER_NAMES = {
  1:  ['moon', 'ground', 'cactus', 'gate'],
  2:  ['moon', 'ground', 'tree', 'boat'],
  3:  ['moon', 'ground', 'bridge'],
  4:  ['buildings', 'moon', 'horizon'],
  5:  ['buildings', 'moon', 'horizon'],
  6:  ['horizon?', 'wall'],
  7:  ['bird'],
  8:  ['ground', 'trunk', 'crown'],
  9:  ['sun', 'sea', 'foam', 'hull', 'trim-gold', 'trim-dark', 'portholes', 'mast', 'sails', 'yards', 'flag'],
  10: ['moon', 'ground', 'stone', 'stringcourses', 'windows', 'rose-outer', 'rose-lobes', 'rose-hub', 'portals', 'crosses'],
  11: ['wings', 'bands', 'veins', 'spots', 'body', 'segs', 'head', 'eyes', 'antennae'],
  12: ['sun', 'horizon', 'figure'],
  13: ['earth', 'figures'],
  14: ['floor', 'wall-stripes', 'frame', 'inner', 'top-grass', 'dot1', 'dot2', 'dot3', 'shadow', 'body', 'hair'],
};
const names = LAYER_NAMES[pa.scene] || sdfs.map((_, i) => `layer ${i}`);
document.getElementById('legend').innerHTML = sdfs.map((_, i) => {
  const c = LAYER_COLORS[i] || LAYER_COLORS[3];
  return `<span class="legend-swatch" style="background:${c}"></span>${names[i] || `layer ${i}`} <span style="opacity:0.6">(${counts[i]} lines)</span>`;
}).join(' &nbsp; ');

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
