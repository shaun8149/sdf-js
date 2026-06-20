// =============================================================================
// fractal.js — fractal rendering toolkit (IQ fractal articles). Wave 8.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   continuous iteration count  https://iquilezles.org/articles/msetsmooth/
//   Mandelbulb DE               https://iquilezles.org/articles/mandelbulb/
//   3D (quaternion) Julia DE    https://iquilezles.org/articles/juliasets/
//   Menger sponge SDF           https://iquilezles.org/articles/menger/
//   orbit traps                 https://iquilezles.org/articles/orbittraps/
//   (+ Sierpinski IFS folding tetrahedron)
//
// Escape-time 2D fractals return a smooth iteration count; the 3D fractals are
// distance estimators (finite, positive outside). JS (CPU/testable) + GLSL
// mirror (FRACTAL_GLSL). License: PolyForm Noncommercial 1.0.0.
//
// Deferred to W11 (image-accumulation, not single-value pure fns): Budhabrot,
// popcorn, Lyapunov, IFS point-cloud, bitmap orbit traps.
// =============================================================================

const LOG2 = Math.log(2);

// ---- 2D escape-time (smooth/continuous iteration count) ---------------------

/** Mandelbrot smooth iteration count; maxIter if c is in the set. */
export function mandelbrot2(cx, cy, maxIter) {
  let zx = 0,
    zy = 0,
    i = 0;
  for (; i < maxIter; i++) {
    const x = zx * zx - zy * zy + cx;
    const y = 2 * zx * zy + cy;
    zx = x;
    zy = y;
    if (zx * zx + zy * zy > 256) break;
  }
  if (i >= maxIter) return maxIter;
  const l = Math.sqrt(zx * zx + zy * zy);
  return i + 1 - Math.log(Math.log(l)) / LOG2;
}

/** Julia smooth iteration count for fixed c; maxIter if z stays bounded. */
export function julia2(zx0, zy0, cx, cy, maxIter) {
  let zx = zx0,
    zy = zy0,
    i = 0;
  for (; i < maxIter; i++) {
    const x = zx * zx - zy * zy + cx;
    const y = 2 * zx * zy + cy;
    zx = x;
    zy = y;
    if (zx * zx + zy * zy > 256) break;
  }
  if (i >= maxIter) return maxIter;
  const l = Math.sqrt(zx * zx + zy * zy);
  return i + 1 - Math.log(Math.log(l)) / LOG2;
}

/** Mandelbrot orbit trap: min |z| over the orbit (point trap at the origin). */
export function mandelbrotTrap(cx, cy, maxIter) {
  let zx = 0,
    zy = 0,
    trap = 1e9;
  for (let i = 0; i < maxIter; i++) {
    const x = zx * zx - zy * zy + cx;
    const y = 2 * zx * zy + cy;
    zx = x;
    zy = y;
    const r = Math.sqrt(zx * zx + zy * zy);
    if (r < trap) trap = r;
    if (r > 256) break;
  }
  return trap;
}

// ---- 3D distance-estimator fractals -----------------------------------------

/** Mandelbulb distance estimator. */
export function mandelbulbDE(px, py, pz, power, maxIter) {
  let wx = px,
    wy = py,
    wz = pz;
  let m = wx * wx + wy * wy + wz * wz;
  if (m < 1e-12) return 0; // origin: deep interior, DE undefined
  let dz = 1.0;
  for (let i = 0; i < maxIter; i++) {
    const r = Math.sqrt(m);
    if (r < 1e-9 || m > 4) break;
    dz = power * Math.pow(r, power - 1) * dz + 1.0;
    const theta = power * Math.acos(Math.max(-1, Math.min(1, wz / r)));
    const phi = power * Math.atan2(wy, wx);
    const rp = Math.pow(r, power);
    const st = Math.sin(theta);
    wx = px + rp * st * Math.cos(phi);
    wy = py + rp * st * Math.sin(phi);
    wz = pz + rp * Math.cos(theta);
    m = wx * wx + wy * wy + wz * wz;
  }
  return (0.25 * Math.log(Math.max(m, 1e-12)) * Math.sqrt(m)) / dz;
}

/** Quaternion Julia distance estimator. c is a 4-vector [x,y,z,w]. */
export function juliaQuatDE(px, py, pz, c, maxIter) {
  let zx = px,
    zy = py,
    zz = pz,
    zw = 0;
  let m = zx * zx + zy * zy + zz * zz + zw * zw;
  let dz = 1.0;
  for (let i = 0; i < maxIter; i++) {
    if (m > 4) break;
    dz = 2.0 * Math.sqrt(m) * dz;
    const nx = zx * zx - zy * zy - zz * zz - zw * zw + c[0];
    const ny = 2 * zx * zy + c[1];
    const nz = 2 * zx * zz + c[2];
    const nw = 2 * zx * zw + c[3];
    zx = nx;
    zy = ny;
    zz = nz;
    zw = nw;
    m = zx * zx + zy * zy + zz * zz + zw * zw;
  }
  dz = Math.max(dz, 1e-12);
  return (0.25 * Math.log(Math.max(m, 1e-12)) * Math.sqrt(Math.max(m, 1e-12))) / dz;
}

// ---- IFS / folding SDF fractals ---------------------------------------------

function sdBoxUniform(px, py, pz, b) {
  const qx = Math.abs(px) - b,
    qy = Math.abs(py) - b,
    qz = Math.abs(pz) - b;
  const o = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  return o + Math.min(Math.max(qx, qy, qz), 0);
}
const mod2 = (x) => (((x % 2) + 2) % 2) - 1;

