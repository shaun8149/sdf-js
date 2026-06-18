// =============================================================================
// grid-layout visual verify — compose atoms via grid positions
// -----------------------------------------------------------------------------
// 3 panels demonstrating gridLayout() composing different atom sets:
//   1. 2×2 KPI dashboard (kpi-card-3d)
//   2. 3×3 business icon grid (one icon per cell)
//   3. 1×4 pie chart strip (pie-3d donuts in a row)
// =============================================================================

import '../../src/sdf/index.js';
import { gridLayout } from '../../src/scene/grid-layout.js';
import { kpiCard3dSDF } from '../../src/scene/components/charts/data/kpi-card-3d.js';
import { businessIconSDF, ICON_NAMES } from '../../src/scene/components/icons/business.js';
import { pie3dSDF } from '../../src/scene/components/charts/data/pie-3d.js';
import * as v from '../../src/sdf/vec.js';

const W = 192,
  H = 192;

// ---- Composition: union N atoms at grid positions ---------------------------

function composeGrid(positions, makeAtomAt) {
  let scene = null;
  positions.forEach((pos, i) => {
    const atom = makeAtomAt(i, pos).translate([pos.x, pos.y, pos.z]);
    scene = scene ? scene.union(atom) : atom;
  });
  return scene;
}

// ---- Panel 1: 2×2 KPI dashboard --------------------------------------------

const kpiPositions = gridLayout({
  cols: 2,
  rows: 2,
  cellWidth: 1.6,
  cellHeight: 1.0,
  spacing: 0.2,
});
const kpiScene = composeGrid(kpiPositions, () =>
  kpiCard3dSDF({ width: 1.4, height: 0.85, depth: 0.15, cornerRadius: 0.1 }),
);

// ---- Panel 2: 3×3 icon grid (use first 9 of 10 icons) ----------------------

const iconPositions = gridLayout({
  cols: 3,
  rows: 3,
  cellWidth: 0.7,
  cellHeight: 0.7,
  spacing: 0.2,
});
const iconScene = composeGrid(iconPositions, (i) =>
  businessIconSDF({ name: ICON_NAMES[i] ?? 'check', size: 0.55, thickness: 0.08, depth: 0.1 }),
);

// ---- Panel 3: 1×4 pie chart strip ------------------------------------------

const piePositions = gridLayout({
  cols: 4,
  rows: 1,
  cellWidth: 0.9,
  cellHeight: 0.9,
  spacing: 0.15,
});
const pieValuesSets = [
  [40, 30, 20, 10],
  [25, 25, 25, 25],
  [60, 25, 15],
  [50, 30, 15, 5],
];
const pieScene = composeGrid(piePositions, (i) =>
  pie3dSDF({
    values: pieValuesSets[i],
    outerRadius: 0.4,
    innerRadius: i === 0 ? 0 : 0.15,
    thickness: 0.15,
  }),
);

const panels = [
  {
    title: '2×2 KPI dashboard (4 kpi-card-3d)',
    code: 'gridLayout({cols:2, rows:2})',
    sdf: kpiScene,
  },
  {
    title: '3×3 business icon grid (9 icons)',
    code: 'gridLayout({cols:3, rows:3})',
    sdf: iconScene,
  },
  {
    title: '1×4 pie chart strip (donut row)',
    code: 'gridLayout({cols:4, rows:1})',
    sdf: pieScene,
  },
];

// ---- Raymarcher (shared template) -------------------------------------------

const camPos = [0, 0, -6.0];
const focal = 1.5;
const lightDir = v.normalize([0.55, 0.7, -0.45]);
const bgTop = [10, 12, 18];
const bgBot = [22, 26, 36];

const viewRotate = (sdf) => sdf.rotate(0.3, v.Y).rotate(-0.3, v.X);

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
  const ambient = 0.12;
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
