// =============================================================================
// sdf-js 浏览器 demo —— raymarching 渲染 9 个面板
// -----------------------------------------------------------------------------
// 每个面板都是 sdf-js 链式 API 的一行表达式 → 一个 192×192 的预览图。
// 渲染器是最朴素的 sphere tracing + 中心差分法向 + Lambert 着色，纯 JS 单线程。
// 性能不是这一版的目标；目标是验证：
//   primitives:  sphere / box / plane
//   transforms:  translate / rotate / scale / orient
//   booleans:    union / intersection / difference + smooth k
// 都能正确组合并出图。
// =============================================================================

import {
  sphere, box, plane,
  union, intersection, difference,
} from '../../src/index.js';
import * as v from '../../src/sdf/vec.js';

// ---- 面板配置 --------------------------------------------------------------

const panels = [
  {
    title: 'sphere(1)',
    code: 'sphere(1)',
    sdf: sphere(1),
  },
  {
    title: 'box(1.4)',
    code: 'box(1.4)',
    sdf: box(1.4),
  },
  {
    title: 'sphere ∪ box',
    code: 'sphere(1).union(box(1.4).translate([0.7,0.7,0.7]))',
    sdf: sphere(1).union(box(1.4).translate([0.7, 0.7, 0.7])),
  },
  {
    title: 'sphere ∩ box',
    code: 'sphere(1).intersection(box(1.5))',
    sdf: sphere(1).intersection(box(1.5)),
  },
  {
    title: 'sphere − box',
    code: 'sphere(1).difference(box(1.4).translate([0.6,0.6,-0.6]))',
    sdf: sphere(1).difference(box(1.4).translate([0.6, 0.6, -0.6])),
  },
  {
    title: 'smooth union k=0.3',
    code: 'sphere(1).union(box(1.2).translate([0.9,0,0]).k(0.3))',
    sdf: sphere(1).union(box(1.2).translate([0.9, 0, 0]).k(0.3)),
  },
  {
    title: 'rotate(π/4, X)',
    code: 'box([1.6,1.6,0.5]).rotate(Math.PI/4, [1,0,0])',
    sdf: box([1.6, 1.6, 0.5]).rotate(Math.PI / 4, [1, 0, 0]),
  },
  {
    title: 'orient: three-axis box cross',
    code: 'box([0.4,0.4,1.6]).orient(X) ∪ orient(Y) ∪ orient(Z)',
    sdf: union(
      box([0.4, 0.4, 1.6]).orient([1, 0, 0]),
      box([0.4, 0.4, 1.6]).orient([0, 1, 0]),
      box([0.4, 0.4, 1.6]).orient([0, 0, 1]),
    ),
  },
  {
    title: 'classic: sphere ∩ box − three rods',
    code: 'sphere(1) & box(1.5) − rod.orient(X|Y|Z)',
    sdf: sphere(1)
      .intersection(box(1.5))
      .difference(union(
        box([0.5, 0.5, 3]).orient([1, 0, 0]),
        box([0.5, 0.5, 3]).orient([0, 1, 0]),
        box([0.5, 0.5, 3]).orient([0, 0, 1]),
      )),
  },
];

// ---- Raymarcher ------------------------------------------------------------

const W = 192, H = 192;
const camPos = [0, 0, -4.2];
const focal = 1.25;                                       // 焦距，越小透视越强
const lightDir = v.normalize([0.55, 0.7, -0.45]);
const bgTop = [10, 12, 18];
const bgBot = [22, 26, 36];

// 3/4 视角：把每个 SDF 先绕 Y 转 30°、再绕 X 倒一点 20°，让正面的方块也露三面。
// 用户原本写的 SDF 不变（方块还是轴对齐），只在渲染入口加这层"看的角度"。
const VIEW_YAW = 0.55;
const VIEW_PITCH = -0.35;
const viewRotate = (sdf) =>
  sdf.rotate(VIEW_YAW, v.Y).rotate(VIEW_PITCH, v.X);

function raymarch(sdf, ro, rd) {
  let t = 0;
  for (let i = 0; i < 80; i++) {
    const p = v.add(ro, v.mul(rd, t));
    const d = sdf(p);
    if (d < 0.001) return [t, p];
    t += d;
    if (t > 50) return null;
  }
  return null;
}

function gradient(sdf, p, eps = 0.001) {
  return v.normalize([
    sdf([p[0] + eps, p[1], p[2]]) - sdf([p[0] - eps, p[1], p[2]]),
    sdf([p[0], p[1] + eps, p[2]]) - sdf([p[0], p[1] - eps, p[2]]),
    sdf([p[0], p[1], p[2] + eps]) - sdf([p[0], p[1], p[2] - eps]),
  ]);
}

function shade(sdf, hit) {
  if (!hit) return null;
  const n = gradient(sdf, hit[1]);
  const lambert = Math.max(0, v.dot(n, lightDir));
  const ambient = 0.10;                                   // 压深阴影
  const k = ambient + (1 - ambient) * lambert;
  // 法线染色：把法线 xyz 偏移映射到 RGB，让相邻面颜色不同 → 棱角清晰
  return [
    Math.floor(255 * k * (0.45 + 0.45 * Math.abs(n[0]))),
    Math.floor(255 * k * (0.45 + 0.45 * Math.abs(n[1]))),
    Math.floor(255 * k * (0.55 + 0.40 * Math.abs(n[2]))),
  ];
}

function renderPanel(sdf, canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x / W) * 2 - 1;
      const w = (y / H) * 2 - 1;
      const rd = v.normalize([u, -w, focal]);
      const hit = raymarch(sdf, camPos, rd);
      const col = shade(sdf, hit);
      const i = (y * W + x) * 4;
      if (col) {
        data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2];
      } else {
        // 垂直渐变背景
        const t = y / H;
        data[i]     = bgTop[0] * (1 - t) + bgBot[0] * t;
        data[i + 1] = bgTop[1] * (1 - t) + bgBot[1] * t;
        data[i + 2] = bgTop[2] * (1 - t) + bgBot[2] * t;
      }
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---- 装配 DOM 并按帧异步渲染（避免主线程一次性卡死）------------------------

const grid = document.getElementById('grid');
const canvases = panels.map((p) => {
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <h2>${p.title}</h2>
    <code>${p.code}</code>
    <canvas width="${W}" height="${H}"></canvas>
    <div class="stats">queued…</div>
  `;
  grid.appendChild(panel);
  return {
    canvas: panel.querySelector('canvas'),
    stats: panel.querySelector('.stats'),
    spec: p,
  };
});

(async function renderAll() {
  for (const item of canvases) {
    item.stats.textContent = 'rendering…';
    await new Promise((r) => requestAnimationFrame(r));
    const t0 = performance.now();
    renderPanel(viewRotate(item.spec.sdf), item.canvas);
    item.stats.textContent = `${W}×${H} · ${(performance.now() - t0).toFixed(0)} ms`;
  }
})();
