// =============================================================================
// gaps.js — W13 gap-fill: the deferred ★★★ IQ items, as pure functions.
// -----------------------------------------------------------------------------
// Recipe-only ports / applications of Inigo Quilez:
//   2D bounding boxes      https://iquilezles.org/articles/diskbbox/
//   multi-resolution AO    https://iquilezles.org/articles/multiresaocc/
//   distance to implicits  https://iquilezles.org/articles/distance/
//   box occlusion          https://iquilezles.org/articles/boxocclusion/
//   simple global illum.   https://iquilezles.org/articles/simplegi/
//
// boxAO uses the box's bounding sphere with the (exact) W4 sphere occlusion — a
// fast approximation; the full face-integral box occlusion is overkill for the
// cube atoms. JS (CPU/testable) + GLSL mirror (GAPS_GLSL; boxAO calls sphereAO
// from LIGHTING_GLSL, co-included earlier). License: PolyForm Noncommercial.
// =============================================================================

import { sphereAO } from './lighting.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Grid-sampled 2D axis-aligned bounding box of an SDF (p=[x,y] → dist). */
export function bbox2FromSDF(sdfFn, opts = {}) {
  const R = opts.radius ?? 3;
  const res = opts.res ?? 48;
  const iso = opts.iso ?? 0;
  const step = (2 * R) / res;
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  let found = false;
  for (let i = 0; i <= res; i++) {
    const x = -R + i * step;
    for (let j = 0; j <= res; j++) {
      const y = -R + j * step;
      if (sdfFn([x, y]) <= iso) {
        found = true;
        if (x < min[0]) min[0] = x;
        if (x > max[0]) max[0] = x;
        if (y < min[1]) min[1] = y;
        if (y > max[1]) max[1] = y;
      }
    }
  }
  if (!found) return { min: [0, 0], max: [0, 0], center: [0, 0], size: [0, 0], empty: true };
  const h = step * 0.5;
  min[0] -= h;
  min[1] -= h;
  max[0] += h;
  max[1] += h;
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2];
  const size = [max[0] - min[0], max[1] - min[1]];
  return { min, max, center, size };
}

/** Multi-resolution SDF ambient occlusion: combine occlusion across spatial
 *  scales for a softer, less banded result than a single-radius tap set. */
export function multiresAO(sdfFn, p, n, opts = {}) {
  const scales = opts.scales ?? [0.04, 0.1, 0.25];
  let occ = 0,
    sca = 1,
    total = 0;
  for (const h of scales) {
    const d = sdfFn([p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h]);
    occ += (Math.max(0, h - d) / h) * sca;
    total += sca;
    sca *= 0.6;
  }
  return clamp01(1 - (1.5 * occ) / total);
}

/** Lipschitz distance estimate for an arbitrary implicit field: value / |∇f|.
 *  Lets a sphere-tracer safely march any LLM-generated field, not just true SDFs. */
export function approxDistImplicit(value, gradMag) {
  return value / Math.max(gradMag, 1e-6);
}

/** Box ambient occlusion (bounding-sphere approximation via exact sphere AO). */
export function boxAO(pos, nor, center, half) {
  const r = Math.hypot(half[0], half[1], half[2]);
  return sphereAO(pos, nor, center, r);
}

/** Simple hemispheric GI: ground-bounce ↔ sky-dome blend by normal.y, ×AO. */
export function simpleGI(nor, skyColor, groundColor, ao) {
  const t = 0.5 + 0.5 * nor[1];
  return [
    (groundColor[0] + (skyColor[0] - groundColor[0]) * t) * ao,
    (groundColor[1] + (skyColor[1] - groundColor[1]) * t) * ao,
    (groundColor[2] + (skyColor[2] - groundColor[2]) * t) * ao,
  ];
}

// -----------------------------------------------------------------------------
// GLSL mirror (boxAO uses sphereAO from LIGHTING_GLSL, co-included earlier).
// bbox2 / multiresAO take a callback → CPU-only.
// -----------------------------------------------------------------------------
export const GAPS_GLSL = /* glsl */ `
float approxDistImplicit(float value, float gradMag){
  return value / max(gradMag, 1e-6);
}
float boxAO(vec3 pos, vec3 nor, vec3 ce, vec3 half_){
  return sphereAO(pos, nor, vec4(ce, length(half_)));
}
vec3 simpleGI(vec3 nor, vec3 skyColor, vec3 groundColor, float ao){
  float t = 0.5 + 0.5*nor.y;
  return mix(groundColor, skyColor, t) * ao;
}
`;
