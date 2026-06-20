// =============================================================================
// filter.js — filtering / texturing toolkit (IQ texturing & filtering articles).
// -----------------------------------------------------------------------------
// Wave 3 of the IQ-shader program. Recipe-only ports of Inigo Quilez:
//   filterable / band-limited procedurals, (improved) analytic checker filtering,
//   ray differentials, texture repetition (no-tile), biplanar mapping, improved
//   bilinear / hardware interpolation, premultiplied alpha, gamma-correct blur.
//
// Every band-limited pattern is an analytic box-filter: integrate the periodic
// signal, sample the integral at the two footprint edges, divide by the width.
// As w → 0 it reduces to the hard pattern; as w → ∞ it converges to the mean.
//
// JS (CPU/testable) + a GLSL mirror string (FILTER_GLSL). License: PolyForm
// Noncommercial 1.0.0 (Atlas reimplementation).
// =============================================================================

const fract = (x) => x - Math.floor(x);

/** Analytic pixel footprint on a surface (ray differentials, no fwidth needed).
 *  Grows with hit distance and with grazing angle (1/|rdY|), shrinks with res. */
export function filterWidth(dist, resY, rdY, focal = 1.5) {
  return (dist * (2.0 / Math.max(resY, 1))) / focal / Math.max(Math.abs(rdY), 0.12);
}

// ---- Triangle wave + band-limited triangle ----------------------------------

/** Periodic triangle wave, range [0,1], period 1: tri(0)=1, tri(0.5)=0. */
export const triWave = (x) => Math.abs(2 * fract(x) - 1);

// Integral of triWave from 0 to x (per-period area = 0.5).
function intTri(x) {
  const fl = Math.floor(x);
  const t = x - fl;
  const f = t <= 0.5 ? t - t * t : t * t - t + 0.5;
  return fl * 0.5 + f;
}

/** Band-limited triangle wave over footprint w (box filter). */
export function triWaveFiltered(x, w) {
  if (w < 1e-6) return triWave(x);
  return (intTri(x + 0.5 * w) - intTri(x - 0.5 * w)) / w;
}

// ---- Analytic filtered checkerboard (IQ improved) ---------------------------

/** Box-filtered XOR checkerboard. Period 2 in (x,y); returns 0..1, 0.5 at distance. */
export function checkersFiltered(x, y, wx, wy) {
  wx = Math.max(wx, 1e-5);
  wy = Math.max(wy, 1e-5);
  const ix =
    (2 *
      (Math.abs(fract((x - 0.5 * wx) * 0.5) - 0.5) - Math.abs(fract((x + 0.5 * wx) * 0.5) - 0.5))) /
    wx;
  const iy =
    (2 *
      (Math.abs(fract((y - 0.5 * wy) * 0.5) - 0.5) - Math.abs(fract((y + 0.5 * wy) * 0.5) - 0.5))) /
    wy;
  return 0.5 - 0.5 * ix * iy;
}

// ---- Filtered grid + stripes ------------------------------------------------

const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
// Distance from x to the nearest integer, in [0,0.5].
const distToInt = (x) => 0.5 - Math.abs(fract(x) - 0.5);

/** Anti-aliased grid lines (1 on a line of half-width lw, 0 between), footprint w. */
export function gridFiltered(x, y, lw, wx, wy) {
  const lineX = 1 - smoothstep(lw, lw + Math.max(wx, 1e-4), distToInt(x));
  const lineY = 1 - smoothstep(lw, lw + Math.max(wy, 1e-4), distToInt(y));
  return Math.max(lineX, lineY);
}

// Integral of the 0/1 square wave (=1 for fract(x) ≥ 0.5) from 0 to x.
function sqInt(x) {
  const fl = Math.floor(x);
  return fl * 0.5 + Math.max(0, x - fl - 0.5);
}

/** Band-limited 0/1 stripes over footprint w. */
export function stripesFiltered(x, w) {
  if (w < 1e-6) return fract(x) >= 0.5 ? 1 : 0;
  return (sqInt(x + 0.5 * w) - sqInt(x - 0.5 * w)) / w;
}

// ---- Texture repetition breaker (no-tile) -----------------------------------

function hashCell(x, y) {
  let h = fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
  return h;
}

/** IQ no-tile: blend per-cell offset samples of a procedural field to hide the
 *  obvious lattice periodicity. A constant field stays constant. */
export function noTile(x, y, fn) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const wx = fx * fx * (3 - 2 * fx);
  const wy = fy * fy * (3 - 2 * fy);
  const sample = (cx, cy) => {
    const h = hashCell(cx, cy);
    return fn(x + h * 0.41 + cx * 0.0, y + fract(h * 7.3) * 0.41);
  };
  const s00 = sample(ix, iy);
  const s10 = sample(ix + 1, iy);
  const s01 = sample(ix, iy + 1);
  const s11 = sample(ix + 1, iy + 1);
  const top = s00 + (s10 - s00) * wx;
  const bot = s01 + (s11 - s01) * wx;
  return top + (bot - top) * wy;
}

