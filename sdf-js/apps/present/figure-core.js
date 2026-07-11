// figure-core.js — the shared live-figure mount: studio renderer + boot loader
// + reveal-timed label overlay. Used by figure.js (?ir= / ?deck= viewer) and
// author.js (text → IR → deck). One mount per page.
import { createStudioRenderer } from '../../src/render/studio.js';
import { applyStudioScene } from '../../src/runtime/apply-studio-scene.js';
import { attachDeckWindows } from '../../src/runtime/deck-shader-windows.js';

/**
 * createFigure({ outdoor, stage }) → { studio, show(sceneData) }.
 * `show` may be called repeatedly (the author page regenerates in place) —
 * old overlay labels are removed and the new scene's sequence starts fresh.
 * `stage`: fighting-game stage lighting — the main directional light drops low
 * and rakes from the side, so the backdrop walls fall dark and the spotlight
 * rig (scene defaults.lights from stagePreset) carries the subject.
 * `present`: a presenter owns the sequence clock (it opens HELD at t≈0) — the
 * deck warm-up must not pause/restart the clock underneath it.
 */
export function createFigure({ outdoor = false, stage = false, present = false } = {}) {
  const wrap = document.getElementById('wrap');
  const canvas = document.getElementById('c');
  const size = () => {
    canvas.width = Math.max(1, wrap.clientWidth || window.innerWidth);
    canvas.height = Math.max(1, wrap.clientHeight || window.innerHeight);
  };
  size();

  // ---- FPS HUD + adaptive resolution -----------------------------------------
  // Live FPS readout (green ≥50 / amber ≥30 / red <30, ?fps=0 hides it) and a
  // laptop-GPU safety net: sustained <24fps drops the render scale a notch
  // (0.75× → 0.5× of canvas resolution), sustained >52fps climbs back. This is
  // damage control, not the fix — heavy multi-station decks need the per-station
  // shader work (see perf notes); the HUD exists so we SEE the problem.
  const fpsHud = document.createElement('div');
  fpsHud.style.cssText =
    'position:fixed;top:10px;right:12px;z-index:40;font:700 12px ui-monospace,monospace;' +
    'padding:3px 8px;border-radius:4px;background:rgba(14,15,18,0.72);pointer-events:none;';
  if (new URLSearchParams(location.search).get('fps') !== '0') document.body.appendChild(fpsHud);
  const SCALES = [1.0, 0.75, 0.5];
  let scaleIdx = 0;
  let lowStreak = 0;
  let highStreak = 0;
  // Adaptive grace period: the first seconds after a scene load are dominated
  // by driver shader compiles (deck decks warm up to 2N programs), which stall
  // rAF and read as "1 fps" — NOT a render-cost signal. Downshifting on those
  // samples parks the deck at 0.5× forever (the climb-back bar is high on
  // purpose). Ignore the adjuster until the load storm has passed.
  let adaptAfter = 0;
  const ADAPT_GRACE_MS = 5000;
  const onFps = (fps) => {
    fpsHud.textContent = `${fps.toFixed(0)} fps${scaleIdx ? ` · ${SCALES[scaleIdx]}×` : ''}`;
    fpsHud.style.color = fps >= 50 ? '#7fd77f' : fps >= 30 ? '#e8c35c' : '#f26d6d';
    if (performance.now() < adaptAfter) return;
    // Sub-3fps reads are main-thread stalls (shader compile, GC), not render
    // cost — lowering the resolution can't fix them, so they must not feed
    // the downshift streak.
    if (fps < 3) return;
    if (fps < 24 && scaleIdx < SCALES.length - 1) {
      if (++lowStreak >= 2) {
        scaleIdx++;
        lowStreak = 0;
        if (studio.setRenderScale) studio.setRenderScale(SCALES[scaleIdx]);
      }
    } else lowStreak = 0;
    if (fps > 52 && scaleIdx > 0) {
      if (++highStreak >= 4) {
        scaleIdx--;
        highStreak = 0;
        if (studio.setRenderScale) studio.setRenderScale(SCALES[scaleIdx]);
      }
    } else highStreak = 0;
  };

  const studio = createStudioRenderer({
    canvas,
    getControls: () => ({
      lightAzim: stage ? 1.15 : 0.5,
      lightAlt: stage ? 0.32 : 0.7,
      lightDist: 30,
      fov: 1.5,
      shadowsOn: true,
      // Outdoor envs bring their own terrain — the studio's flat ground plane
      // + checker must be off or they slice through the landscape.
      groundOn: !outdoor,
      checkerOn: !outdoor,
    }),
    onFps,
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
  let stageItems = []; // narrative layer: titles + bullets, screen-space
  let stageEls = [];
  let detachDeckWindows = null;
  let deckWarming = false; // keep the boot loader up while window shaders warm
  const loading = document.getElementById('loading');

  function show(scene) {
    for (const el of els) {
      if (el._lead) el._lead.remove();
      el.remove();
    }
    for (const el of stageEls) el.remove();
    stageEls = [];
    // Two text layers, HARD split (user-locked 2026-07-11):
    //   • narrative (title / screen bullets) → the STAGE LAYER: pure screen-
    //     space typography on its own canvas — big, composed, never projected.
    //     The 3D world tells the story; it does not carry sentences.
    //   • data labels (value / card) → the ANCHOR LAYER: projected onto the
    //     geometry they measure, depth-scaled. Numbers live with their shapes.
    const all = (scene.overlay || []).filter((o) => o.text);
    items = all.filter((o) => o.anchor && (o.role === 'value' || o.role === 'card'));
    els = items.map((o) => {
      const d = document.createElement('div');
      d.className = 'lbl' + (o.role === 'value' ? ' value' : '');
      // Numeric value chips COUNT UP over ~0.8s after their reveal — numbers
      // that arrive read as data landing, not captions appearing.
      if (o.role === 'value' && /^[\d,]+$/.test(o.text)) {
        o._countTarget = Number(o.text.replace(/,/g, ''));
      }
      d.textContent = o.text;
      document.body.appendChild(d);
      return d;
    });
    stageItems = all
      .filter((o) => o.role === 'title' || o.role === 'screen')
      .map((o) => ({ ...o, revealAt: o.revealAt ?? 0 }))
      .sort((a, b) => a.revealAt - b.revealAt);
    // Chapters: each title OWNS the stage until the next title (in a deck,
    // titles arrive at their station's start — assembleDeck shifts revealAt).
    // Bullets show inside their chapter only, so a station's list clears the
    // stage when the camera slings away.
    {
      let ch = -1;
      for (const o of stageItems) {
        if (o.role === 'title') ch++;
        o._ch = ch;
      }
    }
    stageEls = stageItems.map((o) => {
      const d = document.createElement('div');
      d.className = o.role === 'title' ? 'stage-title' : 'stage-bullet';
      d.textContent = o.text;
      document.body.appendChild(d);
      return d;
    });
    window.__figReplay = () => studio.setSequence(scene.cameraSequence);
    // Deck scenes carry a window timeline — play them through the per-station
    // shader switcher (the giant full-world shader would run at single-digit
    // fps on laptop GPUs; see deck-shader-windows.js). Single-structure scenes
    // keep the one-shot path: applyStudioScene wires setSequence + setAnimated
    // (subject.animation counts as time content) — no manual overrides needed.
    // Re-show() (author regenerates in place) must detach the old watcher
    // first or two rAF loops would fight over programs.
    if (detachDeckWindows) {
      detachDeckWindows();
      detachDeckWindows = null;
    }
    adaptAfter = performance.now() + ADAPT_GRACE_MS;
    lowStreak = 0;
    highStreak = 0;
    const loadingMsg = loading && loading.querySelector('.msg');
    const dw = attachDeckWindows(studio, scene, {
      holdDuringWarmup: !present,
      // boundary swaps can stall the driver briefly — those samples are not a
      // render-cost signal, so the adaptive scaler sits out a grace window
      onSwap: () => {
        adaptAfter = Math.max(adaptAfter, performance.now() + 2500);
        lowStreak = 0;
      },
      // A 10-station deck warms ~20s behind the boot overlay. Without visible
      // progress that reads as a hang — the counter is what makes it a load.
      onProgress: (done, total) => {
        if (loadingMsg) loadingMsg.textContent = `warming shaders ${done}/${total}`;
      },
    });
    if (dw) {
      detachDeckWindows = dw.detach;
      deckWarming = true;
      dw.warmed.then(() => {
        deckWarming = false;
        // The warm stalls also polluted the fps counter — restart the grace
        // clock so the adaptive scaler judges real playback frames only.
        adaptAfter = performance.now() + ADAPT_GRACE_MS;
      });
    } else {
      applyStudioScene(studio, scene);
    }
  }

  function tick() {
    // Dismiss the boot loader on the first drawn frame (the async shader
    // compile keeps the main thread free, so the spinner animates while we wait).
    if (
      loading &&
      !loading.classList.contains('done') &&
      !deckWarming &&
      studio.hasDrawn &&
      studio.hasDrawn()
    ) {
      loading.classList.add('done');
    }
    const t = studio.getSequenceTime ? studio.getSequenceTime() : 1e9;
    // Stage layer (screen-space narrative): show the current chapter's title
    // big and composed, and slide its bullets in as their beats pass. Pure 2D
    // typography — never projected, never fighting the 3D frame.
    {
      let curCh = -1;
      for (const o of stageItems)
        if (o.role === 'title' && o.revealAt <= t + 0.02 && o._ch > curCh) curCh = o._ch;
      let slot = 0;
      let lastOn = -1;
      for (let i = 0; i < stageItems.length; i++) {
        const o = stageItems[i];
        // hideAt (set by assembleDeck = the station's end) clears the outgoing
        // station's words during the transit flight; the chapter test keeps
        // seeks honest in both directions.
        const on =
          o._ch === curCh && o.revealAt <= t + 0.02 && (o.hideAt == null || t < o.hideAt);
        if (o.role === 'screen' && on) {
          stageEls[i].style.top = `calc(26vh + ${slot} * 9.5vh)`;
          slot++;
          lastOn = i;
        }
        stageEls[i].classList.toggle('on', on);
      }
      // The camera and the words move as ONE: the beat the camera is visiting
      // reads at full strength, spoken-already lines fall back. (`cur` is the
      // latest revealed subtitle — reveal times are beat-synced by design.)
      for (let i = 0; i < stageItems.length; i++)
        if (stageItems[i].role === 'screen')
          stageEls[i].classList.toggle('cur', i === lastOn);
    }
    // Pass 1: project + opacity/count-up; collect visible labels for layout.
    const placedRects = []; // near labels claim space first
    const visible = [];
    for (let i = 0; i < items.length; i++) {
      const o = items[i],
        el = els[i];
      const p = studio.project(o.anchor);
      if (!p || !p.visible) {
        el.style.opacity = 0;
        if (el._lead) el._lead.style.opacity = 0;
        continue;
      }
      // Distance falloff: labels stay crisp near the camera, fade with depth so
      // wide/deck shots don't pile every station's text on screen. Titles keep
      // a longer reach (they ARE the far signpost).
      const reach = o.role === 'title' ? 60 : 22;
      const depthFade =
        p.depth == null ? 1 : Math.max(0, Math.min(1, (reach - p.depth) / (reach * 0.45)));
      const opacity = (o.revealAt == null || t >= o.revealAt ? 1 : 0) * depthFade;
      el.style.opacity = opacity;
      // Depth-scaled type: data labels grow as the camera approaches the
      // geometry they measure — numbers live WITH their shapes. Quantized +
      // write-on-change so the per-frame style churn stays near zero.
      if (p.depth != null) {
        const base = 13;
        const fs =
          Math.round(Math.max(9, Math.min(base * (6.2 / Math.max(p.depth, 0.6)), base * 2.1)) * 2) /
          2;
        if (el._fs !== fs) {
          el._fs = fs;
          el.style.fontSize = `${fs}px`;
        }
      }
      if (o._countTarget != null && o.revealAt != null) {
        const k = Math.max(0, Math.min(1, (t - o.revealAt) / 0.8));
        const eased = 1 - (1 - k) * (1 - k); // ease-out: fast start, settle on the number
        const v = Math.round(o._countTarget * eased);
        const shown = k >= 1 ? o.text : v.toLocaleString('en-US');
        if (el.textContent !== shown) el.textContent = shown;
      }
      if (opacity > 0.02) visible.push({ o, el, p, depth: p.depth ?? 0 });
      else if (el._lead) el._lead.style.opacity = 0;
    }
    // Pass 2: collision layout, near-first (near labels keep their spot; far
    // ones step DOWN in 30px slots until clear). A displaced label gets a thin
    // leader line back up to its anchor so it never floats ambiguously.
    visible.sort((a, b) => a.depth - b.depth);
    for (const v of visible) {
      const x = v.p.x * canvas.clientWidth;
      let y = v.p.y * canvas.clientHeight;
      const w = v.el.offsetWidth || 60;
      const h = v.el.offsetHeight || 26;
      const collides = (yy) =>
        placedRects.some(
          (r) => Math.abs(x - r.x) * 2 < w + r.w + 6 && Math.abs(yy - r.y) * 2 < h + r.h + 4,
        );
      let shift = 0;
      while (shift < 4 && collides(y)) {
        y += 30;
        shift++;
      }
      placedRects.push({ x, y, w, h });
      v.el.style.left = `${x}px`;
      v.el.style.top = `${y}px`;
      if (shift > 0) {
        if (!v.el._lead) {
          const lead = document.createElement('div');
          lead.style.cssText =
            'position:fixed;width:1px;background:rgba(255,255,255,0.45);pointer-events:none;transform:translateX(-50%);';
          document.body.appendChild(lead);
          v.el._lead = lead;
        }
        const anchorY = v.p.y * canvas.clientHeight;
        v.el._lead.style.left = `${x}px`;
        v.el._lead.style.top = `${anchorY}px`;
        v.el._lead.style.height = `${Math.max(0, y - anchorY - h / 2)}px`;
        v.el._lead.style.opacity = v.el.style.opacity;
      } else if (v.el._lead) {
        v.el._lead.style.opacity = 0;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return { studio, show };
}
