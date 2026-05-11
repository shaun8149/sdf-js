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
  render,
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
    title: 'rounded_rectangle, per-corner radii',
    code: 'rounded_rectangle([1.6,1], [0.4,0.05,0.05,0.4])',
    sdf: rounded_rectangle([1.6, 1], [0.4, 0.05, 0.05, 0.4]),
  },
  {
    title: 'hexagon(1)',
    code: 'hexagon(1).rotate(Math.PI / 6)',
    sdf: hexagon(1).rotate(Math.PI / 6),
  },
  {
    title: '5-point star (polygon)',
    code: 'polygon([10 alternating vertices])',
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
    title: 'triangle + circle, smooth union',
    code: 'triangle.union(circle.translate.k(0.15))',
    sdf: triangle([-0.8, -0.6], [0.8, -0.6], [0, 0.9])
      .union(circle(0.4).translate([0.7, 0.7]).k(0.15)),
  },
  {
    title: 'circle ∩ rectangle',
    code: 'circle(1).intersection(rectangle([1.6, 1]))',
    sdf: circle(1).intersection(rectangle([1.6, 1])),
  },
  {
    title: 'crescent (difference) — BOB preview',
    code: 'circle(0.7).difference(circle(0.7).translate([-0.25,0.1]))',
    sdf: circle(0.7).difference(circle(0.7).translate([-0.25, 0.1])),
  },
  {
    title: 'circular array of 8',
    code: 'circle(0.18).translate([0.7,0]).circular_array(8)',
    sdf: circle(0.18).translate([0.7, 0]).circular_array(8),
  },
  {
    title: 'shell of a hexagon',
    code: 'hexagon(1).shell(0.1)',
    sdf: hexagon(1).shell(0.1),
  },
  {
    title: 'BOB cactus, chained',
    code: 'union of 5 rounded_rectangles',
    sdf: union(
      rounded_rectangle([0.45, 1.6], [0, 0.3, 0, 0.3]),
      rounded_rectangle([0.3, 0.8], [0, 0.2, 0, 0.2]).translate([0.45, 0.15]),
      rounded_rectangle([0.3, 0.8], [0, 0.2, 0, 0.2]).translate([-0.45, -0.15]),
      rounded_rectangle([0.3, 0.3], 0.08).translate([0.3, 0.6]),
      rounded_rectangle([0.3, 0.3], 0.08).translate([-0.3, 0.3]),
    ).translate([0, -0.3]),
  },
  {
    title: 'smooth blob (3 circles soft-unioned)',
    code: 'circle.union(circle.k(0.2), circle.k(0.2))',
    sdf: circle(0.55).translate([-0.4, 0]).union(
      circle(0.55).translate([0.4, 0]).k(0.2),
      circle(0.55).translate([0, 0.6]).k(0.2),
    ),
  },
];

// ---- 渲染 ------------------------------------------------------------------
// IQ 风格距离场可视化全部在 render.bands 里。这里只指定画布尺寸 + 视野。

const W = 256, H = 256;

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
    render.bands(item.canvas.getContext('2d'), item.spec.sdf, { view: 1.6 });
    item.stats.textContent = `${W}×${H} · ${(performance.now() - t0).toFixed(0)} ms`;
  }
})();
