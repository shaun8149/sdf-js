// =============================================================================
// u-shape — IQ's U-shaped SDF (semi-circle arc + two parallel legs)
// Source: https://iquilezles.org/articles/distfunctions/
// GLSL helper: sdU(p, r, le, vec2 w)
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

/**
 * U-shape SDF — magnet / horseshoe-like form. Half-circle in the upper half,
 * straight legs extending below.
 *
 * @param {object} opts
 * @param {number} [opts.radius=0.3]      radius of the half-circle arc (centerline)
 * @param {number} [opts.legLength=0.2]   length of the straight leg below the arc
 * @param {number} [opts.halfWidth=0.06]  half-thickness of the bar in the XY plane
 * @param {number} [opts.halfDepth=0.04]  half-extent along Z (out-of-plane)
 */
export function uShapeSDF({
  radius = 0.3,
  legLength = 0.2,
  halfWidth = 0.06,
  halfDepth = 0.04,
} = {}) {
  const r = radius,
    le = legLength,
    wx = halfWidth,
    wy = halfDepth;
  const inst = SDF3((p) => {
    const py = p[1];
    // p.x = (p.y > 0) ? abs(p.x) : length(p.xy)
    let px = py > 0 ? Math.abs(p[0]) : Math.sqrt(p[0] * p[0] + py * py);
    px = Math.abs(px - r);
    const pyAdj = py - le;
    const k = Math.max(px, pyAdj);
    const qx = k < 0 ? -k : Math.sqrt(Math.max(px, 0) ** 2 + Math.max(pyAdj, 0) ** 2);
    const qy = Math.abs(p[2]);
    const dx = qx - wx;
    const dy = qy - wy;
    return Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) + Math.min(Math.max(dx, dy), 0);
  });
  inst.ast = { kind: 'prim', name: 'u-shape', args: [radius, legLength, halfWidth, halfDepth] };
  return inst;
}

export const uShapeSpec = {
  type: 'u-shape',
  category: 'primitive',
  args: {
    radius: { type: 'number', default: 0.3 },
    legLength: { type: 'number', default: 0.2 },
    halfWidth: { type: 'number', default: 0.06 },
    halfDepth: { type: 'number', default: 0.04 },
  },
  source: {
    portedFrom: 'https://iquilezles.org/articles/distfunctions/',
    originalAuthor: 'Inigo Quilez',
    license: 'MIT',
    portedAt: '2026-05-18',
    porter: 'Atlas /port-shader batch port',
  },
};
