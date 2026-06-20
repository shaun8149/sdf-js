// =============================================================================
// deck-model.js — Atlas Present Layer 2 data model (Sprint 1 v4 / 2D Info Graphic)
// -----------------------------------------------------------------------------
// Pure JS / no DOM. Mode-agnostic schema centered on `sections + region`.
// 2D Info Graphic mode uses region.centerX/Y for 2D layout; Sprint 2 3D Play
// mode will derive its view from the same region (proving mode-agnosticism).
//
// localStorage key: 'atlas-decks', version 3
//   v1 (PPT-mode) + v2 (Canvas Mode) silent drop on first v3 load.
//
// HARD RULE (per memory hard rule 5 + spec Rule 9): this file MUST NOT contain 3D vocabulary tokens — namely: camera, yaw, pitch, distance, focal, waypoint, cameraSequence, tween, easing. CI grep verifies. Use mode-agnostic words instead: region, sections, bbox, center, halfSize.
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-v4-design.md
// Plan: docs/superpowers/plans/2026-06-19-atlas-present-sprint-1-v4-plan.md
// =============================================================================

/**
 * @typedef {object} DeckSource
 * @property {'pdf'} type — Sprint 2+ adds 'text' | 'docx'
 * @property {string} fileName
 * @property {number} pageCount
 */

/**
 * @typedef {object} DeckLayout
 * @property {'linear'} archetype — Sprint 3+ adds 'radial' | 'grid' | ...
 * @property {number} spacing — section centers spacing (default 6)
 */

/**
 * @typedef {object} Region
 * @property {number} centerX
 * @property {number} centerY
 * @property {number} centerZ
 * @property {number} halfWidth
 * @property {number} halfHeight
 * @property {number} halfDepth
 * @property {string} [title]
 */

/**
 * @typedef {object} SceneDataSubject
 * @property {string} id
 * @property {string} type
 * @property {object} args
 * @property {{translate?:number[], rotate?:number[], scale?:number}} [transform]
 * @property {string} [material]
 */

/**
 * @typedef {object} SceneData
 * @property {1} v
 * @property {string} name
 * @property {SceneDataSubject[]} subjects
 * @property {object} [defaults]
 */

/**
 * @typedef {object} SectionEntry
 * @property {string} id
 * @property {number} pageIndex — 0-based source page index
 * @property {'pending'|'lifting'|'ready'|'error'} status
 * @property {object} [slideData] — SlideData v1 from parser
 * @property {string} [code2d] — emitted 2D code (input to lift LLM)
 * @property {string} [prompt] — user-facing label / title
 * @property {SceneData} [sceneData] — lift output (when status === 'ready')
 * @property {Region} [region] — computed via linear-layout when sceneData ready
 * @property {string} [liftError]
 */

/**
 * @typedef {object} Deck
 * @property {string} id
 * @property {string} title
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {DeckSource} source
 * @property {DeckLayout} layout
 * @property {SectionEntry[]} sections
 */

export const DECKS_STORAGE_KEY = 'atlas-decks';
export const STORAGE_VERSION = 3;

// ---- ID helpers -------------------------------------------------------------

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---- Deck CRUD --------------------------------------------------------------

/**
 * Create a new deck with empty sections.
 *
 * @param {string} title
 * @param {DeckSource} source
 * @returns {Deck}
 */
export function createDeck(title, source) {
  const now = Date.now();
  return {
    id: uuid(),
    title: title || 'Untitled Deck',
    createdAt: now,
    updatedAt: now,
    source: source ?? { type: 'pdf', fileName: '', pageCount: 0 },
    layout: { archetype: 'linear', spacing: 6 },
    sections: [],
  };
}

/**
 * Bulk-add sections in 'pending' status. Called by pipeline after parse.
 *
 * @param {Deck} deck
 * @param {Array<{slideData:object, code2d:string, prompt?:string}>} entries
 * @returns {SectionEntry[]} the newly added sections
 */
