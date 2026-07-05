// sdf-js/src/scene/ir.js
// Intermediate Representation: the neutral "what structure does this content have"
// that decouples input (scaffold / text) from 3D rendering. Grown structure by
// structure — a field earns its place when a renderer needs it (YAGNI).
//
//   sequence  — ordered stages (funnel): nodes + magnitude drive stage widths.
//   hierarchy — parent→child tree (org chart / taxonomy): relations carry the
//               edges as [parentIndex, childIndex] pairs; exactly one root.
export const STRUCTURES = ['sequence', 'hierarchy'];

export function validateIR(ir) {
  const errors = [];
  if (!ir || typeof ir !== 'object') return { ok: false, errors: ['ir must be an object'] };
  if (!STRUCTURES.includes(ir.structure)) errors.push(`unknown structure "${ir.structure}"`);
  if (!Array.isArray(ir.nodes) || ir.nodes.length === 0)
    errors.push('nodes must be a non-empty array');
  const N = Array.isArray(ir.nodes) ? ir.nodes.length : 0;
  if (ir.magnitude != null) {
    if (!Array.isArray(ir.magnitude)) errors.push('magnitude must be an array');
    else if (N && ir.magnitude.length !== N)
      errors.push('magnitude length must match nodes length');
  }
  if (ir.order != null && (!Array.isArray(ir.order) || ir.order.length !== N))
    errors.push('order length must match nodes length');
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
  return { ok: errors.length === 0, errors };
}
