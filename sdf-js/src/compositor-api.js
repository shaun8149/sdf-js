// =============================================================================
// compositor-api.js — Layer 1 public API extracted from examples/compositor/compositor.js
// -----------------------------------------------------------------------------
// Why this exists: compositor.js (3283 lines) bundles state machine + UI +
// pure-function APIs together. Layer 2 (examples/present/) and future
// consumers (MCP server, tests, automation) need the APIs without dragging
// in compositor's DOM logic.
//
// Per [[compositor-layered-for-presentation]] memory: Layer 2 applications
// MUST call Layer 1 via this module's public API surface. Never mutate
// compositor internal state directly.
//
// Exports (added incrementally in Phase 1 tasks 1.2-1.6):
//   - sphericalToCamState(cam) — spherical camera → Cartesian eye position
//   - compileScene(sceneData, opts) — compile + expandVariants + sdfUnion
//   - parseLiftResponse(text) — LLM JSON-isms stripper (markdown fence,
//     trailing comma, // comment, /* */ — load-bearing)
//   - loadSystemPromptLift(fetchBase) — fetch + cache lift system prompt
//   - callLiftLLM(originalPrompt, code2d, apiKey, opts) — Anthropic API call
//   - createRendererForId(rendererId, canvas, opts) — factory for studio
//     / fly3d / silhouette / etc renderer instances
//
// Spec: docs/superpowers/specs/2026-06-19-atlas-present-sprint-1-design.md
// =============================================================================

import { compile } from './scene/compile.js';
import { expandVariants } from './scene/generator-s.js';
import { union as sdfUnion } from './sdf/dn.js';

// Constants
export const DEFAULT_LIFT_MODEL = 'claude-sonnet-4-6';

/**
 * Convert spherical camera coords (target + yaw/pitch/distance) to Cartesian
 * eye position. Used by all 3D renderers when applying `scene.cameraStatic`.
 *
 * @param {{targetX:number, targetY:number, targetZ:number, yaw:number, pitch:number, distance:number}} cam
 * @returns {{position:[number,number,number], yaw:number, pitch:number}}
 */
export function sphericalToCamState(cam) {
  return {
    position: [
      cam.targetX - cam.distance * Math.sin(cam.yaw) * Math.cos(cam.pitch),
      cam.targetY + cam.distance * Math.sin(cam.pitch),
      cam.targetZ - cam.distance * Math.cos(cam.yaw) * Math.cos(cam.pitch),
    ],
    yaw: cam.yaw,
    pitch: cam.pitch,
  };
}

/**
 * Compile a SceneData v1 to a ready-to-render SDF tree.
 *
 * Wraps the 3-step pattern: expandVariants (Generator-S scatter) → compile()
 * → sdfUnion(sdf, groundSdf). Callers receive the unified SDF directly
 * instead of having to remember the union step.
 *
 * @param {object} sceneData — SceneData v1 (must have `v: 1`)
 * @param {object} opts
 * @param {number} [opts.sceneHash=1] — drives Generator-S variant PRNG
 * @returns {{sdf:object, subjects:Array, cameraStatic:object|null, lightStatic:object|null, groundSdf:object|null, bakedHeightmap:object|null}}
 */
export function compileScene(sceneData, opts = {}) {
  const sceneHash = opts.sceneHash ?? 1;
  const rng = mulberry32(sceneHash);
  const expanded = expandVariants(sceneData, rng);
  const compiled = compile(expanded);
  const unifiedSdf = compiled.groundSdf ? sdfUnion(compiled.sdf, compiled.groundSdf) : compiled.sdf;
  return {
    sdf: unifiedSdf,
    subjects: compiled.subjects,
    cameraStatic: compiled.cameraStatic ?? null,
    lightStatic: compiled.lightStatic ?? null,
    groundSdf: compiled.groundSdf ?? null,
    bakedHeightmap: compiled.bakedHeightmap ?? null,
  };
}

// Mulberry32 — minimal seeded PRNG. Matches the one used elsewhere in Atlas
// (see src/scene/components/shapes/cube-3d.js).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Exports populated by subsequent tasks.