export function addPendingSections(deck, entries) {
  const added = entries.map((e, i) => ({
    id: uuid(),
    pageIndex: deck.sections.length + i,
    status: 'pending',
    slideData: e.slideData,
    code2d: e.code2d,
    prompt: e.prompt,
  }));
  deck.sections.push(...added);
  deck.updatedAt = Date.now();
  return added;
}

/**
 * Update a section's status and optional payload (e.g., sceneData on 'ready').
 *
 * @param {Deck} deck
 * @param {string} sectionId
 * @param {'pending'|'lifting'|'ready'|'error'} status
 * @param {object} [payload] — merged into the section (e.g., {sceneData, region} or {liftError})
 * @returns {boolean} true if updated, false if section not found
 */
export function updateSectionStatus(deck, sectionId, status, payload = {}) {
  const section = deck.sections.find((s) => s.id === sectionId);
  if (!section) return false;
  section.status = status;
  Object.assign(section, payload);
  deck.updatedAt = Date.now();
  return true;
}

/**
 * Count sections in each status. Useful for library card progress UI.
 *
 * @param {Deck} deck
 * @returns {{pending:number, lifting:number, ready:number, error:number, total:number}}
 */
export function sectionStatusCounts(deck) {
  const counts = { pending: 0, lifting: 0, ready: 0, error: 0, total: deck.sections.length };
  for (const s of deck.sections) {
    counts[s.status]++;
  }
  return counts;
}

// ---- Storage ----------------------------------------------------------------

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

function writeStorage(shape) {
  try {
    localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(shape));
  } catch (e) {
    console.error('[deck-model] storage write failed (quota?):', e.message);
    throw e;
  }
}

/**
 * Migrate storage shape. v1 (PPT-mode) + v2 (Canvas Mode) silent drop.
 * Only v3 passes through.
 *
 * @param {object} raw
 * @returns {{version:number, decks:Deck[]}}
 */
export function migrateDecksStorage(raw) {
  if (!raw || typeof raw !== 'object') {
    return { version: STORAGE_VERSION, decks: [] };
  }
  if (raw.version !== STORAGE_VERSION) {
    return { version: STORAGE_VERSION, decks: [] };
  }
  if (!Array.isArray(raw.decks)) {
    return { version: STORAGE_VERSION, decks: [] };
  }
  return { version: STORAGE_VERSION, decks: raw.decks };
}

export function saveDeckToStorage(deck) {
  const shape = readStorage();
  const idx = shape.decks.findIndex((existing) => existing.id === deck.id);
  if (idx >= 0) shape.decks[idx] = deck;
  else shape.decks.push(deck);
  writeStorage(shape);
}

export function loadDeckFromStorage(id) {
  const shape = readStorage();
  return shape.decks.find((d) => d.id === id) || null;
}

export function listDecks() {
  const shape = readStorage();
  return [...shape.decks].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteDeckFromStorage(id) {
  const shape = readStorage();
  const idx = shape.decks.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  shape.decks.splice(idx, 1);
  writeStorage(shape);
  return true;
}

export function renameDeck(id, newTitle) {
  const deck = loadDeckFromStorage(id);
  if (!deck) return false;
  deck.title = newTitle;
  deck.updatedAt = Date.now();
  saveDeckToStorage(deck);
  return true;
}

/**
 * Duplicate a deck — deep copy with new id + " (copy)" suffix. Sections reset
 * to 'pending' status (lifted sceneData is per-content; copying loses lift —
 * user must re-lift). Section ids reassigned.
 *
 * @param {string} id
 * @returns {Deck|null}
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
    sections: src.sections.map((s) => ({
      id: uuid(),
      pageIndex: s.pageIndex,
      status: 'pending',
      slideData: s.slideData,
      code2d: s.code2d,
      prompt: s.prompt,
      // sceneData + region + liftError dropped — re-lift required
    })),
  };
  saveDeckToStorage(copy);
  return copy;
}
