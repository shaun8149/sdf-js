// =============================================================================
// deck-shader-windows.js — per-station shader switching for deck playback.
// -----------------------------------------------------------------------------
// WHY: the assembled deck is ONE world in ONE fragment shader. On Apple GPUs a
// shader's register budget is allocated for its worst-case path AT COMPILE
// TIME, so a 3-station deck shader runs at ~7fps even at 0.5× resolution while
// each station alone runs at ~54fps (and runtime bounding-sphere early-outs
// measurably change nothing — 2026-07-10 A/B). The fix must make the SHADER
// smaller, not the work-per-frame: render only the stations the camera can
// currently see.
//
// HOW: assembleDeck emits a window timeline (deckWindows) + sliceDeckWindow.
// This module compiles each window's slice to its own SDF, warms every shader
// through studio.precompile() while window 0 plays, and swaps programs with
// studio.swapSDF() as the presentation clock crosses each boundary (a cache
// hit — no clear, no clock reset, no visible hitch). If the user grabs the
// fly camera we fall back to the FULL world (the finale window's shader):
// slow but correct — a free camera can look anywhere.
// =============================================================================
import { applyStudioScene, expandAndCompile } from './apply-studio-scene.js';
import { sliceDeckWindow } from '../scene/assemble-deck.js';

/** First window whose end is still ahead of t (clamped to the last window). */
export function windowIndexAt(windows, t) {
  for (let i = 0; i < windows.length; i++) if (t < windows[i].end) return i;
  return windows.length - 1;
}

/**
 * @param opts.holdDuringWarmup  pause the opening frame until every window's
 *   program is compiled AND pipeline-warmed, then restart from t=0. The warm
 *   draws stall the main thread for seconds total — behind a static held
 *   frame that's invisible; mid-playback it would freeze the show. Pass
 *   false when something else already owns the clock (presenter mode opens
 *   HELD at t≈0, which hides the same stalls for free).
 */
export function attachDeckWindows(studio, scene, { holdDuringWarmup = true } = {}) {
  const windows = scene.deckWindows;
  if (!Array.isArray(windows) || windows.length < 2 || !studio.swapSDF) return null;

  // Window index → ground-unioned SDF. Compiled lazily (CPU-side, ~ms each);
  // the GPU program for each SDF lives in studio's programCache.
  const sdfCache = new Map();
  const sdfFor = (i) => {
    if (!sdfCache.has(i)) sdfCache.set(i, expandAndCompile(sliceDeckWindow(scene, windows[i])).sdf);
    return sdfCache.get(i);
  };

  // Initial load renders window 0's slice (NOT the giant full-world shader —
  // the whole point is that the full shader only ever runs during the finale).
  const first = applyStudioScene(studio, sliceDeckWindow(scene, windows[0]));
  sdfCache.set(0, first.sdf);
  let cur = 0;
  let stopped = false;

  if (holdDuringWarmup && studio.setSequencePaused) studio.setSequencePaused(true);

  const frames = (n) =>
    new Promise((r) => {
      const step = (k) => (k <= 0 ? r() : requestAnimationFrame(() => step(k - 1)));
      step(n);
    });

  // Warm the remaining windows in playback order — TWO passes, both hidden
  // behind the boot overlay (figure-core keeps it up until `warmed` resolves):
  //   1. precompile(): GLSL compile + link into the program cache. This is
  //      what KHR_parallel covers — but Metal still defers the expensive
  //      pipeline specialization past link AND past a token 1px draw.
  //   2. a real full-viewport draw per window via swapSDF (the clock is held,
  //      the overlay masks the geometry flicker), which is the only thing
  //      that verifiably builds the real pipeline. Without it, each window
  //      BOUNDARY paid a 0.7-2s first-draw stall mid-presentation.
  const warmed = (async () => {
    const t0 = performance.now();
    for (let i = 1; i < windows.length && !stopped; i++) {
      try {
        await studio.precompile(sdfFor(i));
      } catch (e) {
        console.warn('[deck-windows] precompile failed for window', i, e);
      }
    }
    for (let i = 1; i < windows.length && !stopped; i++) {
      studio.swapSDF(sdfFor(i));
      await frames(3); // wake() renders settle frames — one real draw lands
    }
    if (stopped) return;
    studio.swapSDF(sdfFor(0)); // back to the opening window
    await frames(3);
    if (holdDuringWarmup && studio.setSequenceTime) studio.setSequenceTime(0);
    console.log(
      `[deck-windows] ${windows.length} window shaders warmed in ${(performance.now() - t0).toFixed(0)}ms`,
    );
  })();

  const tick = () => {
    if (stopped) return;
    const freeCam = studio.isSequenceActive && !studio.isSequenceActive();
    const idx = freeCam
      ? windows.length - 1 // free-fly → full world (finale shader)
      : windowIndexAt(windows, studio.getPresentationTime ? studio.getPresentationTime() : 0);
    if (idx !== cur) {
      cur = idx;
      studio.swapSDF(sdfFor(idx));
    }
    requestAnimationFrame(tick);
  };
  // The boundary watcher starts only after warm-up — it must not fight the
  // warm cycle's program swaps (the clock is parked near 0 the whole time).
  warmed.then(() => {
    if (!stopped) requestAnimationFrame(tick);
  });

  return {
    detach: () => {
      stopped = true;
    },
    warmed,
  };
}
