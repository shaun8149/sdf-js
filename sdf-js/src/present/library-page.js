// =============================================================================
// library-page.js — Atlas Present Sprint 1 v4 library page
// -----------------------------------------------------------------------------
// List decks + Import PDF + card actions (view / rename / delete).
// =============================================================================

import * as deckModel from './deck-model.js';
import { createPipeline } from './pipeline.js';
import { parsePDFFromBytes } from '../parser/index.js';
import { emitSlide2dCode } from '../mapping/slide-to-2d-code.js';
import { callLiftLLM, parseLiftResponse } from '../compositor-api.js';

const ANTHROPIC_KEY_STORAGE = 'atlas-anthropic-key';

let activePipeline = null;

export async function mountLibraryPage(target) {
  target.innerHTML = `
    <div class="topbar">
      <div class="brand">Atlas <span class="sub">Present</span></div>
      <div class="spacer"></div>
      <button id="btn-import-pdf">+ Import PDF</button>
      <input id="file-input" type="file" accept="application/pdf" hidden />
    </div>
    <div id="library-body"></div>
  `;

  document.getElementById('btn-import-pdf').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  document.getElementById('file-input').addEventListener('change', handleFileSelected);

  renderLibraryBody();
}

function renderLibraryBody() {
  const body = document.getElementById('library-body');
  const decks = deckModel.listDecks();
  if (decks.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <h2>No decks yet</h2>
        <p>Click [+ Import PDF] to create your first deck.</p>
      </div>
    `;
    return;
  }
  body.innerHTML = `
    <div class="library-grid">
      ${decks.map(renderDeckCard).join('')}
    </div>
  `;
  for (const d of decks) {
    document.getElementById(`btn-view-${d.id}`)?.addEventListener('click', () => handleView(d.id));
    document
      .getElementById(`btn-rename-${d.id}`)
      ?.addEventListener('click', () => handleRename(d.id));
    document
      .getElementById(`btn-delete-${d.id}`)
      ?.addEventListener('click', () => handleDelete(d.id));
  }
}

function renderDeckCard(deck) {
  const counts = deckModel.sectionStatusCounts(deck);
  const isLifting = counts.lifting > 0 || counts.pending > 0;
  const isReady = counts.ready === counts.total && counts.total > 0;
  const statusLabel = isReady
    ? `Lifted ✓ (${counts.total})`
    : isLifting
      ? `Lifting ${counts.ready}/${counts.total}`
      : counts.error > 0
        ? `${counts.error} error${counts.error > 1 ? 's' : ''}, ${counts.ready} ready`
        : `${counts.total} sections`;
  const updated = relativeTime(deck.updatedAt);
  return `
    <div class="deck-card">
      <h3>${escapeHtml(deck.title)}</h3>
      <div class="meta">${escapeHtml(deck.source.fileName)} · ${counts.total} sections</div>
      <div class="status">${statusLabel} · ${updated}</div>
      <div class="actions">
        <button id="btn-view-${deck.id}" ${isReady ? 'class="primary"' : 'disabled'}>View</button>
        <button id="btn-rename-${deck.id}">Rename</button>
        <button id="btn-delete-${deck.id}">Delete</button>
      </div>
    </div>
  `;
}

async function handleFileSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Only .pdf supported in Sprint 1 (text/.pptx/.docx coming Sprint 2)');
    return;
  }

  // Check API key
  let apiKey = localStorage.getItem(ANTHROPIC_KEY_STORAGE);
  if (!apiKey) {
    const enteredKey = prompt('Anthropic API key (saved to localStorage):');
    if (!enteredKey) return;
    localStorage.setItem(ANTHROPIC_KEY_STORAGE, enteredKey);
    apiKey = enteredKey;
  }

  // Read file as Uint8Array
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Create deck
  const deck = deckModel.createDeck(file.name.replace(/\.pdf$/i, ''), {
    type: 'pdf',
    fileName: file.name,
    pageCount: 0, // updated after parse
  });
  deckModel.saveDeckToStorage(deck);
  renderLibraryBody();

  // Start pipeline
  activePipeline = createPipeline(
    deck,
    bytes,
    apiKey,
    {
      parsePDFFromBytes,
      emitSlide2dCode,
      callLiftLLM,
      parseLiftResponse,
      saveDeck: (d) => {
        deckModel.saveDeckToStorage(d);
        renderLibraryBody(); // re-render to update progress
      },
    },
    {
      onEvent: (event) => {
        if (event.type === 'parse-done') {
          deck.source.pageCount = event.sectionCount;
          deckModel.saveDeckToStorage(deck);
        }
        if (event.type === 'parse-error') {
          alert(`PDF parse failed: ${event.error.message}`);
          deckModel.deleteDeckFromStorage(deck.id);
          renderLibraryBody();
        }
      },
    },
  );

  await activePipeline.start();
  activePipeline = null;
  renderLibraryBody();
}

function handleView(deckId) {
  location.search = `?deck=${deckId}`;
}

function handleRename(deckId) {
  const deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) return;
  const newTitle = prompt('New name:', deck.title);
  if (!newTitle) return;
  deckModel.renameDeck(deckId, newTitle);
  renderLibraryBody();
}

function handleDelete(deckId) {
  const deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) return;
  if (!confirm(`Delete "${deck.title}"? This cannot be undone.`)) return;
  deckModel.deleteDeckFromStorage(deckId);
  renderLibraryBody();
}

// ---- Helpers ----------------------------------------------------------------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function relativeTime(ms) {
  const diffSec = Math.round((Date.now() - ms) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}
