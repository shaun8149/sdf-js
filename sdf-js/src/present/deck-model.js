// =============================================================================
// deck-model.js — Atlas Present Layer 2 data model
// -----------------------------------------------------------------------------
// Pure JS / no DOM. Defines Deck + Slide types (JSDoc), CRUD operations,
// localStorage persistence + migration.
//
// localStorage key: 'atlas-decks'
//   shape: { version: 2, decks: Deck[] }  ← UPDATED in Canvas Mode pivot 2026-06-19
//
// ⚠️ DEPRECATED PPT-MODE IMPL — full rewrite in Plan Phase 3 (Canvas Mode pivot).
// Until then, do NOT extend or "improve" this file. See plan
// docs/superpowers/plans/2026-06-19-atlas-present-canvas-mode-plan.md
//
// Per [[compositor-layered-for-presentation]] memory: this lives in
// Layer 2 (presentation app), calls Layer 1 (compositor-api) only when
// needed for compile/render — but for Sprint 1 the model is pure data.
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-design.md
// =============================================================================

/**
 * @typedef {object} Theme
 * @property {string} renderer — one of 'studio'|'fly3d'|'silhouette' (Sprint 1)
 */

/**
 * @typedef {object} DeckDefaults
 * @property {'cut'} transitionType — Sprint 1 only supports 'cut'
 * @property {number} transitionDuration — ms; 0 for cut
 */

/**
 * @typedef {object} SlideSource
 * @property {'compositor-saved'|'compositor-demo'|'blank'} type
 * @property {string} [refId] — id of source scene/demo
 * @property {number} addedAt — ms epoch
 */

/**
 * @typedef {object} Slide
 * @property {string} id — uuid
 * @property {string} [title]
 * @property {object} sceneData — SceneData v1 schema (inline, not reference)
 * @property {SlideSource} [source]
 */

/**
 * @typedef {object} Deck
 * @property {string} id — uuid
 * @property {string} title
 * @property {number} createdAt — ms epoch
 * @property {number} updatedAt — ms epoch
 * @property {Theme} theme
 * @property {DeckDefaults} defaults
 * @property {Slide[]} slides
 */

export const DECKS_STORAGE_KEY = 'atlas-decks';
export const STORAGE_VERSION = 1;

// ---- ID helpers -------------------------------------------------------------

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---- CRUD operations --------------------------------------------------------

/**
 * Create a new deck with default theme + empty slides.
 *
 * @param {string} [title='Untitled Deck']
 * @returns {Deck}
 */
export function createDeck(title) {
  const now = Date.now();
  return {
    id: uuid(),
    title: title || 'Untitled Deck',
    createdAt: now,
    updatedAt: now,
    theme: {
      renderer: 'studio',
    },
    defaults: {
      transitionType: 'cut',
      transitionDuration: 0,
    },
    slides: [],
  };
}

/**
 * Add a slide to a deck (mutates deck, appends to slides array, updates updatedAt).
 *
 * @param {Deck} d
 * @param {Partial<Slide>} slideInput — sceneData required; id auto-assigned if missing
 * @returns {Slide} the added slide
 */
export function addSlide(d, slideInput) {
  if (!slideInput || !slideInput.sceneData) {
    throw new Error('[deck-model] addSlide: slideInput.sceneData required');
  }
  const slide = {
    id: slideInput.id || uuid(),
    title: slideInput.title,
    sceneData: slideInput.sceneData,
    source: slideInput.source,
  };
  d.slides.push(slide);
  d.updatedAt = Date.now();
  return slide;
}

/**
 * Remove a slide from a deck by id (mutates deck, updates updatedAt if found).
 *
 * @param {Deck} d
 * @param {string} slideId
 * @returns {boolean} true if removed, false if id not found
 */
export function removeSlide(d, slideId) {
  const idx = d.slides.findIndex((s) => s.id === slideId);
  if (idx === -1) return false;
  d.slides.splice(idx, 1);
  d.updatedAt = Date.now();
  return true;
}

/**
 * Move a slide from one index to another (mutates deck, updates updatedAt).
 * Clamps toIdx to [0, slides.length-1]. Out-of-bounds fromIdx is no-op.
 *
 * @param {Deck} d
 * @param {number} fromIdx
 * @param {number} toIdx
 * @returns {boolean} true if moved, false if no-op
 */
