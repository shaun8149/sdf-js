// =============================================================================
// deck-model.js — Atlas Present Layer 2 data model (Sprint 1.5 v4 / variants)
// -----------------------------------------------------------------------------
// Pure JS / no DOM. Mode-agnostic schema centered on `sections + region`.
// 2D Info Graphic mode uses region.centerX/Y for 2D layout; Sprint 2 3D Play
// mode will derive its view from the same region (proving mode-agnosticism).
//
// localStorage key: 'atlas-decks', version 4
//   v1 (PPT-mode) + v2 (Canvas Mode) + v3 (Sprint 1 v4 flat shape) silent drop
//   on first v4 load. Each section now carries variants[VARIANT_COUNT=3] +
//   selectedVariantIndex. Variants diverge via stochastic lift LLM (default
//   temperature ~1.0) given the archetype-first prompt v3.18. Each variant
//   may carry an optional `archetype` field (populated by pipeline from
//   sceneData.name prefix after a successful lift).
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
 * @typedef {object} SectionVariant
 * @property {'pending'|'lifting'|'ready'|'error'} status
 * @property {string} [archetype] — extracted from sceneData.name when ready (e.g. 'sequence' / 'list' / 'compare' / 'hierarchy' / 'relation' / 'kpi-hero' / 'text-card')
 * @property {SceneData} [sceneData] — present when status === 'ready'
 * @property {Region} [region] — present when status === 'ready'
 * @property {string} [liftError] — present when status === 'error'
 */

/**
 * @typedef {object} SectionEntry
 * @property {string} id
 * @property {number} pageIndex — 0-based source page index
 * @property {'pending'|'lifting'|'ready'|'error'} status — derived from variants (see deriveStatus)
 * @property {object} [slideData] — SlideData v1 from parser
 * @property {string} [code2d] — emitted 2D code (input to lift LLM)
 * @property {string} [prompt] — user-facing label / title
 * @property {SectionVariant[]} variants — always exactly VARIANT_COUNT (3) entries
 * @property {number} selectedVariantIndex — 0..2 — which variant is "active"
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
export const STORAGE_VERSION = 4;

/** Number of stochastic variants generated per section (Sprint 1.5). */
export const VARIANT_COUNT = 3;

/**
 * Derive a section's aggregated status from its variants.
 *
 * Rules:
 *   - 'lifting' if any variant is currently lifting (in-flight beats all)
 *   - 'ready'   if at least 1 variant is ready (and none lifting)
 *   - 'error'   if all variants are error
 *   - 'pending' otherwise (all pending, or pending+error mix)
 *
 * @param {SectionVariant[]} variants
 * @returns {'pending'|'lifting'|'ready'|'error'}
 */
export function deriveStatus(variants) {
  if (variants.some((v) => v.status === 'lifting')) return 'lifting';
  if (variants.some((v) => v.status === 'ready')) return 'ready';
  if (variants.every((v) => v.status === 'error')) return 'error';
  return 'pending';
}

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
    variants: Array.from({ length: VARIANT_COUNT }, () => ({
      status: 'pending',
      // archetype/sceneData/region/liftError populated by pipeline as lifts complete
    })),
    selectedVariantIndex: 0,
  }));
  deck.sections.push(...added);
  deck.updatedAt = Date.now();
  return added;
}

/**
 * Update a single variant's status + optionally merge payload. After the
 * variant update, derive and apply the section's aggregated status.
 *
 * @param {Deck} deck
 * @param {string} sectionId
 * @param {number} variantIndex — 0..VARIANT_COUNT-1
 * @param {'pending'|'lifting'|'ready'|'error'} status
 * @param {object} [payload] — merged into the variant: { sceneData, region, liftError, archetype }
 * @returns {boolean} true if update succeeded
 */
export function updateVariantStatus(deck, sectionId, variantIndex, status, payload = {}) {
  const section = deck.sections.find((s) => s.id === sectionId);
  if (!section) return false;
  if (!Array.isArray(section.variants)) return false;
  if (variantIndex < 0 || variantIndex >= section.variants.length) return false;
  const variant = section.variants[variantIndex];
  variant.status = status;
  if (payload.sceneData !== undefined) variant.sceneData = payload.sceneData;
  if (payload.region !== undefined) variant.region = payload.region;
  if (payload.liftError !== undefined) variant.liftError = payload.liftError;
  if (payload.archetype !== undefined) variant.archetype = payload.archetype;
  section.status = deriveStatus(section.variants);
  deck.updatedAt = Date.now();
  return true;
}

/**
 * Switch a section's selectedVariantIndex (UI: user picks a variant).
 *
 * @param {Deck} deck
 * @param {string} sectionId
 * @param {number} variantIndex — 0..VARIANT_COUNT-1
 * @returns {boolean}
 */
export function selectVariant(deck, sectionId, variantIndex) {
  const section = deck.sections.find((s) => s.id === sectionId);
  if (!section) return false;
  if (!Array.isArray(section.variants)) return false;
  if (variantIndex < 0 || variantIndex >= section.variants.length) return false;
  section.selectedVariantIndex = variantIndex;
  deck.updatedAt = Date.now();
  return true;
}

/**
 * Convenience accessor for a section's currently selected variant.
 *
 * @param {SectionEntry} section
 * @returns {SectionVariant | null} null if no variants array (corrupt)
 */
export function getSelectedVariant(section) {
  if (!section || !Array.isArray(section.variants)) return null;
  const idx = Number.isInteger(section.selectedVariantIndex) ? section.selectedVariantIndex : 0;
  return section.variants[idx] || section.variants[0] || null;
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
 * Migrate storage shape. v1 (PPT-mode) + v2 (Canvas Mode) + v3 (Sprint 1 v4
 * flat shape) silent drop. Only v4 (Sprint 1.5 variants) passes through.
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
      variants: Array.from({ length: VARIANT_COUNT }, () => ({
        status: 'pending',
        // archetype/sceneData/region/liftError dropped — re-lift required
      })),
      selectedVariantIndex: 0,
    })),
  };
  saveDeckToStorage(copy);
  return copy;
}
