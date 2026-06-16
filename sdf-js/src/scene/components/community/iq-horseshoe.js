// =============================================================================
// horseshoe — IQ's horseshoe SDF (open arc with rectangular cross-section)
// Source: https://iquilezles.org/articles/distfunctions/
// GLSL helper: sdHorseshoe(p, vec2 c, r, le, vec2 w)
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

/**
 * Horseshoe SDF — arc with rectangular cross-section, opens around +Y.
 * c = (cos, sin) of opening half-angle (gap at top); the unopen portion
 * sweeps from -angle to +angle below the axis.
 *
 * @param {object} opts
 * @param {number} [opts.openAngle=Math.PI/3]  half angle of the opening (the gap), 0..π/2
 * @param {number} [opts.radius=0.4]           radius of the arc center-line
 * @param {number} [opts.length=0.1]           half-length of the straight legs after the arc
 * @param {number} [opts.halfWidth=0.08]       half-thickness of the bar
 * @param {number} [opts.halfDepth=0.04]       half-extent along Z (out-of-plane)
 */
export function horseshoeSDF({
  openAngle = Math.PI / 3,
  radius = 0.4,
  length = 0.1,
  halfWidth = 0.08,
  halfDepth = 0.04,
} = {}) {
  const cx = Math.cos(openAngle),
    cy = Math.sin(openAngle);
  const r = radius,
    le = length,
    wx = halfWidth,
    wy = halfDepth;
  const inst = SDF3((p) => {
    let px = Math.abs(p[0]);
    const py = p[1];
    const pz = p[2];
    const l = Math.sqrt(px * px + py * py);
    // 2x2 mat * p.xy : mat = [[-cx, cy], [cy, cx]]
    let tx = -cx * px + cy * py;
    let ty = cy * px + cx * py;
    if (!(ty > 0 || tx > 0)) tx = l * (-cx >= 0 ? 1 : -1);
    if (!(tx > 0)) ty = l;
    tx = tx - le;
    ty = Math.abs(ty - r);
    const insideMin = Math.min(0, Math.max(tx, ty));
    const outsideX = Math.max(tx, 0);
    const outsideY = Math.max(ty, 0);
    const qx = Math.sqrt(outsideX * outsideX + outsideY * outsideY) + insideMin;
    const qy = pz;
    const dx = Math.abs(qx) - wx;
    const dy = Math.abs(qy) - wy;
    return Math.min(Math.max(dx, dy), 0) + Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2);
  });
  inst.ast = {
    kind: 'prim',
    name: 'horseshoe',
    args: [openAngle, radius, length, halfWidth, halfDepth],
  };
  return inst;
}

export const horseshoeSpec = {
  type: 'horseshoe',
  category: 'primitive',
  args: {
    openAngle: { type: 'number', default: Math.PI / 3 },
    radius: { type: 'number', default: 0.4 },
    length: { type: 'number', default: 0.1 },
    halfWidth: { type: 'number', default: 0.08 },
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