export function moveSlide(d, fromIdx, toIdx) {
  if (fromIdx < 0 || fromIdx >= d.slides.length) return false;
  const clampedTo = Math.max(0, Math.min(toIdx, d.slides.length - 1));
  if (clampedTo === fromIdx) return false;
  const [moved] = d.slides.splice(fromIdx, 1);
  d.slides.splice(clampedTo, 0, moved);
  d.updatedAt = Date.now();
  return true;
}

/**
 * Read raw storage shape. Initializes empty + version if missing.
 *
 * @private
 * @returns {{version:number, decks:Deck[]}}
 */
function readStorage() {
  const raw = localStorage.getItem(DECKS_STORAGE_KEY);
  if (!raw) return { version: STORAGE_VERSION, decks: [] };
  try {
    const parsed = JSON.parse(raw);
    return migrateDecksStorage(parsed);
  } catch (e) {
    console.warn('[deck-model] storage parse failed, reinitializing:', e.message);
    return { version: STORAGE_VERSION, decks: [] };
  }
}

/**
 * Write raw storage shape.
 *
 * @private
 * @param {{version:number, decks:Deck[]}} shape
 */
function writeStorage(shape) {
  try {
    localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(shape));
  } catch (e) {
    console.error('[deck-model] storage write failed (quota?):', e.message);
    throw e;
  }
}

/**
 * Migrate storage shape across versions. Sprint 1 has only v1.
 *
 * @param {object} raw
 * @returns {{version:number, decks:Deck[]}}
 */
export function migrateDecksStorage(raw) {
  if (!raw || typeof raw !== 'object') {
    return { version: STORAGE_VERSION, decks: [] };
  }
  if (!Array.isArray(raw.decks)) {
    return { version: STORAGE_VERSION, decks: [] };
  }
  return { version: STORAGE_VERSION, decks: raw.decks };
}

/**
 * Save a single deck to storage (creates or updates).
 *
 * @param {Deck} d
 */
export function saveDeckToStorage(d) {
  const shape = readStorage();
  const idx = shape.decks.findIndex((existing) => existing.id === d.id);
  if (idx >= 0) {
    shape.decks[idx] = d;
  } else {
    shape.decks.push(d);
  }
  writeStorage(shape);
}

/**
 * Load a single deck by id. Returns null if not found.
 *
 * @param {string} id
 * @returns {Deck|null}
 */
export function loadDeckFromStorage(id) {
  const shape = readStorage();
  return shape.decks.find((d) => d.id === id) || null;
}

/**
 * List all decks sorted by updatedAt (most recent first).
 *
 * @returns {Deck[]}
 */
export function listDecks() {
  const shape = readStorage();
  return [...shape.decks].sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Delete a deck by id. Returns true if deleted, false if not found.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function deleteDeckFromStorage(id) {
  const shape = readStorage();
  const idx = shape.decks.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  shape.decks.splice(idx, 1);
  writeStorage(shape);
  return true;
}

/**
 * Rename a deck (load, update title, save). Updates updatedAt.
 *
 * @param {string} id
 * @param {string} newTitle
 * @returns {boolean} true if renamed, false if id not found
 */
export function renameDeck(id, newTitle) {
  const d = loadDeckFromStorage(id);
  if (!d) return false;
  d.title = newTitle;
  d.updatedAt = Date.now();
  saveDeckToStorage(d);
  return true;
}

/**
 * Duplicate a deck — deep copy with new id + suffix " (copy)" on title.
 * Slide ids are also reassigned (so future edits don't conflict).
 *
 * @param {string} id — source deck id
 * @returns {Deck|null} the new deck, or null if source not found
 */
export function duplicateDeck(id) {
  const src = loadDeckFromStorage(id);
  if (!src) return null;
  const now = Date.now();
  const copy = {
    ...src,
    id: uuid(),
    title: `${src.title} (copy)`,
    createdAt: now,
    updatedAt: now,
    slides: src.slides.map((s) => ({
      ...s,
      id: uuid(),
      sceneData: JSON.parse(JSON.stringify(s.sceneData)),
    })),
  };
  saveDeckToStorage(copy);
  return copy;
}
