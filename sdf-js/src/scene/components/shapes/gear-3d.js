// =============================================================================
// gear-3d.js — cog / gear wheel (Atlas Shape atom, Sprint 3).
// -----------------------------------------------------------------------------
// Cylinder body + N radial teeth (one box repeated via modPolar) − a centre
// hole. Covers PresentationLoad "Gear Wheels 3D" (process / mechanism / config).
// Composite atom from cylinder / box / modPolar / union / difference (all
// GLSL-emit registered).
//
// Spec: docs/superpowers/specs/2026-06-21-simple-shapes-design.md
// =============================================================================

import { cylinder, box, modPolar } from '../../../sdf/d3.js';
import { union, difference } from '../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.teeth=12]        number of teeth
 * @param {number} [opts.radius=0.7]      body radius (to tooth root)
 * @param {number} [opts.thickness=0.25]  Y extent
 * @param {number} [opts.toothDepth=0.16] how far teeth stick out past the rim
 * @param {number} [opts.toothWidth=0.18] tangential tooth width
 * @param {number} [opts.holeRadius=0.22] centre hole radius
 * @returns {SDF3}
 */
export function gear3dSDF({
  teeth = 12,
  radius = 0.7,
  thickness = 0.25,
  toothDepth = 0.16,
  toothWidth = 0.18,
  holeRadius = 0.22,
} = {}) {
  const body = cylinder(radius, thickness);
  // One tooth at +X rim, then repeated around Y into `teeth` copies.
  const tooth = box([toothDepth * 2, toothWidth, thickness]).translate([radius, 0, 0]);
  const teethRing = modPolar(tooth, { axis: 'y', repetitions: Math.max(3, Math.floor(teeth)) });
  const solid = union(body, teethRing);
  const hole = cylinder(holeRadius, thickness * 1.2);
  return difference(solid, hole);
}

export const gear3dSpec = {
  type: 'gear-3d',
  category: 'shapes',
  args: {
    teeth: { type: 'number', default: 12, doc: 'Number of teeth (≥3)' },
    radius: { type: 'number', default: 0.7, doc: 'Body radius to tooth root' },
    thickness: { type: 'number', default: 0.25, doc: 'Y extent' },
    toothDepth: { type: 'number', default: 0.16, doc: 'Tooth protrusion past rim' },
    toothWidth: { type: 'number', default: 0.18, doc: 'Tangential tooth width' },
    holeRadius: { type: 'number', default: 0.22, doc: 'Centre hole radius' },
  },
  examples: [
    { name: 'Cog', args: { teeth: 12 } },
    { name: 'Fine gear', args: { teeth: 24, toothDepth: 0.1, toothWidth: 0.1 } },
    { name: 'Coarse wheel', args: { teeth: 8, radius: 0.8 } },
  ],
  description: 'Gear / cog wheel — process, mechanism, settings/config',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 3 simple shape — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
