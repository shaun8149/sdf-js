// =============================================================================
// circle-loop-3d.js — cycle / loop arrows (Atlas Shape atom, Sprint 3).
// -----------------------------------------------------------------------------
// A ring (torus) with N cone arrowheads placed tangentially around it, reading
// as a rotating cycle. Covers PresentationLoad "Circle Charts Looping" (process
// cycle, PDCA, lifecycle). Composite atom from torus + cone + modPolar + union.
// =============================================================================

import { torus, cone, modPolar } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.segments=4]     number of arrowheads around the loop
 * @param {number} [opts.radius=0.7]     ring centreline radius
 * @param {number} [opts.tube=0.07]      ring tube radius
 * @param {number} [opts.headLength=0.34] arrowhead length
 * @param {number} [opts.headRadius=0.16] arrowhead base radius
 * @returns {SDF3}
 */
export function circleLoop3dSDF({
  segments = 4,
  radius = 0.7,
  tube = 0.07,
  headLength = 0.34,
  headRadius = 0.16,
} = {}) {
  const N = Math.max(2, Math.floor(segments));
  const ring = torus(radius, tube); // flat in XZ (axis Y)
  // Cone points +Y; rotate +90° about X → points +Z (tangent at the +X point);
  // modPolar repeats it tangentially around the loop.
  const arrow = cone(headLength, headRadius)
    .rotate(Math.PI / 2, [1, 0, 0])
    .translate([radius, 0, 0]);
  const arrows = modPolar(arrow, { axis: 'y', repetitions: N });
  return union(ring, arrows);
}

export const circleLoop3dSpec = {
  type: 'circle-loop-3d',
  category: 'shapes',
  args: {
    segments: { type: 'number', default: 4, doc: 'Number of arrowheads (≥2)' },
    radius: { type: 'number', default: 0.7, doc: 'Ring centreline radius' },
    tube: { type: 'number', default: 0.07, doc: 'Ring tube radius' },
    headLength: { type: 'number', default: 0.34, doc: 'Arrowhead length' },
    headRadius: { type: 'number', default: 0.16, doc: 'Arrowhead base radius' },
  },
  examples: [
    { name: 'PDCA cycle (4)', args: { segments: 4 } },
    { name: 'Lifecycle (3)', args: { segments: 3 } },
    { name: 'Continuous (6)', args: { segments: 6, headLength: 0.26 } },
  ],
  description: 'Looping cycle arrows — process cycle, PDCA, lifecycle, iteration',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 3 circle family — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
