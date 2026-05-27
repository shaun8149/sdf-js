// =============================================================================
// pentagon — 2D SDF for a regular pentagon
// -----------------------------------------------------------------------------
// 5-sided regular polygon, point-up. Inscribed-radius `radius`.
// Use cases: badges, traffic/regulatory signs (US yield), pentagonal icons.
//
// Ported via Atlas /port-shader pipeline (Track 4 batch, 2026-05-27).
// Source: https://github.com/Games-by-Mason/gbms/blob/main/include/gbms/sd.glsl
// Algorithm credit: Inigo Quilez (canonical 2D SDF article)
// License: MIT
// =============================================================================

import { SDF2 } from '../../../sdf/core.js';

// k = (cos(2π/10), sin(2π/10), tan(2π/10))
//   = (0.809016994, 0.587785252, 0.726542528)
const K_PENTAGON = [0.809016994, 0.587785252, 0.726542528];

export function pentagonSDF({ radius = 0.5 } = {}) {
  const r = radius;
  const k0 = K_PENTAGON[0], k1 = K_PENTAGON[1], k2 = K_PENTAGON[2];
  const inst = SDF2((p) => {
    // Atlas uses math coords (y up); IQ pentagon formula assumes image
    // coords (y down). Negate y so pentagon appears point-up in Atlas.
    let px = Math.abs(p[0]);
    let py = -p[1];
    let m1 = -k0 * px + k1 * py;
    if (m1 < 0) { px = px - 2 * m1 * -k0; py = py - 2 * m1 * k1; }
    let m2 =  k0 * px + k1 * py;
    if (m2 < 0) { px = px - 2 * m2 *  k0; py = py - 2 * m2 * k1; }
    const cx = Math.max(-r * k2, Math.min(r * k2, px));
    const dx = px - cx;
    const dy = py - r;
    return Math.hypot(dx, dy) * Math.sign(dy);
  });
  inst.ast = { kind: 'prim', name: 'pentagon', args: [r] };
  return inst;
}

export const pentagonSpec = {
  type: 'pentagon',
  category: '2d-primitive',
  args: {
    radius: { type: 'number', default: 0.5, doc: 'inscribed radius (vertex distance to center)' },
  },
  source: {
    portedFrom:     'https://github.com/Games-by-Mason/gbms/blob/main/include/gbms/sd.glsl',
    originalAuthor: 'Mason — adapted from IQ canonical SDF article',
    license:        'MIT',
    portedAt:       '2026-05-27',
    porter:         'Atlas /port-shader (Track 4 batch)',
  },
};
