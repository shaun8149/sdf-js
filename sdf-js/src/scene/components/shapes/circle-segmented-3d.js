// =============================================================================
// circle-segmented-3d.js — segmented donut ring (Atlas Shape atom, Sprint 3).
// -----------------------------------------------------------------------------
// A flat annulus (lying in XZ, thin in Y) cut into N arc segments by radial
// gaps. Covers PresentationLoad "3D Circles Segmented". Composite atom from
// cylinder + box + modPolar + difference (all GLSL-emit registered; same
// difference+modPolar path as gear-3d, GPU-verified).
// =============================================================================

import { cylinder, box, modPolar } from '../../../sdf/d3.js';
import { difference } from '../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.segments=6]   number of arc segments (clamped ≥2)
 * @param {number} [opts.radius=0.8]   outer radius
 * @param {number} [opts.innerRatio=0.55] inner radius as a fraction of outer
 * @param {number} [opts.thickness=0.2] Y extent
 * @param {number} [opts.gapWidth=0.12] tangential gap width
 * @returns {SDF3}
 */
export function circleSegmented3dSDF({
  segments = 6,
  radius = 0.8,
  innerRatio = 0.55,
  thickness = 0.2,
  gapWidth = 0.12,
} = {}) {
  const N = Math.max(2, Math.floor(segments));
  const ring = difference(
    cylinder(radius, thickness),
    cylinder(radius * innerRatio, thickness * 1.2),
  );
  // Radial slot at +X (long in X, full in Y, thin in Z=tangential), repeated.
  const slot = box([radius * 2.4, thickness * 1.4, gapWidth]);
  const slots = modPolar(slot, { axis: 'y', repetitions: N });
  return difference(ring, slots);
}

export const circleSegmented3dSpec = {
  type: 'circle-segmented-3d',
  category: 'shapes',
  args: {
    segments: { type: 'number', default: 6, doc: 'Number of arc segments (≥2)' },
    radius: { type: 'number', default: 0.8, doc: 'Outer radius' },
    innerRatio: { type: 'number', default: 0.55, doc: 'Inner / outer radius' },
    thickness: { type: 'number', default: 0.2, doc: 'Y extent' },
    gapWidth: { type: 'number', default: 0.12, doc: 'Tangential gap width' },
  },
  examples: [
    { name: 'Segmented ring (6)', args: { segments: 6 } },
    { name: 'Dial (12)', args: { segments: 12, gapWidth: 0.06 } },
    { name: 'Quad ring', args: { segments: 4, gapWidth: 0.2 } },
  ],
  description: 'Segmented donut ring — share split, phases of a cycle, dial',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 3 circle family — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
