// =============================================================================
// chamfer-box — 2D SDF for a box with 45° chamfered corners
// -----------------------------------------------------------------------------
// Rectangle of half-extent `dims` with 45° edges cut off corners (chamfer
// size = `chamfer`). Distinct from `rounded_rectangle`, which uses CIRCULAR
// corners. Chamfered corners give an industrial / hardware / mechanical
// aesthetic (gaskets, washers, electronic case cutouts).
//
// Ported via Atlas /port-shader pipeline (Track 4 batch, 2026-05-27).
// Source: https://github.com/Games-by-Mason/gbms/blob/main/include/gbms/sd.glsl
// License: MIT
// =============================================================================

import { SDF2 } from '../../../sdf/core.js';

const SQRT_HALF = Math.sqrt(0.5);

export function chamferBoxSDF({ dims = [0.5, 0.3], chamfer = 0.08 } = {}) {
  const [hx, hy] = dims;
  const c = Math.max(0, chamfer);
  const inst = SDF2((p) => {
    // Fold to first quadrant
    let px = Math.abs(p[0]) - hx;
    let py = Math.abs(p[1]) - hy;
    // Swap so px >= py (the longer-out axis)
    if (py > px) { const t = px; px = py; py = t; }
    // After swap: chamfer cut applies along the (px, py + chamfer) corner
    py = py + c;
    // Inside both faces? Negative distance to nearer face.
    if (py < 0 && py + px * (1 - Math.SQRT2) < 0) {
      return px;  // inside, closest face is px-aligned
    }
    if (px < py) {
      // On the chamfer 45° line
      return (px + py) * SQRT_HALF;
    }
    // Outside corner
    return Math.hypot(Math.max(px, 0), Math.max(py, 0));
  });
  inst.ast = { kind: 'prim', name: 'chamfer-box', args: [hx, hy, c] };
  return inst;
}

export const chamferBoxSpec = {
  type: 'chamfer-box',
  category: '2d-primitive',
  args: {
    dims:    { type: 'array',  default: [0.5, 0.3], doc: 'half-extents [hx, hy]' },
    chamfer: { type: 'number', default: 0.08,       doc: '45° cut size at each corner' },
  },
  source: {
    portedFrom:     'https://github.com/Games-by-Mason/gbms/blob/main/include/gbms/sd.glsl',
    originalAuthor: 'Mason',
    license:        'MIT',
    portedAt:       '2026-05-27',
    porter:         'Atlas /port-shader (Track 4 batch)',
  },
};