/** Menger sponge SDF (box minus a recursively repeated cross). */
export function mengerSDF(px, py, pz, iters) {
  let d = sdBoxUniform(px, py, pz, 1.0);
  let s = 1.0;
  for (let i = 0; i < iters; i++) {
    const ax = mod2(px * s),
      ay = mod2(py * s),
      az = mod2(pz * s);
    s *= 3.0;
    const rx = Math.abs(1 - 3 * Math.abs(ax)),
      ry = Math.abs(1 - 3 * Math.abs(ay)),
      rz = Math.abs(1 - 3 * Math.abs(az));
    const da = Math.max(rx, ry),
      db = Math.max(ry, rz),
      dc = Math.max(rz, rx);
    const cr = (Math.min(da, Math.min(db, dc)) - 1.0) / s;
    d = Math.max(d, cr);
  }
  return d;
}

/** Sierpinski tetrahedron SDF via IFS folding. */
export function sierpinskiSDF(px, py, pz, iters) {
  let x = px,
    y = py,
    z = pz;
  const scale = 2.0;
  const off = 1.0;
  for (let i = 0; i < iters; i++) {
    if (x + y < 0) {
      const t = x;
      x = -y;
      y = -t;
    }
    if (x + z < 0) {
      const t = x;
      x = -z;
      z = -t;
    }
    if (y + z < 0) {
      const t = y;
      y = -z;
      z = -t;
    }
    x = scale * x - off * (scale - 1);
    y = scale * y - off * (scale - 1);
    z = scale * z - off * (scale - 1);
  }
  return (Math.hypot(x, y, z) - 2.0) * Math.pow(scale, -iters);
}

// -----------------------------------------------------------------------------
// GLSL mirror (constant loop bounds + runtime break per GLSL ES 1.00).
// -----------------------------------------------------------------------------
export const FRACTAL_GLSL = /* glsl */ `
float mandelbrot2(vec2 c, int maxIter){
  vec2 z = vec2(0.0); int i = 0;
  int limit = maxIter;
  if (limit > 1024) limit = 1024;
  bool escaped = false;
  for (int k = 0; k < 1024; k++){
    if (k >= limit) break;
    z = vec2(z.x*z.x - z.y*z.y + c.x, 2.0*z.x*z.y + c.y);
    i = k;
    if (dot(z,z) > 256.0) { escaped = true; i = k; break; }
    i = k + 1;
  }
  if (!escaped) return float(maxIter);
  float l = length(z);
  return float(i) + 1.0 - log(log(l))/log(2.0);
}
float mandelbrotTrap(vec2 c, int maxIter){
  vec2 z = vec2(0.0); float trap = 1e9;
  for (int k = 0; k < 1024; k++){
    if (k >= maxIter) break;
    z = vec2(z.x*z.x - z.y*z.y + c.x, 2.0*z.x*z.y + c.y);
    float r = length(z);
    trap = min(trap, r);
    if (r > 256.0) break;
  }
  return trap;
}
float mandelbulbDE(vec3 p, float power, int maxIter){
  vec3 w = p;
  float m = dot(w,w);
  if (m < 1e-12) return 0.0;
  float dz = 1.0;
  for (int i = 0; i < 64; i++){
    if (i >= maxIter) break;
    float r = sqrt(m);
    if (r < 1e-9 || m > 4.0) break;
    dz = power*pow(r, power-1.0)*dz + 1.0;
    float theta = power*acos(clamp(w.z/r, -1.0, 1.0));
    float phi = power*atan(w.y, w.x);
    float rp = pow(r, power);
    w = p + rp*vec3(sin(theta)*cos(phi), sin(theta)*sin(phi), cos(theta));
    m = dot(w,w);
  }
  return 0.25*log(max(m,1e-12))*sqrt(m)/dz;
}
float juliaQuatDE(vec3 p, vec4 c, int maxIter){
  vec4 z = vec4(p, 0.0);
  float m = dot(z,z);
  float dz = 1.0;
  for (int i = 0; i < 64; i++){
    if (i >= maxIter) break;
    if (m > 4.0) break;
    dz = 2.0*sqrt(m)*dz;
    z = vec4(
      z.x*z.x - z.y*z.y - z.z*z.z - z.w*z.w + c.x,
      2.0*z.x*z.y + c.y,
      2.0*z.x*z.z + c.z,
      2.0*z.x*z.w + c.w);
    m = dot(z,z);
  }
  dz = max(dz, 1e-12);
  return 0.25*log(max(m,1e-12))*sqrt(max(m,1e-12))/dz;
}
float sdBoxUniform(vec3 p, float b){
  vec3 q = abs(p) - vec3(b);
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}
float mengerSDF(vec3 p, int iters){
  float d = sdBoxUniform(p, 1.0);
  float s = 1.0;
  for (int i = 0; i < 16; i++){
    if (i >= iters) break;
    vec3 a = mod(p*s, 2.0) - 1.0;
    s *= 3.0;
    vec3 r = abs(1.0 - 3.0*abs(a));
    float da = max(r.x, r.y);
    float db = max(r.y, r.z);
    float dc = max(r.z, r.x);
    float cr = (min(da, min(db, dc)) - 1.0)/s;
    d = max(d, cr);
  }
  return d;
}
float sierpinskiSDF(vec3 p, int iters){
  vec3 z = p;
  float scale = 2.0, off = 1.0;
  for (int i = 0; i < 32; i++){
    if (i >= iters) break;
    if (z.x + z.y < 0.0) z.xy = -z.yx;
    if (z.x + z.z < 0.0) z.xz = -z.zx;
    if (z.y + z.z < 0.0) z.yz = -z.zy;
    z = scale*z - off*(scale - 1.0);
  }
  return (length(z) - 2.0)*pow(scale, -float(iters));
}
`;
