// sdf-js/src/scene/ir.js
// Intermediate Representation: the neutral "what structure does this content have"
// that decouples input (scaffold / text) from 3D rendering. v0, grown from the funnel.
export const STRUCTURES = ['sequence'];

export function validateIR(ir) {
  const errors = [];
  if (!ir || typeof ir !== 'object') return { ok: false, errors: ['ir must be an object'] };
  if (!STRUCTURES.includes(ir.structure)) errors.push(`unknown structure "${ir.structure}"`);
  if (!Array.isArray(ir.nodes) || ir.nodes.length === 0)
    errors.push('nodes must be a non-empty array');
  if (ir.magnitude != null) {
    if (!Array.isArray(ir.magnitude)) errors.push('magnitude must be an array');
    else if (Array.isArray(ir.nodes) && ir.magnitude.length !== ir.nodes.length)
      errors.push('magnitude length must match nodes length');
  }
  if (ir.order != null && (!Array.isArray(ir.order) || ir.order.length !== (ir.nodes || []).length))
    errors.push('order length must match nodes length');
  return { ok: errors.length === 0, errors };
}
