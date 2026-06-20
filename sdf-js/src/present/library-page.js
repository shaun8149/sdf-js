// =============================================================================
// library-page.js — Atlas Present Sprint 2 library landing page
// -----------------------------------------------------------------------------
// Lists existing decks + Import PDF button. View button routes to
// /examples/present/?deck=<id> which is handled by index.html router →
// document-view.js mountDocumentView.
//
// Sprint 2 changes vs Sprint 1.5:
// - View button opens document-view (Napkin), not deck-view (info graphic)
// - Card meta shows "<page count> pages · <visual count> visuals" instead
//   of section count / lifting progress
// - No batch-lift status (lifting is now user-triggered per-selection inside
//   document-view)
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §6
// =============================================================================

import * as deckModel from './deck-model.js';
import { parsePDFFromBytes } from '../parser/index.js';
import { extractDocumentData } from './pdf-text-extractor.js';

export async function mountLibraryPage(target) {
  const decks = deckModel.listDecks();
  target.innerHTML = `
    <div class="library-page">
      <div class="library-header">
        <h1>Atlas Present <span style="font-weight:400; color:#6b7280; font-size:18px;">Library</span></h1>
        <button id="btn-import">+ Import PDF</button>
        <input type="file" id="file-input" accept="application/pdf" style="display:none" />
      </div>
      <div class="library-grid">
        ${decks.length === 0 ? `<div class="page-pad" style="color:#6b7280;">No decks yet. Click "+ Import PDF" to start.</div>` : decks.map(renderCard).join('')}
      </div>
    </div>
  `;

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  document.getElementById('file-input').addEventListener('change', handleFileImport);

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

function renderCard(deck) {
  const pageCount = deck.document?.pages?.length ?? deck.source?.pageCount ?? 0;
  const visualCount = deck.visuals?.length ?? 0;
  const updated = relativeTime(deck.updatedAt);
  return `
    <div class="library-card">
      <h3>${escapeHtml(deck.title)}</h3>
      <div class="meta">${pageCount} pages · ${visualCount} visuals</div>
      <div class="meta">Updated ${updated}</div>
      <div class="actions">
        <button id="btn-view-${deck.id}" class="primary">View</button>
        <button id="btn-rename-${deck.id}">Rename</button>
        <button id="btn-delete-${deck.id}">Delete</button>
      </div>
    </div>
  `;
}

async function handleFileImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    alert('Only .pdf supported in Sprint 2 (Sprint 3+ adds .pptx / .docx)');
    return;
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let slides;
  try {
    slides = await parsePDFFromBytes(bytes, file.name);
  } catch (err) {
    alert(`PDF parse failed: ${err.message}`);
    return;
  }

  const documentData = extractDocumentData(slides);
  const deck = deckModel.createDeck(file.name.replace(/\.pdf$/i, ''), {
    type: 'pdf',
    fileName: file.name,
    pageCount: slides.length,
  });
  deckModel.setDocument(deck, documentData);
  deckModel.saveDeckToStorage(deck);

  // Refresh library page
  const target = document.getElementById('route-target') || document.body;
  await mountLibraryPage(target);
}

function handleView(id) {
  location.search = `?deck=${id}`;
}

function handleRename(id) {
  const deck = deckModel.loadDeckFromStorage(id);
  if (!deck) return;
  const next = prompt('New name:', deck.title);
  if (next && next.trim()) {
    deckModel.renameDeck(id, next.trim());
    const target = document.getElementById('route-target') || document.body;
    mountLibraryPage(target);
  }
}

function handleDelete(id) {
  if (confirm('Delete this deck?')) {
    deckModel.deleteDeckFromStorage(id);
    const target = document.getElementById('route-target') || document.body;
    mountLibraryPage(target);
  }
}

function relativeTime(ts) {
  const delta = Date.now() - ts;
  const m = Math.floor(delta / 60000);
  const h = Math.floor(delta / 3600000);
  const d = Math.floor(delta / 86400000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
