// =============================================================================
// sdg.js — signed distance functions that also return their gradient (IQ).
// -----------------------------------------------------------------------------
// Wave 5 of the IQ-shader program. Recipe-only ports of Inigo Quilez:
//   2D SDFs + gradients  https://iquilezles.org/articles/distgradfunctions2d/
//   3D SDFs + gradients  https://iquilezles.org/articles/distgradfunctions/
//
// Each sdg* returns [distance, ...gradient]. The gradient is the analytic
// surface normal / outline direction — exact, unit-length, and free of the
// finite-difference artifacts that 4–6-tap numerical normals carry. Useful for
// crisp 2D outlines/bevels and fast exact 3D normals.
//
// JS (CPU/testable) + GLSL mirror (SDG_GLSL). License: PolyForm Noncommercial.
// =============================================================================

const sgn = (x) => (x < 0 ? -1 : 1);

// ---- 2D (return [d, gx, gy]) ------------------------------------------------

export function sdgCircle(px, py, r) {
  const l = Math.hypot(px, py) || 1e-20;
  return [l - r, px / l, py / l];
}

export function sdgBox(px, py, bx, by) {
  const wx = Math.abs(px) - bx,
    wy = Math.abs(py) - by;
  const sx = sgn(px),
    sy = sgn(py);
  const g = Math.max(wx, wy);
  const qx = Math.max(wx, 0),
    qy = Math.max(wy, 0);
  const l = Math.hypot(qx, qy) || 1e-20;
  if (g > 0) return [l, (sx * qx) / l, (sy * qy) / l];
  return wx > wy ? [g, sx, 0] : [g, 0, sy];
}

export function sdgSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax,
    pay = py - ay;
  const bax = bx - ax,
    bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  const qx = pax - h * bax,
    qy = pay - h * bay;
  const d = Math.hypot(qx, qy) || 1e-20;
  return [d, qx / d, qy / d];
}

// ---- 3D (return [d, nx, ny, nz]) --------------------------------------------

export function sdgSphere(px, py, pz, r) {
  const l = Math.hypot(px, py, pz) || 1e-20;
  return [l - r, px / l, py / l, pz / l];
}

export function sdgBox3(px, py, pz, bx, by, bz) {
  const wx = Math.abs(px) - bx,
    wy = Math.abs(py) - by,
    wz = Math.abs(pz) - bz;
  const sx = sgn(px),
    sy = sgn(py),
    sz = sgn(pz);
  const g = Math.max(wx, wy, wz);
  if (g > 0) {
    const qx = Math.max(wx, 0),
      qy = Math.max(wy, 0),
      qz = Math.max(wz, 0);
    const l = Math.hypot(qx, qy, qz) || 1e-20;
    return [l, (sx * qx) / l, (sy * qy) / l, (sz * qz) / l];
  }
  // inside: gradient points along the nearest face (dominant axis)
  if (wx >= wy && wx >= wz) return [g, sx, 0, 0];
  if (wy >= wx && wy >= wz) return [g, 0, sy, 0];
  return [g, 0, 0, sz];
}

export function sdgTorus(px, py, pz, R, r) {
  const lxz = Math.hypot(px, pz) || 1e-20;
  const qx = lxz - R,
    qy = py;
  const k = Math.hypot(qx, qy) || 1e-20;
  return [k - r, (qx / k) * (px / lxz), qy / k, (qx / k) * (pz / lxz)];
}

// -----------------------------------------------------------------------------
// GLSL mirror.
// -----------------------------------------------------------------------------
export const SDG_GLSL = /* glsl */ `
vec3 sdgCircle(vec2 p, float r){
  float l = max(length(p), 1e-20);
  return vec3(l - r, p/l);
}
vec3 sdgBox(vec2 p, vec2 b){
  vec2 w = abs(p) - b;
  vec2 s = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0);
  float g = max(w.x, w.y);
  vec2 q = max(w, 0.0);
  float l = max(length(q), 1e-20);
  if (g > 0.0) return vec3(l, s*q/l);
  return (w.x > w.y) ? vec3(g, s.x, 0.0) : vec3(g, 0.0, s.y);
}
vec3 sdgSegment(vec2 p, vec2 a, vec2 b){
  vec2 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  vec2 q = pa - h*ba;
  float d = max(length(q), 1e-20);
  return vec3(d, q/d);
}
vec4 sdgSphere(vec3 p, float r){
  float l = max(length(p), 1e-20);
  return vec4(l - r, p/l);
}
vec4 sdgBox3(vec3 p, vec3 b){
  vec3 w = abs(p) - b;
  vec3 s = vec3(p.x<0.0?-1.0:1.0, p.y<0.0?-1.0:1.0, p.z<0.0?-1.0:1.0);
  float g = max(w.x, max(w.y, w.z));
  if (g > 0.0){
    vec3 q = max(w, 0.0);
    float l = max(length(q), 1e-20);
    return vec4(l, s*q/l);
  }
  if (w.x >= w.y && w.x >= w.z) return vec4(g, s.x, 0.0, 0.0);
  if (w.y >= w.x && w.y >= w.z) return vec4(g, 0.0, s.y, 0.0);
  return vec4(g, 0.0, 0.0, s.z);
}
vec4 sdgTorus(vec3 p, float R, float r){
  float lxz = max(length(p.xz), 1e-20);
  vec2 q = vec2(lxz - R, p.y);
  float k = max(length(q), 1e-20);
  return vec4(k - r, (q.x/k)*(p.x/lxz), q.y/k, (q.x/k)*(p.z/lxz));
}
`;
