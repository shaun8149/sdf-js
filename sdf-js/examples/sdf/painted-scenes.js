// =============================================================================
// BOB 6 个 2D 场景 + BOB sketch.js 笔触渲染管线
// -----------------------------------------------------------------------------
// 场景 SDF 抽到了 scenes.js（painted 和 debug 渲染共享）；
// 这里只剩渲染 pipeline（buildPattern / buildSegment / drawSegment / drawShape）。
// =============================================================================

import { makePa, makesdf } from './scenes.js';

// 场景可以通过 URL hash (#2, #3, ...) 强制指定，方便逐个测试
const sceneOverride = parseInt(location.hash.slice(1), 10);
const pa = makePa(sceneOverride);
let sdfs;

// ---- 调色板 + 渲染常量 ----------------------------------------------------
const PALETTE  = ["#e44d36","#d999cb","#12a29b","#f7d923","#159014","#713c97","#0e5f4a","#229d38","#103731","#b6d611","#78b9c8","#ede0df"];
const PALETTE2 = ["#09931e","#002baa","#1c77c3","#ff2702","#feec00","#236846","#ff6900","#fcd300","#a3023b","#f20256","#0aa922"];

const SDFTHRESHOLD = -0.001;
const GAP = 0.75;
const MaxSize = 2048;

let csize, elements, mainGen;
let startIndex = 0;

const shuf = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
};

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

  // BOB 风格：scene 4/5 建筑反转 SDF（让"天空"被染色，建筑保留纸底）
  sdfs = makesdf(pa, { invert: true });
  setupToken();
  mainGen = drawSegment();

  // 诊断：统计每个 SDF 命中了多少 cell
  const hits = sdfs.map(() => 0);
  elements.forEach(e => e.sdf.forEach((h, i) => { if (h) hits[i]++; }));
  console.log(`scene ${pa.scene} · sdf hits per layer:`, hits, `/ total ${elements.length} cells`);

  document.getElementById('stats').textContent =
    `scene ${pa.scene} · ${sdfs.length} sdfs · ${elements.length} cells × ${pa.layers} layers · painting…`;
};

window.draw = () => {
  const r = mainGen.next();
  if (r.done) {
    document.getElementById('stats').textContent =
      `scene ${pa.scene} · done`;
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

// ============================================================================
// BOB sketch.js 渲染管线（搬自 cactus-painted.js / sketch.js，去掉 Y 翻转）
// ============================================================================

const setupToken = () => {
  const scaleSize = Math.pow(2, pa.middleScaleSize);
  const factor = csize / MaxSize;
  const grids = buildPattern(scaleSize * factor);
  elements = buildSegment(grids);
};

const buildPattern = (newScale) => {
  const bigDIM = Math.floor(csize / newScale);
  const grids = new Array(bigDIM * bigDIM).fill(0).map((_, index) => {
    const l = Math.floor(index / bigDIM);
    const k = index % bigDIM;
    const cellSize = Math.pow(2, pa.smallScaleSize);
    // BOB sketch.js 这里写的是 `Math.max(1, Math.min(2,))` —— typo 让
    // scaleModifier 永远 = 2。这其实是 load-bearing：让 cells 占据的范围 (128px)
    // 是 block (64px) 的 2x，邻 block 的 cells 完全重叠 → 4x 密度、消除 block 边界。
    // 修掉这个 typo 就会出现"小方块感"，所以这里保留 BOB 的行为。
    const scaleModifier = 2;
    const modifiedNewScale = newScale * scaleModifier;
    const cellcount = Math.floor(modifiedNewScale / cellSize);
    return new Array(cellcount * cellcount).fill(0).map((_, ci) => {
      const j = Math.floor(ci / cellcount);
      const i = ci % cellcount;
      let xx = l * newScale + cellSize * i;
      let yy = k * newScale + cellSize * j;
      xx = xx * Math.cos(pa.middleRotate) - yy * Math.sin(pa.middleRotate);
      yy = xx * Math.sin(pa.middleRotate) + yy * Math.cos(pa.middleRotate);
      const d = bend(xx, yy);
      xx += d[0]; yy += d[1];
      return {
        x: xx, y: yy, i, j, l, k,
        cellSize,
        colorBase: startIndex,
        layer: new Array(pa.layers).fill(0),
        sdf: new Array(sdfs.length).fill(false),
      };
    });
  }).flat();
  return grids;
};

const buildSegment = (grids) => {
  grids.forEach((e) => {
    const x = (e.x / csize) * 2 * pa.view - pa.view;
    const y = (e.y / csize) * 2 * pa.view - pa.view;
    sdfs.forEach((sdf, index) => {
      if (sdf([x, y]) < SDFTHRESHOLD) {
        e.sdf[index] = true;
        const colorIndex = (() => {
          if (index === 0) return 0;
          else if (index === 1) return e.i % 2 !== 0 ? 0 : 1;
          else return e.i % 2 !== 0 ? 0 : (e.j % 2 === 0 ? 1 : 2);
        })();
        // +1 让 index=0 (单 SDF 场景如鸟、building 反转后的天空) 和"未命中"的默认 startIndex
        // 至少差 1 格调色板，否则形状会和背景同色 → 看不见
        e.colorBase = startIndex + index * 3 + colorIndex + 1;
      }
    });
  });
  return grids;
};

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

const drawShape = (x, y, r, n) => {
  push();
  translate(x, y);
  if (n === 2) {
    ellipse(0, 0, 2 * r, 2 * r);
  } else {
    const verts = [];
    const randomStart = random() * PI;
    for (let i = 0; i < n; i++) {
      const angle = (TAU * i) / n + randomStart;
      verts.push([
        Math.cos(angle) * r * randomGaussian(1, 0.1),
        Math.sin(angle) * r * randomGaussian(1, 0.1),
      ]);
    }
    beginShape();
    curveVertex(verts[n - 1][0], verts[n - 1][1]);
    for (let i = 0; i < n; i++) curveVertex(verts[i][0], verts[i][1]);
    curveVertex(verts[0][0], verts[0][1]);
    curveVertex(verts[1][0], verts[1][1]);
    endShape();
  }
  pop();
};

const bend = (x, y) => {
  const ns = pa.noiseScale;
  return [
    noise(x * ns, y * ns) * 4 - 2,
    noise(x * ns + 1000, y * ns + 1000) * 4 - 2,
  ];
};
