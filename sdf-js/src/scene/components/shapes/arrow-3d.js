// =============================================================================
// arrow-3d.js — directional arrow (Atlas Shape atom, Sprint 3).
// -----------------------------------------------------------------------------
// Shaft (rounded box) + cone head, pointing +X. `double` adds a head on the −X
// end too. Covers PresentationLoad "Arrow Toolbox 2D/3D". Composite atom from
// shipped GLSL-emit primitives (rounded_box / cone / union).
//
// Spec: docs/superpowers/specs/2026-06-21-simple-shapes-design.md
// =============================================================================

import { cone, box } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.length=1.6]      total X span (tip to tail)
 * @param {number} [opts.shaftWidth=0.18] shaft thickness (Y)
 * @param {number} [opts.headLength=0.5]  arrowhead length (X)
 * @param {number} [opts.headWidth=0.5]   arrowhead base width (Y)
 * @param {number} [opts.depth=0.3]       Z thickness
 * @param {boolean} [opts.double=false]   heads on both ends
 * @returns {SDF3}
 */
export function arrow3dSDF({
  length = 1.6,
  shaftWidth = 0.18,
  headLength = 0.5,
  headWidth = 0.5,
  depth = 0.3,
  double = false,
} = {}) {
  const half = length / 2;
  const headR = headWidth / 2;
  // Cone points +Y (apex at +height/2); rotate −90° about Z → apex points +X.
  const headPlus = cone(headLength, headR)
    .rotate(-Math.PI / 2, [0, 0, 1])
    .translate([half - headLength / 2, 0, 0]);

  const parts = [headPlus];
  if (double) {
    const headMinus = cone(headLength, headR)
      .rotate(Math.PI / 2, [0, 0, 1])
      .translate([-half + headLength / 2, 0, 0]);
    parts.push(headMinus);
    // shaft spans between the two head bases
    const shaftLen = Math.max(length - 2 * headLength, 0.01);
    parts.push(box([shaftLen, shaftWidth, depth]));
  } else {
    const shaftLen = Math.max(length - headLength, 0.01);
    // shaft spans −half … (half−headLength); centre at −headLength/2
    parts.push(box([shaftLen, shaftWidth, depth]).translate([-headLength / 2, 0, 0]));
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const arrow3dSpec = {
  type: 'arrow-3d',
  category: 'shapes',
  args: {
    length: { type: 'number', default: 1.6, doc: 'Total X span tip→tail' },
    shaftWidth: { type: 'number', default: 0.18, doc: 'Shaft thickness (Y)' },
    headLength: { type: 'number', default: 0.5, doc: 'Arrowhead length (X)' },
    headWidth: { type: 'number', default: 0.5, doc: 'Arrowhead base width (Y)' },
    depth: { type: 'number', default: 0.3, doc: 'Z thickness' },
    double: { type: 'boolean', default: false, doc: 'Heads on both ends' },
  },
  examples: [
    { name: 'Single arrow', args: { double: false } },
    { name: 'Double arrow', args: { double: true } },
    { name: 'Stubby', args: { length: 1.0, headLength: 0.4, headWidth: 0.6 } },
  ],
  description: 'Directional arrow (single/double) — process flow, emphasis',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 3 simple shape — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
