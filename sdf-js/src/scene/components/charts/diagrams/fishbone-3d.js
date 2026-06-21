// =============================================================================
// fishbone-3d.js — Ishikawa / fishbone diagram (Atlas chart atom).
// -----------------------------------------------------------------------------
// A horizontal spine with a head cone at the right + diagonal ribs branching
// off alternating above/below — root-cause analysis. Covers PresentationLoad
// "Fishbone". Composite atom (capsule + cone + union).
// =============================================================================

import { capsule, cone } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';

/**
 * @param {object} opts
 * @param {number} [opts.ribs=6]          number of ribs (≥1)
 * @param {number} [opts.spineLength=2.8] spine length (X)
 * @param {number} [opts.spineRadius=0.05] spine capsule radius
 * @param {number} [opts.ribLength=0.7]   rib length
 * @param {number} [opts.ribThickness=0.04] rib capsule radius
 * @param {number} [opts.headSize=0.3]    head cone length
 * @returns {SDF3}
 */
export function fishbone3dSDF({
  ribs = 6,
  spineLength = 2.8,
  spineRadius = 0.05,
  ribLength = 0.7,
  ribThickness = 0.04,
  headSize = 0.3,
} = {}) {
  const N = Math.max(1, Math.floor(ribs));
  const half = spineLength / 2;
  const parts = [capsule([-half, 0, 0], [half, 0, 0], spineRadius)];
  // head cone pointing +X at the right end
  parts.push(
    cone(headSize, headSize * 0.6)
      .rotate(-Math.PI / 2, [0, 0, 1])
      .translate([half + headSize / 2, 0, 0]),
  );
  for (let i = 0; i < N; i++) {
    const t = (i + 1) / (N + 1);
    const x = -half + t * spineLength;
    const up = i % 2 === 0 ? 1 : -1;
    const base = [x, 0, 0];
    const tip = [x - ribLength * 0.5, up * ribLength, 0]; // diagonal up/down toward tail
    parts.push(capsule(base, tip, ribThickness));
  }
  return union(...parts);
}

export const fishbone3dSpec = {
  type: 'fishbone-3d',
  category: 'charts/diagrams',
  args: {
    ribs: { type: 'number', default: 6, doc: 'Number of ribs (≥1)' },
    spineLength: { type: 'number', default: 2.8, doc: 'Spine length (X)' },
    spineRadius: { type: 'number', default: 0.05, doc: 'Spine capsule radius' },
    ribLength: { type: 'number', default: 0.7, doc: 'Rib length' },
    ribThickness: { type: 'number', default: 0.04, doc: 'Rib capsule radius' },
    headSize: { type: 'number', default: 0.3, doc: 'Head cone length' },
  },
  examples: [
    { name: 'Fishbone (6)', args: { ribs: 6 } },
    { name: 'Four causes', args: { ribs: 4 } },
    { name: 'Detailed (8)', args: { ribs: 8 } },
  ],
  description: 'Ishikawa / fishbone diagram — root-cause analysis, cause and effect',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-21',
    builder: 'Sprint 5 Wave C — taxonomy charts/diagrams/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
