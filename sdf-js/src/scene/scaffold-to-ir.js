// sdf-js/src/scene/scaffold-to-ir.js
// Input adapter: the 2D scaffold pipeline's baked output (deck.json + slot
// sceneData, 101 atoms) → IR. Reads data (args) only, never x/y/w/h — that's
// what lets a text→IR adapter slot in later unchanged, and lets a scaffold
// deck feed the SAME cinematic renderer (assembleDeck) as text-to-ir.
//
// Layers, thin → thick:
//   atomToIR(subject)   — one atom's args → one IR, or null (no/invalid structure)
//   slotToIR(sceneData) — a slot's several subjects → the ONE richest IR
//   deckToIR(deckDir)   — a baked deck directory → {title, slides: IR[]}
//
// Every IR this file emits is run through validateIR before being returned;
// on failure we console.warn and return null rather than hand the renderer
// garbage (per the IR contract's own rule: the validator is the gate).
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateIR } from './ir.js';
import { RENDERER_STRUCTURES } from './render-ir.js';

// ---- numeric parsing --------------------------------------------------------
// Atom args are prose-formatted for human legibility ("$3.4M", "12,450",
// "92%") but IR magnitude must be real numbers. Leading-numeric parse with
// K/M/B multiplier support; anything that doesn't look like a number → null
// so the caller can skip the atom rather than emit a fake zero.
export function parseMagnitude(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^([+-])?\$?([\d,]+(?:\.\d+)?)\s*([KMBkmb])?%?$/);
  if (!m) return null;
  const [, sign, numStr, suffix] = m;
  let num = parseFloat(numStr.replace(/,/g, ''));
  if (!Number.isFinite(num)) return null;
  if (suffix) num *= { k: 1e3, m: 1e6, b: 1e9 }[suffix.toLowerCase()];
  if (sign === '-') num = -num;
  return num;
}

// argmax helper — index of the largest value (ties → first).
function argmax(values) {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
}

// clamp helper for cell-index derivation (matrix family).
function clampInt(v, lo, hi) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

// Validate + warn-and-drop-on-failure, so a mapping bug never emits garbage
// IR into the renderer — it just silently loses that one atom.
function finish(ir, atomType) {
  const v = validateIR(ir);
  if (!v.ok) {
    console.warn(`scaffold-to-ir: ${atomType} produced invalid IR — ${v.errors.join('; ')}`);
    return null;
  }
  return ir;
}

// Flatten a recursive { [labelKey], children? } tree into IR nodes + relations
// (parent→child index pairs). Root is always index 0 and — by construction —
// the only node with no incoming relation, so validateIR's "exactly one root"
// check always passes for a genuine tree input.
function flattenTree(root, labelKey) {
  const nodes = [];
  const relations = [];
  (function visit(node, parentIdx) {
    const idx = nodes.length;
    nodes.push(node?.[labelKey] || '');
    if (parentIdx != null) relations.push([parentIdx, idx]);
    const children = Array.isArray(node?.children) ? node.children : [];
    for (const c of children) visit(c, idx);
  })(root, null);
  return { nodes, relations };
}

function treeToIR(a, atomType, labelKey) {
  if (!a?.root) return null;
  const { nodes, relations } = flattenTree(a.root, labelKey);
  if (nodes.length < 2) return null; // no children — nothing structural to show
  return finish(
    {
      structure: 'hierarchy',
      nodes,
      relations,
      order: nodes.map((_, i) => i),
      title: a.title || '',
    },
    atomType,
  );
}

// ---- sequence family (ordered stages) ---------------------------------------

function funnelToIR(a) {
  const stages = Array.isArray(a?.stages) ? a.stages : [];
  if (!stages.length) return null;
  const nodes = stages.map((s) => (typeof s === 'string' ? s : s?.label || ''));
  return finish(
    {
      structure: 'sequence',
      nodes,
      magnitude: stages.map((s) => Number(s?.value) || 0),
      emphasis: [Math.max(0, stages.length - 1)],
      order: nodes.map((_, i) => i),
      title: a.title || '',
    },
    'funnel',
  );
}

function funnelWithConversionToIR(a) {
  const stages = Array.isArray(a?.stages) ? a.stages : [];
  if (!stages.length) return null;
  const nodes = stages.map((s) => s?.label || '');
  return finish(
    {
      structure: 'sequence',
      nodes,
      magnitude: stages.map((s) => Number(s?.value) || 0),
      emphasis: [Math.max(0, stages.length - 1)],
      order: nodes.map((_, i) => i),
      title: a.title || '',
    },
    'funnel-with-conversion',
  );
}

