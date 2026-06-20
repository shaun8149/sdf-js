// =============================================================================
// diamond-3d.js — brilliant-cut gem (Atlas Shape atom, Sprint 3).
// -----------------------------------------------------------------------------
// Crown frustum (table → girdle) + pavilion cone (girdle → point), the classic
// diamond silhouette. Covers PresentationLoad "Diamond Charts". Composite atom
// from capped_cone + union (both GLSL-emit registered).
//
// Spec: docs/superpowers/specs/2026-06-21-simple-shapes-design.md
// =============================================================================

import { capped_cone } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.width=0.9]          girdle diameter (widest point)
 * @param {number} [opts.crownHeight=0.3]    table → girdle height
 * @param {number} [opts.pavilionHeight=0.7] girdle → bottom point height
 * @param {number} [opts.tableRatio=0.45]    table radius as a fraction of girdle
 * @returns {SDF3}
 */
export function diamond3dSDF({
  width = 0.9,
  crownHeight = 0.3,
  pavilionHeight = 0.7,
  tableRatio = 0.45,
} = {}) {
  const girdleR = width / 2;
  const tableR = girdleR * tableRatio;
  // Crown: frustum from the table (top, y=crownHeight) down to the girdle (y=0).
  const crown = capped_cone([0, crownHeight, 0], [0, 0, 0], tableR, girdleR);
  // Pavilion: cone from the girdle (y=0) to a point at the bottom.
  const pavilion = capped_cone([0, 0, 0], [0, -pavilionHeight, 0], girdleR, 0.001);
  return union(crown, pavilion);
}

export const diamond3dSpec = {
  type: 'diamond-3d',
  category: 'shapes',
  args: {
    width: { type: 'number', default: 0.9, doc: 'Girdle diameter (widest)' },
    crownHeight: { type: 'number', default: 0.3, doc: 'Table→girdle height' },
    pavilionHeight: { type: 'number', default: 0.7, doc: 'Girdle→point height' },
    tableRatio: { type: 'number', default: 0.45, doc: 'Table radius / girdle radius' },
  },
  examples: [
    { name: 'Brilliant', args: {} },
    { name: 'Shallow', args: { crownHeight: 0.2, pavilionHeight: 0.4 } },
    { name: 'Deep marquise', args: { width: 0.6, pavilionHeight: 1.0 } },
  ],
  description: 'Brilliant-cut diamond / gem — value, premium, achievement',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 3 simple shape — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
