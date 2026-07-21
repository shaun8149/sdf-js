// =============================================================================
// pyramid-3d — Multi-level parametric pyramid (Atlas chart atom, P0 for stun demo)
// -----------------------------------------------------------------------------
// First Atlas-built chart atom under taxonomy charts/hierarchy/. Stacked N
// layers with linear width taper from base (bottom) to top, centered at origin
// in Y.
//
// Use cases:
//   - Hierarchy charts (org levels, maturity stages)
//   - "Types of KPIs" pyramid (PresentationLoad KPI Dashboard style)
//   - Maslow's hierarchy, learning pyramid, food pyramid
//   - Egyptian / Mexican pyramid architecture (gap > 0 = stepped)
//
// Diffusion baseline: Midjourney / Stable Diffusion / DALL-E *cannot* paint
// a pyramid with the correct number of levels reliably. They average ~3 even
// when prompted "5 levels", and layers wobble. This atom is the textbook
// Atlas-vs-diffusion proof point — parametric levels is exact by construction.
//
// Author: Atlas (2026-06-18)
// License: PolyForm Noncommercial 1.0.0
// =============================================================================

import { SDF3 } from '../../../../sdf/core.js';
import { box } from '../../../../sdf/d3.js';
import { union } from '../../../../sdf/dn.js';
import { resolveMaterial } from '../../../spec.js';

/**
 * Multi-level parametric pyramid SDF.
 *
 * @param {object} opts
 * @param {number} [opts.levels=5]        Number of stacked layers (clamped 1-20)
 * @param {number} [opts.baseWidth=2.0]   X width of bottom layer
 * @param {number} [opts.topWidth=0.4]    X width of top layer (linear taper)
 * @param {number} [opts.layerHeight=0.3] Y thickness per layer
 * @param {number} [opts.gap=0.05]        Y gap between layers (0=continuous, >0=stepped)
 * @param {number} [opts.depth=0.6]       Z thickness (3D depth)
 */
export function pyramid3dSDF({
  levels = 5,
  baseWidth = 2.0,
  topWidth = 0.4,
  layerHeight = 0.3,
  gap = 0.05,
  depth = 0.6,
  colors = null,
} = {}) {
  // Clamp levels to [1, 20] (GPU loop is unrolled to 20)
  const N = Math.max(1, Math.min(20, Math.floor(levels)));
  const totalH = N * layerHeight + (N - 1) * gap;

  // per-leaf colours: same tiers as a union of coloured boxes (only when colors[] given;
  // the fused no-colours path below is untouched so existing behaviour/tests are stable).
  if (Array.isArray(colors) && colors.length) {
    const parts = [];
    for (let i = 0; i < N; i++) {
      const t = N > 1 ? i / (N - 1) : 0;
      const w = baseWidth + t * (topWidth - baseWidth);
      const yc = i * (layerHeight + gap) - totalH / 2 + layerHeight / 2;
      const tier = box([w, layerHeight, depth]).translate([0, yc, 0]);
      if (colors[i] != null) {
        const m = resolveMaterial(colors[i]);
        if (m) tier._subjectMaterial = m;
      }
      parts.push(tier);
    }
    return parts.length === 1 ? parts[0] : union(...parts);
  }

  const inst = SDF3((p) => {
    let minDist = Infinity;
    for (let i = 0; i < N; i++) {
      const t = N > 1 ? i / (N - 1) : 0;
      const w = baseWidth + t * (topWidth - baseWidth);
      const yc = i * (layerHeight + gap) - totalH / 2 + layerHeight / 2;
      // sdBox(p - [0, yc, 0], [w/2, layerHeight/2, depth/2])
      const qx = Math.abs(p[0]) - w / 2;
      const qy = Math.abs(p[1] - yc) - layerHeight / 2;
      const qz = Math.abs(p[2]) - depth / 2;
      const dx = Math.max(qx, 0);
      const dy = Math.max(qy, 0);
      const dz = Math.max(qz, 0);
      const outside = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const inside = Math.min(Math.max(qx, qy, qz), 0);
      const d = outside + inside;
      if (d < minDist) minDist = d;
    }
    return minDist;
  });

  inst.ast = {
    kind: 'prim',
    name: 'pyramid-3d',
    args: [N, baseWidth, topWidth, layerHeight, gap, depth],
  };
  return inst;
}

export const pyramid3dSpec = {
  type: 'pyramid-3d',
  category: 'charts/hierarchy',
  args: {
    levels: {
      type: 'number',
      default: 5,
      min: 1,
      max: 20,
      doc: 'Number of stacked layers (1-20)',
    },
    baseWidth: { type: 'number', default: 2.0, doc: 'X width of bottom layer' },
    topWidth: { type: 'number', default: 0.4, doc: 'X width of top layer (linear taper)' },
    layerHeight: { type: 'number', default: 0.3, doc: 'Y thickness per layer' },
    gap: { type: 'number', default: 0.05, doc: 'Y gap between layers (0=continuous, >0=stepped)' },
    depth: { type: 'number', default: 0.6, doc: 'Z thickness (3D depth feel)' },
  },
  examples: [
    { name: 'Maslow 5-level', args: { levels: 5, baseWidth: 2, topWidth: 0.3 } },
    { name: 'KPI dashboard 3-level', args: { levels: 3, baseWidth: 1.5, topWidth: 0.5 } },
    {
      name: 'Stepped Mexican pyramid',
      args: { levels: 7, baseWidth: 3, topWidth: 0.5, gap: 0.1 },
    },
    { name: 'Single block', args: { levels: 1, baseWidth: 1, topWidth: 1 } },
  ],
  description: 'Multi-level parametric pyramid for hierarchy / KPI / maturity charts',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-18',
    builder: 'First chart atom — taxonomy charts/hierarchy/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
