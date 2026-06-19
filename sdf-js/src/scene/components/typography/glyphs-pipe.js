// =============================================================================
// glyphs-pipe.js — hand-crafted true-3D SDF font (monoline pipe style)
// -----------------------------------------------------------------------------
// Sibling to glyphs.js (Wave 1 2D). Each glyph is composed from 3D primitives
// (capsule / torus / sphere / cappedTorusSDF). Same unit cap-height layout
// (baseline y=0, cap top y=1.0, centered x=0). Default pipeRadius = 0.06.
//
// Lives at z=0 in 3D space — the glyph "plane" is XY, with pipe thickness
// extending into ±Z by pipeRadius. Renders as a 3D sculpture (round normals
// everywhere) — fundamentally different visual species from extrude(glyph2d).
//
// Spec: docs/superpowers/specs/2026-06-19-text-3d-pipe-design.md
// Reference: IQ canonical SDFs (https://iquilezles.org/articles/distfunctions/)
// =============================================================================

import { sphere, capsule, torus } from '../../../sdf/d3.js';
import { union } from '../../../sdf/dn.js';
import { cappedTorusSDF } from '../community/iq-capped-torus.js';

// ---- Helpers ----------------------------------------------------------------

/**
 * Build an arc spanning angles a0..a1 (CCW radians from +X axis) at the given
 * center, in the XY plane, as a partial torus (pipe). Wraps cappedTorusSDF
 * (whose default arc midpoint is at +Y direction = angle π/2).
 *
 * @param {number} cx, cy   center of the arc circle in XY
 * @param {number} R        major radius (distance from center to tube axis)
 * @param {number} a0, a1   arc endpoints in radians (CCW from +X)
 * @param {number} pipeR    minor radius (tube thickness)
 */
export function pipeArcSpan(cx, cy, R, a0, a1, pipeR) {
  const halfAp = Math.abs(a1 - a0) / 2;
  const mid = (a0 + a1) / 2;
  // cappedTorus default arc midpoint is at angle π/2 (pointing +Y).
  // Rotate around Z by (mid - π/2) so midpoint lands at `mid`.
  // No X-axis rotation needed — cappedTorus already lies in XY plane.
  const rot = mid - Math.PI / 2;
  return cappedTorusSDF({ capAngle: halfAp, majorR: R, minorR: pipeR })
    .rotate(rot, [0, 0, 1])
    .translate([cx, cy, 0]);
}

// ---- Glyph builders ---------------------------------------------------------
// Each builder takes pipeRadius `r` and returns { sdf: SDF3, advance: number }.

const GLYPH_BUILDERS = {
  // 0 — single torus, rotated to lie in XY plane (torus default = XZ plane)
  0: (r) => ({
    advance: 0.6,
    sdf: torus(0.22, r)
      .rotate(Math.PI / 2, [1, 0, 0])
      .translate([0, 0.5, 0]),
  }),

  // 1 — single vertical capsule (no serif, no flag — round caps give closure)
  1: (r) => ({
    advance: 0.35,
    sdf: capsule([0, 0, 0], [0, 1.0, 0], r),
  }),

  // . — small sphere on baseline
  '.': (r) => ({
    advance: 0.25,
    sdf: sphere(r * 1.6).translate([0, r * 1.6, 0]),
  }),

  // - — horizontal capsule at midline
  '-': (r) => ({
    advance: 0.45,
    sdf: capsule([-0.18, 0.5, 0], [0.18, 0.5, 0], r),
  }),

  // + — two crossing capsules at midline
  '+': (r) => ({
    advance: 0.55,
    sdf: union(capsule([-0.2, 0.5, 0], [0.2, 0.5, 0], r), capsule([0, 0.3, 0], [0, 0.7, 0], r)),
  }),

  // space — no SDF, advance only
  ' ': (_r) => ({ advance: 0.35, sdf: null }),

  // 2 — top arc opening down + diagonal sweep + base capsule
  // Top arc: center (0, 0.7), R 0.22, span (π, 0) sweeping CCW through +π/2 (top opening at bottom)
  2: (r) => ({
    advance: 0.55,
    sdf: union(
      pipeArcSpan(0, 0.7, 0.22, 0, Math.PI, r),
      capsule([0.22, 0.7, 0], [-0.2, 0, 0], r), // diagonal from arc right-end to baseline left
      capsule([-0.2, 0, 0], [0.22, 0, 0], r), // base
    ),
  }),

  // 3 — two stacked arcs opening to the LEFT (midpoints on +X)
  3: (r) => ({
    advance: 0.55,
    sdf: union(
      pipeArcSpan(0, 0.75, 0.22, -Math.PI / 2, Math.PI / 2, r),
      pipeArcSpan(0, 0.25, 0.22, -Math.PI / 2, Math.PI / 2, r),
    ),
  }),

  // 5 — top horizontal + left vertical + bottom belly arc
  // Belly arc: center (0, 0.3) R 0.25, opens UP-LEFT (midpoint near +X going slightly down)
  5: (r) => ({
    advance: 0.55,
    sdf: union(
      capsule([-0.2, 1.0, 0], [0.22, 1.0, 0], r), // top horizontal
      capsule([-0.2, 1.0, 0], [-0.2, 0.55, 0], r), // left vertical
      capsule([-0.2, 0.55, 0], [0.05, 0.55, 0], r), // midline horiz to belly tangent
      pipeArcSpan(0, 0.3, 0.25, -Math.PI / 2, Math.PI + Math.PI / 6, r), // belly: ~210° arc opening up-left
    ),
  }),

  // $ — central bar extending past cap height + two arcs forming S
  // Top arc opens LEFT (mid at +X), bottom arc opens RIGHT (mid at -X)
  $: (r) => ({
    advance: 0.55,
    sdf: union(
      capsule([0, 1.1, 0], [0, -0.1, 0], r),
      pipeArcSpan(0, 0.75, 0.22, -Math.PI / 2, Math.PI / 2, r), // top: mid at +X
      pipeArcSpan(0, 0.25, 0.22, Math.PI / 2, Math.PI + Math.PI / 2, r), // bottom: mid at -X
    ),
  }),
};

// ---- Public API -------------------------------------------------------------

export function buildPipeGlyph(char, pipeRadius = 0.06) {
  const builder = GLYPH_BUILDERS[char];
  if (!builder) return null;
  return builder(pipeRadius);
}

export function supportedPipeChars() {
  return Object.keys(GLYPH_BUILDERS);
}

// Export for tests
export { GLYPH_BUILDERS };
