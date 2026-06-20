// =============================================================================
// mindmap-3d.js — radial mind map (Atlas chart atom).
// -----------------------------------------------------------------------------
// A central node with N branches radiating out, each ending in a branch node
// with a couple of leaf nodes. Covers PresentationLoad "Mindmaps". Same node-
// edge family; composite atom (sphere + capsule + union).
// =============================================================================

import { sphere, capsule } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.branches=5]        main branches around the centre
 * @param {number} [opts.centerRadius=0.34] central node radius
 * @param {number} [opts.branchRadius=0.2]  branch node radius
 * @param {number} [opts.leafRadius=0.12]   leaf node radius
 * @param {number} [opts.mainDist=1.1]      centre→branch distance
 * @param {number} [opts.leafDist=0.55]     branch→leaf distance
 * @param {number} [opts.leavesPerBranch=2] leaves per branch
 * @param {number} [opts.linkThickness=0.04] connector radius
 * @returns {SDF3}
 */
export function mindmap3dSDF({
  branches = 5,
  centerRadius = 0.34,
  branchRadius = 0.2,
  leafRadius = 0.12,
  mainDist = 1.1,
  leafDist = 0.55,
  leavesPerBranch = 2,
  linkThickness = 0.04,
} = {}) {
  const K = Math.max(1, Math.floor(branches));
  const Lf = Math.max(0, Math.floor(leavesPerBranch));
  const parts = [sphere(centerRadius)];
  for (let k = 0; k < K; k++) {
    const a = (k / K) * Math.PI * 2;
    const main = [mainDist * Math.cos(a), 0, mainDist * Math.sin(a)];
    parts.push(capsule([0, 0, 0], main, linkThickness));
    parts.push(sphere(branchRadius).translate(main));
    for (let j = 0; j < Lf; j++) {
      const aj = a + (j - (Lf - 1) / 2) * 0.45;
      const leaf = [main[0] + leafDist * Math.cos(aj), 0, main[2] + leafDist * Math.sin(aj)];
      parts.push(capsule(main, leaf, linkThickness));
      parts.push(sphere(leafRadius).translate(leaf));
    }
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const mindmap3dSpec = {
  type: 'mindmap-3d',
  category: 'charts/mindmaps',
  args: {
    branches: { type: 'number', default: 5, doc: 'Main branches around the centre' },
    centerRadius: { type: 'number', default: 0.34, doc: 'Central node radius' },
    branchRadius: { type: 'number', default: 0.2, doc: 'Branch node radius' },
    leafRadius: { type: 'number', default: 0.12, doc: 'Leaf node radius' },
    mainDist: { type: 'number', default: 1.1, doc: 'Centre→branch distance' },
    leafDist: { type: 'number', default: 0.55, doc: 'Branch→leaf distance' },
    leavesPerBranch: { type: 'number', default: 2, doc: 'Leaves per branch' },
    linkThickness: { type: 'number', default: 0.04, doc: 'Connector radius' },
  },
  examples: [
    { name: 'Mind map', args: { branches: 5 } },
    { name: 'Hub and spokes', args: { branches: 6, leavesPerBranch: 0 } },
    { name: 'Bushy', args: { branches: 4, leavesPerBranch: 3 } },
  ],
  description: 'Radial mind map (centre + branches + leaves) — brainstorm, topic breakdown',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 4b charts — taxonomy charts/mindmaps/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
