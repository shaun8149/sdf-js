// =============================================================================
// lighting.js — lighting toolkit (IQ lighting articles). Wave 4 of the IQ-shader
// program.
// -----------------------------------------------------------------------------
// Recipe-only ports of Inigo Quilez:
//   sphere occlusion (analytic AO)  https://iquilezles.org/articles/sphereao/
//   sphere soft shadow (analytic)   https://iquilezles.org/articles/sphereshadow/
//   outdoors lighting               https://iquilezles.org/articles/outdoorslighting/
//   better fog                      https://iquilezles.org/articles/fog/
//   (+ Schlick fresnel, hemisphere sky term)
//
// The occlusion / shadow forms are closed-form (no scene sampling) → testable
// against physical expectation. JS (CPU/testable) + GLSL mirror (LIGHTING_GLSL).
// License: PolyForm Noncommercial 1.0.0 (Atlas reimplementation).
//
// Deferred to W11 (need screen-space depth or are mesh-only, not pure SDF math):
// SSAO, per-vertex AO, multi-resolution AO, analytic box occlusion.
// =============================================================================

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep01 = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ---- Sphere analytic ambient occlusion --------------------------------------

// IQ exact sphere occlusion ∈ [0,1] (1 = fully occluded over the hemisphere).
function sphOcclusion(pos, nor, sc, sr) {
  const dx = sc[0] - pos[0],
    dy = sc[1] - pos[1],
    dz = sc[2] - pos[2];
  const l = Math.hypot(dx, dy, dz);
  const nl = (nor[0] * dx + nor[1] * dy + nor[2] * dz) / l;
  const h = l / sr;
  const h2 = h * h;
  const k2 = 1 - h2 * nl * nl;
  let res = Math.max(0, nl) / h2;
  if (k2 > 0.001 && h2 > 1 && 1 - nl * nl > 1e-6) {
    res = nl * Math.acos(-nl * Math.sqrt((h2 - 1) / (1 - nl * nl))) - Math.sqrt(k2 * (h2 - 1));
    res = (res / h2 + Math.atan(Math.sqrt(k2 / (h2 - 1)))) / Math.PI;
  }
  return res;
}

/** Sphere ambient-occlusion factor ∈ [0,1]; 1 = unoccluded, lower = more shadow. */
export function sphereAO(pos, nor, sphereCenter, sphereRadius) {
  return 1 - clamp01(sphOcclusion(pos, nor, sphereCenter, sphereRadius));
}

// ---- Sphere analytic soft shadow --------------------------------------------

/** Soft shadow cast by a sphere along ray ro+t·rd ∈ [0,1]; 1 = lit, 0 = shadowed. */
export function sphereSoftShadow(ro, rd, sphereCenter, sphereRadius, k) {
  const ox = ro[0] - sphereCenter[0],
    oy = ro[1] - sphereCenter[1],
    oz = ro[2] - sphereCenter[2];
  const b = ox * rd[0] + oy * rd[1] + oz * rd[2];
  const c = ox * ox + oy * oy + oz * oz - sphereRadius * sphereRadius;
  const h = b * b - c;
  const d = Math.sqrt(Math.max(0, sphereRadius * sphereRadius - h)) - sphereRadius;
  const t = -b - Math.sqrt(Math.max(0, h));
  if (t < 0) return 1;
  return smoothstep01((2.5 * k * d) / t);
}

// ---- Fresnel + hemisphere ---------------------------------------------------

/** Schlick fresnel: F0 at normal incidence (cos=1) → 1 at grazing (cos=0). */
export const fresnelSchlick = (cosTheta, F0) => F0 + (1 - F0) * Math.pow(1 - clamp01(cosTheta), 5);

/** Hemisphere sky-dome factor: 0.5 + 0.5·n.y (1 facing up, 0 facing down). */
export const hemisphereLight = (ny) => 0.5 + 0.5 * ny;

// ---- Outdoors lighting model ------------------------------------------------

