// =============================================================================
// sphere-tree-3d.js — hierarchical sphere tree (Atlas Shape atom, Sprint 2).
// -----------------------------------------------------------------------------
// A root sphere at the top branching into children on each lower level, with
// parent→child capsule links. Covers PresentationLoad "3D Spheres Tree
// Structures" (org / taxonomy / decision trees). Composite atom:
//   - sphere   (d3.js:16, sdf3.compile.js:313)
//   - capsule  (d3.js:54, sdf3.compile.js:326)
//   - union    (dn.js:37, sdf3.compile.js:224)
//
// Each level spans the full `spread` width; node i on a level of N sits at
// x = ((i + 0.5) / N − 0.5) · spread. The parent of node i is ⌊i / branching⌋
// on the level above. Levels/branching are clamped so the node count (and the
// unrolled GPU union) stays bounded.
//
// Spec: docs/superpowers/specs/2026-06-20-sphere-atoms-design.md
// =============================================================================

import { sphere, capsule } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';

const clampInt = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(x)));

/**
 * sphere-tree-3d SDF.
 *
 * @param {object} opts
 * @param {number} [opts.levels=3]          tree depth (clamped 1..5)
 * @param {number} [opts.branching=2]       children per node (clamped 1..5)
 * @param {number} [opts.rootRadius=0.4]    root sphere radius
 * @param {number} [opts.radiusFalloff=0.78] radius multiplier per level down
 * @param {number} [opts.levelHeight=1.0]   vertical gap between levels
 * @param {number} [opts.spread=3.0]        total horizontal width per level
 * @param {number} [opts.linkThickness=0.045] capsule link radius
 * @returns {SDF3|null}
 */
export function sphereTree3dSDF({
  levels = 3,
  branching = 2,
  rootRadius = 0.4,
  radiusFalloff = 0.78,
  levelHeight = 1.0,
  spread = 3.0,
  linkThickness = 0.045,
} = {}) {
  if (levels <= 0) return null;
  const L = clampInt(levels, 1, 5);
  const B = clampInt(branching, 1, 5);

  const topY = ((L - 1) * levelHeight) / 2;
  const nodeX = (i, n) => ((i + 0.5) / n - 0.5) * spread;

  const parts = [];
  // Track each level's node positions so we can link to the level above.
  let prevPositions = [];
  for (let l = 0; l < L; l++) {
    const n = Math.pow(B, l);
    const y = topY - l * levelHeight;
    const r = rootRadius * Math.pow(radiusFalloff, l);
    const positions = [];
    for (let i = 0; i < n; i++) {
      const pos = [nodeX(i, n), y, 0];
      positions.push(pos);
      parts.push(sphere(r).translate(pos));
      if (l > 0) {
        const parent = prevPositions[Math.floor(i / B)];
        parts.push(capsule(parent, pos, linkThickness));
      }
    }
    prevPositions = positions;
  }

  return parts.length === 1 ? parts[0] : union(...parts);
}

// ---- Spec (compile.js validation + lift prompt) -----------------------------

export const sphereTree3dSpec = {
  type: 'sphere-tree-3d',
  category: 'shapes',
  args: {
    levels: { type: 'number', default: 3, min: 1, max: 5, doc: 'Tree depth (1..5)' },
    branching: { type: 'number', default: 2, min: 1, max: 5, doc: 'Children per node (1..5)' },
    rootRadius: { type: 'number', default: 0.4, doc: 'Root sphere radius' },
    radiusFalloff: { type: 'number', default: 0.78, doc: 'Radius multiplier per level down' },
    levelHeight: { type: 'number', default: 1.0, doc: 'Vertical gap between levels' },
    spread: { type: 'number', default: 3.0, doc: 'Total horizontal width per level' },
    linkThickness: { type: 'number', default: 0.045, doc: 'Capsule link radius' },
  },
  examples: [
    { name: 'Binary tree', args: { levels: 3, branching: 2 } },
    { name: 'Org chart', args: { levels: 3, branching: 3, spread: 4 } },
    { name: 'Decision stub', args: { levels: 2, branching: 4 } },
  ],
  description: 'Top-down hierarchical sphere tree with parent→child links (org / taxonomy)',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-20',
    builder: 'Sprint 2 sphere atom #3 — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
