// =============================================================================
// timeline-3d.js — horizontal timeline (Atlas chart atom).
// -----------------------------------------------------------------------------
// A horizontal axis with N milestone markers on stems, alternating above/below
// the line. Covers PresentationLoad "Timelines". Same node-edge family;
// composite atom (capsule axis + capsule stems + sphere markers + union).
// =============================================================================

import { sphere, capsule } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.count=5]          number of milestones (≥1)
 * @param {number} [opts.axisLength=3.4]   length of the timeline axis (X)
 * @param {number} [opts.axisRadius=0.05]  axis capsule radius
 * @param {number} [opts.markerRadius=0.16] milestone node radius
 * @param {number} [opts.stemHeight=0.45]  stem length from axis to node
 * @param {number} [opts.stemThickness=0.035] stem capsule radius
 * @param {boolean} [opts.alternate=true]  alternate markers above/below
 * @returns {SDF3}
 */
export function timeline3dSDF({
  count = 5,
  axisLength = 3.4,
  axisRadius = 0.05,
  markerRadius = 0.16,
  stemHeight = 0.45,
  stemThickness = 0.035,
  alternate = true,
} = {}) {
  const N = Math.max(1, Math.floor(count));
  const half = axisLength / 2;
  const parts = [capsule([-half, 0, 0], [half, 0, 0], axisRadius)];
  for (let i = 0; i < N; i++) {
    const x = N > 1 ? -half + (i / (N - 1)) * axisLength : 0;
    const up = alternate ? (i % 2 === 0 ? 1 : -1) : 1;
    const top = [x, up * stemHeight, 0];
    parts.push(capsule([x, 0, 0], top, stemThickness));
    parts.push(sphere(markerRadius).translate(top));
  }
  return union(...parts);
}

export const timeline3dSpec = {
  type: 'timeline-3d',
  category: 'charts/timelines',
  args: {
    count: { type: 'number', default: 5, doc: 'Number of milestones (≥1)' },
    axisLength: { type: 'number', default: 3.4, doc: 'Length of the axis (X)' },
    axisRadius: { type: 'number', default: 0.05, doc: 'Axis capsule radius' },
    markerRadius: { type: 'number', default: 0.16, doc: 'Milestone node radius' },
    stemHeight: { type: 'number', default: 0.45, doc: 'Stem length axis→node' },
    stemThickness: { type: 'number', default: 0.035, doc: 'Stem capsule radius' },
    alternate: { type: 'boolean', default: true, doc: 'Alternate markers above/below' },
  },
  examples: [
    { name: 'Timeline', args: { count: 5 } },
    { name: 'Roadmap (above)', args: { count: 4, alternate: false } },
    { name: 'Dense history', args: { count: 8, axisLength: 4.5 } },
  ],
  description: 'Horizontal timeline (axis + milestone markers) — roadmap, history, schedule',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 4b charts — taxonomy charts/timelines/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
