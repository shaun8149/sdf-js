// =============================================================================
// cube-segmented-3d.js — a cube sliced into segments (Atlas Shape atom, Sprint 3).
// -----------------------------------------------------------------------------
// One cube cut into N parallel slabs along an axis, separated by gaps (sliced-
// bread / exploded-cube look). Covers PresentationLoad "3D Cubes Segmented".
// Composite atom from box + union (GLSL-emit registered). Distinct from cube-3d,
// which arranges N *separate* cubes — this is ONE cube subdivided.
//
// Spec: docs/superpowers/specs/2026-06-21-simple-shapes-design.md
// =============================================================================

import { box } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.segments=4]  number of slabs (clamped ≥1)
 * @param {number} [opts.size=1.2]    total cube edge length
 * @param {number} [opts.gap=0.08]    gap between slabs
 * @param {string} [opts.axis='x']    slice axis: 'x' | 'y' | 'z'
 * @returns {SDF3}
 */
export function cubeSegmented3dSDF({ segments = 4, size = 1.2, gap = 0.08, axis = 'x' } = {}) {
  const N = Math.max(1, Math.floor(segments));
  const slabThick = Math.max((size - (N - 1) * gap) / N, 0.01);
  const stride = slabThick + gap;
  const offset = ((N - 1) / 2) * stride;

  const slabs = [];
  for (let i = 0; i < N; i++) {
    const c = i * stride - offset;
    let dims, pos;
    if (axis === 'y') {
      dims = [size, slabThick, size];
      pos = [0, c, 0];
    } else if (axis === 'z') {
      dims = [size, size, slabThick];
      pos = [0, 0, c];
    } else {
      dims = [slabThick, size, size];
      pos = [c, 0, 0];
    }
    slabs.push(box(dims).translate(pos));
  }
  return slabs.length === 1 ? slabs[0] : union(...slabs);
}

export const cubeSegmented3dSpec = {
  type: 'cube-segmented-3d',
  category: 'shapes',
  args: {
    segments: { type: 'number', default: 4, doc: 'Number of slabs (≥1)' },
    size: { type: 'number', default: 1.2, doc: 'Total cube edge length' },
    gap: { type: 'number', default: 0.08, doc: 'Gap between slabs' },
    axis: { type: 'enum', values: ['x', 'y', 'z'], default: 'x' },
  },
  examples: [
    { name: 'Sliced (4)', args: { segments: 4 } },
    { name: 'Stacked layers', args: { segments: 5, axis: 'y' } },
    { name: 'Two halves', args: { segments: 2, gap: 0.15 } },
  ],
  description: 'A cube sliced into separated slabs — phases, layers, breakdown',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 3 simple shape — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
