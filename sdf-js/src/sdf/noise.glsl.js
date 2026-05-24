// =============================================================================
// noise.glsl —— procedural noise / hash / fbm / worley library (GPU)
// -----------------------------------------------------------------------------
// Source: Dave Hoskins, "Hash without Sine" + related shadertoy posts
//   https://www.shadertoy.com/view/4djSRW   (hash family)
//   https://www.shadertoy.com/view/Xd23Dh   (value noise)
//   https://www.shadertoy.com/view/Xsl3Dl   (worley / cellular)
// License: MIT (Dave Hoskins, 2014). Compatible with Atlas PolyForm
// Noncommercial 1.0.0 (MIT permits relicensing for our purposes).
//
// Naming convention (Hoskins canonical):
//   hashNM  →  N-dim input, M-dim output
//   hash21  →  vec2 -> float
//   hash33  →  vec3 -> vec3
// (sdf-js's old internal hash12 in flyLambert was non-canonical;
//  renamed to hash21 to match this lib.)
//
// Usage: prepend NOISE_GLSL to shader source. sdf3.compile.js does this
// automatically when includeLibrary=true. Functions are pure (no uniforms,
// no time dependency) so safe to call from any shading context.
// =============================================================================

export const NOISE_GLSL = /* glsl */ `
// Sprint 4: subject motion offset (CarInt physics integration).
// Declared in the shared NOISE prelude so EVERY renderer (FLY 3D / BOB GPU /
// Blueprint) compiles cleanly even when the compiled sceneSDF references
// u_subjectOffset (compile.js injects these references for any subject listed
// in cameraSequence.subjectMotion). Renderer doesn't need to set the uniform
// (WebGL inits arrays to 0); FLY 3D updates it per frame from the evaluator.
uniform vec3 u_subjectOffset[4];

// ---- Hoskins hash family (Hash without Sine) ----
// All functions deterministic, period >2^24 in practice, no trig.

// 1 -> 1
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

// 1 -> 2
vec2 hash12(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// 1 -> 3
vec3 hash13(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

// 2 -> 1
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 2 -> 2
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// 3 -> 1
float hash31(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

// 3 -> 3
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

// ---- Value noise ----
// Cheap. Smooth blocky look. Good for organic surface variation.

float valueNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);  // smoothstep curve
  return mix(mix(mix(hash31(i + vec3(0.0, 0.0, 0.0)),
                     hash31(i + vec3(1.0, 0.0, 0.0)), u.x),
                 mix(hash31(i + vec3(0.0, 1.0, 0.0)),
                     hash31(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
             mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)),
                     hash31(i + vec3(1.0, 0.0, 1.0)), u.x),
                 mix(hash31(i + vec3(0.0, 1.0, 1.0)),
                     hash31(i + vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

// ---- Gradient noise (Perlin-style) ----
// More expensive than value noise but smoother and more isotropic.
// Returns approximately [-1, 1] range.

float gradientNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  vec3 g000 = hash33(i + vec3(0.0, 0.0, 0.0)) * 2.0 - 1.0;
  vec3 g100 = hash33(i + vec3(1.0, 0.0, 0.0)) * 2.0 - 1.0;
  vec3 g010 = hash33(i + vec3(0.0, 1.0, 0.0)) * 2.0 - 1.0;
  vec3 g110 = hash33(i + vec3(1.0, 1.0, 0.0)) * 2.0 - 1.0;
  vec3 g001 = hash33(i + vec3(0.0, 0.0, 1.0)) * 2.0 - 1.0;
  vec3 g101 = hash33(i + vec3(1.0, 0.0, 1.0)) * 2.0 - 1.0;
  vec3 g011 = hash33(i + vec3(0.0, 1.0, 1.0)) * 2.0 - 1.0;
  vec3 g111 = hash33(i + vec3(1.0, 1.0, 1.0)) * 2.0 - 1.0;
  float n000 = dot(g000, f - vec3(0.0, 0.0, 0.0));
  float n100 = dot(g100, f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(g010, f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(g110, f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(g001, f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(g101, f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(g011, f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(g111, f - vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
             mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}

// ---- FBM (fractional Brownian motion) ----
// 5-octave sum of valueNoise3 with gain 0.5, lacunarity 2.0.
// Output ~[0, 1] range. Use *2-1 to recenter on zero.

float fbm3(vec3 p) {
  float a = 0.5;
  float v = 0.0;
  for (int i = 0; i < 5; i++) {
    v += a * valueNoise3(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

// 3-octave cheaper variant for hot paths (per-fragment surface modulation).
float fbm3_lite(vec3 p) {
  float a = 0.5;
  float v = 0.0;
  for (int i = 0; i < 3; i++) {
    v += a * valueNoise3(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

// ---- Worley / cellular noise ----
// Distance to nearest hash point + distance to second-nearest. Useful for:
// cracked stone (use y.x = d1), cell partitioning (compare d1 vs d2), edge
// detection (d2 - d1 = distance to nearest cell boundary).
// 27-cell neighborhood (3^3) — expensive but accurate near boundaries.

vec2 worley3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 9.0;
  float d2 = 9.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = hash33(i + g);
        vec3 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
  }
  return vec2(sqrt(d1), sqrt(d2));
}
`;
