// =============================================================================
// deck-model.js — Atlas Present Layer 2 data model (Sprint 2 v5 / Napkin)
// -----------------------------------------------------------------------------
// Pure JS / no DOM. Document-anchored schema: each deck has ONE document
// (flowing text + page boundaries + headings) and zero-or-more visuals
// anchored to text-range offsets. NO sections, NO regions, NO 3D vocab.
//
// localStorage key: 'atlas-decks', version 5
//   v1 (PPT-mode) + v2 (Canvas Mode) + v3 (Sprint 1 v4) + v4 (Sprint 1.5)
//   ALL silent drop on first v5 load.
//
// HARD RULE (per memory hard rule 5 + spec Rule 4): this file
//   MUST NOT contain 3D vocabulary tokens — the forbidden list:
//   MUST NOT contain : camera, yaw, pitch, distance, focal, waypoint,
//   MUST NOT contain : cameraSequence, tween, easing.
//   CI grep verifies the rule. Use mode-agnostic words instead: visual,
//   textAnchor, offset, archetype, variant, palette.
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md
// =============================================================================

/**
 * @typedef {object} DeckSource
 * @property {'pdf'} type
 * @property {string} fileName
 * @property {number} pageCount
 */

/**
 * @typedef {object} PageBoundary
 * @property {number} startOffset
 * @property {number} endOffset
 * @property {number} pageNumber
 */

/**
 * @typedef {object} Heading
 * @property {number} offset
 * @property {1|2|3} level
 * @property {string} text
 */

/**
 * @typedef {object} DocumentData
 * @property {string} flowingText
 * @property {PageBoundary[]} pages
 * @property {Heading[]} headings
 */

/**
 * @typedef {object} TextAnchor
 * @property {number} startOffset
 * @property {number} endOffset
 * @property {string} text
 */

/**
 * @typedef {object} VisualVariant
 * @property {'pending'|'lifting'|'ready'|'error'} status
 * @property {string} [archetype]
 * @property {object} [sceneData]
 * @property {string} [liftError]
 */

/**
 * @typedef {object} Visual
 * @property {string} id
 * @property {TextAnchor} textAnchor
 * @property {number} createdAt
 * @property {'pending'|'lifting'|'ready'|'error'} status — derived from variants
 * @property {VisualVariant[]} variants — exactly VARIANT_COUNT (6) entries
 * @property {number} selectedVariantIndex
 * @property {string} activeEffect — renderer id from ACTIVE_EFFECTS
 * @property {string} activeBranding — palette preset id (from branding-palettes.js)
 */

/**
 * @typedef {object} Deck
 * @property {string} id
 * @property {string} title
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {DeckSource} source
 * @property {DocumentData|null} document — null until setDocument is called
 * @property {Visual[]} visuals
 */

export const DECKS_STORAGE_KEY = 'atlas-decks';
export const STORAGE_VERSION = 5;
export const VARIANT_COUNT = 6;
export const ACTIVE_EFFECTS = ['silhouette', 'lines', 'crayon', 'topo'];
export const DEFAULT_EFFECT = 'silhouette';
export const DEFAULT_BRANDING = 'mono-light';

// ---- ID helpers -------------------------------------------------------------

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---- Status derivation ------------------------------------------------------

/**
 * Derive aggregated visual status from its variants.
 *
 * @param {VisualVariant[]} variants
 * @returns {'pending'|'lifting'|'ready'|'error'}
 */
export function deriveStatus(variants) {
  if (variants.some((v) => v.status === 'lifting')) return 'lifting';
  if (variants.some((v) => v.status === 'ready')) return 'ready';
  if (variants.every((v) => v.status === 'error')) return 'error';
  return 'pending';
}

// ---- Deck CRUD --------------------------------------------------------------

/**
 * Create a new empty deck (no document yet, no visuals).
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
    document: null,
    visuals: [],
  };
}

/**
 * Set the document data after PDF parse + text extraction.
 *
 * @param {Deck} deck
 * @param {DocumentData} document
 */
export function setDocument(deck, document) {
  deck.document = document;
  deck.updatedAt = Date.now();
}

/**
 * Add a new visual anchored to a text range. Visual starts with VARIANT_COUNT
 * pending variants, selectedVariantIndex = 0, default effect + branding.
 *
 * @param {Deck} deck
 * @param {TextAnchor} textAnchor
 * @returns {Visual} the newly created visual
 */
export function addVisual(deck, textAnchor) {
  const visual = {
    id: uuid(),
    textAnchor: {
      startOffset: textAnchor.startOffset,
      endOffset: textAnchor.endOffset,
      text: textAnchor.text,
    },
    createdAt: Date.now(),
    status: 'pending',
    variants: Array.from({ length: VARIANT_COUNT }, () => ({ status: 'pending' })),
    selectedVariantIndex: 0,
    activeEffect: DEFAULT_EFFECT,
    activeBranding: DEFAULT_BRANDING,
  };
  deck.visuals.push(visual);
  deck.updatedAt = Date.now();
  return visual;
}

