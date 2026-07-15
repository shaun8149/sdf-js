// figure-core.js — the shared live-figure mount: studio renderer + boot loader
// + reveal-timed label overlay. Used by figure.js (?ir= / ?deck= viewer) and
// author.js (text → IR → deck). One mount per page.
import { createStudioRenderer } from '../../src/render/studio.js';
import { applyStudioScene } from '../../src/runtime/apply-studio-scene.js';
import { attachDeckWindows } from '../../src/runtime/deck-shader-windows.js';

// ---- 浮屏 (floating-screen) homography --------------------------------------
// A plate is a DOM <img> laid out at PLATE_PX_W×PLATE_PX_H and warped by a
// CSS matrix3d so its four corners land exactly on the projected corners of
// the in-world screen. Classic 2D projective transform via adjugates.
const PLATE_PX_W = 800;
const PLATE_PX_H = 600; // 4:3 — the 2013 source pages are 1600×1200
function adj3(m) {
  return [
    m[4] * m[8] - m[5] * m[7],
    m[2] * m[7] - m[1] * m[8],
    m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8],
    m[0] * m[8] - m[2] * m[6],
    m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6],
    m[1] * m[6] - m[0] * m[7],
    m[0] * m[4] - m[1] * m[3],
  ];
}
function mul33(a, b) {
  const c = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j];
      c[3 * i + j] = s;
    }
  return c;
}
function mul3v(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}
function basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4) {
  const m = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
  const v = mul3v(adj3(m), [x4, y4, 1]);
  return mul33(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}
/** matrix3d mapping the (0,0)-(w,h) box onto 4 screen-px corners (tl,tr,bl,br). */
function plateMatrix3d(w, h, tl, tr, bl, br) {
  const s = basisToPoints(0, 0, w, 0, 0, h, w, h);
  const d = basisToPoints(tl[0], tl[1], tr[0], tr[1], bl[0], bl[1], br[0], br[1]);
  const t = mul33(d, adj3(s));
  for (let i = 0; i < 9; i++) t[i] /= t[8];
  return `matrix3d(${t[0]},${t[3]},0,${t[6]},${t[1]},${t[4]},0,${t[7]},0,0,1,0,${t[2]},${t[5]},0,${t[8]})`;
}

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
export function createFigure({
  outdoor = false,
  stage = false,
  present = false,
  renderMode = 'analytic', // zero-march white model; 'stone'/'rich' = raymarch tiers
  lightRig = null, // {lightAzim, lightAlt, lightDist} override — long decks (theater
  // line spans ±90) need the key HIGH and FAR or the end acts leave the lit zone
  cleanFloor = false, // drop the studio checker (white-tone worlds want a bare floor)
} = {}) {
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
      lightAzim: lightRig?.lightAzim ?? (stage ? 1.15 : 0.5),
      lightAlt: lightRig?.lightAlt ?? (stage ? 0.32 : 0.7),
      lightDist: lightRig?.lightDist ?? 30,
      fov: 1.5,
      shadowsOn: true,
      // Outdoor envs bring their own terrain — the studio's flat ground plane
      // + checker must be off or they slice through the landscape.
      groundOn: !outdoor,
      checkerOn: !outdoor && !cleanFloor,
    }),
    onFps,
  });
  if (studio.setRenderMode) studio.setRenderMode(renderMode);
  window.addEventListener('resize', () => {
    size();
    if (studio.requestRender) studio.requestRender();
  });

  // test hooks (Playwright verification): replay restarts the fly-through;
  // pinning setSequenceTime in a loop freezes a moment for capture.
  window.__figStudio = studio;

  // ---- replay affordance (auto-play only) ------------------------------------
  // When the fly-through has played out, every window's shader is still warm in
  // the program cache — replay is a CLOCK reset (setSequenceTime(0)), not a
  // page reload: zero recompiles, zero re-warming. The deck-window watcher sees
  // t back inside window 0 and swaps its cached program like any boundary.
  // Presenter mode owns its own clock (Home restarts) — no button there.
  let replayable = false; // set per show(): finite, non-looping sequence only
  let replayShown = false;
  const replayBtn = document.createElement('button');
  replayBtn.id = 'replay-btn';
  replayBtn.textContent = '↻  Replay';
  replayBtn.style.cssText =
    'position:fixed;left:50%;bottom:12%;transform:translateX(-50%);z-index:60;' +
    'font:600 15px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    'color:#f3f6fb;background:rgba(16,20,30,0.72);border:1px solid rgba(255,255,255,0.22);' +
    'padding:12px 26px;border-radius:999px;cursor:pointer;letter-spacing:0.04em;' +
    'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
    'opacity:0;pointer-events:none;transition:opacity 0.45s ease;';
  replayBtn.addEventListener('click', () => {
    if (studio.setSequenceTime) studio.setSequenceTime(0);
    setPaused(false); // replay always resumes — a paused replay reads as "broken"
  });
  if (!present) document.body.appendChild(replayBtn);

  // ---- pause / resume (auto-play only) ---------------------------------------
  // Space or P freezes the fly-through in place (the one-clock engine freezes
  // build-ins + postfx with it, exactly like presenter mode's beat-hold). A
  // corner glyph confirms the state — pressing a key with no visible response
  // reads as "the key doesn't work" (user report 2026-07-15). Presenter mode
  // owns its own clock, so it never gets this handler.
  let paused = false;
  const pauseGlyph = document.createElement('div');
  pauseGlyph.id = 'pause-glyph';
  pauseGlyph.textContent = '❙❙';
  pauseGlyph.style.cssText =
    'position:fixed;left:22px;bottom:20px;z-index:60;' +
    'font:600 20px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    'color:#f3f6fb;background:rgba(16,20,30,0.6);border:1px solid rgba(255,255,255,0.2);' +
    'width:38px;height:38px;border-radius:50%;display:flex;align-items:center;' +
    'justify-content:center;letter-spacing:1px;pointer-events:none;' +
    'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
    'opacity:0;transition:opacity 0.25s ease;';
  if (!present) document.body.appendChild(pauseGlyph);
  function setPaused(p) {
    if (p === paused || !studio.setSequencePaused) return;
    paused = p;
    studio.setSequencePaused(p);
    pauseGlyph.style.opacity = p ? '1' : '0';
    if (!p && studio.requestRender) studio.requestRender(); // revive the loop on resume
  }
  if (!present) {
    window.addEventListener(
      'keydown',
      (e) => {
        // never fight a text field (prompt / api-key box)
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
          e.preventDefault(); // Space would otherwise scroll the page
          setPaused(!paused);
        }
      },
      true, // capture: win over any bubble-phase consumer (fly controls etc.)
    );
  }

  let items = [];
  let els = [];
  let stageItems = []; // narrative layer: titles + bullets, screen-space
  let stageEls = [];
  let plateItems = []; // 浮屏: page images perspective-mapped onto in-world screens
  let plateEls = [];
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
    for (const el of plateEls) el.remove();
    plateEls = [];
    // Two text layers, HARD split (user-locked 2026-07-11):
    //   • narrative (title / screen bullets) → the STAGE LAYER: pure screen-
    //     space typography on its own canvas — big, composed, never projected.
    //     The 3D world tells the story; it does not carry sentences.
    //   • data labels (value / card) → the ANCHOR LAYER: projected onto the
    //     geometry they measure, depth-scaled. Numbers live with their shapes.
    // 浮屏 plates: the ACTUAL source-page pixels, mounted on the in-world
    // screen by perspective-mapping a DOM <img> to the screen face's four
    // projected corners each frame — native-resolution crisp, zero shader
    // cost, and it moves with the world through every dolly.
    plateItems = (scene.overlay || []).filter((o) => o.role === 'plate' && o.image);
    plateEls = plateItems.map((o) => {
      const img = document.createElement('img');
      img.src = `../../scenes/${o.image}`;
      img.decoding = 'async';
      // layout box matches the WORLD quad's aspect (4:3 pages, 16:9 pages…)
      // so the homography never stretches pixels
      img._pxH = Math.round(PLATE_PX_W * ((o.h || 1) / (o.w || 1)));
      Object.assign(img.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: `${PLATE_PX_W}px`,
        height: `${img._pxH}px`,
        transformOrigin: '0 0',
        pointerEvents: 'none',
        zIndex: '6', // under every text layer — words outrank pixels
        opacity: '0',
        background: '#fff',
      });
      document.body.appendChild(img);
      return img;
    });
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
      // section color program: the value chip fills with its station's
      // chapter color (falls back to the stylesheet blue)
      if (o.role === 'value' && o.accentColor) d.style.background = o.accentColor;
      d.textContent = o.text;
      document.body.appendChild(d);
      return d;
    });
    stageItems = all
      .filter((o) => o.role === 'title' || o.role === 'screen' || o.role === 'insight')
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
      d.className =
        o.role === 'title'
          ? 'stage-title'
          : o.role === 'insight'
            ? 'stage-insight'
            : // overlay `side:'right'` opens the RIGHT narration column — a
              // comparison page needs its two sides' text in TWO places
              `stage-bullet${o.side === 'right' ? ' side-right' : ''}`;
      d.textContent = o.text;
      // insight panels carry a cited derivation line under the takeaway
      // (Rule 24: derived values name their parents)
      if (o.role === 'insight' && o.sub) {
        const sub = document.createElement('div');
        sub.className = 'sub';
        sub.textContent = o.sub;
        d.appendChild(sub);
      }
      if (o.role === 'insight' && o.accentColor) d.style.borderColor = o.accentColor;
      // chapter/finale cards own the mid-frame void instead of the corner
      if (o.role === 'insight' && o.panel === 'center') d.classList.add('center');
      document.body.appendChild(d);
      return d;
    });
    window.__figReplay = () => studio.setSequence(scene.cameraSequence);
    replayable = !!(scene.cameraSequence && !scene.cameraSequence.loop);
    replayShown = false;
    replayBtn.style.opacity = '0';
    replayBtn.style.pointerEvents = 'none';
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
    // Wave C: raymarch tiers lower qualifying modifiers to domain-rep (one
    // leaf per pattern); the analytic tier keeps expansion (rep/mirror are
    // outside its SUPPORTED set — lowering would drop whole frames to stone).
    const compileOpts = { lowerRepeats: renderMode !== 'analytic' };
    const dw = attachDeckWindows(studio, scene, {
      holdDuringWarmup: !present,
      compileOpts,
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
      applyStudioScene(studio, scene, compileOpts);
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
    // Replay button rises once the show has played past its end (and never
    // during the warm-up hold, whose clock is parked at ~0 anyway).
    if (!present && replayable) {
      const dur = studio.getSequenceDuration ? studio.getSequenceDuration() : 0;
      const done = dur > 0 && t >= dur - 0.02 && !deckWarming;
      if (done !== replayShown) {
        replayShown = done;
        replayBtn.style.opacity = done ? '1' : '0';
        replayBtn.style.pointerEvents = done ? 'auto' : 'none';
      }
    }
    // Stage layer (screen-space narrative): show the current chapter's title
    // big and composed, and slide its bullets in as their beats pass. Pure 2D
    // typography — never projected, never fighting the 3D frame.
    {
      let curCh = -1;
      for (const o of stageItems)
        if (o.role === 'title' && o.revealAt <= t + 0.02 && o._ch > curCh) curCh = o._ch;
      // two independent narration columns — each side stacks its own slots so a
      // comparison page reads as two facing lists, not one merged pile
      const slots = { left: 0, right: 0 };
      let lastOn = -1;
      for (let i = 0; i < stageItems.length; i++) {
        const o = stageItems[i];
        // hideAt (set by assembleDeck = the station's end) clears the outgoing
        // station's words during the transit flight; the chapter test keeps
        // seeks honest in both directions.
        const on = o._ch === curCh && o.revealAt <= t + 0.02 && (o.hideAt == null || t < o.hideAt);
        if (o.role === 'screen' && on) {
          const side = o.side === 'right' ? 'right' : 'left';
          stageEls[i].style.top = `calc(21vh + ${slots[side]} * 9.5vh)`;
          slots[side]++;
          lastOn = i;
        }
        stageEls[i].classList.toggle('on', on);
      }
      // The camera and the words move as ONE: the beat the camera is visiting
      // reads at full strength, spoken-already lines fall back. (`cur` is the
      // latest revealed subtitle — reveal times are beat-synced by design.)
      for (let i = 0; i < stageItems.length; i++)
        if (stageItems[i].role === 'screen') {
          const isCur = i === lastOn;
          stageEls[i].classList.toggle('cur', isCur);
          // the CURRENT line reads in the station's chapter color — the
          // subtitle column and the geometry share one palette
          stageEls[i].style.color =
            isCur && stageItems[i].accentColor ? stageItems[i].accentColor : '';
        }
    }
    // 浮屏 plates: warp each page image onto its screen's projected corners.
    for (let i = 0; i < plateItems.length; i++) {
      const o = plateItems[i];
      const el = plateEls[i];
      const shown = (o.revealAt == null || t >= o.revealAt) && (o.hideAt == null || t < o.hideAt);
      if (!shown) {
        el.style.opacity = '0';
        continue;
      }
      const [ax, ay, az] = o.anchor;
      const hw = o.w / 2;
      const hh = o.h / 2;
      // +x renders screen-LEFT → the screen-space top-left corner is world +x
      const tl = studio.project([ax + hw, ay + hh, az]);
      const tr = studio.project([ax - hw, ay + hh, az]);
      const bl = studio.project([ax + hw, ay - hh, az]);
      const br = studio.project([ax - hw, ay - hh, az]);
      // any corner behind the lens → drop the plate (project returns no depth
      // there and its x/y are garbage); off-FRAME corners are fine, CSS clips
      if (tl.depth == null || tr.depth == null || bl.depth == null || br.depth == null) {
        el.style.opacity = '0';
        continue;
      }
      const cw = canvas.clientWidth;
      const chh = canvas.clientHeight;
      el.style.transform = plateMatrix3d(
        PLATE_PX_W,
        el._pxH || PLATE_PX_H,
        [tl.x * cw, tl.y * chh],
        [tr.x * cw, tr.y * chh],
        [bl.x * cw, bl.y * chh],
        [br.x * cw, br.y * chh],
      );
      let k = o.revealAt != null ? Math.max(0, Math.min(1, (t - o.revealAt) / 0.5)) : 1;
      // fade out into the transit instead of popping off mid-frame
      if (o.hideAt != null) k *= Math.max(0, Math.min(1, (o.hideAt - t) / 0.4));
      el.style.opacity = String(k);
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
      // hideAt honored on the anchor layer too (R3: outgoing station's cards
      // and value chips must clear the screen during the transit flight)
      const shown = (o.revealAt == null || t >= o.revealAt) && (o.hideAt == null || t < o.hideAt);
      const opacity = (shown ? 1 : 0) * depthFade;
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
