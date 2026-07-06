// sdf-js/src/scene/ir-to-2d.js
// Output adapter: IR (from text-to-ir / scaffold-to-ir) → 2D pseudo-3D atom
// sceneData, the REVERSE direction of scaffold-to-ir.js's atoms→IR bridge.
//
// Why this exists: weak-display machines (no WebGL, headless CI, low-power
// laptops) can't run the 3D cinematic renderer — but they can still render
// Canvas2D. This is also the seam that unlocks PPTX/PDF export for
// text-authored decks (author.html's text-to-ir output), since the
// exporters (exporters/pptx.js, exporters/pdf.js) only know how to draw
// atoms-2d sceneData, never IR or 3D scenes directly.
//
// One IR → ONE full-slide atom subject (not a multi-atom composition — v1
// keeps the mapping 1:1 and legible; a richer slot-composition layer can be
// layered on later without changing this contract).
//
//   sequence  → funnel-with-conversion (strictly decreasing magnitude)
//               else process-arrows (no magnitude / non-monotonic)
//   hierarchy → org-chart (relations rebuilt into a {name, children} tree)
//   network   → relationship-graph (relations → edges)
//   magnitude → bar (nodes → labels, magnitude → values)
//
// Every input is run through validateIR first — this file never guesses at
// a malformed IR's intent.
import { validateIR } from './ir.js';
import { getTheme } from '../present/themes.js';

const SLIDE = { x: 40, y: 20, w: 1200, h: 680 };

// ---- hierarchy: relations → {name, children} tree ---------------------------

function findRootIndex(nodes, relations) {
  const hasParent = new Set(relations.map((r) => r[1]));
  for (let i = 0; i < nodes.length; i++) if (!hasParent.has(i)) return i;
  return 0; // unreachable when validateIR passed (hierarchy guarantees 1 root)
}

function buildTree(nodes, relations, rootIdx, labelKey) {
  const childrenOf = new Map();
  for (const [parent, child] of relations) {
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(child);
  }
  function build(idx) {
    const node = { [labelKey]: nodes[idx] };
    const kids = childrenOf.get(idx);
    if (kids && kids.length) node.children = kids.map(build);
    return node;
  }
  return build(rootIdx);
}

// ---- per-structure mappers ----------------------------------------------------

function sequenceToSubject(ir) {
  const nodes = ir.nodes;
  const magnitude = Array.isArray(ir.magnitude) ? ir.magnitude : null;
  const isStrictlyDecreasing =
    magnitude != null &&
    magnitude.length === nodes.length &&
    magnitude.length >= 2 &&
    magnitude.every((v, i) => i === 0 || magnitude[i - 1] > v);

  if (isStrictlyDecreasing) {
    return {
      type: 'funnel-with-conversion',
      ...SLIDE,
      args: {
        title: ir.title || '',
        stages: nodes.map((label, i) => ({ label, value: magnitude[i] })),
      },
    };
  }
  return {
    type: 'process-arrows',
    ...SLIDE,
    args: {
      title: ir.title || '',
      steps: nodes.map((label) => ({ label })),
    },
  };
}

function hierarchyToSubject(ir) {
  const relations = Array.isArray(ir.relations) ? ir.relations : [];
  const rootIdx = findRootIndex(ir.nodes, relations);
  const root = buildTree(ir.nodes, relations, rootIdx, 'name');
  return {
    type: 'org-chart',
    ...SLIDE,
    args: { title: ir.title || '', root },
  };
}

function networkToSubject(ir) {
  const nodes = ir.nodes.map((label, i) => ({ id: String(i), label }));
  const edges = (ir.relations || []).map(([from, to]) => ({ from: String(from), to: String(to) }));
  return {
    type: 'relationship-graph',
    ...SLIDE,
    args: { title: ir.title || '', nodes, edges },
  };
}

function magnitudeToSubject(ir) {
  return {
    type: 'bar',
    ...SLIDE,
    args: {
      title: ir.title || '',
      labels: ir.nodes,
      values: ir.magnitude,
    },
  };
}

const STRUCTURE_TO_SUBJECT = {
  sequence: sequenceToSubject,
  hierarchy: hierarchyToSubject,
  network: networkToSubject,
  magnitude: magnitudeToSubject,
};

/**
 * irToSceneData(ir, opts?) → sceneData
 * One IR → one full-slide 2D atom subject, wrapped in the sceneData shape
 * atoms-2d/renderer.js's renderSceneDataToCanvas expects: { subjects: [...] }.
 * Throws if `ir` fails validateIR.
 */
export function irToSceneData(ir, _opts = {}) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`irToSceneData: invalid IR — ${v.errors.join('; ')}`);
  const fn = STRUCTURE_TO_SUBJECT[ir.structure];
  if (!fn) throw new Error(`irToSceneData: no 2D mapping for structure "${ir.structure}"`);
  return { subjects: [fn(ir)] };
}

/**
 * irDeckTo2DDeck(irDeck, opts?) → export-ready deck
 * {title, slides:[IR...]} → the shape exporters/pptx.js + exporters/pdf.js
 * (and scaffold-view.js's onExport) expect:
 *   {title, theme, scaffold:{id,label}, slots:[{slotIdx,slotName,slotTitle,slotPurpose,sceneData}]}
 *
 * @param {object} irDeck — {title, slides: IR[]}
 * @param {object} [opts]
 * @param {string|object} [opts.theme] — theme id (resolved via getTheme) or a
 *   theme object already; defaults to 'editorial-navy'.
 */
export function irDeckTo2DDeck(irDeck, opts = {}) {
  const theme =
    (typeof opts.theme === 'string' ? getTheme(opts.theme) : opts.theme) ||
    getTheme('editorial-navy');
  const slides = Array.isArray(irDeck?.slides) ? irDeck.slides : [];
  const slots = slides.map((ir, i) => ({
    slotIdx: i,
    slotName: ir.title || `Slide ${i + 1}`,
    slotTitle: ir.title || '',
    slotPurpose: '',
    sceneData: irToSceneData(ir, opts),
  }));
  return {
    title: irDeck?.title || 'Untitled',
    theme,
    scaffold: { id: 'ir-deck', label: 'IR Deck' },
    slots,
  };
}
