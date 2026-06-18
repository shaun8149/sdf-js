// =============================================================================
// cover-3d visual verify — 6 variants
// =============================================================================

import '../../src/sdf/index.js';
import { cover3dSDF } from '../../src/scene/components/presentation/cover-3d.js';
import * as v from '../../src/sdf/vec.js';

const W = 192,
  H = 192;

const panels = [
  { title: 'Default cover', code: '{4×2 stage + 2.5 backdrop}', sdf: cover3dSDF() },
  {
    title: 'Wide cinema (16:9)',
    code: '{stageW:5, backdropH:2.8}',
    sdf: cover3dSDF({ stageWidth: 5.0, backdropHeight: 2.8 }),
  },
  {
    title: 'Tall portrait',
    code: '{stageW:2, stageD:1, backdropH:4}',
    sdf: cover3dSDF({ stageWidth: 2.0, stageDepth: 1.0, backdropHeight: 4.0 }),
  },
  {
    title: 'Stage only (no backdrop)',
    code: '{backdropHeight: 0}',
    sdf: cover3dSDF({ backdropHeight: 0 }),
  },
  {
    title: 'Thick relief backdrop',
    code: '{backdropThickness: 0.5}',
    sdf: cover3dSDF({ backdropThickness: 0.5 }),
  },
  {
    title: 'Sharp corporate',
    code: '{cornerRadius: 0.02}',
    sdf: cover3dSDF({ cornerRadius: 0.02 }),
  },
];

const camPos = [0, 0, -8.0];
const focal = 1.5;
const lightDir = v.normalize([0.55, 0.7, -0.45]);
const bgTop = [10, 12, 18];
const bgBot = [22, 26, 36];

// Look at stage from the front with downward tilt to see the floor
const viewRotate = (sdf) => sdf.translate([0, -0.5, 0]).rotate(0.2, v.Y).rotate(-0.25, v.X);

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
