// =============================================================================
// deck-editor.js — Atlas Present deck editor page
// -----------------------------------------------------------------------------
// 3-pane layout: slide list (left) + preview (center) + settings (right).
//
// ⚠️ DEPRECATED PPT-MODE IMPL — full rewrite in Plan Phase 4 (Canvas Mode pivot).
// New center pane will be a 3D canvas viewport with waypoint rail + atom palette.
// Do NOT extend or "improve" this file. See plan
// docs/superpowers/plans/2026-06-19-atlas-present-canvas-mode-plan.md
// -----------------------------------------------------------------------------
import * as deckModel from './deck-model.js';
import { createRendererForId, compileScene } from '../compositor-api.js';

let currentDeck = null;
let currentSlideIdx = -1;
let currentRenderer = null;
let currentCanvas = null;

export async function mountDeckEditor(target, deckId) {
  const deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) {
    target.innerHTML = `<div class="page-pad">Deck not found: ${deckId}<br><a href="./">← Library</a></div>`;
    return;
  }
  currentDeck = deck;
  currentSlideIdx = deck.slides.length > 0 ? 0 : -1;

  target.innerHTML = `
    <div class="topbar">
      <a href="./" class="btn-back">← Library</a>
      <div class="brand" style="margin-left: 16px;" id="editor-deck-title">${escapeHtml(deck.title)}</div>
      <div class="spacer"></div>
      <button id="btn-present-current">▶ Present</button>
    </div>
    <div class="editor-body">
      <aside class="slide-rail" id="slide-rail"></aside>
      <main class="preview-pane" id="preview-pane">
        <canvas id="preview-canvas" width="640" height="360"></canvas>
        <div class="preview-meta" id="preview-meta"></div>
      </main>
      <aside class="settings-pane" id="settings-pane"></aside>
    </div>
  `;
  document.getElementById('btn-present-current').addEventListener('click', () => {
    location.search = `?deck=${deck.id}&present=1`;
  });

  renderSlideRail();
  renderSettingsPane();
  renderPreview();
}

function renderSlideRail() {
  const rail = document.getElementById('slide-rail');
  rail.innerHTML = `
    ${currentDeck.slides
      .map(
        (s, i) => `
      <div class="slide-thumb ${i === currentSlideIdx ? 'selected' : ''}" data-idx="${i}" draggable="true">
        <div class="thumb-num">${i + 1}</div>
        <div class="thumb-title">${escapeHtml(s.title || `Slide ${i + 1}`)}</div>
      </div>
    `,
      )
      .join('')}
    <button class="btn-add-slide" id="btn-add-slide">+ Add Slide</button>
  `;
  rail.querySelectorAll('.slide-thumb').forEach((el) => {
    el.addEventListener('click', () => {
      currentSlideIdx = parseInt(el.dataset.idx, 10);
      renderSlideRail();
      renderSettingsPane();
      renderPreview();
    });
  });
  // Drag-to-reorder
  let draggedIdx = null;
  rail.querySelectorAll('.slide-thumb').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      draggedIdx = parseInt(el.dataset.idx, 10);
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(draggedIdx));
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      draggedIdx = null;
      rail.querySelectorAll('.slide-thumb').forEach((t) => t.classList.remove('drop-target'));
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drop-target');
    });
    el.addEventListener('dragleave', () => {
      el.classList.remove('drop-target');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop-target');
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIdx = parseInt(el.dataset.idx, 10);
      if (Number.isFinite(fromIdx) && Number.isFinite(toIdx) && fromIdx !== toIdx) {
        deckModel.moveSlide(currentDeck, fromIdx, toIdx);
        deckModel.saveDeckToStorage(currentDeck);
        currentSlideIdx = toIdx;
        renderSlideRail();
        renderSettingsPane();
        renderPreview();
      }
    });
  });
  document.getElementById('btn-add-slide')?.addEventListener('click', handleAddSlide);
}

