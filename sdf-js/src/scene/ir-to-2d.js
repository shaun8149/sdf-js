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
//   magnitude → bar / pie / donut-with-center — chosen by chooseMagnitudeAtom
//               (data shape: share-language + parts-of-whole → donut, small
//               parts-of-whole → pie, else bar)
//   matrix    → swot / cost-benefit-matrix / risk-heatmap / matrix-grid —
//               chosen by chooseMatrixAtom (axes shape: SWOT-shaped 2×2 →
//               swot, generic 2×2 → cost-benefit-matrix, ≥3×≥3 + magnitude →
//               risk-heatmap, else matrix-grid)
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

// ---- magnitude: smart chart selection (bar / pie / donut-with-center) -------
// "Share of a whole" reads better as pie/donut than bar; a big/lopsided or
// unlabeled-as-share set of quantities reads better as bar. Heuristic, not
// ML — cheap signals a human skimming the same node/title text would use.
const SHARE_LANGUAGE = /share|mix|breakdown|allocation|split|占比|构成|份额/i;

function isPartsOfWhole(magnitude) {
  return (
    Array.isArray(magnitude) &&
    magnitude.length > 0 &&
    magnitude.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)
  );
}

function hasShareLanguage(ir) {
  const haystack = [ir.title, ...(ir.nodes || [])].filter(Boolean).join(' ');
  return SHARE_LANGUAGE.test(haystack);
}

// No single slice dominates (>70% of the total) — a fairly-distributed set
// reads as "composition" even without explicit share/mix/breakdown language.
function noDominantSlice(magnitude) {
  const total = magnitude.reduce((a, b) => a + b, 0);
  if (total <= 0) return false;
  return magnitude.every((v) => v / total <= 0.7);
}

/**
 * chooseMagnitudeAtom(ir) → 'bar' | 'pie' | 'donut-with-center'
 * Pure function of the IR's shape — no side effects, unit-testable in
 * isolation from the subject-building below.
 */
export function chooseMagnitudeAtom(ir) {
  const nodes = ir.nodes || [];
  const magnitude = ir.magnitude;
  const partsOfWhole = isPartsOfWhole(magnitude);
  if (nodes.length <= 6 && partsOfWhole && (hasShareLanguage(ir) || noDominantSlice(magnitude))) {
    return 'donut-with-center';
  }
  if (nodes.length <= 5 && partsOfWhole) return 'pie';
  return 'bar';
}

