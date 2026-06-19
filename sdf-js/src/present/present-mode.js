// =============================================================================
// present-mode.js — Atlas Present fullscreen playback
// -----------------------------------------------------------------------------
// Audience-facing UI: fullscreen, ←→/space/esc/home/end keys, cursor auto-hide,
// renderer LOCKED to deck.theme.renderer, camera LOCKED (no drag/WASD).
//
// ⚠️ DEPRECATED PPT-MODE IMPL — full rewrite in Plan Phase 5 (Canvas Mode pivot).
// Canvas Mode will compile canvas ONCE + tween camera between waypoints on key.
// Do NOT extend or "improve" this file. See plan
// docs/superpowers/plans/2026-06-19-atlas-present-canvas-mode-plan.md
// =============================================================================

import * as deckModel from './deck-model.js';
import { createRendererForId, compileScene } from '../compositor-api.js';

let deck = null;
let slideIdx = 0;
let renderer = null;
let canvas = null;
let cursorHideTimer = null;
let counterHideTimer = null;

export async function mountPresentMode(target, deckId) {
  deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) {
    target.innerHTML = `<div class="page-pad">Deck not found: ${deckId}<br><a href="./">← Library</a></div>`;
    return;
  }
  if (deck.slides.length === 0) {
    target.innerHTML = `<div class="page-pad">Deck "${deck.title}" has no slides.<br><a href="./?deck=${deckId}">← Editor</a></div>`;
    return;
  }
  slideIdx = 0;

  target.innerHTML = `
    <div class="present-stage" id="present-stage">
      <canvas id="present-canvas"></canvas>
      <div class="present-counter" id="present-counter"></div>
      <div class="present-exit-hint" id="present-exit-hint">Press <kbd>esc</kbd> to exit</div>
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

  // Try to enter fullscreen (requires user gesture in some browsers; suppress
  // error if blocked — present mode still works in a regular window).
  // Skip when `&nofs=1` is set (useful for headless testing / debugging).
  const skipFs = new URLSearchParams(location.search).get('nofs') === '1';
  if (!skipFs) {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn('[present-mode] fullscreen blocked:', e.message);
    }
  }

  // Hide cursor after 2s idle
  resetCursorHide();
  document.addEventListener('mousemove', resetCursorHide);

  // Key handlers
  document.addEventListener('keydown', handleKey);

  // Click anywhere → next
  canvas.addEventListener('click', goNext);

  // Window resize → refit canvas + re-render
  window.addEventListener('resize', () => {
    fitCanvasToWindow();
    renderCurrentSlide();
  });

  renderCurrentSlide();
  updateCounter();
}

function fitCanvasToWindow() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function renderCurrentSlide() {
  if (!deck || !renderer || !canvas) return;
  if (slideIdx < 0 || slideIdx >= deck.slides.length) return;
  const slide = deck.slides[slideIdx];
  try {
    const compiled = compileScene(slide.sceneData);
    if (deck.theme.renderer === 'silhouette') {
      const layers = [{ sdf: compiled.sdf, color: [200, 200, 200], stroke: 0 }];
      renderer.render(layers, { background: [13, 13, 13] });
    } else {
      renderer.render(compiled.sdf);
    }
  } catch (e) {
    console.error('[present-mode] render failed:', e);
  }
}

function updateCounter() {
  const el = document.getElementById('present-counter');
  if (!el) return;
  el.textContent = `${slideIdx + 1} / ${deck.slides.length}`;
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

function goNext() {
  if (slideIdx < deck.slides.length - 1) {
    slideIdx++;
    renderCurrentSlide();
    updateCounter();
  }
}

function goPrev() {
  if (slideIdx > 0) {
    slideIdx--;
    renderCurrentSlide();
    updateCounter();
  }
}

function goFirst() {
  slideIdx = 0;
  renderCurrentSlide();
  updateCounter();
}

function goLast() {
  slideIdx = deck.slides.length - 1;
  renderCurrentSlide();
  updateCounter();
}

async function exitPresent() {
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
