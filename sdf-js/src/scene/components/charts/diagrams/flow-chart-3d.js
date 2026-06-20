// =============================================================================
// flow-chart-3d.js — linear process flow (Atlas chart atom).
// -----------------------------------------------------------------------------
// N box steps in a row connected by arrowed capsules (shaft + cone head), the
// classic left-to-right process flow. Covers PresentationLoad "Flow Charts".
// Composite atom (box + capsule + cone + union).
// =============================================================================

import { box, capsule, cone } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.steps=4]        number of step boxes (≥1)
 * @param {number} [opts.nodeW=0.6]      step box width
 * @param {number} [opts.nodeH=0.4]      step box height
 * @param {number} [opts.nodeD=0.2]      step box depth
 * @param {number} [opts.gap=0.55]       gap between steps (holds the arrow)
 * @param {number} [opts.linkThickness=0.05] connector shaft radius
 * @returns {SDF3}
 */
export function flowChart3dSDF({
  steps = 4,
  nodeW = 0.6,
  nodeH = 0.4,
  nodeD = 0.2,
  gap = 0.55,
  linkThickness = 0.05,
} = {}) {
  const N = Math.max(1, Math.floor(steps));
  const stride = nodeW + gap;
  const offset = ((N - 1) / 2) * stride;
  const headLen = Math.min(0.18, gap * 0.5);
  const parts = [];
  for (let i = 0; i < N; i++) {
    const x = i * stride - offset;
    parts.push(box([nodeW, nodeH, nodeD]).translate([x, 0, 0]));
    if (i > 0) {
      const x0 = (i - 1) * stride - offset + nodeW / 2; // prev box right edge
      const x1 = x - nodeW / 2; // this box left edge
      // shaft up to the arrowhead, then a cone head pointing +X into this box
      parts.push(capsule([x0, 0, 0], [x1 - headLen, 0, 0], linkThickness));
      parts.push(
        cone(headLen, linkThickness * 2.4)
          .rotate(-Math.PI / 2, [0, 0, 1])
          .translate([x1 - headLen / 2, 0, 0]),
      );
    }
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const flowChart3dSpec = {
  type: 'flow-chart-3d',
  category: 'charts/flow',
  args: {
    steps: { type: 'number', default: 4, doc: 'Number of step boxes (≥1)' },
    nodeW: { type: 'number', default: 0.6, doc: 'Step box width' },
    nodeH: { type: 'number', default: 0.4, doc: 'Step box height' },
    nodeD: { type: 'number', default: 0.2, doc: 'Step box depth' },
    gap: { type: 'number', default: 0.55, doc: 'Gap between steps' },
    linkThickness: { type: 'number', default: 0.05, doc: 'Connector shaft radius' },
  },
  examples: [
    { name: 'Process flow', args: { steps: 4 } },
    { name: 'Two-step', args: { steps: 2 } },
    { name: 'Long pipeline', args: { steps: 6, nodeW: 0.5 } },
  ],
  description: 'Left-to-right process flow (steps + arrows) — pipeline, workflow, stages',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 4 node-edge charts — taxonomy charts/flow/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
