// =============================================================================
// parabola — 2D SDF for the curve y = k * x²
// -----------------------------------------------------------------------------
// Closed-form distance using cubic root formula (Cardano). `k` is the
// quadratic coefficient — larger k = tighter parabola.
// Use cases: arch silhouettes, dome cross-sections, lens curves, fountain
// trajectories.
//
// Ported via Atlas /port-shader pipeline (Track 4 batch, 2026-05-27).
// Source: https://github.com/Games-by-Mason/gbms/blob/main/include/gbms/sd.glsl
// Algorithm credit: Inigo Quilez (canonical 2D SDF article — closed-form via Cardano)
// License: MIT
// =============================================================================

import { SDF2 } from '../../../sdf/core.js';

export function parabolaSDF({ k = 1.0 } = {}) {
  const kk = k;
  const inst = SDF2((p) => {
    const px = Math.abs(p[0]);
    const py = p[1];
    const ik = 1.0 / kk;
    // Solve cubic for closest point (x, k*x*x) on y = k*x²
    const pCoef = (ik * (py - 0.5 * ik)) / 3.0;
    const qCoef = 0.25 * ik * ik * px;
    const h = qCoef * qCoef - pCoef * pCoef * pCoef;
    const r = Math.sqrt(Math.abs(h));
    let x;
    if (h > 0) {
      // One real root via Cardano
      x = Math.cbrt(qCoef + r) - Math.cbrt(Math.abs(qCoef - r)) * Math.sign(r - qCoef);
    } else {
      // Three real roots — pick relevant via trig form
      x = 2.0 * Math.cos(Math.atan2(r, qCoef) / 3.0) * Math.sqrt(pCoef);
    }
    const dx = px - x;
    const dy = py - kk * x * x;
    return Math.hypot(dx, dy) * Math.sign(px - x);
  });
  inst.ast = { kind: 'prim', name: 'parabola', args: [kk] };
  return inst;
}

export const parabolaSpec = {
  type: 'parabola',
  category: '2d-primitive',
  args: {
    k: {
      type: 'number',
      default: 1.0,
      doc: 'quadratic coefficient (y = k*x²); larger = tighter curve',
    },
  },
  source: {
    portedFrom: 'https://github.com/Games-by-Mason/gbms/blob/main/include/gbms/sd.glsl',
    originalAuthor: 'Mason — adapted from IQ canonical SDF article (Cardano closed-form)',
    license: 'MIT',
    portedAt: '2026-05-27',
    porter: 'Atlas /port-shader (Track 4 batch)',
  },
};
