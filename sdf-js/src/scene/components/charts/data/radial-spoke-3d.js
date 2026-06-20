// =============================================================================
// radial-spoke-3d.js — radial bar / spoke chart (Atlas chart atom).
// -----------------------------------------------------------------------------
// A central hub with N spokes of VARYING length radiating in the XY plane, each
// tipped with a node — a radial bar chart / wheel. Covers PresentationLoad
// "Radial". Distinct from mindmap-3d (uniform branches + leaves). Spoke lengths
// are a pure function of the index. Composite atom (sphere + capsule + union).
// =============================================================================

import { sphere, capsule } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.spokes=8]      number of spokes (≥2)
 * @param {number} [opts.hubRadius=0.25] hub sphere radius
 * @param {number} [opts.spokeThickness=0.05] spoke capsule radius
 * @param {number} [opts.minLen=0.55]   shortest spoke length
 * @param {number} [opts.maxLen=1.2]    longest spoke length
 * @param {number} [opts.nodeRadius=0.1] tip node radius
 * @returns {SDF3}
 */
export function radialSpoke3dSDF({
  spokes = 8,
  hubRadius = 0.25,
  spokeThickness = 0.05,
  minLen = 0.55,
  maxLen = 1.2,
  nodeRadius = 0.1,
} = {}) {
  const N = Math.max(2, Math.floor(spokes));
  const parts = [sphere(hubRadius)];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const len = minLen + (maxLen - minLen) * (0.5 + 0.5 * Math.sin(i * 1.7));
    const end = [len * Math.cos(a), len * Math.sin(a), 0];
    parts.push(capsule([0, 0, 0], end, spokeThickness));
    parts.push(sphere(nodeRadius).translate(end));
  }
  return union(...parts);
}

export const radialSpoke3dSpec = {
  type: 'radial-spoke-3d',
  category: 'charts/data',
  args: {
    spokes: { type: 'number', default: 8, min: 2, doc: 'Number of spokes' },
    hubRadius: { type: 'number', default: 0.25, doc: 'Hub sphere radius' },
    spokeThickness: { type: 'number', default: 0.05, doc: 'Spoke capsule radius' },
    minLen: { type: 'number', default: 0.55, doc: 'Shortest spoke length' },
    maxLen: { type: 'number', default: 1.2, doc: 'Longest spoke length' },
    nodeRadius: { type: 'number', default: 0.1, doc: 'Tip node radius' },
  },
  examples: [
    { name: 'Radial bars (8)', args: { spokes: 8 } },
    { name: 'Spider (6)', args: { spokes: 6 } },
    { name: 'Dense wheel (12)', args: { spokes: 12 } },
  ],
  description: 'Radial bar / spoke chart — radial comparison, wheel, spider layout',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave C — taxonomy charts/data/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