function processArrowsToIR(a) {
  const steps = Array.isArray(a?.steps) ? a.steps : [];
  if (!steps.length) return null;
  const nodes = steps.map((s) => (typeof s === 'string' ? s : s?.label || ''));
  return finish(
    { structure: 'sequence', nodes, order: nodes.map((_, i) => i), title: a.title || '' },
    'process-arrows',
  );
}

function progressionToIR(a) {
  const steps = Array.isArray(a?.steps) ? a.steps : [];
  if (!steps.length) return null;
  const nodes = steps.map((s) => (typeof s === 'string' ? s : s?.label || ''));
  const currentIdx = steps.findIndex((s) => s?.status === 'current');
  const ir = { structure: 'sequence', nodes, order: nodes.map((_, i) => i), title: a.title || '' };
  if (currentIdx >= 0) ir.emphasis = [currentIdx];
  return finish(ir, 'progression');
}

function flowChartToIR(a) {
  const steps = Array.isArray(a?.steps) ? a.steps : [];
  if (!steps.length) return null;
  const nodes = steps.map((s) => String(s));
  const ir = { structure: 'sequence', nodes, order: nodes.map((_, i) => i), title: a.title || '' };
  if (Number.isInteger(a.highlight)) ir.emphasis = [a.highlight];
  return finish(ir, 'flow-chart');
}

function timelineToIR(a, atomType) {
  const events = Array.isArray(a?.events) ? a.events : [];
  if (!events.length) return null;
  const nodes = events.map((e) => e?.label || e?.date || '');
  return finish(
    { structure: 'sequence', nodes, order: nodes.map((_, i) => i), title: a.title || '' },
    atomType,
  );
}

function journeyFlowCurveToIR(a) {
  const tps = Array.isArray(a?.touchpoints) ? a.touchpoints : [];
  if (!tps.length) return null;
  const nodes = tps.map((t) => t?.label || '');
  // emotion is -1..+1; remap to a positive 0..100 magnitude scale.
  const magnitude = tps.map((t) => (Number.isFinite(t?.emotion) ? (t.emotion + 1) * 50 : 50));
  return finish(
    {
      structure: 'sequence',
      nodes,
      magnitude,
      order: nodes.map((_, i) => i),
      emphasis: [argmax(magnitude)],
      title: a.title || '',
    },
    'journey-flow-curve',
  );
}

function changeCurveChartToIR(a) {
  const phases = Array.isArray(a?.phases) ? a.phases : [];
  if (!phases.length) return null;
  const nodes = phases.map((p) => (typeof p === 'string' ? p : p?.label || ''));
  return finish(
    { structure: 'sequence', nodes, order: nodes.map((_, i) => i), title: a.title || '' },
    'change-curve-chart',
  );
}

function circleProcessCycleToIR(a) {
  const steps = Array.isArray(a?.steps) ? a.steps : [];
  if (!steps.length) return null;
  const nodes = steps.map((s) => (typeof s === 'string' ? s : s?.label || ''));
  return finish(
    {
      structure: 'sequence',
      nodes,
      order: nodes.map((_, i) => i),
      title: a.title || a.centerLabel || '',
    },
    'circle-process-cycle',
  );
}

function maturityModelToIR(a) {
  const stages = Array.isArray(a?.stages) ? a.stages : [];
  if (!stages.length) return null;
  const nodes = stages.map((s) => (typeof s === 'string' ? s : s?.label || ''));
  const ir = { structure: 'sequence', nodes, order: nodes.map((_, i) => i), title: a.title || '' };
  if (Number.isInteger(a.currentLevel)) ir.emphasis = [Math.max(0, a.currentLevel - 1)];
  return finish(ir, 'maturity-model');
}

function kanbanBoardToIR(a) {
  const columns = Array.isArray(a?.columns) ? a.columns : [];
  if (!columns.length) return null;
  const nodes = columns.map((c) => c?.label || '');
  const magnitude = columns.map((c) => (Array.isArray(c?.cards) ? c.cards.length : 0));
  return finish(
    {
      structure: 'sequence',
      nodes,
      magnitude,
      order: nodes.map((_, i) => i),
      title: a.title || '',
    },
    'kanban-board',
  );
}

// ---- hierarchy family (parent→child, one root) ------------------------------

