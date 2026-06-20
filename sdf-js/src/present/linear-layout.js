// =============================================================================
// linear-layout.js — Atlas Present Linear archetype layout (Sprint 1 v4)
// -----------------------------------------------------------------------------
// Pure functions for computing section regions in Linear archetype:
//   centerX = i * spacing
//   bbox derived from sceneData subjects (mode-agnostic)
//
// Used by info-graphic-render.js (2D Info Graphic mode) and Sprint 2+ by
// 3D Play mode. Regions are mode-agnostic — they describe spatial bounds,
// NOT cameras.
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-v4-design.md §5
// =============================================================================

export const DEFAULT_SPACING = 6;

// Functions added in Task 2.2-2.3.
