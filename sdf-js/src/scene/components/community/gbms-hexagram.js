// =============================================================================
// hexagram — 2D SDF for a 6-pointed star (Star of David / Solomon's seal)
// -----------------------------------------------------------------------------
// Two overlapping triangles forming a 6-pointed star. `radius` controls the
// circumscribed circle (point-to-center).
// Use cases: Jewish iconography, geometric ornament, occult symbolism.
//
// Ported via Atlas /port-shader pipeline (Track 4 batch, 2026-05-27).
// Source: https://github.com/Games-by-Mason/gbms/blob/main/include/gbms/sd.glsl
// Algorithm credit: Inigo Quilez (canonical 2D SDF article)
// License: MIT
// =============================================================================

import { SDF2 } from '../../../sdf/core.js';

// k = (-0.5, sqrt(3)/2, 1/sqrt(3), sqrt(3))
//   ≈ (-0.5, 0.8660254038, 0.5773502692, 1.7320508076)
const K_HEX = [-0.5, 0.8660254038, 0.5773502692, 1.7320508076];

export function hexagramSDF({ radius = 0.5 } = {}) {
  const r = radius;
  const k0 = K_HEX[0],
    k1 = K_HEX[1],
    k2 = K_HEX[2],
    k3 = K_HEX[3];
  const inst = SDF2((p) => {
    let px = Math.abs(p[0]);
    let py = Math.abs(p[1]);
    // First reflection: k.xy = (-0.5, 0.8660254)
    let m1 = k0 * px + k1 * py;
    if (m1 < 0) {
      px = px - 2 * m1 * k0;
      py = py - 2 * m1 * k1;
    }
    // Second reflection: k.yx = (0.8660254, -0.5)
    let m2 = k1 * px + k0 * py;
    if (m2 < 0) {
      px = px - 2 * m2 * k1;
      py = py - 2 * m2 * k0;
    }
    const cx = Math.max(r * k2, Math.min(r * k3, px));
    const dx = px - cx;
    const dy = py - r;
    return Math.hypot(dx, dy) * Math.sign(dy);
  });
  inst.ast = { kind: 'prim', name: 'hexagram', args: [r] };
  return inst;
}

export const hexagramSpec = {
  type: 'hexagram',
  category: '2d-primitive',
  args: {
    radius: { type: 'number', default: 0.5, doc: 'circumscribed radius (point-to-center)' },
  },
  source: {
    portedFrom: 'https://github.com/Games-by-Mason/gbms/blob/main/include/gbms/sd.glsl',
    originalAuthor: 'Mason — adapted from IQ canonical SDF article',
    license: 'MIT',
    portedAt: '2026-05-27',
    porter: 'Atlas /port-shader (Track 4 batch)',
  },
};