function okrTreeToIR(a) {
  const krs = Array.isArray(a?.keyResults) ? a.keyResults : [];
  if (!a?.objective || !krs.length) return null;
  const nodes = [a.objective, ...krs.map((k) => (typeof k === 'string' ? k : k?.label || ''))];
  const relations = krs.map((_, i) => [0, i + 1]);
  return finish(
    {
      structure: 'hierarchy',
      nodes,
      relations,
      order: nodes.map((_, i) => i),
      title: a.quarter ? `${a.objective} · ${a.quarter}` : a.objective,
    },
    'okr-tree',
  );
}

function decisionTree3ArmToIR(a) {
  const arms = Array.isArray(a?.arms) ? a.arms : [];
  if (!a?.question || !arms.length) return null;
  const nodes = [a.question, ...arms.map((ar) => (typeof ar === 'string' ? ar : ar?.label || ''))];
  const relations = arms.map((_, i) => [0, i + 1]);
  return finish(
    {
      structure: 'hierarchy',
      nodes,
      relations,
      order: nodes.map((_, i) => i),
      title: a.title || a.question,
    },
    'decision-tree-3-arm',
  );
}

// pyramid is levels, not strictly parent→child — but its layers are ordered
// broad-to-narrow, so it fits sequence naturally; when layers carry values it
// is better read as a magnitude comparison (base vs apex size).
function pyramidToIR(a) {
  const layers = Array.isArray(a?.layers) ? a.layers : [];
  if (!layers.length) return null;
  const nodes = layers.map((l) => (typeof l === 'string' ? l : l?.label || ''));
  const parsedValues = layers.map((l) => (l && l.value != null ? parseMagnitude(l.value) : null));
  const hasAllValues = parsedValues.every((v) => v != null);
  if (hasAllValues) {
    return finish(
      {
        structure: 'magnitude',
        nodes,
        magnitude: parsedValues,
        emphasis: [argmax(parsedValues)],
        title: a.title || '',
      },
      'pyramid',
    );
  }
  return finish(
    {
      structure: 'sequence',
      nodes,
      order: nodes.map((_, i) => i),
      emphasis: [a.inverted ? 0 : nodes.length - 1],
      title: a.title || '',
    },
    'pyramid',
  );
}

// ---- network family (undirected edges) --------------------------------------

function relationshipGraphToIR(a) {
  const nodesArr = Array.isArray(a?.nodes) ? a.nodes : [];
  const edgesArr = Array.isArray(a?.edges) ? a.edges : [];
  if (nodesArr.length < 2 || !edgesArr.length) return null;
  const idIndex = new Map(nodesArr.map((n, i) => [n.id, i]));
  const relations = [];
  for (const e of edgesArr) {
    const from = idIndex.get(e.from);
    const to = idIndex.get(e.to);
    if (from == null || to == null || from === to) continue;
    relations.push([from, to]);
  }
  if (!relations.length) return null;
  return finish(
    {
      structure: 'network',
      nodes: nodesArr.map((n) => n.label || n.id || ''),
      relations,
      title: a.title || '',
    },
    'relationship-graph',
  );
}

// Star-topology helper: one hub + N satellites, all satellites edged to hub.
function hubSpokeToIR(hubLabel, satellites, satLabelFn, atomType, title) {
  if (!satellites || satellites.length < 2) return null;
  const nodes = [hubLabel || 'Hub', ...satellites.map(satLabelFn)];
  const relations = satellites.map((_, i) => [0, i + 1]);
  return finish({ structure: 'network', nodes, relations, title: title || '' }, atomType);
}

function sphereNetworkToIR(a) {
  const sats = Array.isArray(a?.satellites) ? a.satellites : [];
  return hubSpokeToIR(a?.hub?.label, sats, (s) => s?.label || '', 'sphere-network', a.title);
}

function circleImageHubSpokeToIR(a) {
  const sats = Array.isArray(a?.satellites) ? a.satellites : [];
  if (!a?.center) return null;
  return hubSpokeToIR(
    a.center.label,
    sats,
    (s) => s?.label || '',
    'circle-image-hub-spoke',
    a.title,
  );
}

function radialWheelSegmentedToIR(a) {
  const segs = Array.isArray(a?.segments) ? a.segments : [];
  if (!a?.hub) return null;
  return hubSpokeToIR(
    a.hub,
    segs,
    (s) => (typeof s === 'string' ? s : s?.label || ''),
    'radial-wheel-segmented',
    a.title,
  );
}

