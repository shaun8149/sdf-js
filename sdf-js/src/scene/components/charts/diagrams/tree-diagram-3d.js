// =============================================================================
// tree-diagram-3d.js — left-to-right tree (Atlas chart atom).
// -----------------------------------------------------------------------------
// Sphere nodes in a branching tree that grows horizontally (root at left,
// leaves at right) + capsule connectors. Covers PresentationLoad "Tree
// Diagrams" — distinct from org-chart-3d (which is vertical, box cards). Same
// node-edge family; composite atom (sphere + capsule + union).
// =============================================================================

import { sphere, capsule } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

const clampInt = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(x)));

/**
 * @param {object} opts
 * @param {number} [opts.levels=3]        depth (1..5)
 * @param {number} [opts.branching=2]     children per node (1..4)
 * @param {number} [opts.nodeRadius=0.18] node sphere radius
 * @param {number} [opts.levelWidth=0.95] horizontal gap between levels
 * @param {number} [opts.spread=2.6]      total depth (Z) of the widest level
 * @param {number} [opts.linkThickness=0.04] connector radius
 * @returns {SDF3}
 */
export function treeDiagram3dSDF({
  levels = 3,
  branching = 2,
  nodeRadius = 0.18,
  levelWidth = 0.95,
  spread = 2.6,
  linkThickness = 0.04,
} = {}) {
  const L = clampInt(levels, 1, 5);
  const B = clampInt(branching, 1, 4);
  const leftX = -((L - 1) * levelWidth) / 2;
  const nodeZ = (i, n) => ((i + 0.5) / n - 0.5) * spread;
  const parts = [];
  let prev = [];
  for (let l = 0; l < L; l++) {
    const n = Math.pow(B, l);
    const x = leftX + l * levelWidth;
    const pos = [];
    for (let i = 0; i < n; i++) {
      const p = [x, 0, nodeZ(i, n)];
      pos.push(p);
      parts.push(sphere(nodeRadius).translate(p));
      if (l > 0) parts.push(capsule(prev[Math.floor(i / B)], p, linkThickness));
    }
    prev = pos;
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const treeDiagram3dSpec = {
  type: 'tree-diagram-3d',
  category: 'charts/hierarchy',
  args: {
    levels: { type: 'number', default: 3, min: 1, max: 5, doc: 'Depth' },
    branching: { type: 'number', default: 2, min: 1, max: 4, doc: 'Children per node' },
    nodeRadius: { type: 'number', default: 0.18, doc: 'Node sphere radius' },
    levelWidth: { type: 'number', default: 0.95, doc: 'Horizontal gap between levels' },
    spread: { type: 'number', default: 2.6, doc: 'Total depth of the widest level' },
    linkThickness: { type: 'number', default: 0.04, doc: 'Connector radius' },
  },
  examples: [
    { name: 'Binary tree', args: { levels: 3, branching: 2 } },
    { name: 'Ternary', args: { levels: 3, branching: 3 } },
    { name: 'Decision chain', args: { levels: 4, branching: 1 } },
  ],
  description: 'Left-to-right branching tree (sphere nodes + links) — taxonomy, decision tree',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 4b charts — taxonomy charts/hierarchy/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
