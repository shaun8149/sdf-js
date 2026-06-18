// =============================================================================
// column-3d visual verify — 6 parametric variants, pure-JS raymarcher
// -----------------------------------------------------------------------------
// Mirrors bar-3d-test pattern, but rotated (column = horizontal bar chart).
// =============================================================================

import '../../src/sdf/index.js';
import { column3dSDF } from '../../src/scene/components/charts/data/column-3d.js';
import * as v from '../../src/sdf/vec.js';

const W = 192,
  H = 192;

const panels = [
  {
    title: 'Top 5 regions (default)',
    code: '{values:[0.95, 0.8, 0.6, 0.55, 0.3]}',
    sdf: column3dSDF({ values: [0.95, 0.8, 0.6, 0.55, 0.3] }),
  },
  {
    title: 'Survey breakdown (3 wide rows)',
    code: '{values:[0.65, 0.25, 0.1], barW:0.6, gap:0.12}',
    sdf: column3dSDF({ values: [0.65, 0.25, 0.1], barWidth: 0.6, gap: 0.12 }),
  },
  {
    title: '8-phase project timeline',
    code: '{values:[0.3,0.6,1.0,0.8,0.5,0.9,0.4,0.7], barW:0.25}',
    sdf: column3dSDF({
      values: [0.3, 0.6, 1.0, 0.8, 0.5, 0.9, 0.4, 0.7],
      barWidth: 0.25,
      gap: 0.05,
    }),
  },
  {
    title: 'Single row (KPI)',
    code: '{values:[0.85], barW:0.8}',
    sdf: column3dSDF({ values: [0.85], barWidth: 0.8, barDepth: 0.8 }),
  },
  {
    title: 'Decreasing ranking (top is largest)',
    code: '[1.0, 0.7, 0.5, 0.3, 0.15]',
    sdf: column3dSDF({ values: [1.0, 0.7, 0.5, 0.3, 0.15], barWidth: 0.35, gap: 0.08 }),
  },
  {
    title: '15-row dense data',
    code: '15 values, barW:0.15, gap:0.03',
    sdf: column3dSDF({
      values: [0.4, 0.7, 0.5, 0.9, 0.6, 0.3, 0.8, 1.0, 0.55, 0.45, 0.75, 0.35, 0.65, 0.5, 0.25],
      barWidth: 0.15,
      gap: 0.03,
      maxHeight: 1.8,
    }),
  },
];

// ---- Raymarcher (shared template) -------------------------------------------

const camPos = [0, 0, -4.2];
const focal = 1.25;
const lightDir = v.normalize([0.55, 0.7, -0.45]);
const bgTop = [10, 12, 18];
const bgBot = [22, 26, 36];

const VIEW_YAW = 0.4;
const VIEW_PITCH = -0.3;
// column-3d is X-anchored at 0 growing right. Pull LEFT so chart is centered in frame.
const viewRotate = (sdf) =>
  sdf.translate([-1.0, 0, 0]).rotate(VIEW_YAW, v.Y).rotate(VIEW_PITCH, v.X);

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
  const ambient = 0.1;
  const k = ambient + (1 - ambient) * lambert;
  return [
    Math.floor(255 * k * (0.45 + 0.45 * Math.abs(n[0]))),
    Math.floor(255 * k * (0.45 + 0.45 * Math.abs(n[1]))),
    Math.floor(255 * k * (0.55 + 0.4 * Math.abs(n[2]))),
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
        data[i] = col[0];
        data[i + 1] = col[1];
        data[i + 2] = col[2];
      } else {
        const t = y / H;
        data[i] = bgTop[0] * (1 - t) + bgBot[0] * t;
        data[i + 1] = bgTop[1] * (1 - t) + bgBot[1] * t;
        data[i + 2] = bgTop[2] * (1 - t) + bgBot[2] * t;
      }
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

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