// ---- magnitude family (quantities compared) ---------------------------------

function valuesLabelsToIR(a, atomType) {
  const values = Array.isArray(a?.values) ? a.values : [];
  const labels = Array.isArray(a?.labels) ? a.labels : [];
  if (!values.length || values.length !== labels.length) return null;
  return finish(
    {
      structure: 'magnitude',
      nodes: labels,
      magnitude: values,
      emphasis: [argmax(values)],
      title: a.title || '',
    },
    atomType,
  );
}

// Shared shape for "array of { label, <valueKey> }" → magnitude, parsing
// prose-formatted values; skips the whole atom (returns null) if ANY value
// fails to parse rather than emit a partial/garbage magnitude array.
function labeledValuesToIR(items, valueKey, atomType, title) {
  if (!items || !items.length) return null;
  const nodes = items.map((it) => it?.label || '');
  const magnitude = items.map((it) => parseMagnitude(it?.[valueKey]));
  if (magnitude.some((v) => v == null)) return null;
  return finish(
    { structure: 'magnitude', nodes, magnitude, emphasis: [argmax(magnitude)], title: title || '' },
    atomType,
  );
}

function donutWithCenterToIR(a) {
  return labeledValuesToIR(a?.segments, 'value', 'donut-with-center', a?.title || a?.centerLabel);
}

function segmentedBarToIR(a) {
  return labeledValuesToIR(a?.segments, 'value', 'segmented-bar', a?.title);
}

function statGridLargeToIR(a) {
  return labeledValuesToIR(a?.stats, 'value', 'stat-grid-large', a?.title);
}

function dashboardMultiKpiToIR(a) {
  return labeledValuesToIR(a?.kpis, 'value', 'dashboard-multi-kpi-composite', a?.title);
}

function isotypeStatComparisonToIR(a) {
  return labeledValuesToIR(a?.stats, 'count', 'isotype-stat-comparison', a?.title);
}

function histogramToIR(a) {
  const bins = Array.isArray(a?.bins) ? a.bins : [];
  if (!bins.length) return null;
  const nodes = bins.map((b) => (Array.isArray(b?.range) ? `${b.range[0]}-${b.range[1]}` : ''));
  const magnitude = bins.map((b) => (typeof b?.count === 'number' ? b.count : null));
  if (magnitude.some((v) => v == null)) return null;
  return finish(
    {
      structure: 'magnitude',
      nodes,
      magnitude,
      emphasis: [argmax(magnitude)],
      title: a.title || '',
    },
    'histogram',
  );
}

function waterfallToIR(a) {
  const bars = Array.isArray(a?.bars) ? a.bars : [];
  if (!bars.length) return null;
  const nodes = bars.map((b) => b?.label || '');
  const magnitude = bars.map((b) =>
    typeof b?.value === 'number' ? b.value : parseMagnitude(b?.value),
  );
  if (magnitude.some((v) => v == null)) return null;
  const endIdx = bars.findIndex((b) => b?.kind === 'end');
  return finish(
    {
      structure: 'magnitude',
      nodes,
      magnitude,
      emphasis: [endIdx >= 0 ? endIdx : nodes.length - 1],
      title: a.title || '',
    },
    'waterfall',
  );
}

function radarChartToIR(a) {
  const axes = Array.isArray(a?.axes) ? a.axes : [];
  const series = Array.isArray(a?.series) ? a.series : [];
  if (!axes.length || !series.length) return null;
  const first = series[0];
  const values = Array.isArray(first?.values) ? first.values : [];
  if (values.length !== axes.length) return null;
  const magnitude = values.map((v) => (Number.isFinite(v) ? v * 100 : null));
  if (magnitude.some((v) => v == null)) return null;
  return finish(
    {
      structure: 'magnitude',
      nodes: axes,
      magnitude,
      emphasis: [argmax(magnitude)],
      title: a.title || first.label || '',
    },
    'radar-chart',
  );
}

// ---- matrix family (2-axis classification) -----------------------------------
// Sprint 28: the 6 "2-dimensional classification" atoms that TODO'd in the
// coverage doc waiting for the IR to grow a matrix structure (see ir.js).

