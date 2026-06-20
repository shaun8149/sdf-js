// =============================================================================
// document-view.js — Atlas Present Sprint 2 Napkin document viewer
// -----------------------------------------------------------------------------
// Mounts the document viewer at /examples/present/?deck=<id>. Renders the
// deck's flowingText with heading-style typography (Canvas2D + system fonts,
// not SDF — per spec rule "no SDF text in 2D mode"). Wires floating-toolbar
// for user text selection → ⚡ → generate visual. Anchors mounted
// visual-panel instances at their text offsets.
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §6
// =============================================================================

import * as deckModel from './deck-model.js';
import { mountFloatingToolbar } from './floating-toolbar.js';
import { mountVisualPanel } from './visual-panel.js';
import { createVisualPipeline } from './pipeline.js';
import { callLiftLLM, parseLiftResponse, sanitize2dSceneData } from '../compositor-api.js';

const ANTHROPIC_KEY_STORAGE = 'atlas-anthropic-key';

export async function mountDocumentView(target, deckId) {
  const deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) {
    target.innerHTML = `<div class="page-pad">Deck not found.<br><a href="./">← Library</a></div>`;
    return;
  }
  if (!deck.document) {
    target.innerHTML = `<div class="page-pad">Deck has no document data. Re-import the PDF.<br><a href="./">← Library</a></div>`;
    return;
  }

  target.innerHTML = `
    <div class="deck-view-header">
      <a href="./">← Library</a>
      <h2>${escapeHtml(deck.title)}</h2>
      <span class="meta">${deck.document.pages.length} pages · ${deck.visuals.length} visuals</span>
    </div>
    <div id="document-container" class="document-container"></div>
  `;

  const docContainer = document.getElementById('document-container');
  renderDocumentHTML(docContainer, deck.document);

  // Mount existing visuals (sorted by textAnchor.startOffset)
  const sortedVisuals = [...deck.visuals].sort(
    (a, b) => a.textAnchor.startOffset - b.textAnchor.startOffset,
  );
  for (const visual of sortedVisuals) {
    mountVisualPanelAtAnchor(docContainer, deck, visual);
  }

  // Floating ⚡ toolbar wires to selection
  mountFloatingToolbar(docContainer, (textAnchor) => {
    handleVisualizeTrigger(deck, docContainer, textAnchor);
  });
}

function renderDocumentHTML(container, document) {
  const lines = [];
  let cursor = 0;
  const headingsByOffset = new Map();
  for (const h of document.headings) {
    headingsByOffset.set(h.offset, h);
  }
  const textParts = document.flowingText.split('\n');
  for (const part of textParts) {
    const heading = headingsByOffset.get(cursor);
    const className = heading ? `heading h${heading.level}` : 'body';
    lines.push({ text: part, className, offset: cursor });
    cursor += part.length + 1; // +1 for the \n
  }

  container.innerHTML = lines
    .filter((l) => l.text.length > 0)
    .map((l) => `<div class="${l.className}" data-offset="${l.offset}">${escapeHtml(l.text)}</div>`)
    .join('');
}

async function handleVisualizeTrigger(deck, docContainer, textAnchor) {
  // BYOK API key
  let apiKey = localStorage.getItem(ANTHROPIC_KEY_STORAGE);
  if (!apiKey) {
    const entered = prompt('Anthropic API key (saved to localStorage):');
    if (!entered) return;
    localStorage.setItem(ANTHROPIC_KEY_STORAGE, entered);
    apiKey = entered;
  }

  // Add visual to deck model
  const visual = deckModel.addVisual(deck, textAnchor);
  deckModel.saveDeckToStorage(deck);

  // Mount the visual-panel placeholder (it shows "lifting..." until variants come in)
  const panel = mountVisualPanelAtAnchor(docContainer, deck, visual);

  // Start the visual-pipeline (6 lifts serial)
  const pipeline = createVisualPipeline(
    deck,
    visual.id,
    apiKey,
    {
      callLiftLLM,
      parseLiftResponse,
      sanitize2dSceneData,
      saveDeck: (d) => deckModel.saveDeckToStorage(d),
    },
    {
      onEvent: () => {
        // Re-render panel as variants come in
        if (panel && typeof panel.refresh === 'function') panel.refresh();
      },
    },
  );
  await pipeline.start();
}

function mountVisualPanelAtAnchor(docContainer, deck, visual) {
  // Find the document line that contains the textAnchor.endOffset.
  // Insert the visual-panel DIV immediately AFTER that line.
  const lines = docContainer.querySelectorAll('.body, .heading');
  let anchorLine = null;
  for (const line of lines) {
    const offset = parseInt(line.dataset.offset, 10);
    if (offset >= visual.textAnchor.endOffset) break;
    anchorLine = line;
  }
  if (!anchorLine) anchorLine = lines[lines.length - 1];

  const panelWrapper = document.createElement('div');
  panelWrapper.className = 'visual-panel-wrapper';
  panelWrapper.dataset.visualId = visual.id;
  if (anchorLine) {
    anchorLine.insertAdjacentElement('afterend', panelWrapper);
  } else {
    docContainer.appendChild(panelWrapper);
  }

  return mountVisualPanel(panelWrapper, deck, visual.id);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
