// =============================================================================
// effects.js — procedural "simple oldschool effects" toolkit (IQ). Wave 9.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   2D dynamic clouds   https://iquilezles.org/articles/dynclouds/
//   plane deformations  https://iquilezles.org/articles/deform/
//   feedback effect     https://iquilezles.org/articles/feedbackeffect/
//   Game of Life        https://iquilezles.org/articles/gameoflife/
//
// JS (CPU/testable) + GLSL mirror (EFFECTS_GLSL). The GLSL clouds2D calls
// valueNoiseD2 from the W2 noise library (co-included before this one).
// License: PolyForm Noncommercial 1.0.0 (Atlas reimplementation).
// =============================================================================

import { valueNoise2 } from './noise.js';

/** Animated 2D cloud density ∈ [0,1] (fbm of value noise, drifting with time). */
export function clouds2D(x, y, t) {
  let v = 0,
    amp = 0.5,
    freq = 1;
  let fx = x + t * 0.1;
  const fy = y;
  for (let i = 0; i < 5; i++) {
    v += amp * valueNoise2(fx * freq, fy * freq);
    amp *= 0.5;
    freq *= 2;
    fx += t * 0.02;
  }
  return Math.max(0, Math.min(1, v * 1.4 - 0.2));
}

/** Tunnel-style polar plane deformation → [angle/π, radial-depth]. */
export function planeDeformPolar(x, y) {
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x);
  return [a / Math.PI, 0.3 / (r + 1e-6)];
}

/** Radius-dependent twist deformation; k=0 is the identity, radius preserved. */
export function planeDeformTwist(x, y, k) {
  const r = Math.hypot(x, y);
  const a = Math.atan2(y, x) + k * r;
  return [r * Math.cos(a), r * Math.sin(a)];
}

/** Feedback / trail blend: decay 0 = current frame, 1 = previous frame. */
export function feedbackBlend(prev, cur, decay) {
  return cur + (prev - cur) * decay;
}

/** Conway's Game of Life rule for one cell (alive 0/1, live-neighbour count). */
export function lifeRule(alive, n) {
  if (alive) return n === 2 || n === 3 ? 1 : 0;
  return n === 3 ? 1 : 0;
}

/** One Game-of-Life generation over a flat w×h grid (toroidal wrap). */
export function lifeStep(grid, w, h) {
  const out = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (x + dx + w) % w;
          const ny = (y + dy + h) % h;
          n += grid[ny * w + nx];
        }
      }
      out[y * w + x] = lifeRule(grid[y * w + x], n);
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// GLSL mirror (clouds2D uses valueNoiseD2 from NOISE_GLSL, included earlier).
// -----------------------------------------------------------------------------
export const EFFECTS_GLSL = /* glsl */ `
float clouds2D(vec2 p, float t){
  float v = 0.0, amp = 0.5, freq = 1.0;
  vec2 q = vec2(p.x + t*0.1, p.y);
  for (int i = 0; i < 5; i++){
    v += amp * valueNoiseD2(q*freq).x;
    amp *= 0.5; freq *= 2.0; q.x += t*0.02;
  }
  return clamp(v*1.4 - 0.2, 0.0, 1.0);
}
vec2 planeDeformPolar(vec2 p){
  float r = length(p);
  float a = atan(p.y, p.x);
  return vec2(a/3.14159265, 0.3/(r + 1e-6));
}
vec2 planeDeformTwist(vec2 p, float k){
  float r = length(p);
  float a = atan(p.y, p.x) + k*r;
  return vec2(r*cos(a), r*sin(a));
}
vec3 feedbackBlend(vec3 prev, vec3 cur, float decay){
  return mix(cur, prev, decay);
}
float lifeRule(float alive, float n){
  if (alive > 0.5) return (n == 2.0 || n == 3.0) ? 1.0 : 0.0;
  return (n == 3.0) ? 1.0 : 0.0;
}
`;
