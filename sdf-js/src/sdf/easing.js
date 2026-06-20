// =============================================================================
// easing.js — remapping / easing math toolkit (IQ "useful little functions").
// -----------------------------------------------------------------------------
// Wave 1 of the IQ-shader program. Recipe-only ports (reimplemented from the
// math, credited) of Inigo Quilez's small reusable functions:
//   - "useful little functions"   https://iquilezles.org/articles/functions/
//   - smoothstep / smootherstep    https://iquilezles.org/articles/smoothsteps/
//   - inverse smoothstep           https://iquilezles.org/articles/ismoothstep/
//   - smoothstep integral          https://iquilezles.org/articles/smoothstepintegral/
//   - sigmoid                      https://iquilezles.org/articles/sigmoid/
//
// Each function ships as a JS implementation (CPU / testable) AND inside the
// `EASING_GLSL` string (the shader-side mirror, prepended into a fragment
// shader like noise.glsl.js / voronoi.glsl.js). Names match across both.
//
// License: PolyForm Noncommercial 1.0.0 (Atlas reimplementation).
// =============================================================================

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Linear remap [a,b] → [c,d] (no clamping; extrapolates outside [a,b]). */
export const remap = (x, a, b, c, d) => c + ((x - a) * (d - c)) / (b - a);

/** Linear remap [a,b] → [c,d] clamped to the output range. */
export const remapClamp = (x, a, b, c, d) => c + clamp01((x - a) / (b - a)) * (d - c);

/** Cubic smoothstep on [0,1] (3t²−2t³). */
export const smoothstep01 = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Quintic smootherstep on [0,1] (zero 1st+2nd derivative at the ends). */
export const smootherstep = (x) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Inverse of smoothstep01: given y in [0,1], recover x. */
export const invSmoothstep = (y) => 0.5 - Math.sin(Math.asin(1 - 2 * clamp01(y)) / 3);

/** Definite integral of smoothstep from 0 to x (clamped pieces outside [0,1]). */
export const smoothstepInteg = (x) => {
  if (x <= 0) return 0;
  if (x >= 1) return x - 0.5;
  return x * x * x - 0.5 * x * x * x * x;
};

/** Parabola peaking at 1 over x∈[0,1]; k sharpens the peak. */
export const parabola = (x, k) => Math.pow(4 * x * (1 - x), k);

/** Power curve: 0 at x=0 and x=1, peak 1 at x=a/(a+b). */
export const pcurve = (x, a, b) => {
  const k = Math.pow(a + b, a + b) / (Math.pow(a, a) * Math.pow(b, b));
  return k * Math.pow(x, a) * Math.pow(1 - x, b);
};

/** Smooth pulse of half-width w centered at c (1 at center, 0 beyond w). */
export const cubicPulse = (c, w, x) => {
  let d = Math.abs(x - c);
  if (d > w) return 0;
  d /= w;
  return 1 - d * d * (3 - 2 * d);
};

/** Exponential impulse: rises then decays, peak 1 at x = 1/k. */
export const expImpulse = (x, k) => {
  const h = k * x;
  return h * Math.exp(1 - h);
};

/** Exponential step / falloff: 1 at x=0, decaying with k·xⁿ. */
export const expStep = (x, k, n) => Math.exp(-k * Math.pow(x, n));

/** Gain: contrast S-curve fixing 0, 0.5, 1; gain(x,1) is the identity. */
export const gain = (x, k) => {
  const a = 0.5 * Math.pow(2 * (x < 0.5 ? x : 1 - x), k);
  return x < 0.5 ? a : 1 - a;
};

/** Normalized sinc with frequency k; sinc(0,k)=1 (removable singularity). */
export const sinc = (x, k) => {
  if (x === 0) return 1;
  const a = Math.PI * k * x;
  return Math.sin(a) / a;
};

/** Logistic sigmoid 1/(1+e^−x); sigmoid(0)=0.5. */
export const sigmoid = (x) => 1 / (1 + Math.exp(-x));

/** Almost-identity: identity for x≥m, smoothly lifts small x up to a floor n. */
export const almostIdentity = (x, m, n) => {
  if (x > m) return x;
  const a = 2 * n - m;
  const b = 2 * m - 3 * n;
  const t = x / m;
  return (a * t + b) * t * t + n;
};

// -----------------------------------------------------------------------------
// GLSL mirror — prepend into a fragment shader. Function names match the JS API.
// (Not yet wired into a renderer; consumed starting in the W3 filtering wave,
// where it gets its first real GPU compile + browser verification.)
// -----------------------------------------------------------------------------
export const EASING_GLSL = /* glsl */ `
float clamp01(float x){ return clamp(x, 0.0, 1.0); }
float remap(float x, float a, float b, float c, float d){ return c + (x-a)*(d-c)/(b-a); }
float remapClamp(float x, float a, float b, float c, float d){ return c + clamp01((x-a)/(b-a))*(d-c); }
float smoothstep01(float x){ float t = clamp01(x); return t*t*(3.0-2.0*t); }
float smootherstep(float x){ float t = clamp01(x); return t*t*t*(t*(t*6.0-15.0)+10.0); }
float invSmoothstep(float y){ return 0.5 - sin(asin(1.0-2.0*clamp01(y))/3.0); }
float smoothstepInteg(float x){
  if (x <= 0.0) return 0.0;
  if (x >= 1.0) return x - 0.5;
  return x*x*x - 0.5*x*x*x*x;
}
float parabola(float x, float k){ return pow(4.0*x*(1.0-x), k); }
float pcurve(float x, float a, float b){
  float k = pow(a+b, a+b) / (pow(a,a)*pow(b,b));
  return k * pow(x,a) * pow(1.0-x, b);
}
float cubicPulse(float c, float w, float x){
  float d = abs(x-c);
  if (d > w) return 0.0;
  d /= w;
  return 1.0 - d*d*(3.0-2.0*d);
}
float expImpulse(float x, float k){ float h = k*x; return h*exp(1.0-h); }
float expStep(float x, float k, float n){ return exp(-k*pow(x,n)); }
float gain(float x, float k){
  float a = 0.5*pow(2.0*((x<0.5)?x:1.0-x), k);
  return (x<0.5) ? a : 1.0-a;
}
float sinc(float x, float k){
  if (x == 0.0) return 1.0;
  float a = 3.14159265359*k*x;
  return sin(a)/a;
}
float sigmoid(float x){ return 1.0/(1.0+exp(-x)); }
float almostIdentity(float x, float m, float n){
  if (x > m) return x;
  float a = 2.0*n - m;
  float b = 2.0*m - 3.0*n;
  float t = x/m;
  return (a*t+b)*t*t + n;
}
`;
