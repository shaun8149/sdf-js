// =============================================================================
// glyphs.js — hand-crafted SDF font (monoline grotesk, parametric)
// -----------------------------------------------------------------------------
// Each glyph is composed from IQ 2D primitives (segment / arc / ring / circle).
// All glyphs live in unit cap-height space:
//   baseline at y = 0
//   cap height at y = 1.0
//   centered horizontally at x = 0, half-width varies per glyph
//   stroke radius r ≈ 0.06 (== 12% cap height — classic grotesk proportions)
//
// Why no font atlas / no MSDF: Atlas's value prop is "everything is an SDF
// tree." A textured quad would break boolean composition, animation, and the
// renderer-as-preset axis. ~30 lines of segment/arc unions per glyph = real
// SDF, anti-aliased for free, extrudable to 3D, animatable per-stroke.
//
// Reference: IQ canonical 2D SDFs (https://iquilezles.org/articles/distfunctions2d/)
// Wave 1: digits 0-9 + %  +  .  +  -  +  +  +  $  + space   (KPI use case)
// Wave 2 (TODO): A-Z
// Wave 3 (TODO): a-z
// Wave 4 (TODO): punctuation
// =============================================================================

import { segment, arc, ring, circle } from '../../../sdf/d2.js';
import { union } from '../../../sdf/dn.js';

// ---- Helpers ----------------------------------------------------------------

/**
 * Build an arc spanning angles a0..a1 (CCW, measured from +X axis) around the
 * given center. Wraps IQ's arc() — which opens at -Y by default with half-
 * aperture measured from +Y — by rotating into our preferred parameterization.
 */
function arcSpan(centerX, centerY, radius, a0, a1, thickness) {
  const halfAp = Math.abs(a1 - a0) / 2;
  const mid = (a0 + a1) / 2;
  // arc() opens at -Y. We want the opening at angle (mid + π). Required
  // rotation: (mid + π) - (-π/2) = mid - π/2 (mod 2π).
  const rot = mid - Math.PI / 2;
  return arc(radius, halfAp, thickness, [0, 0]).rotate(rot).translate([centerX, centerY]);
}

// ---- Digit glyphs (cap height 1.0) ------------------------------------------

const DIGIT_BUILDERS = {
  // 0 — stadium: two vertical strokes + top/bottom semicircular caps
  0: (r) => ({
    advance: 0.6,
    sdf: union(
      segment([-0.2, 0.25], [-0.2, 0.75], r),
      segment([0.2, 0.25], [0.2, 0.75], r),
      arcSpan(0, 0.75, 0.2, 0, Math.PI, r * 2),
      arcSpan(0, 0.25, 0.2, Math.PI, 2 * Math.PI, r * 2),
    ),
  }),
  // 1 — vertical stem + top flag + base serif
  1: (r) => ({
    advance: 0.35,
    sdf: union(
      segment([0, 0], [0, 1.0], r),
      segment([-0.15, 0.78], [0, 1.0], r),
      segment([-0.12, 0], [0.12, 0], r),
    ),
  }),
  // 2 — top open arc + diagonal sweep + base
  2: (r) => ({
    advance: 0.55,
    sdf: union(
      arcSpan(0, 0.7, 0.22, -Math.PI / 8, Math.PI + Math.PI / 8, r * 2),
      segment([0.2, 0.55], [-0.2, 0], r),
      segment([-0.2, 0], [0.22, 0], r),
    ),
  }),
  // 3 — two arcs that open to the left, stacked
  3: (r) => ({
    advance: 0.55,
    sdf: union(
      arcSpan(0, 0.75, 0.22, -Math.PI / 2, Math.PI, r * 2),
      arcSpan(0, 0.25, 0.22, 0, (3 * Math.PI) / 2, r * 2),
    ),
  }),
  // 4 — left diagonal down to crossbar + right vertical
  4: (r) => ({
    advance: 0.55,
    sdf: union(
      segment([0.12, 1.0], [-0.22, 0.32], r),
      segment([-0.22, 0.32], [0.22, 0.32], r),
      segment([0.12, 1.0], [0.12, 0], r),
    ),
  }),
  // 5 — top horiz + left vertical + curved bottom belly
  5: (r) => ({
    advance: 0.55,
    sdf: union(
      segment([-0.2, 1.0], [0.22, 1.0], r),
      segment([-0.2, 1.0], [-0.2, 0.55], r),
      segment([-0.2, 0.55], [0.05, 0.55], r),
      arcSpan(0, 0.3, 0.25, -Math.PI / 2, Math.PI + Math.PI / 6, r * 2),
    ),
  }),
  // 6 — top hook curving down-left + closed bottom loop
  6: (r) => ({
    advance: 0.55,
    sdf: union(
      arcSpan(0, 0.7, 0.32, Math.PI / 2, Math.PI, r * 2),
      segment([-0.22, 0.7], [-0.22, 0.3], r),
      ring(0.22, r * 2, [0, 0.3]),
    ),
  }),
  // 7 — top horizontal + diagonal down
  7: (r) => ({
    advance: 0.55,
    sdf: union(segment([-0.22, 1.0], [0.22, 1.0], r), segment([0.22, 1.0], [-0.1, 0], r)),
  }),
  // 8 — two stacked rings, smaller on top (classical grotesk)
  8: (r) => ({
    advance: 0.55,
    sdf: union(ring(0.2, r * 2, [0, 0.74]), ring(0.22, r * 2, [0, 0.26])),
  }),
  // 9 — mirror of 6: top closed loop + tail going down-right
  9: (r) => ({
    advance: 0.55,
    sdf: union(
      ring(0.22, r * 2, [0, 0.7]),
      segment([0.22, 0.7], [0.22, 0.3], r),
      arcSpan(0, 0.3, 0.32, -Math.PI / 2, 0, r * 2),
    ),
  }),
};

