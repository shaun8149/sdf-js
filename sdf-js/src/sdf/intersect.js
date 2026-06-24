// =============================================================================
// intersect.js — analytic ray intersectors + sphere math (IQ articles). Wave 7.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   ray-surface intersectors  https://iquilezles.org/articles/intersectors/
//   sphere density            https://iquilezles.org/articles/spheredensity/
//   inverse bilinear          https://iquilezles.org/articles/ibilinear/
//
// Closed-form ray/geometry intersections (faster + exact vs sphere-tracing for
// these shapes) + soft volumetric sphere density + quad UV recovery.
// JS (CPU/testable) + GLSL mirror (INTERSECT_GLSL). License: PolyForm Noncommercial.
// =============================================================================

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];

/** Ray-sphere: nearest hit distance, or −1 on miss (or behind the origin). */
export function iSphere(ro, rd, center, r) {
  const oc = sub3(ro, center);
  const b = dot3(oc, rd);
  const c = dot3(oc, oc) - r * r;
  const h = b * b - c;
  if (h < 0) return -1;
  return -b - Math.sqrt(h);
}

/** Ray-box (AABB, slab method): [tNear, tFar] or null on miss. */
export function iBox(ro, rd, center, halfsize) {
  let tN = -Infinity,
    tF = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(rd[i]) < 1e-12) {
      // Ray parallel to this slab: miss unless the origin is between the planes.
      if (ro[i] < center[i] - halfsize[i] || ro[i] > center[i] + halfsize[i]) return null;
      continue;
    }
    const m = 1 / rd[i];
    const n = m * (ro[i] - center[i]);
    const k = Math.abs(m) * halfsize[i];
    const t1 = -n - k,
      t2 = -n + k;
    tN = Math.max(tN, Math.min(t1, t2));
    tF = Math.min(tF, Math.max(t1, t2));
  }
  if (tN > tF || tF < 0) return null;
  return [tN, tF];
}

/** Ray-plane: t for plane dot(p,normal)+d = 0, or −1 if parallel/behind. */
export function iPlane(ro, rd, normal, d) {
  const denom = dot3(rd, normal);
  if (Math.abs(denom) < 1e-12) return -1;
  return -(dot3(ro, normal) + d) / denom;
}

/** Ray-triangle (Möller–Trumbore): hit distance t, or −1 on miss. */
export function iTriangle(ro, rd, v0, v1, v2) {
  const e1 = sub3(v1, v0),
    e2 = sub3(v2, v0);
  const pv = cross3(rd, e2);
  const det = dot3(e1, pv);
  if (Math.abs(det) < 1e-12) return -1;
  const inv = 1 / det;
  const tv = sub3(ro, v0);
  const u = dot3(tv, pv) * inv;
  if (u < 0 || u > 1) return -1;
  const qv = cross3(tv, e1);
  const v = dot3(rd, qv) * inv;
  if (v < 0 || u + v > 1) return -1;
  return dot3(e2, qv) * inv;
}

/** Soft volumetric density integrated through a sphere along a ray, ∈ [0,1]. */
export function sphereDensity(ro, rd, center, r, dbuffer) {
  const nd = dbuffer / r;
  const rc = [(ro[0] - center[0]) / r, (ro[1] - center[1]) / r, (ro[2] - center[2]) / r];
  const b = dot3(rd, rc);
  const c = dot3(rc, rc) - 1;
  let h = b * b - c;
  if (h < 0) return 0;
  h = Math.sqrt(h);
  let t1 = -b - h;
  let t2 = -b + h;
  if (t2 < 0 || t1 > nd) return 0;
  t1 = Math.max(t1, 0);
  t2 = Math.min(t2, nd);
  const i1 = -(c * t1 + b * t1 * t1 + (t1 * t1 * t1) / 3);
  const i2 = -(c * t2 + b * t2 * t2 + (t2 * t2 * t2) / 3);
  return (i2 - i1) * (3 / 4);
}

/** Inverse bilinear: recover (u,v) of point p inside quad a,b,c,d (CCW), or
 *  [-1,-1] if outside. Inverse of p = a + (b−a)u + (d−a)v + (a−b+c−d)uv. */
export function invBilinear(p, a, b, c, d) {
  const e = sub2(b, a),
    f = sub2(d, a),
    g = sub2(sub2(a, b), sub2(d, c)),
    h = sub2(p, a);
  const k2 = cross2(g, f);
  const k1 = cross2(e, f) + cross2(h, g);
  const k0 = cross2(h, e);
  // Near-parallel edges → degenerate to linear.
  if (Math.abs(k2) < 1e-9) {
    const v = -k0 / k1;
    const u = (h[0] - f[0] * v) / (e[0] + g[0] * v);
    return [u, v];
  }
  let w = k1 * k1 - 4 * k0 * k2;
  if (w < 0) return [-1, -1];
  w = Math.sqrt(w);
  const cand = [(-k1 - w) / (2 * k2), (-k1 + w) / (2 * k2)];
  let res = [-1, -1];
  for (const v of cand) {
    const u = (h[0] - f[0] * v) / (e[0] + g[0] * v);
    if (v > -1e-4 && v < 1 + 1e-4 && u > -1e-4 && u < 1 + 1e-4) res = [u, v];
  }
  return res;
}

