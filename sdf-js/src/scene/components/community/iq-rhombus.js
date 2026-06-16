// =============================================================================
// rhombus — IQ's rhombus primitive (axis-aligned diamond in XZ, extruded along Y)
// Source: https://iquilezles.org/articles/distfunctions/
// GLSL helper: sdRhombus(p, la, lb, h, ra)
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

// ndot helper: negative dot — same convention as IQ's article
const ndot = (a, b) => a[0] * b[0] - a[1] * b[1];

/**
 * Rhombus SDF — a flat rhombus (diamond) in the XZ plane, extruded along Y.
 * @param {object} opts
 * @param {number} [opts.la=0.4]    half-length along X (one diagonal direction)
 * @param {number} [opts.lb=0.2]    half-length along Z (other diagonal direction)
 * @param {number} [opts.h=0.05]    half-extent along Y (thickness)
 * @param {number} [opts.cornerR=0.02]  corner-rounding radius
 */
export function rhombusSDF({ la = 0.4, lb = 0.2, h = 0.05, cornerR = 0.02 } = {}) {
  const ra = cornerR;
  const bDotB = la * la + lb * lb;
  const inst = SDF3((p) => {
    const px = Math.abs(p[0]),
      py = Math.abs(p[1]),
      pz = Math.abs(p[2]);
    // f = clamp(ndot(b, b - 2*p.xz) / dot(b,b), -1, 1)
    const fNum = ndot([la, lb], [la - 2 * px, lb - 2 * pz]);
    const f = Math.max(-1, Math.min(1, fNum / bDotB));
    const cx = px - 0.5 * la * (1 - f);
    const cz = pz - 0.5 * lb * (1 + f);
    const sgn = px * lb + pz * la - la * lb >= 0 ? 1 : -1;
    const qx = Math.sqrt(cx * cx + cz * cz) * sgn - ra;
    const qy = py - h;
    return Math.min(Math.max(qx, qy), 0) + Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2);
  });
  inst.ast = { kind: 'prim', name: 'rhombus', args: [la, lb, h, cornerR] };
  return inst;
}

export const rhombusSpec = {
  type: 'rhombus',
  category: 'primitive',
  args: {
    la: { type: 'number', default: 0.4 },
    lb: { type: 'number', default: 0.2 },
    h: { type: 'number', default: 0.05 },
    cornerR: { type: 'number', default: 0.02 },
  },
  source: {
    portedFrom: 'https://iquilezles.org/articles/distfunctions/',
    originalAuthor: 'Inigo Quilez',
    license: 'MIT',
    portedAt: '2026-05-18',
    porter: 'Atlas /port-shader batch port',
  },
};
