// =============================================================================
// circle-stack-3d.js — stacked disks (Atlas Shape atom, Sprint 3).
// -----------------------------------------------------------------------------
// N coin-like cylinders stacked along Y, optionally tapering in radius — a
// layered-disk / tiered infographic. Covers PresentationLoad "3D Circle Shapes"
// (multi-circle stack). Composite atom from cylinder + union.
// =============================================================================

import { cylinder } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';
import { resolveMaterial } from '../../spec.js';

/**
 * @param {object} opts
 * @param {number} [opts.count=4]        number of disks (clamped ≥1)
 * @param {number} [opts.radius=0.7]     bottom disk radius
 * @param {number} [opts.taper=0.85]     radius multiplier per disk going up
 * @param {number} [opts.diskHeight=0.18] disk thickness
 * @param {number} [opts.gap=0.06]       gap between disks
 * @returns {SDF3}
 */
export function circleStack3dSDF({
  count = 4,
  radius = 0.7,
  taper = 0.85,
  diskHeight = 0.18,
  gap = 0.06,
  colors = null,
} = {}) {
  const N = Math.max(1, Math.floor(count));
  const stride = diskHeight + gap;
  const offset = ((N - 1) / 2) * stride;
  const disks = [];
  for (let i = 0; i < N; i++) {
    const r = radius * Math.pow(taper, i);
    const y = i * stride - offset;
    const disk = cylinder(r, diskHeight).translate([0, y, 0]);
    if (colors && colors[i] != null) {
      const m = resolveMaterial(colors[i]);
      if (m) disk._subjectMaterial = m;
    }
    disks.push(disk);
  }
  return disks.length === 1 ? disks[0] : union(...disks);
}

export const circleStack3dSpec = {
  type: 'circle-stack-3d',
  category: 'shapes',
  args: {
    count: { type: 'number', default: 4, doc: 'Number of disks (≥1)' },
    radius: { type: 'number', default: 0.7, doc: 'Bottom disk radius' },
    taper: { type: 'number', default: 0.85, doc: 'Radius × per disk upward' },
    diskHeight: { type: 'number', default: 0.18, doc: 'Disk thickness' },
    gap: { type: 'number', default: 0.06, doc: 'Gap between disks' },
  },
  examples: [
    { name: 'Tiered stack', args: { count: 4 } },
    { name: 'Coin pile', args: { count: 6, taper: 1.0, gap: 0.02 } },
    { name: 'Wedding cake', args: { count: 3, taper: 0.7, diskHeight: 0.3 } },
  ],
  description: 'Stacked / tiered disks — layers, levels, accumulation',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 3 circle family — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