function renderSettingsPane() {
  const pane = document.getElementById('settings-pane');
  const slide = currentSlideIdx >= 0 ? currentDeck.slides[currentSlideIdx] : null;
  const RENDERERS = ['studio', 'fly3d', 'silhouette'];
  pane.innerHTML = `
    <h3>Deck</h3>
    <div class="settings-row">
      <label>Renderer</label>
      <select id="select-renderer">
        ${RENDERERS.map((r) => `<option value="${r}" ${r === currentDeck.theme.renderer ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
    </div>
    <div class="settings-row meta">${currentDeck.slides.length} slides</div>

    ${
      slide
        ? `
      <h3 style="margin-top: 24px;">Slide ${currentSlideIdx + 1}</h3>
      <div class="settings-row">
        <label>Title</label>
        <input type="text" id="input-slide-title" value="${escapeHtml(slide.title || '')}" placeholder="(no title)" />
      </div>
      <div class="settings-row">
        <button id="btn-remove-slide">Remove Slide</button>
      </div>
    `
        : '<div class="settings-row meta" style="margin-top: 24px;">No slide selected. Add a slide to start.</div>'
    }
  `;
  document.getElementById('select-renderer')?.addEventListener('change', handleRendererChange);
  document.getElementById('input-slide-title')?.addEventListener('change', handleSlideTitleChange);
  document.getElementById('btn-remove-slide')?.addEventListener('click', handleRemoveSlide);
}

function renderPreview() {
  const canvas = document.getElementById('preview-canvas');
  const meta = document.getElementById('preview-meta');
  if (currentSlideIdx < 0 || !currentDeck.slides[currentSlideIdx]) {
    meta.textContent = 'No slide selected';
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText('Empty preview', 20, 30);
    return;
  }
  const slide = currentDeck.slides[currentSlideIdx];
  const rendererId = currentDeck.theme.renderer;
  meta.textContent = `Slide ${currentSlideIdx + 1} / ${currentDeck.slides.length} · ${rendererId}`;

  if (currentRenderer && currentCanvas === canvas && currentRenderer.__rendererId === rendererId) {
    try {
      renderSlideToCurrentRenderer(slide);
    } catch (e) {
      console.error('[deck-editor] preview render failed:', e);
      meta.textContent = `Render error: ${e.message}`;
    }
    return;
  }
  if (currentRenderer) {
    try {
      currentRenderer.unmount();
    } catch (e) {
      console.warn('[deck-editor] previous renderer unmount failed:', e);
    }
  }
  try {
    currentRenderer = createRendererForId(rendererId, canvas);
    currentRenderer.__rendererId = rendererId;
    currentCanvas = canvas;
    renderSlideToCurrentRenderer(slide);
  } catch (e) {
    console.error('[deck-editor] renderer create failed:', e);
    meta.textContent = `Renderer error (${rendererId}): ${e.message}`;
  }
}

function renderSlideToCurrentRenderer(slide) {
  const rendererId = currentDeck.theme.renderer;
  if (rendererId === 'silhouette') {
    const compiled = compileScene(slide.sceneData);
    const layers = [{ sdf: compiled.sdf, color: [200, 200, 200], stroke: 0 }];
    currentRenderer.render(layers, { background: [13, 13, 13] });
  } else {
    const compiled = compileScene(slide.sceneData);
    currentRenderer.render(compiled.sdf);
  }
}

// ---- Handlers ---------------------------------------------------------------

function handleAddSlide() {
  const demoId = prompt('Add slide from compositor demo id (e.g. "cube-3d-showcase"):');
  if (!demoId) return;
  loadDemoAndAddSlide(demoId);
}

async function loadDemoAndAddSlide(demoId) {
  try {
    const res = await fetch(`../compositor/demo-lifts/${demoId}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.sceneData) throw new Error('demo has no sceneData');
    deckModel.addSlide(currentDeck, {
      title: data.title || demoId,
      sceneData: data.sceneData,
      source: { type: 'compositor-demo', refId: demoId, addedAt: Date.now() },
    });
    deckModel.saveDeckToStorage(currentDeck);
    currentSlideIdx = currentDeck.slides.length - 1;
    renderSlideRail();
    renderSettingsPane();
    renderPreview();
  } catch (e) {
    alert(`Failed to add slide: ${e.message}`);
  }
}

function handleRendererChange(e) {
  currentDeck.theme.renderer = e.target.value;
  currentDeck.updatedAt = Date.now();
  deckModel.saveDeckToStorage(currentDeck);
  renderPreview();
}

function handleSlideTitleChange(e) {
  if (currentSlideIdx < 0) return;
  currentDeck.slides[currentSlideIdx].title = e.target.value;
  currentDeck.updatedAt = Date.now();
  deckModel.saveDeckToStorage(currentDeck);
  renderSlideRail();
}

function handleRemoveSlide() {
  if (currentSlideIdx < 0) return;
  const slide = currentDeck.slides[currentSlideIdx];
  if (!confirm(`Remove slide "${slide.title || `Slide ${currentSlideIdx + 1}`}"?`)) return;
  deckModel.removeSlide(currentDeck, slide.id);
  deckModel.saveDeckToStorage(currentDeck);
  currentSlideIdx = Math.min(currentSlideIdx, currentDeck.slides.length - 1);
  renderSlideRail();
  renderSettingsPane();
  renderPreview();
}

// ---- Helpers ----------------------------------------------------------------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
