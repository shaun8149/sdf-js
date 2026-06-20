// =============================================================================
// mathx.js — math / rotation toolkit (IQ "useful maths" articles). Wave 10.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   quaternions          https://iquilezles.org/articles/quaternions/
//   Fourier series       https://iquilezles.org/articles/fourier/
//   distance to triangle https://iquilezles.org/articles/triangledistance/
//   triangle area        https://iquilezles.org/articles/trianglearea/
//   polygon normals/area https://iquilezles.org/articles/polygonnormals/
//   patched sphere (uv)  https://iquilezles.org/articles/patchedsphere/
//
// Quaternion convention: q = [x, y, z, w] (vector part first, scalar last).
// JS (CPU/testable) + GLSL mirror (MATHX_GLSL). License: PolyForm Noncommercial.
// =============================================================================

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---- Quaternions ------------------------------------------------------------

export function qFromAxisAngle(axis, angle) {
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const s = Math.sin(angle / 2);
  return [(axis[0] / l) * s, (axis[1] / l) * s, (axis[2] / l) * s, Math.cos(angle / 2)];
}

export function qMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export const qConj = (q) => [-q[0], -q[1], -q[2], q[3]];

/** Rotate a 3-vector by quaternion q (q · v · q*). */
export function qRotate(q, v) {
  const r = qMul(qMul(q, [v[0], v[1], v[2], 0]), qConj(q));
  return [r[0], r[1], r[2]];
}

// ---- Fourier series ---------------------------------------------------------

/** Square wave (period 1, ±1) approximated by its Fourier series (odd harmonics). */
export function fourierSquare(x, terms) {
  let s = 0;
  for (let k = 1; k <= 2 * terms; k += 2) {
    s += Math.sin(2 * Math.PI * k * x) / k;
  }
  return (4 / Math.PI) * s;
}

// ---- Areas / normals --------------------------------------------------------

/** Area of triangle (a,b,c) in 3D. */
export function triangleArea(a, b, c) {
  const n = cross(sub(b, a), sub(c, a));
  return 0.5 * Math.hypot(n[0], n[1], n[2]);
}

/** Newell's method: area + unit normal of an arbitrary (planar-ish) polygon. */
export function polygonAreaNormal(verts) {
  let nx = 0,
    ny = 0,
    nz = 0;
  const m = verts.length;
  for (let i = 0; i < m; i++) {
    const c = verts[i],
      n = verts[(i + 1) % m];
    nx += (c[1] - n[1]) * (c[2] + n[2]);
    ny += (c[2] - n[2]) * (c[0] + n[0]);
    nz += (c[0] - n[0]) * (c[1] + n[1]);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  return { area: 0.5 * Math.hypot(nx, ny, nz), normal: [nx / len, ny / len, nz / len] };
}

// ---- Point-to-triangle distance (IQ udTriangle) -----------------------------

const dot2 = (v) => dot(v, v);

export function distToTriangle(p, a, b, c) {
  const ba = sub(b, a),
    pa = sub(p, a);
  const cb = sub(c, b),
    pb = sub(p, b);
  const ac = sub(a, c),
    pc = sub(p, c);
  const nor = cross(ba, ac);
  const sign =
    Math.sign(dot(cross(ba, nor), pa)) +
    Math.sign(dot(cross(cb, nor), pb)) +
    Math.sign(dot(cross(ac, nor), pc));
  let d;
  if (sign < 2) {
    const e = (edge, q) => {
      const t = clamp(dot(edge, q) / dot2(edge), 0, 1);
      return dot2([edge[0] * t - q[0], edge[1] * t - q[1], edge[2] * t - q[2]]);
    };
    d = Math.min(e(ba, pa), e(cb, pb), e(ac, pc));
  } else {
    d = (dot(nor, pa) * dot(nor, pa)) / dot2(nor);
  }
  return Math.sqrt(d);
}

// ---- Sphere UV (equirectangular patch mapping) ------------------------------

/** Map a direction to equirectangular sphere UV ∈ [0,1]². */
export function sphereUV(dir) {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const x = dir[0] / l,
    y = dir[1] / l,
    z = dir[2] / l;
  const u = 0.5 + Math.atan2(z, x) / (2 * Math.PI);
  const v = 0.5 - Math.asin(clamp(y, -1, 1)) / Math.PI;
  return [u, v];
}

// -----------------------------------------------------------------------------
// GLSL mirror. Quaternion = vec4 (xyz, w).
// -----------------------------------------------------------------------------
export const MATHX_GLSL = /* glsl */ `
vec4 qFromAxisAngle(vec3 axis, float angle){
  float s = sin(angle*0.5);
  return vec4(normalize(axis)*s, cos(angle*0.5));
}
vec4 qMul(vec4 a, vec4 b){
  return vec4(
    a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
    a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
    a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
    a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z);
}
vec4 qConj(vec4 q){ return vec4(-q.xyz, q.w); }
vec3 qRotate(vec4 q, vec3 v){
  vec4 r = qMul(qMul(q, vec4(v, 0.0)), qConj(q));
  return r.xyz;
}
float fourierSquare(float x, int terms){
  float s = 0.0;
  for (int i = 0; i < 512; i++){
    if (i >= terms) break;
    float k = float(2*i + 1);
    s += sin(2.0*3.14159265*k*x)/k;
  }
  return (4.0/3.14159265)*s;
}
float triangleArea(vec3 a, vec3 b, vec3 c){
  return 0.5*length(cross(b-a, c-a));
}
float dot2_(vec3 v){ return dot(v, v); }
float distToTriangle(vec3 p, vec3 a, vec3 b, vec3 c){
  vec3 ba = b-a, pa = p-a;
  vec3 cb = c-b, pb = p-b;
  vec3 ac = a-c, pc = p-c;
  vec3 nor = cross(ba, ac);
  float sgn = sign(dot(cross(ba,nor),pa)) + sign(dot(cross(cb,nor),pb)) + sign(dot(cross(ac,nor),pc));
  float d;
  if (sgn < 2.0){
    d = min(min(
      dot2_(ba*clamp(dot(ba,pa)/dot(ba,ba),0.0,1.0)-pa),
      dot2_(cb*clamp(dot(cb,pb)/dot(cb,cb),0.0,1.0)-pb)),
      dot2_(ac*clamp(dot(ac,pc)/dot(ac,ac),0.0,1.0)-pc));
  } else {
    d = dot(nor,pa)*dot(nor,pa)/dot(nor,nor);
  }
  return sqrt(d);
}
vec2 sphereUV(vec3 dir){
  vec3 d = normalize(dir);
  return vec2(0.5 + atan(d.z, d.x)/(2.0*3.14159265), 0.5 - asin(clamp(d.y,-1.0,1.0))/3.14159265);
}
`;