/**
 * Remove a visual by id.
 *
 * @param {Deck} deck
 * @param {string} visualId
 * @returns {boolean} true if removed
 */
export function removeVisual(deck, visualId) {
  const idx = deck.visuals.findIndex((v) => v.id === visualId);
  if (idx === -1) return false;
  deck.visuals.splice(idx, 1);
  deck.updatedAt = Date.now();
  return true;
}

/**
 * Update a single variant of a visual + derive aggregated visual status.
 *
 * @param {Deck} deck
 * @param {string} visualId
 * @param {number} variantIndex 0..VARIANT_COUNT-1
 * @param {'pending'|'lifting'|'ready'|'error'} status
 * @param {object} [payload] merged into variant: {sceneData, archetype, liftError}
 * @returns {boolean}
 */
export function updateVisualVariantStatus(deck, visualId, variantIndex, status, payload = {}) {
  const visual = deck.visuals.find((v) => v.id === visualId);
  if (!visual) return false;
  if (variantIndex < 0 || variantIndex >= visual.variants.length) return false;
  const variant = visual.variants[variantIndex];
  variant.status = status;
  if (payload.sceneData !== undefined) variant.sceneData = payload.sceneData;
  if (payload.archetype !== undefined) variant.archetype = payload.archetype;
  if (payload.liftError !== undefined) variant.liftError = payload.liftError;
  visual.status = deriveStatus(visual.variants);
  deck.updatedAt = Date.now();
  return true;
}

/**
 * Switch the selectedVariantIndex of a visual (UI: user picks a variant).
 *
 * @param {Deck} deck
 * @param {string} visualId
 * @param {number} variantIndex 0..VARIANT_COUNT-1
 * @returns {boolean}
 */
export function selectVisualVariant(deck, visualId, variantIndex) {
  const visual = deck.visuals.find((v) => v.id === visualId);
  if (!visual) return false;
  if (variantIndex < 0 || variantIndex >= visual.variants.length) return false;
  visual.selectedVariantIndex = variantIndex;
  deck.updatedAt = Date.now();
  return true;
}

/**
 * Accessor for the currently-selected variant of a visual.
 *
 * @param {Visual} visual
 * @returns {VisualVariant | null}
 */
export function getSelectedVisualVariant(visual) {
  if (!visual || !Array.isArray(visual.variants)) return null;
  const idx = Number.isInteger(visual.selectedVariantIndex) ? visual.selectedVariantIndex : 0;
  return visual.variants[idx] || visual.variants[0] || null;
}

/**
 * Set the active renderer for a visual. Must be one of ACTIVE_EFFECTS.
 *
 * @param {Deck} deck
 * @param {string} visualId
 * @param {string} effect
 * @returns {boolean}
 */
export function setActiveEffect(deck, visualId, effect) {
  const visual = deck.visuals.find((v) => v.id === visualId);
  if (!visual) return false;
  if (!ACTIVE_EFFECTS.includes(effect)) return false;
  visual.activeEffect = effect;
  deck.updatedAt = Date.now();
  return true;
}

/**
 * Set the active branding preset for a visual.
 *
 * @param {Deck} deck
 * @param {string} visualId
 * @param {string} brandingId
 * @returns {boolean}
 */
export function setActiveBranding(deck, visualId, brandingId) {
  const visual = deck.visuals.find((v) => v.id === visualId);
  if (!visual) return false;
  visual.activeBranding = brandingId;
  deck.updatedAt = Date.now();
  return true;
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
 * Migrate storage. v1/v2/v3/v4 silent drop. Only v5 passes through.
 *
 * @param {object} raw
 * @returns {{version:number, decks:Deck[]}}
 */
export function migrateDecksStorage(raw) {
  if (!raw || typeof raw !== 'object') return { version: STORAGE_VERSION, decks: [] };
  if (raw.version !== STORAGE_VERSION) return { version: STORAGE_VERSION, decks: [] };
  if (!Array.isArray(raw.decks)) return { version: STORAGE_VERSION, decks: [] };
  return { version: STORAGE_VERSION, decks: raw.decks };
}

export function saveDeckToStorage(deck) {
  const shape = readStorage();
  const idx = shape.decks.findIndex((d) => d.id === deck.id);
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
 * Duplicate a deck — deep copy with new id + " (copy)" suffix. document is
 * preserved (it's PDF text, independent of lifts). Visuals are dropped
 * (user needs to re-generate against the copy).
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
    document: src.document ? JSON.parse(JSON.stringify(src.document)) : null,
    visuals: [], // drop visuals on duplicate
  };
  saveDeckToStorage(copy);
  return copy;
}
