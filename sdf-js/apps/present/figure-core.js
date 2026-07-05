// figure-core.js — the shared live-figure mount: studio renderer + boot loader
// + reveal-timed label overlay. Used by figure.js (?ir= / ?deck= viewer) and
// author.js (text → IR → deck). One mount per page.
import { createStudioRenderer } from '../../src/render/studio.js';
import { applyStudioScene } from '../../src/runtime/apply-studio-scene.js';

/**
 * createFigure({ outdoor }) → { studio, show(sceneData) }.
 * `show` may be called repeatedly (the author page regenerates in place) —
 * old overlay labels are removed and the new scene's sequence starts fresh.
 */
export function createFigure({ outdoor = false } = {}) {
  const wrap = document.getElementById('wrap');
  const canvas = document.getElementById('c');
  const size = () => {
    canvas.width = Math.max(1, wrap.clientWidth || window.innerWidth);
    canvas.height = Math.max(1, wrap.clientHeight || window.innerHeight);
  };
  size();

  const studio = createStudioRenderer({
    canvas,
    getControls: () => ({
      lightAzim: 0.5,
      lightAlt: 0.7,
      lightDist: 30,
      fov: 1.5,
      shadowsOn: true,
      // Outdoor envs bring their own terrain — the studio's flat ground plane
      // + checker must be off or they slice through the landscape.
      groundOn: !outdoor,
      checkerOn: !outdoor,
    }),
    onFps: () => {},
  });
  window.addEventListener('resize', () => {
    size();
    if (studio.requestRender) studio.requestRender();
  });

  // test hooks (Playwright verification): replay restarts the fly-through;
  // pinning setSequenceTime in a loop freezes a moment for capture.
  window.__figStudio = studio;

  let items = [];
  let els = [];
  const loading = document.getElementById('loading');

  function show(scene) {
    for (const el of els) el.remove();
    // Reveal-timed overlay: labels fade in as the sequence clock passes each
    // item's revealAt (makeOverlay isn't reused — it has no reveal timing).
    items = (scene.overlay || []).filter((o) => o.anchor && o.text);
    els = items.map((o) => {
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
    window.__figReplay = () => studio.setSequence(scene.cameraSequence);
    // applyStudioScene wires setSequence + setAnimated (subject.animation counts
    // as time content) — no manual overrides needed.
    applyStudioScene(studio, scene);
  }

  function tick() {
    // Dismiss the boot loader on the first drawn frame (the async shader
    // compile keeps the main thread free, so the spinner animates while we wait).
    if (loading && !loading.classList.contains('done') && studio.hasDrawn && studio.hasDrawn()) {
      loading.classList.add('done');
    }
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
      // Distance falloff: labels stay crisp near the camera, fade with depth so
      // wide/deck shots don't pile every station's text on screen. Titles keep
      // a longer reach (they ARE the far signpost).
      const reach = o.role === 'title' ? 60 : 22;
      const depthFade =
        p.depth == null ? 1 : Math.max(0, Math.min(1, (reach - p.depth) / (reach * 0.45)));
      el.style.opacity = (o.revealAt == null || t >= o.revealAt ? 1 : 0) * depthFade;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return { studio, show };
}
