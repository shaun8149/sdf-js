// =============================================================================
// scatter-3d.js — scatter plot (Atlas chart atom).
// -----------------------------------------------------------------------------
// A cloud of dot spheres at deterministic (hash-placed) positions in the XY
// plane + L-shaped axes. Covers PresentationLoad "Scatter / XY". Composite atom
// (sphere + capsule + union). Positions are a pure function of the index, so a
// given count always renders identically (and is unit-testable).
// =============================================================================

import { sphere, capsule } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

// Deterministic 1-D hash → [0,1). Mirrored exactly in the test.
export function scatterHash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * @param {object} opts
 * @param {number} [opts.count=12]    number of dots (≥1)
 * @param {number} [opts.spread=1.4]  half-extent of the plot area
 * @param {number} [opts.dotRadius=0.09] dot sphere radius
 * @param {boolean} [opts.axes=true]  draw L-shaped axes
 * @param {number} [opts.axisRadius=0.03] axis capsule radius
 * @returns {SDF3}
 */
export function scatter3dSDF({
  count = 12,
  spread = 1.4,
  dotRadius = 0.09,
  axes = true,
  axisRadius = 0.03,
} = {}) {
  const N = Math.max(1, Math.floor(count));
  const parts = [];
  if (axes) {
    parts.push(capsule([-spread, -spread, 0], [spread, -spread, 0], axisRadius)); // x-axis
    parts.push(capsule([-spread, -spread, 0], [-spread, spread, 0], axisRadius)); // y-axis
  }
  for (let i = 0; i < N; i++) {
    const px = (scatterHash(i * 2 + 1) * 2 - 1) * spread;
    const py = (scatterHash(i * 2 + 2) * 2 - 1) * spread;
    parts.push(sphere(dotRadius).translate([px, py, 0]));
  }
  return parts.length === 1 ? parts[0] : union(...parts);
}

export const scatter3dSpec = {
  type: 'scatter-3d',
  category: 'charts/data',
  args: {
    count: { type: 'number', default: 12, doc: 'Number of dots (≥1)' },
    spread: { type: 'number', default: 1.4, doc: 'Half-extent of the plot area' },
    dotRadius: { type: 'number', default: 0.09, doc: 'Dot sphere radius' },
    axes: { type: 'boolean', default: true, doc: 'Draw L-shaped axes' },
    axisRadius: { type: 'number', default: 0.03, doc: 'Axis capsule radius' },
  },
  examples: [
    { name: 'Scatter (12)', args: { count: 12 } },
    { name: 'Dense cloud', args: { count: 24 } },
    { name: 'Dots only', args: { count: 16, axes: false } },
  ],
  description: 'Scatter plot (dot cloud + axes) — correlation, distribution, XY data',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave B — taxonomy charts/data/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
