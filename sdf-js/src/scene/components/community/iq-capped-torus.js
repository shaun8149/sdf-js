// =============================================================================
// capped-torus — IQ's partial-torus arc primitive (Y-axis, arc opens around +Y)
// Source: https://iquilezles.org/articles/distfunctions/
// GLSL helper: sdCappedTorus(p, vec2 sc, ra, rb) — sc = (sin, cos) of cap angle
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

/**
 * Capped-torus SDF — a torus arc that sweeps `2*capAngle` around +Y.
 * @param {object} opts
 * @param {number} [opts.capAngle=Math.PI/2]  half the arc sweep angle in radians (π/2 = half-torus, π = full)
 * @param {number} [opts.majorR=0.4]          major radius of the loop
 * @param {number} [opts.minorR=0.1]          minor radius (tube thickness)
 */
export function cappedTorusSDF({ capAngle = Math.PI / 2, majorR = 0.4, minorR = 0.1 } = {}) {
  const sinA = Math.sin(capAngle), cosA = Math.cos(capAngle);
  const ra = majorR, rb = minorR;
  const inst = SDF3((p) => {
    const px = Math.abs(p[0]);
    const py = p[1];
    const pz = p[2];
    const dotPxy = px * sinA + py * cosA;
    const k = (cosA * px > sinA * py) ? dotPxy : Math.sqrt(px * px + py * py);
    return Math.sqrt(px * px + py * py + pz * pz + ra * ra - 2 * ra * k) - rb;
  });
  inst.ast = { kind: 'prim', name: 'capped-torus', args: [capAngle, majorR, minorR] };
  return inst;
}

export const cappedTorusSpec = {
  type: 'capped-torus',
  category: 'primitive',
  args: {
    capAngle: { type: 'number', default: Math.PI / 2 },
    majorR:   { type: 'number', default: 0.4 },
    minorR:   { type: 'number', default: 0.1 },
  },
  source: {
    portedFrom:     'https://iquilezles.org/articles/distfunctions/',
    originalAuthor: 'Inigo Quilez',
    license:        'MIT (canonical IQ SDF article)',
    portedAt:       '2026-05-18',
    porter:         'Atlas /port-shader batch port',
  },
};
