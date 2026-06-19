// =============================================================================
// deck-library.js — Atlas Present library page
// -----------------------------------------------------------------------------
// Lists decks from localStorage, supports create / rename / delete / duplicate.
// =============================================================================

import * as deckModel from './deck-model.js';

export async function mountDeckLibrary(target) {
  target.innerHTML = `
    <div class="topbar">
      <div class="brand">Atlas <span class="sub">Present</span></div>
      <div class="spacer"></div>
      <button id="btn-new-deck">+ New Deck</button>
    </div>
    <div id="library-body"></div>
  `;
  document.getElementById('btn-new-deck').addEventListener('click', handleNewDeck);
  renderLibraryBody();
}

function renderLibraryBody() {
  const body = document.getElementById('library-body');
  const decks = deckModel.listDecks();
  if (decks.length === 0) {
    body.innerHTML = `
      <div class="empty-state">
        <h2>No decks yet</h2>
        <p>Click "+ New Deck" to create your first deck.</p>
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
    document
      .getElementById(`btn-present-${d.id}`)
      ?.addEventListener('click', () => handlePresent(d.id));
    document.getElementById(`btn-edit-${d.id}`)?.addEventListener('click', () => handleEdit(d.id));
    document
      .getElementById(`btn-rename-${d.id}`)
      ?.addEventListener('click', () => handleRename(d.id));
    document
      .getElementById(`btn-duplicate-${d.id}`)
      ?.addEventListener('click', () => handleDuplicate(d.id));
    document
      .getElementById(`btn-delete-${d.id}`)
      ?.addEventListener('click', () => handleDelete(d.id));
  }
}

function renderDeckCard(d) {
  const updated = relativeTime(d.updatedAt);
  return `
    <div class="deck-card">
      <h3>${escapeHtml(d.title)}</h3>
      <div class="meta">${d.slides.length} slides · ${updated}</div>
      <div class="actions">
        <button id="btn-present-${d.id}" class="primary">▶</button>
        <button id="btn-edit-${d.id}">✎</button>
        <button id="btn-rename-${d.id}">Rename</button>
        <button id="btn-duplicate-${d.id}">Duplicate</button>
        <button id="btn-delete-${d.id}">Delete</button>
      </div>
    </div>
  `;
}

function handleNewDeck() {
  const title = prompt('Deck name:', 'Untitled Deck');
  if (!title) return;
  const d = deckModel.createDeck(title);
  deckModel.saveDeckToStorage(d);
  renderLibraryBody();
}

function handleEdit(id) {
  location.search = `?deck=${id}`;
}

function handlePresent(id) {
  location.search = `?deck=${id}&present=1`;
}

function handleRename(id) {
  const d = deckModel.loadDeckFromStorage(id);
  if (!d) return;
  const newTitle = prompt('New name:', d.title);
  if (!newTitle) return;
  deckModel.renameDeck(id, newTitle);
  renderLibraryBody();
}

function handleDuplicate(id) {
  deckModel.duplicateDeck(id);
  renderLibraryBody();
}

function handleDelete(id) {
  const d = deckModel.loadDeckFromStorage(id);
  if (!d) return;
  if (!confirm(`Delete deck "${d.title}"? This cannot be undone.`)) return;
  deckModel.deleteDeckFromStorage(id);
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
