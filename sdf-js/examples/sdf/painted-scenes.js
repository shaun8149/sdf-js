// =============================================================================
// BOB 6 个 2D 场景的 painted 笔触渲染
// -----------------------------------------------------------------------------
// 场景 SDF 来自 scenes.js（painted 和 debug 共用）。
// 渲染走 src/render/painted。
// 注意：scenes.js 是 BOB y-down 约定，所以传 flipY:false。
// =============================================================================

import { render } from '../../src/index.js';
import { makePa, makesdf } from './scenes.js';

// 场景可由 URL hash (#2, #3, ...) 强制指定，方便逐个测试
const sceneOverride = parseInt(location.hash.slice(1), 10);
const pa = makePa(sceneOverride);

// BOB pigments 双调色板。每次刷新洗牌让配色不同
const PALETTE  = ['#e44d36','#d999cb','#12a29b','#f7d923','#159014','#713c97','#0e5f4a','#229d38','#103731','#b6d611','#78b9c8','#ede0df'];
const PALETTE2 = ['#09931e','#002baa','#1c77c3','#ff2702','#feec00','#236846','#ff6900','#fcd300','#a3023b','#f20256','#0aa922'];

const shuf = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
};

let painter;

window.setup = () => {
  pixelDensity(2);
  const canvas = createCanvas(720, 720);
  canvas.parent('canvas-host');
  noStroke();
  background(pa.bg);

  shuf(PALETTE);
  shuf(PALETTE2);

  // BOB 风格：scene 4/5 建筑反转 SDF（让"天空"被染色，建筑保留纸底）
  const sdfs = makesdf(pa, { invert: true });

  painter = render.painted(window, sdfs, {
    palette:         PALETTE,
    palette2:        PALETTE2,
    startIndex:      Math.floor(Math.random() * PALETTE.length),
    view:            pa.view,
    flipY:           false,           // scenes.js 是 BOB y-down 约定
    middleScaleSize: pa.middleScaleSize,
    smallScaleSize:  pa.smallScaleSize,
    middleRotate:    pa.middleRotate,
    layers:          pa.layers,
    smallOffset:     pa.smallOffset,
    smallSegs:       pa.smallSegs,
    noiseScale:      pa.noiseScale,
    rH:              pa.rH,
    rV:              pa.rV,
    brushSpeed:      pa.brushSpeed,
  });

  document.getElementById('stats').textContent =
    `scene ${pa.scene} · ${sdfs.length} sdfs · ${pa.layers} layers · painting…`;
};

window.draw = () => {
  const r = painter.next();
  if (r.done) {
    document.getElementById('stats').textContent = `scene ${pa.scene} · done`;
    noLoop();
  }
};

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
