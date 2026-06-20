// =============================================================================
// puzzle-piece-3d.js — jigsaw piece (Atlas Shape atom).
// -----------------------------------------------------------------------------
// A square slab with a round tab on the +X edge and a matching blank (notch)
// carved from the -X edge — the classic interlocking puzzle piece. Covers
// PresentationLoad "Puzzle". Composite atom (box + cylinder + union +
// difference).
// =============================================================================

import { box, cylinder } from '../../../sdf/d3.js';
import { union, difference } from '../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.size=1.0]  edge length of the square slab
 * @param {number} [opts.depth=0.25] Z thickness
 * @param {number} [opts.knob=0.24] tab / blank radius
 * @returns {SDF3}
 */
export function puzzlePiece3dSDF({ size = 1.0, depth = 0.25, knob = 0.24 } = {}) {
  const body = box([size, size, depth]);
  // cylinder default axis Y → rotate to axis Z so it runs through the slab depth
  const tab = cylinder(knob, depth)
    .rotate(Math.PI / 2, [1, 0, 0])
    .translate([size / 2, 0, 0]);
  const blank = cylinder(knob, depth * 1.2)
    .rotate(Math.PI / 2, [1, 0, 0])
    .translate([-size / 2, 0, 0]);
  return difference(union(body, tab), blank);
}

export const puzzlePiece3dSpec = {
  type: 'puzzle-piece-3d',
  category: 'shapes',
  args: {
    size: { type: 'number', default: 1.0, doc: 'Edge length of the square slab' },
    depth: { type: 'number', default: 0.25, doc: 'Z thickness' },
    knob: { type: 'number', default: 0.24, doc: 'Tab / blank radius' },
  },
  examples: [
    { name: 'Puzzle piece', args: {} },
    { name: 'Big knobs', args: { knob: 0.3 } },
    { name: 'Thin tile', args: { depth: 0.15 } },
  ],
  description: 'Jigsaw puzzle piece (tab + blank) — fit, integration, solution, teamwork',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave C — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
