// sdf-js/src/scene/ir.js
// Intermediate Representation: the neutral "what structure does this content have"
// that decouples input (scaffold / text) from 3D rendering. Grown structure by
// structure — a field earns its place when a renderer needs it (YAGNI).
//
//   sequence  — ordered stages (funnel): nodes + magnitude drive stage widths.
//   hierarchy — parent→child tree (org chart / taxonomy): relations carry the
//               edges as [parentIndex, childIndex] pairs; exactly one root.
//   network   — arbitrary graph (ecosystem / dependencies): relations are
//               undirected edges; hubs emerge from degree, no root required.
//   magnitude — quantities compared as volumetric masses (monolith row):
//               magnitude is REQUIRED; nodes are the category names.
//   matrix    — 2-axis classification (SWOT / risk likelihood×impact /
//               cost-benefit): axes + cells are REQUIRED; magnitude optional
//               (bubble size / severity weight). No 3D renderer yet — see
//               docs/superpowers/ir-matrix-proposal.md; the 2D bridges
//               (scaffold-to-ir, ir-to-2d) and text-to-ir already emit/consume it.
//   hold      — a page with NO chartable structure (cover, narration, product
//               tour): title + optional bullet nodes. Renders as a title-card
//               interlude station (stele + bullet pips; text rides the DOM
//               overlay per the two-text-systems rule). nodes MAY be empty —
//               a cover is legitimately just a title.
export const STRUCTURES = [
  'sequence',
  'hierarchy',
  'network',
  'magnitude',
  'matrix',
  'hold',
  'image',
  'proportion',
  'roadmap',
];

