// =============================================================================
// text-3d-test — visual verify for typography Wave 1 (digits + KPI symbols)
// -----------------------------------------------------------------------------
// 6 panels: every digit, the % symbol, a few common KPI strings.
// Pattern cloned from bar-3d-test / cover-3d-test. Each panel = one text3dExtrudedSDF.
//
// Open: http://localhost:8001/examples/sdf/text-3d-test.html
// =============================================================================

import '../../src/sdf/index.js';

import { text3dExtrudedSDF } from '../../src/scene/components/typography/text-3d.js';
import * as v from '../../src/sdf/vec.js';

const W = 256,
  H = 192;

const panels = [
  {
    title: 'Every digit',
    code: '"0123456789"',
    sdf: text3dExtrudedSDF({ text: '0123456789', height: 0.9 }),
  },
  { title: 'KPI: 90%', code: '"90%" h=1.4', sdf: text3dExtrudedSDF({ text: '90%', height: 1.4 }) },
  { title: 'KPI: 100%', code: '"100%"', sdf: text3dExtrudedSDF({ text: '100%', height: 1.2 }) },
  {
    title: 'Big symbol stack',
    code: '"%$+-."',
    sdf: text3dExtrudedSDF({ text: '%$+-.', height: 1.1 }),
  },
  {
    title: 'Mixed: $ + decimal',
    code: '"$3.14"',
    sdf: text3dExtrudedSDF({ text: '$3.14', height: 1.0 }),
  },
  {
    title: 'Thick stroke',
    code: '"42" sw=0.22 d=0.4',
    sdf: text3dExtrudedSDF({ text: '42', strokeWidth: 0.22, height: 1.6, depth: 0.4 }),
  },
];

// ---- Raymarcher -------------------------------------------------------------

const camPos = [0, 0, -3.5];
const focal = 1.5;
const lightDir = v.normalize([0.55, 0.7, -0.45]);
const bgTop = [10, 12, 18];
const bgBot = [22, 26, 36];

// Text sits in roughly y=0..height, depth ±0.1..0.2 along Z.
// Pull camera back, tilt slightly so we see depth.
const VIEW_YAW = 0.25;
const VIEW_PITCH = -0.3;
const viewRotate = (sdf) =>
  sdf.translate([0, -0.5, 0]).rotate(VIEW_YAW, v.Y).rotate(VIEW_PITCH, v.X);

function raymarch(sdf, ro, rd) {
  let t = 0;
  for (let i = 0; i < 96; i++) {
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
  const ambient = 0.15;
  const k = ambient + (1 - ambient) * lambert;
  return [
    Math.floor(255 * k * (0.5 + 0.4 * Math.abs(n[0]))),
    Math.floor(255 * k * (0.55 + 0.35 * Math.abs(n[1]))),
    Math.floor(255 * k * (0.6 + 0.3 * Math.abs(n[2]))),
  ];
}

function renderPanel(sdf, canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const data = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Wide panel: shrink x scaling so glyphs aren't squashed
      const aspect = W / H;
      const u = ((x / W) * 2 - 1) * aspect;
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