function swotToIR(a) {
  const groups = [
    { items: a?.strengths, cell: [0, 0] }, // Internal × Helpful
    { items: a?.weaknesses, cell: [0, 1] }, // Internal × Harmful
    { items: a?.opportunities, cell: [1, 0] }, // External × Helpful
    { items: a?.threats, cell: [1, 1] }, // External × Harmful
  ];
  const nodes = [];
  const cells = [];
  for (const g of groups) {
    for (const it of Array.isArray(g.items) ? g.items : []) {
      nodes.push(typeof it === 'string' ? it : it?.label || '');
      cells.push(g.cell);
    }
  }
  if (!nodes.length) return null;
  return finish(
    {
      structure: 'matrix',
      nodes,
      axes: [
        ['Internal', 'External'],
        ['Helpful', 'Harmful'],
      ],
      cells,
      title: a.title || 'SWOT Analysis',
    },
    'swot',
  );
}

function riskHeatmapToIR(a) {
  const risks = Array.isArray(a?.risks) ? a.risks : [];
  if (!risks.length) return null;
  const DEFAULT_LABELS = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
  const xLabels = Array.isArray(a.xLabels) && a.xLabels.length ? a.xLabels : DEFAULT_LABELS;
  const yLabels = Array.isArray(a.yLabels) && a.yLabels.length ? a.yLabels : DEFAULT_LABELS;
  const nodes = risks.map((r) => r?.label || '');
  const cells = risks.map((r) => [
    clampInt(Number(r?.likelihood) - 1, 0, xLabels.length - 1),
    clampInt(Number(r?.impact) - 1, 0, yLabels.length - 1),
  ]);
  const magnitude = risks.map((r) => (Number(r?.likelihood) || 0) * (Number(r?.impact) || 0));
  return finish(
    {
      structure: 'matrix',
      nodes,
      axes: [xLabels, yLabels],
      cells,
      magnitude,
      emphasis: [argmax(magnitude)],
      title: a.title || 'Risk Assessment Matrix',
    },
    'risk-heatmap',
  );
}

function costBenefitMatrixToIR(a) {
  const items = Array.isArray(a?.items) ? a.items : [];
  if (!items.length) return null;
  const nodes = items.map((it) => it?.label || '');
  const cells = items.map((it) => [it?.cost === 'high' ? 1 : 0, it?.benefit === 'high' ? 1 : 0]);
  return finish(
    {
      structure: 'matrix',
      nodes,
      axes: [
        ['Low Cost', 'High Cost'],
        ['Low Benefit', 'High Benefit'],
      ],
      cells,
      title: a.title || '',
    },
    'cost-benefit-matrix',
  );
}

function orgVsOrgMatrixToIR(a) {
  const orgs = Array.isArray(a?.orgs) ? a.orgs : [];
  if (!orgs.length) return null;
  const xAxis = a.xAxis || 'X Axis';
  const yAxis = a.yAxis || 'Y Axis';
  const nodes = orgs.map((o) => o?.name || '');
  const cells = orgs.map((o) => [
    (Number(o?.x) || 0) >= 0.5 ? 1 : 0,
    (Number(o?.y) || 0) >= 0.5 ? 1 : 0,
  ]);
  const usIdx = orgs.findIndex((o) => o?.isUs);
  const ir = {
    structure: 'matrix',
    nodes,
    axes: [
      [`Low ${xAxis}`, `High ${xAxis}`],
      [`Low ${yAxis}`, `High ${yAxis}`],
    ],
    cells,
    title: a.title || '',
  };
  if (usIdx >= 0) ir.emphasis = [usIdx];
  const sizes = orgs.map((o) => (Number.isFinite(o?.size) ? o.size : null));
  if (sizes.every((v) => v != null)) ir.magnitude = sizes;
  return finish(ir, 'org-vs-org-matrix');
}

// matrix-grid: rows×cols cells in row-major order → generic ['Col N']/['Row
// N'] axes, unless the atom carries a named 2-endpoint xAxis/yAxis (only
// meaningful when that dimension is exactly 2 wide).
function matrixGridToIR(a) {
  const cellsArg = Array.isArray(a?.cells) ? a.cells : [];
  if (!cellsArg.length) return null;
  const rows = clampInt(a.rows || 2, 1, 4);
  const cols = clampInt(a.cols || 2, 1, 4);
  const xCats =
    cols === 2 && a.xAxis && (a.xAxis.low || a.xAxis.high)
      ? [a.xAxis.low || 'Low', a.xAxis.high || 'High']
      : Array.from({ length: cols }, (_, i) => `Col ${i + 1}`);
  const yCats =
    rows === 2 && a.yAxis && (a.yAxis.low || a.yAxis.high)
      ? [a.yAxis.low || 'Low', a.yAxis.high || 'High']
      : Array.from({ length: rows }, (_, i) => `Row ${i + 1}`);
  const nodes = [];
  const cells = [];
  for (let idx = 0; idx < cellsArg.length && idx < rows * cols; idx++) {
    nodes.push(cellsArg[idx]?.label || '');
    cells.push([idx % cols, Math.floor(idx / cols)]);
  }
  if (!nodes.length) return null;
  return finish(
    { structure: 'matrix', nodes, axes: [xCats, yCats], cells, title: a.title || '' },
    'matrix-grid',
  );
}

