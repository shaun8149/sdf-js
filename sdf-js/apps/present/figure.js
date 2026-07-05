// figure.js — standalone live "figure": one structure-rendered scene (IR → renderSequence)
// mounted in the studio, camera fly-through playing, labels fading in by sequence time.
// The embeddable unit of the structure-aware spatialization slice (P1). ?ir=<name> loads
// scenes/ir/<name>.json.
import { createStudioRenderer } from '../../src/render/studio.js';
import { applyStudioScene } from '../../src/runtime/apply-studio-scene.js';
import { renderSequence } from '../../src/scene/render-sequence.js';

const wrap = document.getElementById('wrap');
const canvas = document.getElementById('c');
function size() {
  canvas.width = Math.max(1, wrap.clientWidth || window.innerWidth);
  canvas.height = Math.max(1, wrap.clientHeight || window.innerHeight);
}
size();

const studio = createStudioRenderer({
  canvas,
  getControls: () => ({
    lightAzim: 0.5,
    lightAlt: 0.7,
    lightDist: 30,
    fov: 1.5,
    shadowsOn: true,
    groundOn: true,
    checkerOn: true,
  }),
  onFps: () => {},
});
window.addEventListener('resize', () => {
  size();
  if (studio.requestRender) studio.requestRender();
});

// test hooks (Playwright verification + future figure e2e tests): replay restarts
// the fly-through; pinning setSequenceTime in a loop freezes a moment for capture.
window.__figStudio = studio;
window.__figReplay = () => studio.setSequence(scene.cameraSequence);

const name = new URLSearchParams(location.search).get('ir') || 'funnel-sales';
const ir = await (await fetch(`../../scenes/ir/${name}.json`)).json();
const scene = renderSequence(ir);
// applyStudioScene wires setSequence + setAnimated (subject.animation counts as
// time content since the sceneHasTimeContent fix) — no manual overrides needed.
applyStudioScene(studio, scene);

// Our own reveal-timed overlay: labels fade in as the sequence clock passes each
// item's revealAt (makeOverlay isn't reused — it has no reveal timing).
const items = (scene.overlay || []).filter((o) => o.anchor && o.text);
const els = items.map((o) => {
  const d = document.createElement('div');
  d.className = 'lbl' + (o.role === 'value' ? ' value' : '');
  d.textContent = o.text;
  if (o.role === 'title') {
    d.style.fontSize = '20px';
    d.style.fontWeight = '900';
    d.style.background = 'none';
  }
  document.body.appendChild(d);
  return d;
});
function tick() {
  const t = studio.getSequenceTime ? studio.getSequenceTime() : 1e9;
  for (let i = 0; i < items.length; i++) {
    const o = items[i],
      el = els[i];
    const p = studio.project(o.anchor);
    if (!p || !p.visible) {
      el.style.opacity = 0;
      continue;
    }
    el.style.left = `${p.x * canvas.clientWidth}px`;
    el.style.top = `${p.y * canvas.clientHeight}px`;
    const revealed = o.revealAt == null || t >= o.revealAt;
    el.style.opacity = revealed ? 1 : 0;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
