// =============================================================================
// octagon-prism — IQ's octagonal prism (axis = +Z). Note: GLSL function is
// `sdOctogonPrism` (IQ's typo for octagon); we use the canonical spelling.
// Source: https://iquilezles.org/articles/distfunctions/
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

/**
 * Octagon prism SDF — regular octagonal prism, long axis along +Z.
 * @param {object} opts
 * @param {number} [opts.apothem=0.3]
 * @param {number} [opts.halfHeight=0.5]
 */
export function octagonPrismSDF({ apothem = 0.3, halfHeight = 0.5 } = {}) {
  const r = apothem,
    h = halfHeight;
  const kx = -0.9238795325,
    ky = 0.3826834323,
    kz = 0.4142135623;
  const inst = SDF3((p) => {
    let px = Math.abs(p[0]),
      py = Math.abs(p[1]);
    const pz = Math.abs(p[2]);
    // first fold
    let dot = Math.min(kx * px + ky * py, 0);
    px -= 2 * dot * kx;
    py -= 2 * dot * ky;
    // second fold (mirror x)
    dot = Math.min(-kx * px + ky * py, 0);
    px -= 2 * dot * -kx;
    py -= 2 * dot * ky;
    // edge projection
    px -= Math.max(-kz * r, Math.min(kz * r, px));
    py -= r;
    const sgn = py >= 0 ? 1 : -1;
    const d0 = Math.sqrt(px * px + py * py) * sgn;
    const d1 = pz - h;
    const outsideX = Math.max(d0, 0);
    const outsideY = Math.max(d1, 0);
    return Math.min(Math.max(d0, d1), 0) + Math.sqrt(outsideX * outsideX + outsideY * outsideY);
  });
  inst.ast = { kind: 'prim', name: 'octagon-prism', args: [apothem, halfHeight] };
  return inst;
}

export const octagonPrismSpec = {
  type: 'octagon-prism',
  category: 'primitive',
  args: { apothem: { type: 'number', default: 0.3 }, halfHeight: { type: 'number', default: 0.5 } },
  source: {
    portedFrom: 'https://iquilezles.org/articles/distfunctions/',
    originalAuthor: 'Inigo Quilez',
    license: 'MIT',
    portedAt: '2026-05-18',
    porter: 'Atlas /port-shader batch port',
  },
};