// nine-field-matrix: fixed 3x3 GE/McKinsey grid — axes are the model's own
// Low/Medium/High business-strength × industry-attractiveness semantics.
function nineFieldMatrixToIR(a) {
  const cellsArg = Array.isArray(a?.cells) ? a.cells : [];
  if (!cellsArg.length) return null;
  const xCats = ['Low', 'Medium', 'High'];
  const yCats = ['Low', 'Medium', 'High'];
  const nodes = [];
  const cells = [];
  for (let idx = 0; idx < cellsArg.length && idx < 9; idx++) {
    nodes.push(cellsArg[idx]?.label || '');
    cells.push([idx % 3, Math.floor(idx / 3)]);
  }
  if (!nodes.length) return null;
  return finish(
    { structure: 'matrix', nodes, axes: [xCats, yCats], cells, title: a.title || '' },
    'nine-field-matrix',
  );
}

// ---- registry ----------------------------------------------------------------
// type → (args) => IR|null. ~40 high-value atoms with real structural content;
// everything else (cover / quote-pull / image / single-value stat cards /
// pure shapes / icons…) has no entry and atomToIR returns null for it — by
// design, not oversight. See docs/superpowers/atoms-to-ir-coverage.md.
const ATOM_IR_MAP = {
  // sequence
  funnel: funnelToIR,
  'funnel-with-conversion': funnelWithConversionToIR,
  'process-arrows': processArrowsToIR,
  progression: progressionToIR,
  'flow-chart': flowChartToIR,
  timeline: (a) => timelineToIR(a, 'timeline'),
  'vertical-timeline': (a) => timelineToIR(a, 'vertical-timeline'),
  'journey-flow-curve': journeyFlowCurveToIR,
  'change-curve-chart': changeCurveChartToIR,
  'circle-process-cycle': circleProcessCycleToIR,
  'maturity-model': maturityModelToIR,
  'kanban-board': kanbanBoardToIR,

  // hierarchy
  'org-chart': (a) => treeToIR(a, 'org-chart', 'name'),
  'tree-diagram': (a) => treeToIR(a, 'tree-diagram', 'label'),
  mindmap: (a) => treeToIR(a, 'mindmap', 'label'),
  'sphere-tree': (a) => treeToIR(a, 'sphere-tree', 'label'),
  'okr-tree': okrTreeToIR,
  'decision-tree-3-arm': decisionTree3ArmToIR,
  pyramid: pyramidToIR, // conditional: magnitude (has values) or sequence

  // network
  'relationship-graph': relationshipGraphToIR,
  'sphere-network': sphereNetworkToIR,
  'circle-image-hub-spoke': circleImageHubSpokeToIR,
  'radial-wheel-segmented': radialWheelSegmentedToIR,

  // magnitude
  bar: (a) => valuesLabelsToIR(a, 'bar'),
  column: (a) => valuesLabelsToIR(a, 'column'),
  pie: (a) => valuesLabelsToIR(a, 'pie'),
  'donut-with-center': donutWithCenterToIR,
  'segmented-bar': segmentedBarToIR,
  'stat-grid-large': statGridLargeToIR,
  'dashboard-multi-kpi-composite': dashboardMultiKpiToIR,
  'isotype-stat-comparison': isotypeStatComparisonToIR,
  histogram: histogramToIR,
  waterfall: waterfallToIR,
  'radar-chart': radarChartToIR,

  // matrix (2-axis classification — see ir.js)
  swot: swotToIR,
  'risk-heatmap': riskHeatmapToIR,
  'cost-benefit-matrix': costBenefitMatrixToIR,
  'org-vs-org-matrix': orgVsOrgMatrixToIR,
  'matrix-grid': matrixGridToIR,
  'nine-field-matrix': nineFieldMatrixToIR,
};

