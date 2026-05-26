// =============================================================================
// cut-disk — 2D SDF for a disk with a chord-cut top (D-shape)
// -----------------------------------------------------------------------------
// A circle of `radius` with the portion above the horizontal line y = cut
// removed. Cut ranges in [-radius, radius]:
//   cut > 0  → less than half-disk on the bottom
//   cut = 0  → exact half-disk (lower hemisphere)
//   cut < 0  → more than half-disk (fattens the bottom)
//
// Use cases: badge silhouettes, lens cross-section, half-moon icons,
// stamped tab buttons, partial-eclipse moon.
//
// Ported via Atlas /port-shader pipeline (Track 4 dogfood, 2026-05-26).
// Source: https://github.com/Games-by-Mason/gbms/blob/main/include/gbms/sd.glsl
// Algorithm credit: Inigo Quilez (gbms's own header credits IQ as origin)
// License of source file: MIT (gbms repo top-level LICENSE)
// =============================================================================

import { SDF2 } from '../../../sdf/core.js';

/**
 * Cut-disk 2D SDF.
 *
 *   `cut` is the y-level of the horizontal chord. The kept region is BELOW
 *   the chord (y ≤ cut), and the disk is otherwise within `radius`. This is
 *   inverted from gbms's original convention (which keeps ABOVE) — Atlas
 *   uses "keep below" so the verb `cut` matches its intuitive meaning of
 *   "cut off the top". Implemented by negating y + cut at the call site.
 *
 *   cut =  radius → full disk (no cut)
 *   cut =  0       → lower half-disk (∪ shape)
 *   cut = -radius → empty
 *
 * @param {object} opts
 * @param {number} [opts.radius=0.5] — circle radius before cut
 * @param {number} [opts.cut=0]      — y-level of the chord, in [-radius, radius]
 */
function gbmsCutDiskAlgorithm(px_abs, py, radius, cut, w) {
  // Verbatim translation of gbms sdCutDisk (MIT, IQ-derived). Keeps y > cut.
  const s = Math.max(
    (cut - radius) * px_abs * px_abs + w * w * (cut + radius - 2 * py),
    cut * px_abs - w * py,
  );
  if (s < 0) return Math.hypot(px_abs, py) - radius;
  if (px_abs < w) return cut - py;
  return Math.hypot(px_abs - w, py - cut);
}

export function cutDiskSDF({ radius = 0.5, cut = 0 } = {}) {
  // Atlas inverts convention to "keep below cut". Compute by passing -y
  // and -cut into the gbms algorithm, which keeps "above its cut" — the
  // negation flips the kept side.
  const w = Math.sqrt(Math.max(0, radius * radius - cut * cut));
  const inst = SDF2((p) => {
    const px = Math.abs(p[0]);
    return gbmsCutDiskAlgorithm(px, -p[1], radius, -cut, w);
  });
  // AST tag for future SceneData → GLSL compile path (CPU works today).
  inst.ast = { kind: 'prim', name: 'cut-disk', args: [radius, cut] };
  return inst;
}

export const cutDiskSpec = {
  type: 'cut-disk',
  category: '2d-primitive',
  args: {
    radius: { type: 'number', default: 0.5, doc: 'circle radius before the cut' },
    cut:    { type: 'number', default: 0.1, doc: 'y-level of the chord cut, in [-radius, radius]' },
  },
  source: {
    portedFrom:     'https://github.com/Games-by-Mason/gbms/blob/main/include/gbms/sd.glsl',
    originalAuthor: 'Mason — adapted from IQ canonical SDF article',
    license:        'MIT',
    portedAt:       '2026-05-26',
    porter:         'Atlas /port-shader skill (Track 4 dogfood)',
  },
};