// ---- KPI symbol glyphs ------------------------------------------------------

const SYMBOL_BUILDERS = {
  // % — two small rings + diagonal slash
  '%': (r) => ({
    advance: 0.7,
    sdf: union(
      ring(0.13, r * 1.5, [-0.18, 0.78]),
      ring(0.13, r * 1.5, [0.18, 0.22]),
      segment([-0.3, 0.05], [0.3, 0.95], r),
    ),
  }),
  // . — small circle on baseline
  '.': (r) => ({
    advance: 0.25,
    sdf: circle(r * 1.6, [0, r * 1.6]),
  }),
  // - — single horizontal midline stroke
  '-': (r) => ({
    advance: 0.45,
    sdf: segment([-0.18, 0.5], [0.18, 0.5], r),
  }),
  // + — plus sign at midline
  '+': (r) => ({
    advance: 0.55,
    sdf: union(segment([-0.2, 0.5], [0.2, 0.5], r), segment([0, 0.3], [0, 0.7], r)),
  }),
  // $ — central vertical bar (extends past cap height) + S-shape from two arcs
  $: (r) => ({
    advance: 0.55,
    sdf: union(
      segment([0, 1.1], [0, -0.1], r),
      arcSpan(0, 0.75, 0.22, -Math.PI / 2, Math.PI, r * 2),
      arcSpan(0, 0.25, 0.22, Math.PI / 2, 2 * Math.PI, r * 2),
    ),
  }),
  // ' ' space — no SDF, just advance
  ' ': (_r) => ({ advance: 0.35, sdf: null }),
};

// ---- Uppercase letter glyphs (Wave 2+) --------------------------------------

