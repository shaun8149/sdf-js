// =============================================================================
// link — IQ's "Link" SDF primitive (chain link / connector / oblong torus)
// -----------------------------------------------------------------------------
// A torus elongated along the Y axis: two parallel straight cylindrical sections
// (length = 2 * halfLength) joined by half-torus caps at each end. The shape of
// a single steel chain link, a key-ring, an oblong loop, a carabiner body, a
// stylized capsule-with-a-hole.
//
// Algorithm: take a standard torus equation
//   length(vec2(length(p.xy) - R, p.z)) - r
// and replace `p.y` with `max(|p.y| - le, 0)` so the torus is "pulled apart"
// along Y by 2*le. Inside |y| ≤ le the q.y = 0 (radial profile is identical to
// a torus cross-section), outside it joins to the spherical cap.
//
// Ported via Atlas /port-shader pipeline (Day 1, 2026-05-18, second port).
// Source: https://iquilezles.org/articles/distfunctions/  ("Link - exact")
// Original GLSL author: Inigo Quilez (canonical SDF library)
// License: MIT (canonical IQ SDF article) — used here as derived work.
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

/**
 * Link SDF — a chain-link / oblong-torus shape, axis along +Y.
 *
 *   total length along Y = 2 * (halfLength + majorR + minorR)
 *   tube outer diameter  = 2 * (majorR + minorR)
 *   hole inner diameter  = 2 * (majorR - minorR)
 *
 * Default: a small chain link (halfLength=0.13, majorR=0.1, minorR=0.02).
 *
 * @param {object} opts
 * @param {number} [opts.halfLength=0.13]  half the length of the straight section (Y elongation)
 * @param {number} [opts.majorR=0.1]       major radius of the (round) loop cross-section
 * @param {number} [opts.minorR=0.02]      minor radius (tube thickness)
 */
export function linkSDF({ halfLength = 0.13, majorR = 0.1, minorR = 0.02 } = {}) {
  const le = halfLength,
    r1 = majorR,
    r2 = minorR;

  const inst = SDF3((p) => {
    // q = (p.x, max(|p.y|-le, 0), p.z) — elongates the torus along Y
    const qx = p[0];
    const qy = Math.max(Math.abs(p[1]) - le, 0);
    const qz = p[2];
    // standard torus body in qx/qy/qz frame: length(vec2(length(q.xy) - r1, q.z)) - r2
    const lenQXY = Math.sqrt(qx * qx + qy * qy);
    const ax = lenQXY - r1;
    const ay = qz;
    return Math.sqrt(ax * ax + ay * ay) - r2;
  });

  inst.ast = { kind: 'prim', name: 'link', args: [halfLength, majorR, minorR] };
  return inst;
}

export const linkSpec = {
  type: 'link',
  category: 'primitive',
  args: {
    halfLength: {
      type: 'number',
      default: 0.13,
      doc: 'Half-length of the straight section (Y elongation)',
    },
    majorR: { type: 'number', default: 0.1, doc: 'Major radius of the loop cross-section' },
    minorR: { type: 'number', default: 0.02, doc: 'Minor radius (tube thickness)' },
  },
  source: {
    portedFrom: 'https://iquilezles.org/articles/distfunctions/',
    algorithmRef: 'IQ "Link - exact" SDF',
    originalAuthor: 'Inigo Quilez (canonical SDF article)',
    license: 'MIT (canonical IQ SDF article)',
    portedAt: '2026-05-18',
    porter: 'Atlas /port-shader skill — second invocation (dogfood)',
  },
  thumbnail: null,
};