/** IQ outdoor 3-term model: sun key (×visibility) + sky dome (×AO) + ground
 *  bounce (×AO). Returns linear RGB. All ambient terms are AO-modulated so
 *  crevices darken (the thing flat single-light shading lacks). */
export function outdoorLighting(nor, sunDir, sunVis, ao, albedo, sunCol, skyCol, bounceCol) {
  const ndl = Math.max(0, dot3(nor, sunDir));
  const sky = 0.5 + 0.5 * nor[1];
  const bounce = clamp01(0.5 - 0.5 * nor[1]);
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    out[i] =
      albedo[i] * sunCol[i] * ndl * sunVis +
      albedo[i] * skyCol[i] * sky * ao +
      albedo[i] * bounceCol[i] * bounce * ao;
  }
  return out;
}

// ---- Better fog (distance extinction + sun in-scatter) ----------------------

/** IQ better fog: extinction by distance + warm in-scatter toward the sun. */
export function betterFog(col, dist, rd, sunDir, fogCol, sunFogCol, density) {
  const fogAmount = 1 - Math.exp(-dist * density);
  const sunAmount = Math.max(0, dot3(rd, sunDir));
  const k = Math.pow(sunAmount, 8);
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const fc = fogCol[i] + (sunFogCol[i] - fogCol[i]) * k;
    out[i] = col[i] + (fc - col[i]) * fogAmount;
  }
  return out;
}

// -----------------------------------------------------------------------------
// GLSL mirror.
// -----------------------------------------------------------------------------
export const LIGHTING_GLSL = /* glsl */ `
float sphOcclusion(vec3 pos, vec3 nor, vec4 sph){
  vec3 di = sph.xyz - pos;
  float l = length(di);
  float nl = dot(nor, di/l);
  float h = l/sph.w;
  float h2 = h*h;
  float k2 = 1.0 - h2*nl*nl;
  float res = max(0.0, nl)/h2;
  if (k2 > 0.001 && h2 > 1.0 && (1.0-nl*nl) > 1e-6){
    res = nl*acos(-nl*sqrt((h2-1.0)/(1.0-nl*nl))) - sqrt(k2*(h2-1.0));
    res = (res/h2 + atan(sqrt(k2/(h2-1.0))))/3.14159265;
  }
  return res;
}
float sphereAO(vec3 pos, vec3 nor, vec4 sph){
  return 1.0 - clamp(sphOcclusion(pos, nor, sph), 0.0, 1.0);
}
float sphereSoftShadow(vec3 ro, vec3 rd, vec4 sph, float k){
  vec3 oc = ro - sph.xyz;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - sph.w*sph.w;
  float h = b*b - c;
  float d = sqrt(max(0.0, sph.w*sph.w - h)) - sph.w;
  float t = -b - sqrt(max(0.0, h));
  if (t < 0.0) return 1.0;
  return smoothstep(0.0, 1.0, 2.5*k*d/t);
}
float fresnelSchlick(float cosTheta, float F0){
  return F0 + (1.0-F0)*pow(1.0 - clamp(cosTheta,0.0,1.0), 5.0);
}
float hemisphereLight(float ny){ return 0.5 + 0.5*ny; }
vec3 outdoorLighting(vec3 nor, vec3 sunDir, float sunVis, float ao, vec3 albedo,
                     vec3 sunCol, vec3 skyCol, vec3 bounceCol){
  float ndl = max(0.0, dot(nor, sunDir));
  float sky = 0.5 + 0.5*nor.y;
  float bounce = clamp(0.5 - 0.5*nor.y, 0.0, 1.0);
  return albedo*sunCol*ndl*sunVis + albedo*skyCol*sky*ao + albedo*bounceCol*bounce*ao;
}
vec3 betterFog(vec3 col, float dist, vec3 rd, vec3 sunDir, vec3 fogCol, vec3 sunFogCol, float density){
  float fogAmount = 1.0 - exp(-dist*density);
  float sunAmount = max(0.0, dot(rd, sunDir));
  vec3 fc = mix(fogCol, sunFogCol, pow(sunAmount, 8.0));
  return mix(col, fc, fogAmount);
}
`;