/**
 * atomToIR(subject) → IR | null
 * One 2D atom subject ({ type, args }) → its best-fit IR, or null if the atom
 * has no structural content mapped (by design) or its args don't shape into
 * a valid IR (e.g. missing required fields, unparseable magnitude values).
 */
export function atomToIR(subject) {
  if (!subject || typeof subject.type !== 'string') return null;
  const fn = ATOM_IR_MAP[subject.type];
  if (!fn) return null;
  try {
    return fn(subject.args || {});
  } catch (e) {
    console.warn(`scaffold-to-ir: ${subject.type} threw — ${e.message}`);
    return null;
  }
}

// ---- slot-level KPI aggregation ----------------------------------------------
// The single dominant shape in real 2D output (77/423 atoms in the handoff ammo)
// is "a page of KPI cards" — no single card has structure, but the PAGE does:
// N comparable quantities = a magnitude IR. Aggregate kpi-card siblings and
// dashboard-multi-kpi-composite kpis[] — but only within one UNIT FAMILY
// ($ / % / bare number, by value-string shape): comparing "$1,146.8M" against
// "+69%" as bar heights would lie. Mixed-unit pages stay unaggregated
// (contract gap logged for §9.5).
const unitFamily = (v) => {
  const s = String(v).trim();
  if (s.includes('%')) return '%';
  if (s.includes('$')) return '$';
  return '#';
};

function kpiSlotToIR(subjects) {
  const kpis = [];
  for (const s of subjects) {
    if (s.type === 'kpi-card' && s.args) kpis.push(s.args);
    else if (s.type === 'dashboard-multi-kpi-composite' && Array.isArray(s.args?.kpis))
      kpis.push(...s.args.kpis);
  }
  // largest unit family with ≥2 parseable values wins
  const fams = {};
  for (const k of kpis) {
    const val = parseMagnitude(k.value);
    if (val == null || !k.label) continue;
    const fam = unitFamily(k.value);
    (fams[fam] = fams[fam] || []).push({ label: String(k.label), val, display: String(k.value) });
  }
  const best = Object.values(fams).sort((a, b) => b.length - a.length)[0];
  if (!best || best.length < 2) return null;
  const magnitude = best.map((k) => k.val);
  return {
    structure: 'magnitude',
    nodes: best.map((k) => k.label),
    magnitude,
    // display: keep the 2D end's human formatting ("$240.5M") for the value
    // labels — bare parsed numbers as UI text would violate the numbers-are-
    // payload rule the 2D end enforces upstream.
    display: best.map((k) => k.display),
    emphasis: [argmax(magnitude)],
    title: '',
  };
}

/**
 * slotToIR(sceneData) → IR | null
 * A slot carries several atom subjects (a cover + N content atoms); pick the
 * single richest structural one — most nodes wins, first wins ties. When no
 * single atom has structure, fall back to slot-level KPI aggregation (a page
 * of comparable KPI cards IS a magnitude). Returns null when neither applies.
 */
export function slotToIR(sceneData) {
  const subjects = Array.isArray(sceneData?.subjects) ? sceneData.subjects : [];
  let best = null;
  for (const s of subjects) {
    const ir = atomToIR(s);
    if (!ir) continue;
    if (!best || ir.nodes.length > best.nodes.length) best = ir;
  }
  if (!best) best = kpiSlotToIR(subjects);
  return best;
}

/**
 * deckToIR(deckDir, opts?) → { title, slides: IR[] }
 * Reads a baked scaffold deck directory (deck.json manifest + slots/*.json,
 * the shape bake-scaffold-pipeline.mjs produces and eval-deck-quality.mjs
 * reads) and returns an assembleDeck-ready deck. Skips slots that errored,
 * mapped empty, or have no structural subject.
 *
 * render-ir.js throws on a structure with no renderer — 'matrix' is a valid
 * IR structure (both bridges + text-to-ir emit/consume it) but has no 3D
 * renderer yet (docs/superpowers/ir-matrix-proposal.md). So by default this
 * only RETURNS slides whose structure RENDERER_STRUCTURES supports; slides
 * filtered out are logged, not silently dropped.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.structures] — allowlist override (e.g. include
 *   'matrix' once the 3D renderer exists, or for tooling that only needs
 *   the IR itself, not assembleDeck).
 */
