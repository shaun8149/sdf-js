// =============================================================================
// octogon — 2D SDF for a regular octagon
// -----------------------------------------------------------------------------
// 8-sided regular polygon, flat-top. Inscribed-radius `radius`.
// Use cases: stop signs, octagonal mirror frames, geometric icons.
//
// Ported via Atlas /port-shader pipeline (Track 4 batch, 2026-05-27).
// Source: https://github.com/Games-by-Mason/gbms/blob/main/include/gbms/sd.glsl
// Algorithm credit: Inigo Quilez (canonical 2D SDF article)
// License: MIT
// =============================================================================

import { SDF2 } from '../../../sdf/core.js';

// k = (-cos(2π/16), sin(2π/16), tan(2π/16))
//   = (-0.9238795325, 0.3826834323, 0.4142135623)
const K_OCT = [-0.9238795325, 0.3826834323, 0.4142135623];

export function octogonSDF({ radius = 0.5 } = {}) {
  const r = radius;
  const k0 = K_OCT[0], k1 = K_OCT[1], k2 = K_OCT[2];
  const inst = SDF2((p) => {
    let px = Math.abs(p[0]);
    let py = Math.abs(p[1]);
    let m1 =  k0 * px + k1 * py;
    if (m1 < 0) { px = px - 2 * m1 *  k0; py = py - 2 * m1 * k1; }
    let m2 = -k0 * px + k1 * py;
    if (m2 < 0) { px = px - 2 * m2 * -k0; py = py - 2 * m2 * k1; }
    const cx = Math.max(-r * k2, Math.min(r * k2, px));
    const dx = px - cx;
    const dy = py - r;
    return Math.hypot(dx, dy) * Math.sign(dy);
  });
  inst.ast = { kind: 'prim', name: 'octogon', args: [r] };
  return inst;
}

export const octogonSpec = {
  type: 'octogon',
  category: '2d-primitive',
  args: {
    radius: { type: 'number', default: 0.5, doc: 'inscribed radius' },
  },
  source: {
    portedFrom:     'https://github.com/Games-by-Mason/gbms/blob/main/include/gbms/sd.glsl',
    originalAuthor: 'Mason — adapted from IQ canonical SDF article',
    license:        'MIT',
    portedAt:       '2026-05-27',
    porter:         'Atlas /port-shader (Track 4 batch)',
  },
};
