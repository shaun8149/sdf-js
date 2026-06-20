// =============================================================================
// extra.js — W11 cleanup: the deferred IQ items expressible as pure functions.
// -----------------------------------------------------------------------------
// Final wave of the IQ-shader program. Recipe-only ports of Inigo Quilez:
//   distance to ellipse     https://iquilezles.org/articles/ellipsedist/
//   directional derivative  https://iquilezles.org/articles/derivative/
//   Lyapunov exponent       https://iquilezles.org/articles/lyapunov/
//   (+ generic SDF AO; box hard shadow via the W7 box intersector)
//
// OUT OF SCOPE as pure functions (accumulation-buffer / depth-buffer renderer
// techniques — belong to a future fractal/AO renderer, not a math library):
// SSAO, Budhabrot, popcorn, bitmap orbit traps, IFS point clouds, full analytic
// box / multi-resolution AO.
//
// JS (CPU/testable) + GLSL mirror (EXTRA_GLSL). License: PolyForm Noncommercial.
// =============================================================================

import { iBox } from './intersect.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Exact signed distance from point (px,py) to an axis-aligned ellipse with
 *  semi-axes (ax,ay). IQ's robust closed form. Negative inside. */
export function distToEllipse(px, py, ax, ay) {
  let pxa = Math.abs(px),
    pya = Math.abs(py);
  let a = ax,
    b = ay;
  if (pxa > pya) {
    [pxa, pya] = [pya, pxa];
    [a, b] = [b, a];
  }
  const l = b * b - a * a;
  const m = (a * pxa) / l,
    m2 = m * m;
  const n = (b * pya) / l,
    n2 = n * n;
  const c = (m2 + n2 - 1) / 3,
    c3 = c * c * c;
  const q = c3 + m2 * n2 * 2;
  const d = c3 + m2 * n2;
  const g = m + m * n2;
  let co;
  if (d < 0) {
    const h = Math.acos(q / c3) / 3;
    const s = Math.cos(h);
    const t = Math.sin(h) * Math.sqrt(3);
    const rx = Math.sqrt(-c * (s + t + 2) + m2);
    const ry = Math.sqrt(-c * (s - t + 2) + m2);
    co = (ry + Math.sign(l) * rx + Math.abs(g) / (rx * ry) - m) / 2;
  } else {
    const h = 2 * m * n * Math.sqrt(d);
    const s = Math.sign(q + h) * Math.pow(Math.abs(q + h), 1 / 3);
    const u = Math.sign(q - h) * Math.pow(Math.abs(q - h), 1 / 3);
    const rx = -s - u - c * 4 + 2 * m2;
    const ry = (s - u) * Math.sqrt(3);
    const rm = Math.sqrt(rx * rx + ry * ry);
    co = (ry / Math.sqrt(rm - rx) + (2 * g) / rm - m) / 2;
  }
  const rX = a * co,
    rY = b * Math.sqrt(1 - co * co);
  return Math.hypot(rX - pxa, rY - pya) * Math.sign(pya - rY);
}

/** Directional derivative of an SDF field along a (unit) direction. */
export function directionalDerivative(sdfFn, p, dir, h = 1e-4) {
  const a = sdfFn([p[0] + dir[0] * h, p[1] + dir[1] * h, p[2] + dir[2] * h]);
  const b = sdfFn([p[0] - dir[0] * h, p[1] - dir[1] * h, p[2] - dir[2] * h]);
  return (a - b) / (2 * h);
}

/** Generic IQ 5-tap ambient occlusion for any SDF, sampled along the normal. */
export function sdfAO(sdfFn, p, n, opts = {}) {
  const steps = opts.steps ?? 5;
  const spread = opts.spread ?? 0.15;
  let occ = 0,
    sca = 1;
  for (let i = 0; i < steps; i++) {
    const h = 0.01 + (spread * i) / Math.max(steps - 1, 1);
    const d = sdfFn([p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h]);
    occ += (h - d) * sca;
    sca *= 0.95;
  }
  return clamp01(1 - 1.8 * occ);
}

/** Hard shadow: 0 if the ray hits the box within (eps, maxT], else 1. */
export function boxShadow(ro, rd, center, halfsize, maxT) {
  const h = iBox(ro, rd, center, halfsize);
  if (h && h[0] > 1e-3 && h[0] < maxT) return 0;
  return 1;
}

/** Lyapunov exponent of the logistic map xₙ₊₁ = r·xₙ(1−xₙ) at parameter r.
 *  Positive → chaotic, negative → stable (basis of Lyapunov fractals). */
export function lyapunovLogistic(r, n) {
  let x = 0.5;
  for (let i = 0; i < 100; i++) x = r * x * (1 - x); // burn-in
  let sum = 0;
  for (let i = 0; i < n; i++) {
    x = r * x * (1 - x);
    sum += Math.log(Math.abs(r * (1 - 2 * x)) + 1e-30);
  }
  return sum / n;
}

// -----------------------------------------------------------------------------
// GLSL mirror (boxShadow uses iBox from INTERSECT_GLSL, co-included earlier).
// -----------------------------------------------------------------------------
export const EXTRA_GLSL = /* glsl */ `
float distToEllipse(vec2 p, vec2 ab){
  p = abs(p);
  if (p.x > p.y){ p = p.yx; ab = ab.yx; }
  float l = ab.y*ab.y - ab.x*ab.x;
  float m = ab.x*p.x/l; float m2 = m*m;
  float n = ab.y*p.y/l; float n2 = n*n;
  float c = (m2+n2-1.0)/3.0; float c3 = c*c*c;
  float q = c3 + m2*n2*2.0;
  float d = c3 + m2*n2;
  float g = m + m*n2;
  float co;
  if (d < 0.0){
    float h = acos(q/c3)/3.0;
    float s = cos(h);
    float t = sin(h)*sqrt(3.0);
    float rx = sqrt(-c*(s + t + 2.0) + m2);
    float ry = sqrt(-c*(s - t + 2.0) + m2);
    co = (ry + sign(l)*rx + abs(g)/(rx*ry) - m)/2.0;
  } else {
    float h = 2.0*m*n*sqrt(d);
    float s = sign(q+h)*pow(abs(q+h), 1.0/3.0);
    float u = sign(q-h)*pow(abs(q-h), 1.0/3.0);
    float rx = -s - u - c*4.0 + 2.0*m2;
    float ry = (s - u)*sqrt(3.0);
    float rm = sqrt(rx*rx + ry*ry);
    co = (ry/sqrt(rm-rx) + 2.0*g/rm - m)/2.0;
  }
  vec2 r = ab*vec2(co, sqrt(1.0 - co*co));
  return length(r - p)*sign(p.y - r.y);
}
float boxShadow(vec3 ro, vec3 rd, vec3 ce, vec3 rad, float maxT){
  vec2 h = iBox(ro, rd, ce, rad);
  if (h.x > 1e-3 && h.x < maxT && h.x <= h.y) return 0.0;
  return 1.0;
}
`;
