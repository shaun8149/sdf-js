// =============================================================================
// present-mode.js — Atlas Present Canvas Mode fullscreen playback
// -----------------------------------------------------------------------------
// Compiles deck.canvas ONCE, mounts renderer ONCE, then tweens camera between
// waypoints on ←→ keys. No scene rebuild between waypoints — the canvas is
// persistent (Prezi-style).
//
// Camera is LOCKED (no drag / WASD). Renderer LOCKED to deck.theme.renderer.
// =============================================================================

import * as deckModel from './deck-model.js';
import { createRendererForId, compileScene, sphericalToCamState } from '../compositor-api.js';
import { tweenCamera, easeInOut, easeLinear } from './waypoint-tween.js';

let deck = null;
let waypointIdx = 0;
let renderer = null;
let canvas = null;
let cursorHideTimer = null;
let counterHideTimer = null;
let activeTween = null;
let _compiledSdf = null;

export async function mountPresentMode(target, deckId) {
  deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) {
    target.innerHTML = `<div class="page-pad">Deck not found: ${deckId}<br><a href="./">← Library</a></div>`;
    return;
  }
  if (deck.waypoints.length === 0) {
    target.innerHTML = `<div class="page-pad">Deck "${deck.title}" has no waypoints.<br><a href="./?deck=${deckId}">← Editor</a></div>`;
    return;
  }
  waypointIdx = 0;

  target.innerHTML = `
    <div class="present-stage" id="present-stage">
      <canvas id="present-canvas"></canvas>
      <div class="present-counter" id="present-counter"></div>
      <div class="present-exit-hint">Press <kbd>esc</kbd> to exit</div>
    </div>
  `;
  canvas = document.getElementById('present-canvas');
  fitCanvasToWindow();

  try {
    renderer = createRendererForId(deck.theme.renderer, canvas);
  } catch (e) {
    target.innerHTML = `<div class="page-pad">Renderer error (${deck.theme.renderer}): ${e.message}<br><a href="./?deck=${deckId}">← Editor</a></div>`;
    return;
  }

  // Compile canvas ONCE
  let compiled;
  try {
    compiled = compileScene(deck.canvas);
  } catch (e) {
    target.innerHTML = `<div class="page-pad">Canvas compile error: ${e.message}<br><a href="./?deck=${deckId}">← Editor</a></div>`;
    return;
  }
  _compiledSdf = compiled.sdf;

  // Fullscreen (best-effort)
  const params = new URLSearchParams(location.search);
  const skipFullscreen = params.get('nofs') === '1';
  if (!skipFullscreen) {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn('[present-mode] fullscreen blocked:', e.message);
    }
  }

  // Snap camera to waypoint 0 (no tween for initial frame)
  applyCamera(deck.waypoints[0].camera);
  renderCurrentFrame();
  updateCounter();

  resetCursorHide();
  document.addEventListener('mousemove', resetCursorHide);
  document.addEventListener('keydown', handleKey);
  canvas.addEventListener('click', goNext);
  window.addEventListener('resize', () => {
    fitCanvasToWindow();
    renderCurrentFrame();
  });
}

function fitCanvasToWindow() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function applyCamera(cam) {
  if (renderer && renderer.setCamState) {
    renderer.setCamState(sphericalToCamState(cam));
  }
}

function renderCurrentFrame() {
  if (!renderer || !_compiledSdf) return;
  try {
    if (deck.theme.renderer === 'silhouette') {
      renderer.render([{ sdf: _compiledSdf, color: [200, 200, 200], stroke: 0 }], {
        background: [13, 13, 13],
      });
    } else {
      renderer.render(_compiledSdf);
    }
  } catch (e) {
    console.error('[present-mode] render failed:', e);
  }
}

function updateCounter() {
  const el = document.getElementById('present-counter');
  if (!el) return;
  el.textContent = `${waypointIdx + 1} / ${deck.waypoints.length}`;
  el.classList.remove('hidden');
  if (counterHideTimer) clearTimeout(counterHideTimer);
  counterHideTimer = setTimeout(() => el.classList.add('hidden'), 2000);
}

function resetCursorHide() {
  document.body.style.cursor = '';
  if (cursorHideTimer) clearTimeout(cursorHideTimer);
  cursorHideTimer = setTimeout(() => {
    document.body.style.cursor = 'none';
  }, 2000);
}

function startTweenToWaypoint(targetIdx) {
  if (targetIdx < 0 || targetIdx >= deck.waypoints.length) return;
  if (activeTween) {
    activeTween.cancel();
    activeTween = null;
  }
  const fromCam = deck.waypoints[waypointIdx].camera;
  const toCam = deck.waypoints[targetIdx].camera;
  waypointIdx = targetIdx;
  updateCounter();

  const easingFn = deck.tween.easing === 'linear' ? easeLinear : easeInOut;
  activeTween = tweenCamera(fromCam, toCam, {
    durationMs: deck.tween.durationMs,
    easing: easingFn,
    onFrame: (cam) => {
      applyCamera(cam);
      renderCurrentFrame();
    },
    onComplete: () => {
      activeTween = null;
    },
  });
}

function goNext() {
  if (waypointIdx < deck.waypoints.length - 1) {
    startTweenToWaypoint(waypointIdx + 1);
  }
}

function goPrev() {
  if (waypointIdx > 0) {
    startTweenToWaypoint(waypointIdx - 1);
  }
}

function goFirst() {
  if (waypointIdx !== 0) startTweenToWaypoint(0);
}

function goLast() {
  if (waypointIdx !== deck.waypoints.length - 1) startTweenToWaypoint(deck.waypoints.length - 1);
}

async function exitPresent() {
  if (activeTween) {
    activeTween.cancel();
    activeTween = null;
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch (e) {
    /* ignore */
  }
  location.search = `?deck=${deck.id}`;
}

function handleKey(e) {
  switch (e.key) {
    case 'ArrowRight':
    case ' ':
    case 'PageDown':
      e.preventDefault();
      goNext();
      break;
    case 'ArrowLeft':
    case 'PageUp':
      e.preventDefault();
      goPrev();
      break;
    case 'Home':
      e.preventDefault();
      goFirst();
      break;
    case 'End':
      e.preventDefault();
      goLast();
      break;
    case 'Escape':
      e.preventDefault();
      exitPresent();
      break;
    default:
      break;
  }
}