export function deckToIR(deckDir, opts = {}) {
  const dir = resolve(deckDir);
  const manifestPath = join(dir, 'deck.json');
  if (!existsSync(manifestPath)) throw new Error(`deckToIR: no deck.json in ${dir}`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const allowed = Array.isArray(opts.structures) ? opts.structures : RENDERER_STRUCTURES;

  const slides = [];
  for (const slot of manifest.slots || []) {
    if (!slot.liftFile || slot.error || slot.mappingEmpty) continue;
    const slotPath = join(dir, slot.liftFile);
    if (!existsSync(slotPath)) continue;
    const slotEntry = JSON.parse(readFileSync(slotPath, 'utf8'));
    const sceneData = slotEntry.sceneData;
    if (!sceneData) continue;
    const ir = slotToIR(sceneData);
    if (!ir) continue;
    if (!allowed.includes(ir.structure)) {
      console.log(
        `deckToIR: filtered slot "${slot.liftFile}" — structure "${ir.structure}" has no 3D renderer yet (see docs/superpowers/ir-matrix-proposal.md)`,
      );
      continue;
    }
    slides.push(ir);
  }

  const title = manifest.scaffold?.label || manifest.deckName || 'Deck';
  return { title, slides };
}

/**
 * funnelSlotToIR(sceneData) — kept for back-compat with existing callers/tests.
 * Throws (rather than returning null) if the slot has no funnel subject —
 * this is the ORIGINAL narrow adapter; new code should use slotToIR/atomToIR.
 */
export function funnelSlotToIR(sceneData) {
  const f = (sceneData.subjects || []).find((s) => s.type === 'funnel');
  if (!f) throw new Error('funnelSlotToIR: no funnel subject in slot');
  const stages = Array.isArray(f.args?.stages) ? f.args.stages : [];
  return {
    structure: 'sequence',
    nodes: stages.map((s) => (typeof s === 'string' ? s : s.label || '')),
    magnitude: stages.map((s) => Number(s?.value) || 0),
    emphasis: [Math.max(0, stages.length - 1)],
    order: stages.map((_, i) => i),
    title: f.args?.title || '',
  };
}

// ---------------------------------------------------------------------------
// atlas-deck (the 2D→3D handoff contract, docs/atlas-deck-contract.md) → IR deck.
// This is the "next floor" the 2D end staged for us (#274/#280): a single-file
// deck with inline sceneData per slot. We validate against deck-spec (ERROR =
// reject, WARNING = log + continue), normalize the subjects/atoms alias, then
// reuse the same slotToIR the bake-manifest path uses.
// ---------------------------------------------------------------------------
import { validateDeck } from '../present/deck-spec.js';

/**
 * atlasDeckToIR(deckJson, opts?) → { title, slides: IR[], report }
 * @param {object|string} deckJson  parsed atlas-deck or its JSON string
 * @param {object} [opts.structures]  allowlist override (default: renderable)
 * report: per-slot outcome [{slot, title, outcome: 'ir:<structure>'|'skipped:<why>'}]
 */
export function atlasDeckToIR(deckJson, opts = {}) {
  const deck = typeof deckJson === 'string' ? JSON.parse(deckJson) : deckJson;
  const { ok, errors, warnings } = validateDeck(deck);
  if (!ok) throw new Error(`atlasDeckToIR: contract violation — ${errors.join(' | ')}`);
  for (const w of warnings || []) console.log(`atlasDeckToIR: [warning] ${w}`);

  const allowed = Array.isArray(opts.structures) ? opts.structures : RENDERER_STRUCTURES;
  const slides = [];
  const report = [];
  (deck.slots || []).forEach((slot, i) => {
    // contract §5: "subjects" or "atoms" (historical alias) are synonymous
    const sceneData = slot.sceneData || {};
    const subjects = Array.isArray(sceneData.subjects)
      ? sceneData.subjects
      : Array.isArray(sceneData.atoms)
        ? sceneData.atoms
        : [];
    const ir = slotToIR({ ...sceneData, subjects });
    const label = slot.slotTitle || slot.slotName || `slot ${i}`;
    if (!ir) {
      report.push({ slot: i, title: label, outcome: 'skipped:no-structural-atom' });
      return;
    }
    if (!allowed.includes(ir.structure)) {
      report.push({ slot: i, title: label, outcome: `skipped:no-renderer:${ir.structure}` });
      return;
    }
    if (!ir.title) ir.title = label;
    slides.push(ir);
    report.push({ slot: i, title: label, outcome: `ir:${ir.structure}` });
  });
  return { title: deck.title || 'atlas-deck', slides, report };
}
