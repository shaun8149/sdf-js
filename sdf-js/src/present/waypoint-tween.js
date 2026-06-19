// =============================================================================
// waypoint-tween.js — Atlas Present Canvas Mode camera tweening
// -----------------------------------------------------------------------------
// Pure functions + RAF loop for animating camera between waypoints (spherical
// coords: yaw, pitch, distance, targetX/Y/Z). Used by editor (preview-tween,
// 200ms) and present mode (cinematic-tween, 800ms).
//
// Layer 2 owns this loop. Does NOT touch compositor's gpuCameraLoop or
// scene.evalCamera — that's for cameraSequence-driven scenes only.
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-canvas-mode-design.md §4
// =============================================================================

// Exports added in subsequent tasks:
//   - interpolateCamera(from, to, t) — pure
//   - easeInOut(t) / easeLinear(t)   — pure
//   - tweenCamera(from, to, opts)    — starts RAF, returns { cancel }
