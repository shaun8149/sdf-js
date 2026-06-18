// =============================================================================
// pyramid-3d visual verify — 6 parametric variants, pure-JS raymarcher
// -----------------------------------------------------------------------------
// Standalone visual sanity for Atlas first chart atom (P0). Mirrors the
// 3d.html template. Each panel is one pyramid3dSDF call with different
// args — verifies levels / taper / gap / depth all wire through.
//
// Open: http://localhost:8001/examples/sdf/pyramid-3d-test.html
// =============================================================================

// Side-effect import: triggers d3.js / d2.js to register chainable ops
// (rotate / translate / union / etc.) on SDF3.prototype. Without this, atoms
// returned via SDF3(fn) only have .k() and .f() — chains like .rotate() throw
// "is not a function".
import '../../src/sdf/index.js';

import { pyramid3dSDF } from '../../src/scene/components/charts/hierarchy/pyramid-3d.js';
import * as v from '../../src/sdf/vec.js';

const W = 192,
  H = 192;

const panels = [
  {
    title: '3-level KPI dashboard',
    code: '{levels:3, baseW:1.5, topW:0.5, layerH:0.4, gap:0.06}',
    sdf: pyramid3dSDF({
      levels: 3,
      baseWidth: 1.5,
      topWidth: 0.5,
      layerHeight: 0.4,
      gap: 0.06,
      depth: 0.5,
    }),
  },
  {
    title: '5-level (default Maslow style)',
    code: '{levels:5, baseW:2.0, topW:0.4, layerH:0.3, gap:0.05}',
    sdf: pyramid3dSDF(),
  },
  {
    title: '7-level stepped Mexican',
    code: '{levels:7, baseW:2.5, topW:0.4, layerH:0.25, gap:0.1}',
    sdf: pyramid3dSDF({
      levels: 7,
      baseWidth: 2.5,
      topWidth: 0.4,
      layerHeight: 0.25,
      gap: 0.1,
      depth: 0.7,
    }),
  },
  {
    title: '10-level tall narrow',
    code: '{levels:10, baseW:2.0, topW:0.2, layerH:0.2}',
    sdf: pyramid3dSDF({
      levels: 10,
      baseWidth: 2.0,
      topWidth: 0.2,
      layerHeight: 0.2,
      gap: 0.03,
      depth: 0.5,
    }),
  },
  {
    title: '1-level degenerate (single box)',
    code: '{levels:1, baseW:1.5, topW:1.5, layerH:1.0}',
    sdf: pyramid3dSDF({
      levels: 1,
      baseWidth: 1.5,
      topWidth: 1.5,
      layerHeight: 1.0,
      gap: 0,
      depth: 1.0,
    }),
  },
  {
    title: '20-level (max, smooth cone)',
    code: '{levels:20, baseW:2.5, topW:0.1, layerH:0.1, gap:0.01}',
    sdf: pyramid3dSDF({
      levels: 20,
      baseWidth: 2.5,
      topWidth: 0.1,
      layerHeight: 0.1,
      gap: 0.01,
      depth: 0.6,
    }),
  },
];

// ---- Raymarcher (copied from 3d-demo.js, same pattern) ----------------------

const camPos = [0, 0, -4.2];
const focal = 1.25;
const lightDir = v.normalize([0.55, 0.7, -0.45]);
const bgTop = [10, 12, 18];
const bgBot = [22, 26, 36];

const VIEW_YAW = 0.55;
const VIEW_PITCH = -0.35;
const viewRotate = (sdf) => sdf.rotate(VIEW_YAW, v.Y).rotate(VIEW_PITCH, v.X);

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

// ---- DOM assembly + async render --------------------------------------------

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
