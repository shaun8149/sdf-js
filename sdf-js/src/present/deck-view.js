// =============================================================================
// deck-view.js — Atlas Present Sprint 1.5 deck-view page (2D Info Graphic +
// variant picker)
// -----------------------------------------------------------------------------
// Loads a deck, renders info graphic on a canvas, offers Export PNG button.
// Sprint 1.5 v2 addition: click any section thumbnail in the info graphic →
// variant picker panel slides up from the bottom showing the 3 variants for
// that section, each labeled with its archetype (sequence/list/compare/...).
// Click a variant → updates section.selectedVariantIndex, saves deck, and
// re-renders the main info graphic with the new selection.
// =============================================================================

import * as deckModel from './deck-model.js';
import { renderInfoGraphic, computeCanvasSize } from './info-graphic-render.js';
import { compileScene, createRendererForId } from '../compositor-api.js';
import { computeView } from './linear-layout.js';

// Section layout constants — must match info-graphic-render.js
const SECTION_WIDTH = 200;
const PADDING = 40;

export async function mountDeckView(target, deckId) {
  const deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) {
    target.innerHTML = `
      <div class="page-pad">
        Deck not found: ${deckId}<br>
        <a href="./">← Library</a>
      </div>
    `;
    return;
  }

  const counts = deckModel.sectionStatusCounts(deck);
  if (counts.ready === 0) {
    target.innerHTML = `
      <div class="page-pad">
        Deck "${escapeHtml(deck.title)}" has no lifted sections yet (status: lifting/${counts.lifting}, pending/${counts.pending}, error/${counts.error}).<br>
        <a href="./">← Library</a>
      </div>
    `;
    return;
  }

  target.innerHTML = `
    <div class="deck-view-header">
      <a href="./">← Library</a>
      <h2>${escapeHtml(deck.title)}</h2>
      <button id="btn-export-png">Export PNG</button>
    </div>
    <div class="info-graphic-stage">
      <canvas id="info-graphic-canvas"></canvas>
    </div>
    <div id="variant-picker-panel" style="display:none;">
      <div class="variant-picker-header">
        <span id="variant-picker-title">Variant picker</span>
        <button id="variant-picker-close" aria-label="Close">✕</button>
      </div>
      <div id="variant-picker-thumbs"></div>
    </div>
  `;

  const canvas = document.getElementById('info-graphic-canvas');
  const size = computeCanvasSize(deck);
  canvas.width = size.width;
  canvas.height = size.height;

  // Render main info graphic — extracted to named function so picker can re-call.
  function renderMain() {
    try {
      renderInfoGraphic(deck, canvas);
    } catch (e) {
      console.error('[deck-view] render failed:', e);
      document.querySelector('.info-graphic-stage').innerHTML =
        `<div class="page-pad" style="color: #f55;">Render error: ${escapeHtml(e.message)}</div>`;
    }
  }
  renderMain();

  // === Sprint 1.5 Phase 6.2: variant picker wiring ===
  document.getElementById('variant-picker-close').addEventListener('click', () => {
    document.getElementById('variant-picker-panel').style.display = 'none';
  });

  // Map canvas click → section index (sections are evenly-spaced bands of
  // width SECTION_WIDTH starting at PADDING).
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const cssToCanvasX = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * cssToCanvasX;
    const N = deck.sections.length;
    if (N === 0) return;
    // Section i occupies [PADDING + i*SECTION_WIDTH, PADDING + (i+1)*SECTION_WIDTH).
    const sectionIndex = Math.floor((x - PADDING) / SECTION_WIDTH);
    if (sectionIndex < 0 || sectionIndex >= N) return;
    openVariantPicker(deck, sectionIndex, renderMain);
  });

  document.getElementById('btn-export-png').addEventListener('click', () => {
    handleExportPng(canvas, deck.title);
  });
}

/**
 * Open the variant picker panel for a given section. Renders one thumbnail
 * per variant (Atlas silhouette CPU renderer) labeled with the variant's
 * archetype name.
 */
async function openVariantPicker(deck, sectionIndex, renderMain) {
  const section = deck.sections[sectionIndex];
  if (!section || !Array.isArray(section.variants)) return;

  const titleEl = document.getElementById('variant-picker-title');
  titleEl.textContent = `Section ${sectionIndex + 1} — ${section.prompt || 'untitled'}`;

  const thumbsEl = document.getElementById('variant-picker-thumbs');
  thumbsEl.innerHTML = '';

  for (let variantIdx = 0; variantIdx < section.variants.length; variantIdx++) {
    const variant = section.variants[variantIdx];

    const thumbWrapper = document.createElement('div');
    thumbWrapper.className = 'variant-thumb';
    if (variantIdx === section.selectedVariantIndex) {
      thumbWrapper.classList.add('selected');
    }

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 120;
    thumbCanvas.height = 120;
    thumbWrapper.appendChild(thumbCanvas);

    const label = document.createElement('div');
    label.className = 'variant-thumb-label';
    // Sprint 1.5 v2: label shows variant.archetype (NOT styleHint — that
    // field doesn't exist in v4 schema).
    const archetypeLabel = variant.archetype || (variant.status === 'pending' ? 'pending' : '…');
    if (variant.status === 'error') {
      label.textContent = `${archetypeLabel} (error)`;
    } else if (variant.status === 'pending' || variant.status === 'lifting') {
      label.textContent = variant.status;
    } else {
      label.textContent = archetypeLabel;
    }
    thumbWrapper.appendChild(label);

    if (variant.status === 'ready' && variant.sceneData) {
      drawVariantThumb(thumbCanvas, variant.sceneData);
    } else {
      drawThumbPlaceholder(thumbCanvas, variant.status);
    }

    thumbWrapper.addEventListener('click', () => {
      handleVariantSelect(deck, section.id, variantIdx, renderMain);
    });

    thumbsEl.appendChild(thumbWrapper);
  }

  document.getElementById('variant-picker-panel').style.display = 'block';
}

function handleVariantSelect(deck, sectionId, variantIdx, renderMain) {
  if (deckModel.selectVariant(deck, sectionId, variantIdx)) {
    deckModel.saveDeckToStorage(deck);
    renderMain();
    document.getElementById('variant-picker-panel').style.display = 'none';
  }
}

function drawVariantThumb(canvas, sceneData) {
  try {
    const renderer = createRendererForId('silhouette', canvas);
    const compiled = compileScene(sceneData);
    const view = computeView(sceneData);
    renderer.render([{ sdf: compiled.sdf, color: [60, 60, 60] }], {
      background: [245, 245, 245],
      view,
    });
  } catch (e) {
    console.error('[drawVariantThumb] render failed:', e);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#a55';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('render error', canvas.width / 2, canvas.height / 2);
  }
}

function drawThumbPlaceholder(canvas, status) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#888';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const placeholderText =
    status === 'error' ? '⚠' : status === 'lifting' ? '...' : status === 'pending' ? '—' : '?';
  ctx.fillText(placeholderText, canvas.width / 2, canvas.height / 2);
}

function handleExportPng(canvas, deckTitle) {
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${deckTitle.replace(/[^a-z0-9_-]/gi, '-')}-info-graphic.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
