// =============================================================================
// deck-model.js — Atlas Present Layer 2 data model (CANVAS MODE)
// -----------------------------------------------------------------------------
// Pure JS / no DOM. Defines Deck + Canvas + Waypoint types (JSDoc), CRUD
// operations, localStorage v2 persistence.
//
// localStorage key: 'atlas-decks'
//   shape: { version: 2, decks: Deck[] }
//   v1 (PPT-mode) decks silently dropped on first v2 load.
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-canvas-mode-design.md
// Plan: docs/superpowers/plans/2026-06-19-atlas-present-canvas-mode-plan.md
// =============================================================================

/**
 * @typedef {object} Theme
 * @property {string} renderer — one of 'studio'|'fly3d'|'silhouette' (Sprint 1)
 */

/**
 * @typedef {object} DeckTween
 * @property {number} durationMs — default 800
 * @property {'linear'|'ease-in-out'} easing — default 'ease-in-out'
 */

/**
 * @typedef {object} CameraSpherical
 * @property {number} yaw — radians
 * @property {number} pitch — radians
 * @property {number} distance
 * @property {number} targetX
 * @property {number} targetY
 * @property {number} targetZ
 * @property {number} [focal]
 */

/**
 * @typedef {object} Waypoint
 * @property {string} id
 * @property {string} [title]
 * @property {CameraSpherical} camera
 */

/**
 * @typedef {object} SceneDataSubject
 * @property {string} id
 * @property {string} type — atom name (cube-3d / text-3d-pipe / etc)
 * @property {object} args — atom-specific args
 * @property {{translate?:number[], rotate?:number[], scale?:number}} [transform]
 * @property {string} [material] — material name
 */

/**
 * @typedef {object} SceneData
 * @property {1} v
 * @property {string} name
 * @property {SceneDataSubject[]} subjects
 * @property {object} [defaults]
 */

/**
 * @typedef {object} Deck
 * @property {string} id
 * @property {string} title
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {Theme} theme
 * @property {SceneData} canvas — the persistent 3D scene
 * @property {Waypoint[]} waypoints
 * @property {DeckTween} tween
 */

export const DECKS_STORAGE_KEY = 'atlas-decks';
export const STORAGE_VERSION = 2;

// ---- ID helpers -------------------------------------------------------------

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---- Defaults ---------------------------------------------------------------

function defaultCanvas() {
  return {
    v: 1,
    name: 'canvas',
    subjects: [],
    defaults: {
      camera: {
        yaw: 0.3,
        pitch: -0.15,
        distance: 8,
        focal: 1.5,
        targetX: 0,
        targetY: 0.5,
        targetZ: 0,
      },
      light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
      shadow: { enabled: true, mode: 'darken', strength: 0.4 },
    },
  };
}

function defaultTween() {
  return { durationMs: 800, easing: 'ease-in-out' };
}

// ---- Deck CRUD --------------------------------------------------------------

/**
 * Create a new deck with an empty canvas (no subjects) and no waypoints.
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
    theme: { renderer: 'studio' },
    canvas: defaultCanvas(),
    waypoints: [],
    tween: defaultTween(),
  };
}

// ---- Subject CRUD (operates on deck.canvas.subjects) ------------------------

/**
 * Add a subject to the canvas. Mutates deck + updates updatedAt.
 *
 * @param {Deck} d
 * @param {Partial<SceneDataSubject>} subjectInput — `type` required
 * @returns {SceneDataSubject} the added subject
 */
export function addSubjectToCanvas(d, subjectInput) {
  if (!subjectInput || !subjectInput.type) {
    throw new Error('[deck-model] addSubjectToCanvas: subjectInput.type required');
  }
  const subject = {
    id: subjectInput.id || uuid(),
    type: subjectInput.type,
    args: subjectInput.args || {},
    transform: subjectInput.transform || {},
    ...(subjectInput.material ? { material: subjectInput.material } : {}),
  };
  d.canvas.subjects.push(subject);
  d.updatedAt = Date.now();
  return subject;
}

/**
 * Remove a subject from canvas by id. Returns true if removed, false if not found.
 *
 * @param {Deck} d
 * @param {string} subjectId
 * @returns {boolean}
 */
