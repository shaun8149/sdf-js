// =============================================================================
// venn-3d.js — Venn diagram (Atlas chart atom).
// -----------------------------------------------------------------------------
// N overlapping rings (torus, facing the camera) laid out so neighbours
// intersect — the classic Venn outline. Rings (not filled disks) so the
// overlap lenses read clearly. Covers PresentationLoad "Venn / overlap".
// Composite atom (torus + union).
// =============================================================================

import { torus } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.sets=3]      number of overlapping sets (2..5)
 * @param {number} [opts.radius=0.7]  ring radius
 * @param {number} [opts.tube=0.07]   ring tube radius
 * @param {number} [opts.overlap=0.45] 0=touching, 1=concentric
 * @returns {SDF3}
 */
export function venn3dSDF({ sets = 3, radius = 0.7, tube = 0.07, overlap = 0.45 } = {}) {
  const N = Math.max(2, Math.min(5, Math.floor(sets)));
  const layoutR = radius * (1 - overlap);
  const parts = [];
  for (let i = 0; i < N; i++) {
    const a = N === 2 ? i * Math.PI : (i / N) * Math.PI * 2 - Math.PI / 2;
    const c = [layoutR * Math.cos(a), layoutR * Math.sin(a), 0];
    parts.push(
      torus(radius, tube)
        .rotate(Math.PI / 2, [1, 0, 0])
        .translate(c),
    );
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const venn3dSpec = {
  type: 'venn-3d',
  category: 'charts/data',
  args: {
    sets: { type: 'number', default: 3, min: 2, max: 5, doc: 'Number of sets' },
    radius: { type: 'number', default: 0.7, doc: 'Ring radius' },
    tube: { type: 'number', default: 0.07, doc: 'Ring tube radius' },
    overlap: { type: 'number', default: 0.45, doc: '0=touching, 1=concentric' },
  },
  examples: [
    { name: 'Venn (3)', args: { sets: 3 } },
    { name: 'Two sets', args: { sets: 2 } },
    { name: 'Four sets', args: { sets: 4, overlap: 0.4 } },
  ],
  description: 'Venn diagram (overlapping rings) — set intersection, commonality',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave B — taxonomy charts/data/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
