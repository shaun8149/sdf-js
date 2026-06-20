// =============================================================================
// circle-frame-3d.js — round photo/avatar frame (Atlas Shape atom, Sprint 3).
// -----------------------------------------------------------------------------
// A torus ring facing +Z + a thin recessed backing disk — the "drop a headshot
// / image here" circle. Covers PresentationLoad "Circle Image Infographics".
// Composite atom from torus + cylinder + union (GLSL-emit registered).
// =============================================================================

import { torus, cylinder } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.radius=0.7]      ring centreline radius
 * @param {number} [opts.frameWidth=0.12] ring tube radius (frame thickness)
 * @param {number} [opts.backDepth=0.06]  backing-disk thickness (Z)
 * @param {boolean} [opts.back=true]      include the backing disk
 * @returns {SDF3}
 */
export function circleFrame3dSDF({
  radius = 0.7,
  frameWidth = 0.12,
  backDepth = 0.06,
  back = true,
} = {}) {
  // torus defaults to the XZ plane (axis Y); rotate to face +Z (ring in XY).
  const ring = torus(radius, frameWidth).rotate(Math.PI / 2, [1, 0, 0]);
  if (!back) return ring;
  // backing disk: cylinder (axis Y) rotated so its axis is Z → thin disk in XY.
  const backing = cylinder(radius - frameWidth * 0.5, backDepth).rotate(Math.PI / 2, [1, 0, 0]);
  return union(ring, backing);
}

export const circleFrame3dSpec = {
  type: 'circle-frame-3d',
  category: 'shapes',
  args: {
    radius: { type: 'number', default: 0.7, doc: 'Ring centreline radius' },
    frameWidth: { type: 'number', default: 0.12, doc: 'Ring tube radius' },
    backDepth: { type: 'number', default: 0.06, doc: 'Backing disk thickness' },
    back: { type: 'boolean', default: true, doc: 'Include backing disk' },
  },
  examples: [
    { name: 'Avatar frame', args: {} },
    { name: 'Open ring', args: { back: false } },
    { name: 'Thick bezel', args: { frameWidth: 0.2 } },
  ],
  description: 'Round image / avatar frame (ring + backing) — team, profile, photo',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 3 circle family — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