export function removeSubjectFromCanvas(d, subjectId) {
  const idx = d.canvas.subjects.findIndex((s) => s.id === subjectId);
  if (idx === -1) return false;
  d.canvas.subjects.splice(idx, 1);
  d.updatedAt = Date.now();
  return true;
}

// ---- Waypoint CRUD ----------------------------------------------------------

/**
 * Add a waypoint to the deck. Mutates + updates updatedAt.
 *
 * @param {Deck} d
 * @param {Partial<Waypoint>} waypointInput — `camera` required
 * @returns {Waypoint}
 */
export function addWaypoint(d, waypointInput) {
  if (!waypointInput || !waypointInput.camera) {
    throw new Error('[deck-model] addWaypoint: waypointInput.camera required');
  }
  const wp = {
    id: waypointInput.id || uuid(),
    ...(waypointInput.title ? { title: waypointInput.title } : {}),
    camera: { ...waypointInput.camera },
  };
  d.waypoints.push(wp);
  d.updatedAt = Date.now();
  return wp;
}

/**
 * Remove waypoint by id.
 *
 * @param {Deck} d
 * @param {string} waypointId
 * @returns {boolean}
 */
export function removeWaypoint(d, waypointId) {
  const idx = d.waypoints.findIndex((w) => w.id === waypointId);
  if (idx === -1) return false;
  d.waypoints.splice(idx, 1);
  d.updatedAt = Date.now();
  return true;
}

/**
 * Reorder waypoints. Out-of-bounds fromIdx is no-op; toIdx clamped to length.
 *
 * @param {Deck} d
 * @param {number} fromIdx
 * @param {number} toIdx
 * @returns {boolean}
 */
export function moveWaypoint(d, fromIdx, toIdx) {
  if (fromIdx < 0 || fromIdx >= d.waypoints.length) return false;
  const clampedTo = Math.max(0, Math.min(toIdx, d.waypoints.length - 1));
  if (clampedTo === fromIdx) return false;
  const [moved] = d.waypoints.splice(fromIdx, 1);
  d.waypoints.splice(clampedTo, 0, moved);
  d.updatedAt = Date.now();
  return true;
}

/**
 * Update an existing waypoint's camera (re-capture). Returns false if not found.
 *
 * @param {Deck} d
 * @param {string} waypointId
 * @param {CameraSpherical} newCamera
 * @returns {boolean}
 */
export function updateWaypointCamera(d, waypointId, newCamera) {
  const wp = d.waypoints.find((w) => w.id === waypointId);
  if (!wp) return false;
  wp.camera = { ...newCamera };
  d.updatedAt = Date.now();
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
 * Migrate raw storage shape. v1 (PPT-mode) silently dropped — returns empty
 * v2 storage. v2 passes through.
 *
 * @param {object} raw
 * @returns {{version:number, decks:Deck[]}}
 */
export function migrateDecksStorage(raw) {
  if (!raw || typeof raw !== 'object') {
    return { version: STORAGE_VERSION, decks: [] };
  }
  if (raw.version !== STORAGE_VERSION) {
    // v1 PPT-mode → silently drop. No real users to preserve.
    return { version: STORAGE_VERSION, decks: [] };
  }
  if (!Array.isArray(raw.decks)) {
    return { version: STORAGE_VERSION, decks: [] };
  }
  return { version: STORAGE_VERSION, decks: raw.decks };
}

export function saveDeckToStorage(d) {
  const shape = readStorage();
  const idx = shape.decks.findIndex((existing) => existing.id === d.id);
  if (idx >= 0) shape.decks[idx] = d;
  else shape.decks.push(d);
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
  const d = loadDeckFromStorage(id);
  if (!d) return false;
  d.title = newTitle;
  d.updatedAt = Date.now();
  saveDeckToStorage(d);
  return true;
}

/**
 * Duplicate a deck — deep copy with new id + " (copy)" suffix. Canvas subjects
 * + waypoints all get fresh ids.
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
    canvas: {
      ...src.canvas,
      subjects: src.canvas.subjects.map((s) => ({ ...s, id: uuid() })),
    },
    waypoints: src.waypoints.map((w) => ({ ...w, id: uuid() })),
  };
  saveDeckToStorage(copy);
  return copy;
}