const LETTER_BUILDERS = {
  // Wave 2 Batch 1: straight-vertical letters (I L T E F H)
  I: (r) => ({
    advance: 0.25,
    sdf: segment([0, 0], [0, 1.0], r),
  }),
  L: (r) => ({
    advance: 0.5,
    sdf: union(segment([-0.2, 0], [-0.2, 1.0], r), segment([-0.2, 0], [0.2, 0], r)),
  }),
  T: (r) => ({
    advance: 0.55,
    sdf: union(segment([0, 0], [0, 1.0], r), segment([-0.25, 1.0], [0.25, 1.0], r)),
  }),
  E: (r) => ({
    advance: 0.5,
    sdf: union(
      segment([-0.2, 0], [-0.2, 1.0], r),
      segment([-0.2, 1.0], [0.2, 1.0], r),
      segment([-0.2, 0.5], [0.15, 0.5], r),
      segment([-0.2, 0], [0.2, 0], r),
    ),
  }),
  F: (r) => ({
    advance: 0.5,
    sdf: union(
      segment([-0.2, 0], [-0.2, 1.0], r),
      segment([-0.2, 1.0], [0.2, 1.0], r),
      segment([-0.2, 0.5], [0.15, 0.5], r),
    ),
  }),
  H: (r) => ({
    advance: 0.55,
    sdf: union(
      segment([-0.2, 0], [-0.2, 1.0], r),
      segment([0.2, 0], [0.2, 1.0], r),
      segment([-0.2, 0.5], [0.2, 0.5], r),
    ),
  }),
  // ---- Wave 2 Batch 2: open-arc letters (C G O Q) -------------------------
  O: (r) => ({
    advance: 0.65,
    sdf: ring(0.28, r * 2, [0, 0.5]),
  }),
  C: (r) => ({
    advance: 0.6,
    sdf: arcSpan(0, 0.5, 0.28, Math.PI / 2 + Math.PI / 8, (3 * Math.PI) / 2 - Math.PI / 8, r * 2),
  }),
  G: (r) => ({
    advance: 0.6,
    sdf: union(
      arcSpan(0, 0.5, 0.28, Math.PI / 2 + Math.PI / 8, (3 * Math.PI) / 2 - Math.PI / 8, r * 2),
      segment([0.28, 0.5], [0.05, 0.5], r),
    ),
  }),
  Q: (r) => ({
    advance: 0.7,
    sdf: union(ring(0.28, r * 2, [0, 0.5]), segment([0.15, 0.05], [0.32, -0.08], r)),
  }),
  // ---- Wave 2 Batch 3: diagonal-stroke letters (A K V W X Y Z) ----
  A: (r) => ({
    advance: 0.6,
    sdf: union(
      segment([-0.25, 0], [0, 1.0], r),
      segment([0.25, 0], [0, 1.0], r),
      segment([-0.15, 0.45], [0.15, 0.45], r),
    ),
  }),
  K: (r) => ({
    advance: 0.55,
    sdf: union(
      segment([-0.2, 0], [-0.2, 1.0], r),
      segment([-0.2, 0.5], [0.2, 1.0], r),
      segment([-0.2, 0.5], [0.2, 0], r),
    ),
  }),
  V: (r) => ({
    advance: 0.6,
    sdf: union(segment([-0.25, 1.0], [0, 0], r), segment([0.25, 1.0], [0, 0], r)),
  }),
  W: (r) => ({
    advance: 0.9,
    sdf: union(
      segment([-0.4, 1.0], [-0.2, 0], r),
      segment([-0.2, 0], [0, 0.6], r),
      segment([0, 0.6], [0.2, 0], r),
      segment([0.2, 0], [0.4, 1.0], r),
    ),
  }),
  X: (r) => ({
    advance: 0.6,
    sdf: union(segment([-0.25, 1.0], [0.25, 0], r), segment([0.25, 1.0], [-0.25, 0], r)),
  }),
  Y: (r) => ({
    advance: 0.6,
    sdf: union(
      segment([-0.25, 1.0], [0, 0.5], r),
      segment([0.25, 1.0], [0, 0.5], r),
      segment([0, 0.5], [0, 0], r),
    ),
  }),
  Z: (r) => ({
    advance: 0.55,
    sdf: union(
      segment([-0.22, 1.0], [0.22, 1.0], r),
      segment([0.22, 1.0], [-0.22, 0], r),
      segment([-0.22, 0], [0.22, 0], r),
    ),
  }),
};

// ---- Public API -------------------------------------------------------------

export const GLYPH_BUILDERS = {
  ...DIGIT_BUILDERS,
  ...SYMBOL_BUILDERS,
  ...LETTER_BUILDERS,
};

/** Build a single glyph's 2D SDF in unit cap-height space. Returns { sdf, advance } or null if char unknown. */
export function buildGlyph(char, strokeRadius = 0.06) {
  const builder = GLYPH_BUILDERS[char];
  if (!builder) return null;
  return builder(strokeRadius);
}

/** List of characters this font currently supports. Wave 1 = digits + KPI symbols. */
export function supportedChars() {
  return Object.keys(GLYPH_BUILDERS);
}
