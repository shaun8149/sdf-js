// =============================================================================
// solid-angle — IQ's "Solid Angle - exact" SDF primitive
// -----------------------------------------------------------------------------
// A conical solid-angle volume: tip at origin, opens along +Y, bounded by a
// sphere of `radius`. The aperture is set by `halfAperture` (in radians from
// the +Y axis). Useful for: spotlight cones, ice-cream cones, leaf bases,
// pine-tree silhouettes (foliage envelope), umbrella stems, light beams.
//
// Ported via Atlas /port-shader pipeline (Day 1, 2026-05-18).
// Source: https://github.com/flightphone/shaderty/blob/main/glsl/pine.glsl
// Algorithm: https://iquilezles.org/articles/distfunctions/ ("Solid Angle - exact")
// Original GLSL author: Inigo Quilez (canonical SDF library)
// License: MIT (canonical IQ SDF article) — used here as derived work.
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

/**
 * Solid-angle SDF — a conical wedge of a sphere.
 *
 *   tip at origin, axis along +Y
 *   half-aperture = angle from +Y axis to the cone's lateral surface
 *   radius        = spherical bound (distance from tip to far cap)
 *
 * Default values give a "pine canopy" style cone: 30° half-aperture, r=0.5.
 *
 * @param {object} opts
 * @param {number} [opts.halfAperture=Math.PI/6]  half angle in radians (0 = needle, π/2 = hemisphere)
 * @param {number} [opts.radius=0.5]              outer sphere radius
 */
export function solidAngleSDF({ halfAperture = Math.PI / 6, radius = 0.5 } = {}) {
  const sinA = Math.sin(halfAperture);
  const cosA = Math.cos(halfAperture);
  const ra = radius;

  const inst = SDF3((p) => {
    // q is (radial-distance-from-Y-axis, signed-Y) — collapses 3D problem to 2D
    const qx = Math.sqrt(p[0] * p[0] + p[2] * p[2]);
    const qy = p[1];

    // distance to outer spherical cap
    const lenQ = Math.sqrt(qx * qx + qy * qy);
    const l = lenQ - ra;

    // distance to lateral cone surface (projection onto cone axis, clamped to [0,ra])
    const dotQC = qx * sinA + qy * cosA;
    const t = Math.max(0, Math.min(ra, dotQC));
    const mx = qx - sinA * t;
    const my = qy - cosA * t;
    const m = Math.sqrt(mx * mx + my * my);

    // sign: inside the cone (between axis and lateral surface) the m term flips
    const cross = cosA * qx - sinA * qy;
    const signedM = m * (cross >= 0 ? 1 : -1);

    return Math.max(l, signedM);
  });

  // AST tag — for now the GLSL compiler doesn't know this primitive yet.
  // CPU silhouette renderer + scene-data tree work fine. GPU support is a
  // follow-up: add 'solid-angle' case to sdf3.glsl.js emitter.
  inst.ast = { kind: 'prim', name: 'solid-angle', args: [halfAperture, radius] };
  return inst;
}

export const solidAngleSpec = {
  type: 'solid-angle',
  category: 'primitive',
  args: {
    halfAperture: { type: 'number', default: Math.PI / 6, doc: 'Half angle from +Y axis in radians' },
    radius:       { type: 'number', default: 0.5,         doc: 'Spherical bound radius' },
  },
  source: {
    portedFrom:    'https://github.com/flightphone/shaderty/blob/main/glsl/pine.glsl#L135',
    algorithmRef:  'https://iquilezles.org/articles/distfunctions/',
    originalAuthor: 'Inigo Quilez (canonical SDF article)',
    repoForkedBy:   'flightphone',
    license:        'MIT (canonical IQ SDF article)',
    portedAt:       '2026-05-18',
    porter:         'Atlas /port-shader pipeline Day 1 — manual walkthrough',
  },
  thumbnail: null, // TODO: headless silhouette render
};