export function validateIR(ir) {
  const errors = [];
  if (!ir || typeof ir !== 'object') return { ok: false, errors: ['ir must be an object'] };
  if (!STRUCTURES.includes(ir.structure)) errors.push(`unknown structure "${ir.structure}"`);
  if (ir.structure === 'hold') {
    // hold: nodes are optional bullets — an empty array (a bare cover) is valid.
    if (!Array.isArray(ir.nodes)) errors.push('nodes must be an array');
  } else if (ir.structure === 'image') {
    // image (浮屏): the page IS the content — nodes are optional captions.
    if (typeof ir.image !== 'string' || !ir.image) errors.push('image requires an image path');
    if (ir.nodes != null && !Array.isArray(ir.nodes)) errors.push('nodes must be an array');
  } else if (ir.structure === 'proportion') {
    // proportion (pie row): groups[] each carry a values[] — nodes unused.
    if (!Array.isArray(ir.groups) || ir.groups.length === 0)
      errors.push('proportion requires a non-empty groups array');
    else if (!ir.groups.every((g) => g && Array.isArray(g.values) && g.values.length))
      errors.push('each proportion group needs a non-empty values array');
  } else if (ir.structure === 'roadmap') {
    // roadmap (climbing timeline): milestones[] each carry a label — nodes unused.
    if (!Array.isArray(ir.milestones) || ir.milestones.length === 0)
      errors.push('roadmap requires a non-empty milestones array');
  } else if (!Array.isArray(ir.nodes) || ir.nodes.length === 0)
    errors.push('nodes must be a non-empty array');
  const N = Array.isArray(ir.nodes) ? ir.nodes.length : 0;
  if (ir.magnitude != null) {
    if (!Array.isArray(ir.magnitude)) errors.push('magnitude must be an array');
    else if (N && ir.magnitude.length !== N)
      errors.push(
        `magnitude length ${ir.magnitude.length} must match nodes length ${N} — emit exactly one value per node (sample the chart at the node labels you emit)`,
      );
  }
  // series (grouped charts): every series must align with nodes — a 9/12/12
  // mismatch renders shifted bars against wrong labels (final-showdown audit:
  // p16 put 237.5M under a phantom "⑨" node).
  if (ir.series != null) {
    if (!Array.isArray(ir.series)) errors.push('series must be an array');
    else
      for (const s of ir.series) {
        if (!s || !Array.isArray(s.values)) {
          errors.push('each series needs a values array');
          break;
        }
        if (N && s.values.length !== N) {
          errors.push(
            `series "${s.label ?? '?'}" has ${s.values.length} values but there are ${N} nodes — every series must sample the SAME ${N} x-positions as your node labels`,
          );
          break;
        }
      }
  }
  if (ir.order != null && (!Array.isArray(ir.order) || ir.order.length !== N))
    errors.push('order length must match nodes length');
  else if (Array.isArray(ir.order)) {
    for (const idx of ir.order) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= N) {
        errors.push(`order index ${idx} references a node out of range`);
        break;
      }
    }
  }
  if (ir.emphasis != null) {
    const scalarEmphasis = ir.structure === 'proportion' || ir.structure === 'roadmap';
    const domain =
      ir.structure === 'proportion'
        ? Array.isArray(ir.groups)
          ? ir.groups.length
          : 0
        : ir.structure === 'roadmap'
          ? Array.isArray(ir.milestones)
            ? ir.milestones.length
            : 0
          : N;
    if (scalarEmphasis) {
      if (!Number.isInteger(ir.emphasis)) errors.push('emphasis must be an integer index');
      else if (ir.emphasis < 0 || ir.emphasis >= domain)
        errors.push(`emphasis index ${ir.emphasis} out of range`);
    } else if (!Array.isArray(ir.emphasis)) {
      errors.push('emphasis must be an array of node indices');
    } else {
      for (const idx of ir.emphasis) {
        if (!Number.isInteger(idx) || idx < 0 || idx >= domain) {
          errors.push(`emphasis index ${idx} out of range`);
          break;
        }
      }
    }
  }
  if (ir.relations != null) {
    if (!Array.isArray(ir.relations)) errors.push('relations must be an array');
    else {
      for (const r of ir.relations) {
        if (
          !Array.isArray(r) ||
          r.length !== 2 ||
          !Number.isInteger(r[0]) ||
          !Number.isInteger(r[1])
        ) {
          errors.push('each relation must be an [fromIndex, toIndex] integer pair');
          break;
        }
        if (r[0] < 0 || r[0] >= N || r[1] < 0 || r[1] >= N) {
          errors.push(`relation [${r[0]},${r[1]}] references a node out of range`);
          break;
        }
      }
    }
  }
  if (ir.structure === 'hierarchy') {
    const rels = Array.isArray(ir.relations) ? ir.relations : [];
    if (rels.length === 0) errors.push('hierarchy requires relations (parent→child edges)');
    else {
      const hasParent = new Set(rels.map((r) => r[1]));
      const roots = [];
      for (let i = 0; i < N; i++) if (!hasParent.has(i)) roots.push(i);
      if (roots.length !== 1)
        errors.push(`hierarchy requires exactly one root (found ${roots.length})`);
    }
  }
  if (ir.structure === 'magnitude') {
    if (!Array.isArray(ir.magnitude) || ir.magnitude.length === 0)
      errors.push('magnitude structure requires a magnitude array');
  }
  if (ir.structure === 'network') {
    const rels = Array.isArray(ir.relations) ? ir.relations : [];
    if (rels.length === 0) errors.push('network requires relations (edges)');
    else if (rels.some((r) => Array.isArray(r) && r[0] === r[1]))
      errors.push('network edges must not be self-loops');
  }
  // matrix: axes = [xCategories, yCategories] (exactly 2 non-empty arrays of
  // non-empty strings), cells = one [xIndex, yIndex] integer pair per node,
  // indices in range of the matching axis. Non-matrix structures never look
  // at axes/cells — permissive like the rest of the contract.
  if (ir.structure === 'matrix') {
    const axesOk =
      Array.isArray(ir.axes) &&
      ir.axes.length === 2 &&
      ir.axes.every(
        (axis) =>
          Array.isArray(axis) &&
          axis.length > 0 &&
          axis.every((c) => typeof c === 'string' && c.length > 0),
      );
    if (!axesOk)
      errors.push(
        'matrix requires axes: [xCategories, yCategories], each a non-empty array of non-empty strings',
      );
    if (!Array.isArray(ir.cells) || ir.cells.length !== N) {
      errors.push('matrix requires cells: one [xIndex, yIndex] pair per node');
    } else if (axesOk) {
      const [xCats, yCats] = ir.axes;
      for (const c of ir.cells) {
        if (
          !Array.isArray(c) ||
          c.length !== 2 ||
          !Number.isInteger(c[0]) ||
          !Number.isInteger(c[1])
        ) {
          errors.push('each cell must be an [xIndex, yIndex] integer pair');
          break;
        }
        if (c[0] < 0 || c[0] >= xCats.length || c[1] < 0 || c[1] >= yCats.length) {
          errors.push(`cell [${c[0]},${c[1]}] references an axis index out of range`);
          break;
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