function magnitudeToSubject(ir) {
  const atomType = chooseMagnitudeAtom(ir);

  if (atomType === 'pie') {
    return {
      type: 'pie',
      ...SLIDE,
      args: {
        title: ir.title || '',
        values: ir.magnitude,
        labels: ir.nodes,
        format: 'percent',
      },
    };
  }

  if (atomType === 'donut-with-center') {
    const total = ir.magnitude.reduce((a, b) => a + b, 0);
    return {
      type: 'donut-with-center',
      ...SLIDE,
      args: {
        title: ir.title || '',
        centerValue: String(Math.round(total * 10) / 10),
        centerLabel: ir.title || 'Total',
        segments: ir.nodes.map((label, i) => ({ label, value: ir.magnitude[i] })),
      },
    };
  }

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

// ---- matrix: axes-shape → swot / cost-benefit-matrix / risk-heatmap / matrix-grid --

function normCat(s) {
  return String(s).trim().toLowerCase();
}

// "Low Cost"/"High Cost" → "Cost" (cost-benefit-matrix's own axes shape, and
// org-vs-org-matrix's `Low ${xAxis}`/`High ${xAxis}` round-trips through the
// same pattern) — falls back to a generic label when the pair doesn't share
// a "Low X"/"High X" shape.
function axisLabelFromCats(cats, fallback) {
  const lo = /^low\s+(.*)$/i.exec(cats?.[0] || '');
  const hi = /^high\s+(.*)$/i.exec(cats?.[1] || '');
  if (lo && hi && lo[1].toLowerCase() === hi[1].toLowerCase()) return hi[1];
  return fallback;
}

function isSwotShaped(axes) {
  const [xCats, yCats] = axes;
  if (xCats.length !== 2 || yCats.length !== 2) return false;
  const x = xCats.map(normCat);
  const y = yCats.map(normCat);
  return (
    x.includes('internal') &&
    x.includes('external') &&
    y.includes('helpful') &&
    y.includes('harmful')
  );
}

/**
 * chooseMatrixAtom(ir) → 'swot' | 'cost-benefit-matrix' | 'risk-heatmap' | 'matrix-grid'
 * Pure function of ir.axes (+ ir.magnitude presence) — shape-driven, same
 * spirit as chooseMagnitudeAtom.
 */
export function chooseMatrixAtom(ir) {
  const axes = Array.isArray(ir.axes) ? ir.axes : [[], []];
  const [xCats, yCats] = axes;
  if (isSwotShaped(axes)) return 'swot';
  if (xCats.length === 2 && yCats.length === 2) return 'cost-benefit-matrix';
  if (xCats.length >= 3 && yCats.length >= 3 && Array.isArray(ir.magnitude)) return 'risk-heatmap';
  return 'matrix-grid';
}

function matrixToSubject(ir) {
  const atomType = chooseMatrixAtom(ir);
  const [xCats, yCats] = ir.axes;

  if (atomType === 'swot') {
    const x = xCats.map(normCat);
    const y = yCats.map(normCat);
    const internalIdx = x.indexOf('internal');
    const helpfulIdx = y.indexOf('helpful');
    const groups = { strengths: [], weaknesses: [], opportunities: [], threats: [] };
    ir.nodes.forEach((label, i) => {
      const [xi, yi] = ir.cells[i];
      const internal = xi === internalIdx;
      const helpful = yi === helpfulIdx;
      if (internal && helpful) groups.strengths.push(label);
      else if (internal && !helpful) groups.weaknesses.push(label);
      else if (!internal && helpful) groups.opportunities.push(label);
      else groups.threats.push(label);
    });
    return {
      type: 'swot',
      ...SLIDE,
      args: { title: ir.title || 'SWOT Analysis', ...groups },
    };
  }

  if (atomType === 'cost-benefit-matrix') {
    const items = ir.nodes.map((label, i) => {
      const [xi, yi] = ir.cells[i];
      return { label, cost: xi === 1 ? 'high' : 'low', benefit: yi === 1 ? 'high' : 'low' };
    });
    return {
      type: 'cost-benefit-matrix',
      ...SLIDE,
      args: {
        title: ir.title || '',
        xAxis: axisLabelFromCats(xCats, 'Cost'),
        yAxis: axisLabelFromCats(yCats, 'Benefit'),
        items,
      },
    };
  }

  if (atomType === 'risk-heatmap') {
    const risks = ir.nodes.map((label, i) => {
      const [xi, yi] = ir.cells[i];
      return { label, likelihood: xi + 1, impact: yi + 1 };
    });
    return {
      type: 'risk-heatmap',
      ...SLIDE,
      args: { title: ir.title || '', xLabels: xCats, yLabels: yCats, risks },
    };
  }

  // matrix-grid fallback — one cell per axis intersection; nodes sharing a
  // cell join into that cell's label (matrix-grid has no per-node concept,
  // only per-cell).
  const rows = yCats.length;
  const cols = xCats.length;
  const cellLabels = Array.from({ length: rows * cols }, () => []);
  ir.nodes.forEach((label, i) => {
    const [xi, yi] = ir.cells[i];
    const idx = yi * cols + xi;
    if (cellLabels[idx]) cellLabels[idx].push(label);
  });
  const args = {
    title: ir.title || '',
    rows,
    cols,
    cells: cellLabels.map((labels) => ({ label: labels.join(', ') || '—' })),
  };
  if (cols === 2) args.xAxis = { low: xCats[0], high: xCats[1] };
  if (rows === 2) args.yAxis = { low: yCats[0], high: yCats[1] };
  return { type: 'matrix-grid', ...SLIDE, args };
}

const STRUCTURE_TO_SUBJECT = {
  sequence: sequenceToSubject,
  hierarchy: hierarchyToSubject,
  network: networkToSubject,
  magnitude: magnitudeToSubject,
  matrix: matrixToSubject,
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
