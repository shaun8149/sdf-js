// =============================================================================
// pdf-mapping-demo.js — PDF → SlideData → SceneData → 3D, end-to-end
// -----------------------------------------------------------------------------
// Loads pre-baked SlideData[] (parsed from sdf-js/fixtures/test-deck.pdf via
// scripts/bake-slidedata.mjs), runs M1.5 mapSlideToScene on each, compiles
// the resulting SceneData, and raymarches it into a canvas panel.
//
// This is the M1.5 stun demo: zero authoring between a 20-slide PowerPoint
// and a wall of 3D charts. The whole pipeline is automatic.
//
// Open: http://localhost:8001/examples/sdf/pdf-mapping-demo.html
// =============================================================================

import '../../src/sdf/index.js';

import { mapSlideToScene } from '../../src/mapping/slide-to-scene.js';
import { compile } from '../../src/scene/compile.js';
import * as v from '../../src/sdf/vec.js';

const W = 192,
  H = 192;

// ---- Load + map -------------------------------------------------------------

const slides = await fetch('./pdf-mapping-data.json').then((r) => r.json());

// Map every slide; surface what pattern + what subjects the mapper produced.
const panels = slides.map((slide) => {
  const { scene, pattern, confidence } = mapSlideToScene(slide);
  // compile() warns to console on sanity issues; silence by disabling for
  // this demo (these auto-built scenes are minimal + not author-curated).
  const compiled = compile(scene, { sanity: false });
  return { slide, scene, pattern, confidence, compiled };
});

// ---- Raymarcher -------------------------------------------------------------
// Camera is per-scene: the mapper sets scene.defaults.camera.distance based on
// pattern (10-bar percent-list needs farther pullback than a cover slide).
// We honor that here instead of using one fixed camPos for all panels.

const lightDir = v.normalize([0.55, 0.7, -0.45]);
const bgTop = [10, 12, 18];
const bgBot = [22, 26, 36];

// Build a viewRotate from a scene's compiled camera. Atlas camera convention:
//   distance: pullback along -Z
//   yaw: rotate around Y (horizontal swing)
//   pitch: rotate around X (vertical tilt; positive looks down)
//   targetY: lift origin so target sits at visual center
function makeViewRotate(cam) {
  return (sdf) =>
    sdf
      .translate([0, -(cam.targetY || 0), 0])
      .rotate(cam.yaw || 0, v.Y)
      .rotate(-(cam.pitch || 0), v.X);
}

function raymarch(sdf, ro, rd) {
  let t = 0;
  for (let i = 0; i < 96; i++) {
    const p = v.add(ro, v.mul(rd, t));
    const d = sdf(p);
    if (d < 0.001) return [t, p];
    t += d;
    if (t > 80) return null;
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

function shade(sdf, hit, tint) {
  if (!hit) return null;
  const n = gradient(sdf, hit[1]);
  const lambert = Math.max(0, v.dot(n, lightDir));
  const ambient = 0.1;
  const k = ambient + (1 - ambient) * lambert;
  // Pattern-tinted shading: bar charts get warm tint, covers get cool.
  return [
    Math.floor(255 * k * (tint[0] + 0.4 * Math.abs(n[0]))),
    Math.floor(255 * k * (tint[1] + 0.4 * Math.abs(n[1]))),
    Math.floor(255 * k * (tint[2] + 0.4 * Math.abs(n[2]))),
  ];
}

function renderPanel(sdf, canvas, tint, cam) {
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const camPos = [0, 0, -(cam.distance || 6)];
  const focal = cam.focal || 1.25;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x / W) * 2 - 1;
      const w = (y / H) * 2 - 1;
      const rd = v.normalize([u, -w, focal]);
      const hit = raymarch(sdf, camPos, rd);
      const col = shade(sdf, hit, tint);
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

const PATTERN_TINTS = {
  'percent-list': [0.65, 0.45, 0.35], // warm orange
  cover: [0.4, 0.5, 0.65], // cool blue
  fallback: [0.5, 0.5, 0.55], // neutral
};

// ---- DOM assembly + async render --------------------------------------------

const grid = document.getElementById('grid');
const items = panels.map((p, i) => {
  const panel = document.createElement('div');
  panel.className = 'panel';
  const title = p.slide.title || '(untitled)';
  const subjects = p.scene.subjects.map((s) => s.type).join(' + ');
  const conf = (p.confidence * 100).toFixed(0);
  panel.innerHTML = `
    <h2>Slide ${i}: ${title}</h2>
    <code>${p.pattern} (${conf}%) → ${subjects}</code>
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
    const sdfFn = item.spec.compiled.sdf;
    const cam = item.spec.compiled.cameraStatic;
    const tint = PATTERN_TINTS[item.spec.pattern] || PATTERN_TINTS.fallback;
    const viewRotate = makeViewRotate(cam);
    renderPanel(viewRotate(sdfFn), item.canvas, tint, cam);
    item.stats.textContent = `${W}×${H} · ${(performance.now() - t0).toFixed(0)} ms · ${item.spec.pattern}`;
  }
})();