// ---- Biplanar mapping weights ----------------------------------------------

/** Biplanar projection weights: drop the smallest-normal axis, keep the two
 *  dominant planes. k sharpens the blend. Returns [wx, wy, wz] summing to 1. */
export function biplanarWeights(nx, ny, nz, k = 8) {
  const a = [Math.abs(nx), Math.abs(ny), Math.abs(nz)];
  let mi = 0;
  if (a[1] < a[mi]) mi = 1;
  if (a[2] < a[mi]) mi = 2;
  const w = [Math.pow(a[0], k), Math.pow(a[1], k), Math.pow(a[2], k)];
  w[mi] = 0;
  const s = w[0] + w[1] + w[2] || 1;
  return [w[0] / s, w[1] / s, w[2] / s];
}

// ---- Gamma (sRGB ↔ linear), for gamma-correct blending ----------------------

export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const linearToSrgb = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

// ---- Premultiplied-alpha "over" composite -----------------------------------

/** Straight-alpha "over" computed via premultiplied math. Returns [r,g,b,a]. */
export function premultOver(s, sa, d, da) {
  const a = sa + da * (1 - sa);
  if (a < 1e-9) return [0, 0, 0, 0];
  return [
    (s[0] * sa + d[0] * da * (1 - sa)) / a,
    (s[1] * sa + d[1] * da * (1 - sa)) / a,
    (s[2] * sa + d[2] * da * (1 - sa)) / a,
    a,
  ];
}

// ---- Improved bilinear / hardware interpolation -----------------------------

/** Smooth the fractional part of a texel coordinate (quintic) so bilinear taps
 *  read as higher-order. Texel-space in, texel-space out; identity at centers. */
export function improvedBilinearUV(u, v) {
  const q = (x) => {
    const i = Math.floor(x),
      f = x - i;
    return i + f * f * f * (f * (f * 6 - 15) + 10);
  };
  return [q(u), q(v)];
}

// -----------------------------------------------------------------------------
// GLSL mirror. (noTile needs a sampler callback → omitted here; use per-renderer.)
// -----------------------------------------------------------------------------
export const FILTER_GLSL = /* glsl */ `
float filterWidth(float dist, float resY, float rdY, float focal){
  return dist * (2.0/max(resY,1.0)) / focal / max(abs(rdY), 0.12);
}
float triWave(float x){ return abs(2.0*fract(x)-1.0); }
float intTri(float x){
  float fl = floor(x); float t = x - fl;
  float f = (t <= 0.5) ? (t - t*t) : (t*t - t + 0.5);
  return fl*0.5 + f;
}
float triWaveFiltered(float x, float w){
  if (w < 1e-6) return triWave(x);
  return (intTri(x + 0.5*w) - intTri(x - 0.5*w)) / w;
}
float checkersFiltered(vec2 p, vec2 w){
  w = max(w, vec2(1e-5));
  vec2 i = 2.0*(abs(fract((p-0.5*w)*0.5)-0.5) - abs(fract((p+0.5*w)*0.5)-0.5))/w;
  return 0.5 - 0.5*i.x*i.y;
}
float distToInt(float x){ return 0.5 - abs(fract(x)-0.5); }
float gridFiltered(vec2 p, float lw, vec2 w){
  float lx = 1.0 - smoothstep(lw, lw+max(w.x,1e-4), distToInt(p.x));
  float ly = 1.0 - smoothstep(lw, lw+max(w.y,1e-4), distToInt(p.y));
  return max(lx, ly);
}
float sqInt(float x){ float fl = floor(x); return fl*0.5 + max(0.0, x - fl - 0.5); }
float stripesFiltered(float x, float w){
  if (w < 1e-6) return (fract(x) >= 0.5) ? 1.0 : 0.0;
  return (sqInt(x + 0.5*w) - sqInt(x - 0.5*w)) / w;
}
vec3 biplanarWeights(vec3 n, float k){
  vec3 a = abs(n);
  vec3 w = pow(a, vec3(k));
  // drop the smallest axis (keep the two dominant planes)
  if (a.x <= a.y && a.x <= a.z) w.x = 0.0;
  else if (a.y <= a.x && a.y <= a.z) w.y = 0.0;
  else w.z = 0.0;
  float s = w.x + w.y + w.z;
  return w / max(s, 1e-6);
}
vec3 srgbToLinear(vec3 c){
  return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c){
  return mix(12.92*c, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
vec4 premultOver(vec3 s, float sa, vec3 d, float da){
  float a = sa + da*(1.0-sa);
  if (a < 1e-9) return vec4(0.0);
  vec3 rgb = (s*sa + d*da*(1.0-sa)) / a;
  return vec4(rgb, a);
}
vec2 improvedBilinearUV(vec2 uv){
  vec2 i = floor(uv), f = fract(uv);
  return i + f*f*f*(f*(f*6.0-15.0)+10.0);
}
`;
