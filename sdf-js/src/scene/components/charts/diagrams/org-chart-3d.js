// =============================================================================
// org-chart-3d.js — top-down org chart (Atlas chart atom).
// -----------------------------------------------------------------------------
// Box-card nodes in a branching hierarchy + capsule connectors (parent→child).
// Covers PresentationLoad "Hierarchy Charts (Org Chart 2D/3D)". Same layout as
// sphere-tree-3d but with rectangular cards — the corporate org look.
// Composite atom (box + capsule + union).
// =============================================================================

import { box, capsule } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

const clampInt = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(x)));

/**
 * @param {object} opts
 * @param {number} [opts.levels=3]        hierarchy depth (1..5)
 * @param {number} [opts.branching=2]     children per node (1..5)
 * @param {number} [opts.nodeW=0.5]       card width
 * @param {number} [opts.nodeH=0.3]       card height
 * @param {number} [opts.nodeD=0.18]      card depth
 * @param {number} [opts.levelHeight=0.9] vertical gap between levels
 * @param {number} [opts.spread=3.4]      total width per level
 * @param {number} [opts.linkThickness=0.04] connector radius
 * @returns {SDF3}
 */
export function orgChart3dSDF({
  levels = 3,
  branching = 2,
  nodeW = 0.5,
  nodeH = 0.3,
  nodeD = 0.18,
  levelHeight = 0.9,
  spread = 3.4,
  linkThickness = 0.04,
} = {}) {
  const L = clampInt(levels, 1, 5);
  const B = clampInt(branching, 1, 5);
  const topY = ((L - 1) * levelHeight) / 2;
  const nodeX = (i, n) => ((i + 0.5) / n - 0.5) * spread;
  const parts = [];
  let prev = [];
  for (let l = 0; l < L; l++) {
    const n = Math.pow(B, l);
    const y = topY - l * levelHeight;
    const pos = [];
    for (let i = 0; i < n; i++) {
      const p = [nodeX(i, n), y, 0];
      pos.push(p);
      parts.push(box([nodeW, nodeH, nodeD]).translate(p));
      if (l > 0) parts.push(capsule(prev[Math.floor(i / B)], p, linkThickness));
    }
    prev = pos;
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const orgChart3dSpec = {
  type: 'org-chart-3d',
  category: 'charts/hierarchy',
  args: {
    levels: { type: 'number', default: 3, min: 1, max: 5, doc: 'Hierarchy depth' },
    branching: { type: 'number', default: 2, min: 1, max: 5, doc: 'Children per node' },
    nodeW: { type: 'number', default: 0.5, doc: 'Card width' },
    nodeH: { type: 'number', default: 0.3, doc: 'Card height' },
    nodeD: { type: 'number', default: 0.18, doc: 'Card depth' },
    levelHeight: { type: 'number', default: 0.9, doc: 'Vertical gap between levels' },
    spread: { type: 'number', default: 3.4, doc: 'Total width per level' },
    linkThickness: { type: 'number', default: 0.04, doc: 'Connector radius' },
  },
  examples: [
    { name: 'Org chart', args: { levels: 3, branching: 2 } },
    { name: 'Wide team', args: { levels: 2, branching: 4 } },
    { name: 'Deep chain', args: { levels: 4, branching: 1 } },
  ],
  description: 'Top-down org chart (box cards + connectors) — reporting lines, hierarchy',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 4 node-edge charts — taxonomy charts/hierarchy/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
