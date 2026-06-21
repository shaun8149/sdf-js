// =============================================================================
// atoms-2d/registry.js — Atlas 2D atom registry + render API
// -----------------------------------------------------------------------------
// Maps atom `type` string → import path. Loaded on demand (dynamic import)
// to keep initial bundle small.
//
// API:
//   isAtom2DType(type)              — quick check before dispatching
//   getAtomSpec(type)               — async load and return atom's spec object
//   renderAtom(ctx, type, args, style, opts)  — render atom to Canvas2D context
//
// Per [[atlas-2d-two-track-architecture-lock]] — these atoms are Atlas-
// authored, rendered in main page Canvas2D (NOT iframe), shared name across
// pseudo3d / flat / 3D-SDF render strategies.
//
// Style options:
//   - 'pseudo3d'  (Phase 0+, this batch)
//   - 'flat'      (future, after pseudo3d batch merged)
//   - '3d'        (future, when present mode adds true 3D path)
// =============================================================================

// Static registry. Keys are atom types (also LLM-emit'd in SceneData.subjects[].type).
// Values are dynamic import functions to keep startup light.
//
// Add new atoms by extending this map.
const ATOM_LOADERS = {
  // Charts / data
  'kpi-card': () => import('./charts/data/kpi-card.js'),
  // Future Phase 1: bar / line / pie / column

  // Charts / diagrams (Phase 2)
  // Charts / hierarchy (Phase 2)
  // Shapes (Phase 3)
  // Icons (Phase 4)
  // Presentation (Phase 4)
};

/**
 * Quick membership check. Use to route SceneData.subjects[].type before
 * deciding p5-sketch vs atom-2d render path.
 */
export function isAtom2DType(type) {
  return Object.prototype.hasOwnProperty.call(ATOM_LOADERS, type);
}

/**
 * Returns the array of known atom type strings. For dev/debug and prompt
 * generation tooling.
 */
export function listAtomTypes() {
  return Object.keys(ATOM_LOADERS);
}

// Module cache so we don't dynamic-import the same atom twice.
const MODULE_CACHE = new Map();

async function loadAtomModule(type) {
  if (MODULE_CACHE.has(type)) return MODULE_CACHE.get(type);
  const loader = ATOM_LOADERS[type];
  if (!loader) throw new Error(`atoms-2d: unknown atom type "${type}"`);
  const mod = await loader();
  MODULE_CACHE.set(type, mod);
  return mod;
}

/**
 * Get the atom's static spec (args schema, category, etc) without rendering.
 * Used by prompt-generation tooling and the atom-browser sidebar (future Q4).
 */
export async function getAtomSpec(type) {
  const mod = await loadAtomModule(type);
  return mod.spec;
}

/**
 * Render an atom to a Canvas2D context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} type — atom type (must be in registry)
 * @param {object} args — atom-specific args (matches spec.args schema)
 * @param {'pseudo3d'|'flat'|'3d'} style — render strategy
 * @param {object} [opts]
 * @param {number} [opts.x=0]
 * @param {number} [opts.y=0]
 * @param {number} [opts.w]
 * @param {number} [opts.h]
 * @param {object} [opts.palette] — branding palette { bg, silhouetteColor, colors? }
 *
 * @returns {Promise<void>}
 *
 * Throws if type is unknown OR if the atom doesn't implement requested style.
 */
export async function renderAtom(ctx, type, args, style = 'pseudo3d', opts = {}) {
  const mod = await loadAtomModule(type);
  let drawFn;
  switch (style) {
    case 'pseudo3d':
      drawFn = mod.drawPseudo3D;
      break;
    case 'flat':
      drawFn = mod.drawFlat;
      break;
    case '3d':
      drawFn = mod.draw3D;
      break;
    default:
      throw new Error(`atoms-2d: unknown style "${style}"`);
  }
  if (typeof drawFn !== 'function') {
    throw new Error(`atoms-2d: atom "${type}" does not implement style "${style}" yet`);
  }
  return drawFn(ctx, args, opts);
}