// -----------------------------------------------------------------------------
// GLSL mirror.
// -----------------------------------------------------------------------------
export const INTERSECT_GLSL = /* glsl */ `
float iSphere(vec3 ro, vec3 rd, vec3 ce, float r){
  vec3 oc = ro - ce;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - r*r;
  float h = b*b - c;
  if (h < 0.0) return -1.0;
  return -b - sqrt(h);
}
bool iBoxSlab(float ro, float rd, float ce, float rad, inout float tN, inout float tF){
  if (abs(rd) < 1e-12){
    return ro >= ce - rad && ro <= ce + rad;
  }
  float m = 1.0/rd;
  float n = m*(ro - ce);
  float k = abs(m)*rad;
  float t1 = -n - k;
  float t2 = -n + k;
  tN = max(tN, min(t1, t2));
  tF = min(tF, max(t1, t2));
  return true;
}
vec2 iBox(vec3 ro, vec3 rd, vec3 ce, vec3 rad){
  float tN = -1e20;
  float tF = 1e20;
  if (!iBoxSlab(ro.x, rd.x, ce.x, rad.x, tN, tF)) return vec2(-1.0);
  if (!iBoxSlab(ro.y, rd.y, ce.y, rad.y, tN, tF)) return vec2(-1.0);
  if (!iBoxSlab(ro.z, rd.z, ce.z, rad.z, tN, tF)) return vec2(-1.0);
  if (tN > tF || tF < 0.0) return vec2(-1.0);
  return vec2(tN, tF);
}
float iPlane(vec3 ro, vec3 rd, vec3 nor, float d){
  float denom = dot(rd, nor);
  if (abs(denom) < 1e-12) return -1.0;
  return -(dot(ro, nor) + d)/denom;
}
float iTriangle(vec3 ro, vec3 rd, vec3 v0, vec3 v1, vec3 v2){
  vec3 e1 = v1-v0, e2 = v2-v0;
  vec3 pv = cross(rd, e2);
  float det = dot(e1, pv);
  if (abs(det) < 1e-12) return -1.0;
  float inv = 1.0/det;
  vec3 tv = ro - v0;
  float u = dot(tv, pv)*inv;
  if (u < 0.0 || u > 1.0) return -1.0;
  vec3 qv = cross(tv, e1);
  float v = dot(rd, qv)*inv;
  if (v < 0.0 || u+v > 1.0) return -1.0;
  return dot(e2, qv)*inv;
}
float sphereDensity(vec3 ro, vec3 rd, vec3 ce, float r, float dbuffer){
  float nd = dbuffer/r;
  vec3 rc = (ro - ce)/r;
  float b = dot(rd, rc);
  float c = dot(rc, rc) - 1.0;
  float h = b*b - c;
  if (h < 0.0) return 0.0;
  h = sqrt(h);
  float t1 = -b - h, t2 = -b + h;
  if (t2 < 0.0 || t1 > nd) return 0.0;
  t1 = max(t1, 0.0); t2 = min(t2, nd);
  float i1 = -(c*t1 + b*t1*t1 + t1*t1*t1/3.0);
  float i2 = -(c*t2 + b*t2*t2 + t2*t2*t2/3.0);
  return (i2-i1)*(3.0/4.0);
}
float cross2_(vec2 a, vec2 b){ return a.x*b.y - a.y*b.x; }
vec2 invBilinear(vec2 p, vec2 a, vec2 b, vec2 c, vec2 d){
  vec2 e = b-a, f = d-a, g = (a-b)-(d-c), h = p-a;
  float k2 = cross2_(g, f);
  float k1 = cross2_(e, f) + cross2_(h, g);
  float k0 = cross2_(h, e);
  if (abs(k2) < 1e-9){
    float v = -k0/k1;
    float u = (h.x - f.x*v)/(e.x + g.x*v);
    return vec2(u, v);
  }
  float w = k1*k1 - 4.0*k0*k2;
  if (w < 0.0) return vec2(-1.0);
  w = sqrt(w);
  vec2 res = vec2(-1.0);
  float v1 = (-k1 - w)/(2.0*k2);
  float u1 = (h.x - f.x*v1)/(e.x + g.x*v1);
  if (v1 > -1e-4 && v1 < 1.0001 && u1 > -1e-4 && u1 < 1.0001) res = vec2(u1, v1);
  float v2 = (-k1 + w)/(2.0*k2);
  float u2 = (h.x - f.x*v2)/(e.x + g.x*v2);
  if (v2 > -1e-4 && v2 < 1.0001 && u2 > -1e-4 && u2 < 1.0001) res = vec2(u2, v2);
  return res;
}
`;
