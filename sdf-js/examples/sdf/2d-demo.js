// =============================================================================
// 2D 距离场可视化 demo
// -----------------------------------------------------------------------------
// 每个 panel 都是一个 SDF2 表达式 → 一张 256×256 图。
// 每个像素：取 SDF 数值 d，配色：
//   - d < 0 (内部)：蓝色调
//   - d > 0 (外部)：红色调
//   - 每 0.1 单位一道色带（equipotential 可视化）
//   - d ≈ 0：黑色细线（boundary）
// =============================================================================

import {
  circle, rectangle, rounded_rectangle, hexagon, equilateral_triangle,
  polygon, triangle, line,
  union, intersection, difference,
} from '../../src/index.js';

// ---- Panel 配置 ------------------------------------------------------------

const panels = [
  {
    title: 'circle(1)',
    code: 'circle(1)',
    sdf: circle(1),
  },
  {
    title: 'rectangle([1.5, 1])',
    code: 'rectangle([1.5, 1])',
    sdf: rectangle([1.5, 1]),
  },
  {
    title: 'rounded_rectangle 不同角半径',
    code: 'rounded_rectangle([1.6,1], [0.4,0.05,0.05,0.4])',
    sdf: rounded_rectangle([1.6, 1], [0.4, 0.05, 0.05, 0.4]),
  },
  {
    title: 'hexagon(1)',
    code: 'hexagon(1).rotate(Math.PI / 6)',
    sdf: hexagon(1).rotate(Math.PI / 6),
  },
  {
    title: '5 角星 (polygon)',
    code: 'polygon([5 个交替顶点])',
    sdf: (() => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? 1.1 : 0.45;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return polygon(pts);
    })(),
  },
  {
    title: '三角形 + 圆 smooth union',
    code: 'triangle.union(circle.translate.k(0.15))',
    sdf: triangle([-0.8, -0.6], [0.8, -0.6], [0, 0.9])
      .union(circle(0.4).translate([0.7, 0.7]).k(0.15)),
  },
  {
    title: '圆 ∩ 矩形',
    code: 'circle(1).intersection(rectangle([1.6, 1]))',
    sdf: circle(1).intersection(rectangle([1.6, 1])),
  },
  {
    title: '月牙 (差集) — BOB 场景预演',
    code: 'circle(0.7).difference(circle(0.7).translate([-0.25,0.1]))',
    sdf: circle(0.7).difference(circle(0.7).translate([-0.25, 0.1])),
  },
  {
    title: '圆周阵列 8 份',
    code: 'circle(0.18).translate([0.7,0]).circular_array(8)',
    sdf: circle(0.18).translate([0.7, 0]).circular_array(8),
  },
  {
    title: '抽壳：六边形外壳',
    code: 'hexagon(1).shell(0.1)',
    sdf: hexagon(1).shell(0.1),
  },
  {
    title: 'BOB 仙人掌（链式重写预演）',
    code: '5 个圆角矩形 union',
    sdf: union(
      rounded_rectangle([0.45, 1.6], [0, 0.3, 0, 0.3]),
      rounded_rectangle([0.3, 0.8], [0, 0.2, 0, 0.2]).translate([0.45, 0.15]),
      rounded_rectangle([0.3, 0.8], [0, 0.2, 0, 0.2]).translate([-0.45, -0.15]),
      rounded_rectangle([0.3, 0.3], 0.08).translate([0.3, 0.6]),
      rounded_rectangle([0.3, 0.3], 0.08).translate([-0.3, 0.3]),
    ).translate([0, -0.3]),
  },
  {
    title: 'smooth blob (3 个圆软并)',
    code: 'circle.union(circle.k(0.2), circle.k(0.2))',
    sdf: circle(0.55).translate([-0.4, 0]).union(
      circle(0.55).translate([0.4, 0]).k(0.2),
      circle(0.55).translate([0, 0.6]).k(0.2),
    ),
  },
];

// ---- 渲染：SDF → 色彩 ------------------------------------------------------

const W = 256, H = 256;
const VIEW = 1.6;                                         // 世界半宽（[-1.6, +1.6]）

// IQ 风格距离场上色：内蓝外红 + 0.1 色带 + 边界黑线
function shade(d) {
  const insideMix = 1 - Math.exp(-Math.abs(d) * 4);       // 离边界越远越饱和
  const inside = d < 0;
  const band = 0.7 + 0.3 * Math.cos(d * Math.PI * 10);    // 每 0.2 单位一对带
  let r, g, b;
  if (inside) {
    r = 0.30 + 0.25 * insideMix * band;
    g = 0.45 + 0.25 * insideMix * band;
    b = 0.65 + 0.25 * insideMix * band;
  } else {
    r = 0.65 + 0.25 * insideMix * band;
    g = 0.45 + 0.25 * insideMix * band;
    b = 0.30 + 0.25 * insideMix * band;
  }
  // 边界黑线（fwidth 模拟：在距离接近 0 处暗一下）
  const edge = 1 - Math.exp(-Math.abs(d) * 200);
  r *= edge; g *= edge; b *= edge;
  return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
}

function renderPanel(sdf, canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // 像素坐标 → 世界坐标，y 翻转使 +Y 朝上
      const wx = (x / W) * 2 * VIEW - VIEW;
      const wy = -((y / H) * 2 * VIEW - VIEW);
      const d = sdf([wx, wy]);
      const [r, g, b] = shade(d);
      const i = (y * W + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---- DOM 装配 -------------------------------------------------------------

const grid = document.getElementById('grid');
const items = panels.map((p) => {
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
  for (const item of items) {
    item.stats.textContent = 'rendering…';
    await new Promise((r) => requestAnimationFrame(r));
    const t0 = performance.now();
    renderPanel(item.spec.sdf, item.canvas);
    item.stats.textContent = `${W}×${H} · ${(performance.now() - t0).toFixed(0)} ms`;
  }
})();
