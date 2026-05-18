// =============================================================================
// hex-prism — IQ's hexagonal prism primitive (axis = +Z, matches GLSL helper)
// Source: https://iquilezles.org/articles/distfunctions/
// GLSL helper: sdHexPrism(p, vec2 h) where h = (apothem, halfHeight)
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

/**
 * Hex prism SDF — regular hexagonal prism, long axis along +Z.
 * @param {object} opts
 * @param {number} [opts.apothem=0.3]      apothem (perpendicular distance from axis to a face)
 * @param {number} [opts.halfHeight=0.5]   half the prism length along Z
 */
export function hexPrismSDF({ apothem = 0.3, halfHeight = 0.5 } = {}) {
  const hx = apothem, hy = halfHeight;
  const kx = -0.8660254, ky = 0.5, kz = 0.57735;
  const inst = SDF3((p) => {
    let px = Math.abs(p[0]), py = Math.abs(p[1]), pz = Math.abs(p[2]);
    const dot = Math.min(kx * px + ky * py, 0);
    px -= 2 * dot * kx;
    py -= 2 * dot * ky;
    const cx = Math.max(-kz * hx, Math.min(kz * hx, px));
    const dxRaw = px - cx;
    const dyRaw = py - hx;
    const sgn = (py - hx) >= 0 ? 1 : -1;
    const d0 = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw) * sgn;
    const d1 = pz - hy;
    const outsideX = Math.max(d0, 0);
    const outsideY = Math.max(d1, 0);
    return Math.min(Math.max(d0, d1), 0) + Math.sqrt(outsideX * outsideX + outsideY * outsideY);
  });
  inst.ast = { kind: 'prim', name: 'hex-prism', args: [apothem, halfHeight] };
  return inst;
}

export const hexPrismSpec = {
  type: 'hex-prism',
  category: 'primitive',
  args: {
    apothem:    { type: 'number', default: 0.3 },
    halfHeight: { type: 'number', default: 0.5 },
  },
  source: {
    portedFrom: 'https://iquilezles.org/articles/distfunctions/',
    originalAuthor: 'Inigo Quilez',
    license: 'MIT', portedAt: '2026-05-18', porter: 'Atlas /port-shader batch port',
  },
};
