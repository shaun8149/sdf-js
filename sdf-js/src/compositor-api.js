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
import { createStudioRenderer } from './render/studio.js';
import { createFly3DRenderer } from './render/flyLambert.js';
import { silhouette } from './render/silhouette.js';

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

// Strip JS-style line (//) and block (/* */) comments from JSON-ish text
// without touching comment-like sequences that appear inside string values.
// LLMs sometimes use comments as section dividers — strict JSON.parse rejects
// them, but the actual scene data is fine, so we sanitise rather than fail.
function stripJsonComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let inString = false;
  while (i < n) {
    const ch = src[i];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < n) {
        out += src[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === '/' && i + 1 < n) {
      const next = src[i + 1];
      if (next === '/') {
        // line comment — skip to end of line
        i += 2;
        while (i < n && src[i] !== '\n') i++;
        continue;
      }
      if (next === '*') {
        // block comment — skip to closing */
        i += 2;
        while (i + 1 < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i += 2;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

// Trailing commas in arrays/objects are another common LLM JSON-isms. Strip
// only when followed by `]` or `}` (not inside strings — caller already
// handed us comment-stripped text, but strings still need protection).
function stripTrailingCommas(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let inString = false;
  while (i < n) {
    const ch = src[i];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < n) {
        out += src[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i++;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < n && /\s/.test(src[j])) j++;
      if (j < n && (src[j] === ']' || src[j] === '}')) {
        i++;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Parse raw LLM lift response text into SceneData object. LLM outputs are
 * NOT clean JSON — common patterns: markdown fences (```json ... ```),
 * trailing commas, single-line (//) comments, block (/* * /) comments.
 *
 * Without this stripper, strict JSON.parse() fails ~40% of the time on
 * Claude lift outputs. LOAD-BEARING — do not remove or "simplify".
 *
 * @param {string} text — raw LLM response text
 * @returns {object} parsed SceneData
 * @throws if no valid JSON found after stripping
 */
export function parseLiftResponse(text) {
  // LLM may wrap JSON in ```json ... ``` fence, or emit prose around it.
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  let jsonStr = fenceMatch ? fenceMatch[1] : text.trim();

  // If no fence, try to find the first { and matching } at end
  if (!fenceMatch && !jsonStr.startsWith('{')) {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
  }

  // Sanitise LLM JSON-isms (comments, trailing commas) before strict parse.
  const sanitised = stripTrailingCommas(stripJsonComments(jsonStr));

  try {
    return JSON.parse(sanitised);
  } catch (e) {
    throw new Error(
      `Failed to parse lift JSON: ${e.message}\n\nRaw LLM output (first 500 chars):\n${text.slice(0, 500)}`,
    );
  }
}

// Module-private cache for the lift system prompt. Fetched once per
// loadSystemPromptLift() call; subsequent callLiftLLM calls reuse it.
let CACHED_SYSTEM_PROMPT_LIFT = '';

/**
 * Fetch + cache the lift system prompt markdown file. Called automatically
 * by callLiftLLM if cache is empty.
 *
 * @param {string} fetchBase — absolute or relative URL of the prompt file
 *   (e.g., '/examples/compositor/system-prompt-lift-3d.md')
 * @returns {Promise<number>} byte length of loaded prompt
 */
export async function loadSystemPromptLift(fetchBase) {
  if (CACHED_SYSTEM_PROMPT_LIFT) return CACHED_SYSTEM_PROMPT_LIFT.length;
  const res = await fetch(fetchBase);
  if (!res.ok) throw new Error(`Failed to load lift prompt: ${res.status}`);
  CACHED_SYSTEM_PROMPT_LIFT = await res.text();
  return CACHED_SYSTEM_PROMPT_LIFT.length;
}

/**
 * Call Anthropic Messages API with the lift system prompt.
 *
 * @param {string} originalPrompt — user's original generation prompt
 * @param {string} code2d — 2D SDF JS code to lift
 * @param {string} apiKey — Anthropic API key (BYOK)
 * @param {object} [opts]
 * @param {string} [opts.model=DEFAULT_LIFT_MODEL]
 * @param {string} [opts.promptUrl='/examples/compositor/system-prompt-lift-3d.md']
 * @returns {Promise<{text:string, usage:object}>}
 */
export async function callLiftLLM(originalPrompt, code2d, apiKey, opts = {}) {
  if (!apiKey) throw new Error('Anthropic API key required');
  if (!CACHED_SYSTEM_PROMPT_LIFT) {
    const promptUrl = opts.promptUrl || '/examples/compositor/system-prompt-lift-3d.md';
    await loadSystemPromptLift(promptUrl);
  }
  if (!CACHED_SYSTEM_PROMPT_LIFT) throw new Error('Lift system prompt not loaded');

  const userMessage = `## Original user prompt\n\n${originalPrompt}\n\n## 2D SDF code\n\n\`\`\`js\n${code2d}\n\`\`\``;
  const model = opts.model || DEFAULT_LIFT_MODEL;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: CACHED_SYSTEM_PROMPT_LIFT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  return { text: data.content[0].text, usage: data.usage };
}

/**
 * Create a renderer instance for the given renderer id. Returns an object
 * with `.render(sdf)` and `.unmount()` methods. Caller owns lifecycle.
 *
 * Sprint 1 supports: 'studio', 'fly3d', 'silhouette'. Sprint 2+ will add
 * 'bob-gpu', 'blueprint', 'crayon', 'topo', 'bob', 'lines'.
 *
 * @param {string} rendererId
 * @param {HTMLCanvasElement} canvas
 * @param {object} [opts]
 * @param {Function} [opts.getControls] — for GPU renderers; receives renderer time + returns camera/light state
 * @param {Function} [opts.onFps] — for GPU renderers; called per frame with FPS
 * @returns {{render:Function, unmount:Function}}
 */
export function createRendererForId(rendererId, canvas, opts = {}) {
  if (rendererId === 'silhouette') {
    return {
      render(layers, renderOpts = {}) {
        const ctx = canvas.getContext('2d');
        silhouette(ctx, layers, renderOpts);
      },
      unmount() {
        // No-op for CPU silhouette
      },
    };
  }
  if (rendererId === 'studio') {
    return createStudioRenderer({
      canvas,
      getControls: opts.getControls || (() => ({})),
      onFps: opts.onFps || (() => {}),
    });
  }
  if (rendererId === 'fly3d') {
    return createFly3DRenderer({
      canvas,
      getControls: opts.getControls || (() => ({})),
      onFps: opts.onFps || (() => {}),
    });
  }
  throw new Error(`[compositor-api] unknown renderer id: ${rendererId}`);
}
