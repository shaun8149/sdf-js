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
  bar: () => import('./charts/data/bar.js'),
  'break-even': () => import('./charts/data/break-even.js'),
  line: () => import('./charts/data/line.js'),
  pie: () => import('./charts/data/pie.js'),
  column: () => import('./charts/data/column.js'),
  'sphere-fill': () => import('./charts/data/sphere-fill.js'),
  // Phase 1 (charts/data) — kpi-card / bar / line / pie / column + sphere-fill

  // Charts / diagrams (Phase 2)
  'flow-chart': () => import('./charts/diagrams/flow-chart.js'),
  'tree-diagram': () => import('./charts/diagrams/tree-diagram.js'),
  'org-chart': () => import('./charts/diagrams/org-chart.js'),
  mindmap: () => import('./charts/diagrams/mindmap.js'),
  'relationship-graph': () => import('./charts/diagrams/relationship-graph.js'),
  timeline: () => import('./charts/diagrams/timeline.js'),
  'seven-s-model': () => import('./charts/diagrams/seven-s-model.js'),
  'multiple-arrows': () => import('./charts/diagrams/multiple-arrows.js'),
  'circle-image-hub-spoke': () => import('./charts/diagrams/circle-image-hub-spoke.js'),
  'infinity-loop-flow': () => import('./charts/diagrams/infinity-loop-flow.js'),
  // Phase 2 (charts/diagrams) complete: 7 atoms + Sprint 15a seven-s-model + multiple-arrows + Sprint 15b circle-image-hub-spoke + infinity-loop-flow

  // Charts / hierarchy (Phase 2 closes with hierarchy/pyramid)
  pyramid: () => import('./charts/hierarchy/pyramid.js'),

  // Shapes (Phase 3 — split from former `shape` enum to align 1:1 with 3D
  // shapes/{arrow-3d, cube-3d, diamond-3d, gear-3d})
  arrow: () => import('./shapes/arrow.js'),
  cube: () => import('./shapes/cube.js'),
  diamond: () => import('./shapes/diamond.js'),
  gear: () => import('./shapes/gear.js'),
  // Shapes composites (no 3D twin yet — flagged for 3D backlog)
  'cube-grid': () => import('./shapes/cube-grid.js'),
  'gear-cluster': () => import('./shapes/gear-cluster.js'),
  'puzzle-pieces': () => import('./shapes/puzzle-pieces.js'),

  // Shapes circle family — B3 PR 2 (2D twins of circle-frame-3d / circle-loop-3d /
  // circle-segmented-3d / circle-stack-3d).
  'circle-frame': () => import('./shapes/circle-frame.js'),
  'circle-loop': () => import('./shapes/circle-loop.js'),
  'circle-segmented': () => import('./shapes/circle-segmented.js'),
  'circle-stack': () => import('./shapes/circle-stack.js'),

  // Shapes sphere family + cube-segmented — B3 PR 3 (2D twins of
  // sphere-network-3d / sphere-segmented-3d / sphere-tree-3d / cube-segmented-3d).
  'sphere-network': () => import('./shapes/sphere-network.js'),
  'sphere-segmented': () => import('./shapes/sphere-segmented.js'),
  'sphere-tree': () => import('./shapes/sphere-tree.js'),
  'cube-segmented': () => import('./shapes/cube-segmented.js'),

  // Diagrams / lists / layers / agenda — B3 PR 4 (2D twins of agenda-list-3d /
  // fishbone-3d / layer-stack-3d / bullet-list-3d). Completes B3.
  'agenda-list': () => import('./charts/agenda/agenda-list.js'),
  fishbone: () => import('./charts/diagrams/fishbone.js'),
  'layer-stack': () => import('./charts/layers/layer-stack.js'),
  'bullet-list': () => import('./charts/lists/bullet-list.js'),
  // Charts / layers — Sprint 15b
  'magazine-column-grid': () => import('./charts/layers/magazine-column-grid.js'),

  // Shapes / device mockups — Sprint 15b B2
  'device-mockup-frame': () => import('./shapes/device-mockup-frame.js'),
  'device-mockup-row': () => import('./shapes/device-mockup-row.js'),

  // Charts/data extensions
  'kpi-water-drop': () => import('./charts/data/kpi-water-drop.js'),
  'stacked-area': () => import('./charts/data/stacked-area.js'),
  funnel: () => import('./charts/data/funnel.js'),
  waterfall: () => import('./charts/data/waterfall.js'),
  gantt: () => import('./charts/data/gantt.js'),
  'dashboard-multi-kpi-composite': () => import('./charts/data/dashboard-multi-kpi.js'),

  // Charts/data — Sprint 15b B3: isotype infographic atoms (THE missing idiom)
  'isotype-people-grid': () => import('./charts/data/isotype-people-grid.js'),
  'isotype-prop-row': () => import('./charts/data/isotype-prop-row.js'),
  'isotype-stat-comparison': () => import('./charts/data/isotype-stat-comparison.js'),

  // Charts/data — B3 PR 1 (2D twins of gauge-3d / radial-spoke-3d / scatter-3d /
  // traffic-light-3d / venn-3d). Carry full data, not just count.
  gauge: () => import('./charts/data/gauge.js'),
  'radial-spoke': () => import('./charts/data/radial-spoke.js'),
  scatter: () => import('./charts/data/scatter.js'),
  bubble: () => import('./charts/data/bubble.js'),
  histogram: () => import('./charts/data/histogram.js'),
  'traffic-light': () => import('./charts/data/traffic-light.js'),
  venn: () => import('./charts/data/venn.js'),

  // Progression (new category)
  progression: () => import('./charts/progression/progression.js'),

  // Matrix (new category)
  'matrix-grid': () => import('./charts/matrix/matrix-grid.js'),
  'nine-field-matrix': () => import('./charts/matrix/nine-field-matrix.js'),

  // Media (Sprint 18 Tier 3 C) — image rendering for PL-style hero / full-bleed slides
  image: () => import('./media/image.js'),
  'image-split': () => import('./media/image-split.js'),

  // Icons (Phase 4) — 24 atlas-icon names wrapped in pseudo-3D badge
  'icon-badge': () => import('./icons/icon-badge.js'),
  // Icons (Sprint 18) — N icons horizontally with labels (vision/values/contact)
  'icon-row': () => import('./icons/icon-row.js'),
  // Icons (Sprint 18 T5) — M×N icon grid (services / values / features)
  'icon-grid': () => import('./icons/icon-grid.js'),

  // Presentation (Phase 4) — deck cover / title page
  cover: () => import('./presentation/cover.js'),

  // Sprint 19 Batch 1 — typography / diagrams / data atoms
  'quote-pull': () => import('./charts/typography/quote-pull.js'),
  swot: () => import('./charts/diagrams/swot.js'),
  'value-chain-diagram': () => import('./charts/diagrams/value-chain-diagram.js'),
  'change-curve-chart': () => import('./charts/data/change-curve-chart.js'),

  // Sprint 19 Batch 2 — diagrams / typography / data
  'radial-wheel-segmented': () => import('./charts/diagrams/radial-wheel-segmented.js'),
  'section-number-divider': () => import('./charts/typography/section-number-divider.js'),
  'stat-banner': () => import('./charts/data/stat-banner.js'),
  'comparison-table': () => import('./charts/diagrams/comparison-table.js'),

  // Sprint 20 Batch 1 — diagrams / data / lists / typography
  'process-arrows': () => import('./charts/diagrams/process-arrows.js'),
  'stat-grid-large': () => import('./charts/data/stat-grid-large.js'),
  'number-list': () => import('./charts/lists/number-list.js'),
  'call-to-action': () => import('./charts/typography/call-to-action.js'),

  // Sprint 20 Batch 2 — diagrams / data / typography
  'vertical-timeline': () => import('./charts/diagrams/vertical-timeline.js'),
  'segmented-bar': () => import('./charts/data/segmented-bar.js'),

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
