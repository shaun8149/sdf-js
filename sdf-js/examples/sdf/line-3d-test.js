// =============================================================================
// line-3d visual verify — 6 parametric variants, pure-JS raymarcher
// -----------------------------------------------------------------------------

import '../../src/sdf/index.js';
import { line3dSDF } from '../../src/scene/components/charts/data/line-3d.js';
import * as v from '../../src/sdf/vec.js';

const W = 192,
  H = 192;

const panels = [
  {
    title: 'Default 6-point trend',
    code: '{values:[0.3,0.5,0.7,0.4,0.8,0.9]}',
    sdf: line3dSDF(),
  },
  {
    title: '12-month time-series',
    code: '12 values, spacing:0.25, marker:0.05',
    sdf: line3dSDF({
      values: [0.2, 0.3, 0.35, 0.5, 0.55, 0.6, 0.7, 0.85, 0.8, 0.9, 0.95, 1.0],
      pointSpacing: 0.25,
      pointRadius: 0.05,
      lineThickness: 0.03,
    }),
  },
  {
    title: 'Markers only (scatter)',
    code: '{lineThickness:0, pointRadius:0.12}',
    sdf: line3dSDF({
      values: [0.2, 0.7, 0.4, 0.9, 0.5],
      pointSpacing: 0.6,
      lineThickness: 0,
      pointRadius: 0.12,
    }),
  },
  {
    title: 'Line only (no markers)',
    code: '{pointRadius:0}',
    sdf: line3dSDF({
      values: [0.1, 0.3, 0.6, 0.4, 0.8, 0.5, 0.9],
      pointSpacing: 0.4,
      pointRadius: 0,
      lineThickness: 0.07,
    }),
  },
  {
    title: 'Closed pentagon (radar)',
    code: '{closed:true, 5 values}',
    sdf: line3dSDF({
      values: [0.7, 0.85, 0.6, 0.8, 0.65],
      pointSpacing: 0.45,
      pointRadius: 0.1,
      lineThickness: 0.05,
      closed: true,
    }),
  },
  {
    title: 'V-shape (drop + recovery)',
    code: '{values:[0.9,0.6,0.3,0.1,0.3,0.6,0.9]}',
    sdf: line3dSDF({
      values: [0.9, 0.6, 0.3, 0.1, 0.3, 0.6, 0.9],
      pointSpacing: 0.4,
      pointRadius: 0.08,
      lineThickness: 0.05,
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
const VIEW_PITCH = -0.35;
// line-3d points have Y = value*maxH (positive Y), so center the chart by
// pulling DOWN slightly.
const viewRotate = (sdf) =>
  sdf.translate([0, -1.0, 0]).rotate(VIEW_YAW, v.Y).rotate(VIEW_PITCH, v.X);

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
