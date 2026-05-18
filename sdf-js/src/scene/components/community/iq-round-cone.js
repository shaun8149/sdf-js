// =============================================================================
// round-cone — IQ's round-cone primitives (axis-aligned form only).
// Source: https://iquilezles.org/articles/distfunctions/
// GLSL helper: sdRoundCone(p, r1, r2, h) — axis +Y, base radius r1 at y=0, top radius r2 at y=h
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

/**
 * Round-cone SDF (axis-aligned, +Y) — a cone with rounded (spherical) tip caps.
 * Useful for: pawns, bottles, capsule-like elongated shapes, finger tips.
 * @param {object} opts
 * @param {number} [opts.baseRadius=0.3]  radius at y=0 (r1)
 * @param {number} [opts.topRadius=0.1]   radius at y=height (r2)
 * @param {number} [opts.height=0.6]      distance along +Y between caps
 */
export function roundConeSDF({ baseRadius = 0.3, topRadius = 0.1, height = 0.6 } = {}) {
  const r1 = baseRadius, r2 = topRadius, h = height;
  const b = (r1 - r2) / h;
  const a = Math.sqrt(1 - b * b);
  const inst = SDF3((p) => {
    const qx = Math.sqrt(p[0] * p[0] + p[2] * p[2]);
    const qy = p[1];
    const k = qx * -b + qy * a;
    if (k < 0)     return Math.sqrt(qx * qx + qy * qy) - r1;
    if (k > a * h) return Math.sqrt(qx * qx + (qy - h) * (qy - h)) - r2;
    return qx * a + qy * b - r1;
  });
  inst.ast = { kind: 'prim', name: 'round-cone', args: [baseRadius, topRadius, height] };
  return inst;
}

export const roundConeSpec = {
  type: 'round-cone',
  category: 'primitive',
  args: {
    baseRadius: { type: 'number', default: 0.3 },
    topRadius:  { type: 'number', default: 0.1 },
    height:     { type: 'number', default: 0.6 },
  },
  source: {
    portedFrom: 'https://iquilezles.org/articles/distfunctions/',
    originalAuthor: 'Inigo Quilez',
    license: 'MIT', portedAt: '2026-05-18', porter: 'Atlas /port-shader batch port',
  },
};
