// =============================================================================
// deck-view.js — Atlas Present Sprint 1 v4 deck-view page (2D Info Graphic)
// -----------------------------------------------------------------------------
// Loads a deck, renders info graphic on a canvas, offers Export PNG button.
// Read-only view — no editing affordances (per Gamma-style v4 design).
// =============================================================================

import * as deckModel from './deck-model.js';
import { renderInfoGraphic, computeCanvasSize } from './info-graphic-render.js';

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
  `;

  const canvas = document.getElementById('info-graphic-canvas');
  const size = computeCanvasSize(deck);
  canvas.width = size.width;
  canvas.height = size.height;

  try {
    renderInfoGraphic(deck, canvas);
  } catch (e) {
    console.error('[deck-view] render failed:', e);
    document.querySelector('.info-graphic-stage').innerHTML =
      `<div class="page-pad" style="color: #f55;">Render error: ${escapeHtml(e.message)}</div>`;
    return;
  }

  document.getElementById('btn-export-png').addEventListener('click', () => {
    handleExportPng(canvas, deck.title);
  });
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
