// =============================================================================
// sphere-segmented-3d.js — orange-wedge sphere (Atlas Shape atom, Sprint 2).
// -----------------------------------------------------------------------------
// A sphere split into N longitudinal wedges ("orange slices") with angular gaps,
// each wedge optionally exploded radially outward. Covers PresentationLoad "3D
// Spheres Divisions". Composite atom built from shipped primitives:
//   - sphere        (d3.js:16,  sdf3.compile.js:313)
//   - plane         (d3.js:44,  sdf3.compile.js:321)
//   - intersection  (dn.js:73,  sdf3.compile.js:722)
//   - union         (dn.js:37,  sdf3.compile.js:224)
//
// Each wedge is sphere ∩ two half-planes through the Y axis. With direction
// convention d(θ) = (sinθ, 0, cosθ), wedge i is centered at θm = i·2π/N and
// spans ±α where α = π/N − gapAngle/2. The inward normal of the lower boundary
// (θm − α) is (cos(θm−α), 0, −sin(θm−α)); of the upper boundary (θm + α) is
// (−cos(θm+α), 0, sin(θm+α)). plane(n) is negative (inside) where dot(p, n) > 0,
// so intersecting both half-planes keeps exactly the sector. The wedge is then
// shifted along d(θm) by `explode` to open the slices apart.
//
// Spec: docs/superpowers/specs/2026-06-20-sphere-atoms-design.md
// =============================================================================

import { sphere, plane } from '../../../sdf/d3.js';
import { union, intersection } from '../../../sdf/dn.js';

const clampInt = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(x)));

/**
 * sphere-segmented-3d SDF.
 *
 * @param {object} opts
 * @param {number} [opts.segments=6]    number of wedges (clamped 2..24)
 * @param {number} [opts.radius=0.7]    sphere radius
 * @param {number} [opts.explode=0.12]  radial outward shift per wedge (gap size)
 * @param {number} [opts.gapAngle=0.06] angular gap (radians) shaved off each wedge
 * @returns {SDF3|null}
 */
export function sphereSegmented3dSDF({
  segments = 6,
  radius = 0.7,
  explode = 0.12,
  gapAngle = 0.06,
} = {}) {
  if (radius <= 0) return null;
  const N = clampInt(segments, 2, 24);

  // Half-span of a wedge, minus half the gap on each side. Floor keeps the
  // sector well-defined (two half-planes only describe a sector < 180°).
  const alpha = Math.max(Math.PI / N - gapAngle / 2, 0.02);

  const wedges = [];
  for (let i = 0; i < N; i++) {
    const thetaM = (i / N) * Math.PI * 2;
    const lo = thetaM - alpha;
    const hi = thetaM + alpha;
    const nLo = [Math.cos(lo), 0, -Math.sin(lo)];
    const nHi = [-Math.cos(hi), 0, Math.sin(hi)];
    let wedge = intersection(sphere(radius), plane(nLo), plane(nHi));
    if (explode !== 0) {
      wedge = wedge.translate([explode * Math.sin(thetaM), 0, explode * Math.cos(thetaM)]);
    }
    wedges.push(wedge);
  }

  return wedges.length === 1 ? wedges[0] : union(...wedges);
}

// ---- Spec (compile.js validation + lift prompt) -----------------------------

export const sphereSegmented3dSpec = {
  type: 'sphere-segmented-3d',
  category: 'shapes',
  args: {
    segments: { type: 'number', default: 6, min: 2, max: 24, doc: 'Number of wedges (2..24)' },
    radius: { type: 'number', default: 0.7, doc: 'Sphere radius' },
    explode: { type: 'number', default: 0.12, doc: 'Radial outward shift per wedge (gap size)' },
    gapAngle: { type: 'number', default: 0.06, doc: 'Angular gap (radians) shaved off each wedge' },
  },
  examples: [
    { name: 'Orange (6)', args: { segments: 6, explode: 0.12 } },
    { name: 'Pie sphere (8)', args: { segments: 8, explode: 0.2 } },
    { name: 'Tight halves', args: { segments: 2, explode: 0.05 } },
  ],
  description: 'Sphere split into longitudinal wedges (divisions / market share / exploded view)',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-20',
    builder: 'Sprint 2 sphere atom #4 — taxonomy shapes/',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
