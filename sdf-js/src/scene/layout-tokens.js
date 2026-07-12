// sdf-js/src/scene/layout-tokens.js — Layer B (排布系统), first cut.
//
// The debate verdict re-founded the spatial framework as a COMPOSITION system:
// the user's words "排布 / 对齐 / 对比" are layout-grid vocabulary, and their
// 3D implementation is a shared module system — spacing tokens, alignment
// operators, a monumental-vs-intimate scale contrast — not per-renderer magic
// numbers. This module is the first cut: it extracts render-magnitude's
// hardcoded coordinates (the `xOf(i)` the debate kept pointing at) into named
// tokens. Other renderers migrate as they are touched — extraction must be
// output-identical (the assemble-deck goldens gate it), so we do it renderer
// by renderer, never as a big bang.
//
// Vocabulary:
//   MODULE — the base dimensional tokens (one source for footprints/gaps/
//     plinths). Change `unit` here and every consuming renderer re-derives.
//   stride() — module + breathing: the atomic horizontal rhythm.
//   centeredRow / rowSpan — alignment operators for the row archetype
//     (items centered on the origin, span measured edge to edge).
//   SCALE — the contrast axis: monumental (towers over the camera) vs
//     intimate (hand-height). Deliberate breaks between these two registers
//     are how "对比" is made, per the composition thesis.

export const MODULE = {
  unit: 0.72, // base footprint module (a monolith's W)
  gap: 0.55, // inter-module breathing
  plinthPad: 0.34, // plinth overhang beyond the module footprint
  plinthH: 0.12, // plinth slab thickness — the pedestal datum step
};

export const SCALE = {
  monumental: 4.8, // the champion's ceiling — towers over the tracking camera
  intimate: 1.1, // hand-height register (tracking-shot eye level)
};

/** The atomic horizontal rhythm: one module + one breath. */
export const stride = () => MODULE.unit + MODULE.gap;

/** Center-aligned row position: item i of n, centered on the origin. */
export const centeredRow = (i, n, s = stride()) => (i - (n - 1) / 2) * s;

/** Edge-to-edge span of a centered row of n modules. */
export const rowSpan = (n, s = stride(), w = MODULE.unit) => (n - 1) * s + w;
