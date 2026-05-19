// =============================================================================
// flyLambert —— GPU shader Lambert + pointer-lock fly camera 渲染器
// -----------------------------------------------------------------------------
// 2026-05-17 MOVE from examples/mvp/fly3d-renderer.js → src/render/flyLambert.js
// MVP 切到 'fly3d' mode 时调用 render(sdf)；切走时 unmount()。examples/sdf 里
// 的独立 demo 页 shader-lambert-browser.js 用同样的 shader template + fly-controls。
// =============================================================================

import { compileSDF3ToGLSL, canCompileSDF3, IMIN_GLSL } from '../sdf/sdf3.compile.js';
import { attachFlyControls } from '../input/fly-controls.js';

const VS_SRC = `attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

function buildFragmentShader(sceneGlsl) {
  return `#ifdef GL_ES
precision highp float;
#endif

${sceneGlsl}

uniform vec2  u_resolution;
uniform vec3  u_camPos;
uniform vec3  u_camFwd;
uniform vec3  u_camRight;
uniform vec3  u_camUp;
uniform float u_focal;
uniform vec3  u_lightPos;
uniform float u_shadowsOn;
uniform float u_groundOn;
uniform float u_checkerOn;
uniform float u_reflectOn;     // 0/1 toggle for ground reflection
// Per-leaf material LUT (xyzw = hue, sat, metal, glow). sat < 0 sentinel
// means "no material — fall back to hash palette". Indexed by minIndex-1
// (IMIN_GLSL's imin increments objectIndex BEFORE checking, so minIndex
// values are 1..numLeaves).
uniform vec4  u_leafMaterial[96];
// Per-leaf extended material — y reserved, z reserved, w reserved; x = value
// (HSV brightness). Separate LUT because vec4 already full with hue/sat/metal/
// glow. Default 1.0 = full brightness; matte-black-style presets use ~0.2.
uniform vec4  u_leafTone[96];
// Per-leaf pattern LUT (x = pattern code, y = scale, z = strength, w = reserved).
// code: 0=none, 1=brick, 2=hex, 3=cells, 4=cracked. Same indexing as material.
uniform vec4  u_leafPattern[96];

#define MAX_STEPS    128
#define MAX_DIST     40.0
#define EPS          0.0008
#define GROUND_Y     -1.0
#define MAX_MATERIAL 96

// ---- Scene mapping (with optional infinite ground plane) ------------------
vec2 mapWithGround(vec3 p) {
  float d_obj = sceneSDF(p);
  if (u_groundOn < 0.5) return vec2(d_obj, 2.0);
  float d_gnd = p.y - GROUND_Y;
  if (d_obj < d_gnd) return vec2(d_obj, 2.0);
  return vec2(d_gnd, 1.0);
}

// IQ-style tetrahedral normal — half the texture taps of axis-aligned + smoother
vec3 calcNormal(vec3 p) {
  const float e = 0.0007;
  vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * mapWithGround(p + k.xyy * e).x +
    k.yyx * mapWithGround(p + k.yyx * e).x +
    k.yxy * mapWithGround(p + k.yxy * e).x +
    k.xxx * mapWithGround(p + k.xxx * e).x
  );
}

// IQ "Improved" softShadow — penumbra control via k. Higher k = sharper.
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0;
  float t = mint;
  float ph = 1e10;
  for (int i = 0; i < 32; i++) {
    if (t >= maxt) break;
    float h = mapWithGround(ro + rd * t).x;
    if (h < 0.00012) return 0.0;
    float y = h * h / (2.0 * ph);
    float d = sqrt(h * h - y * y);
    res = min(res, k * d / max(0.0, t - y));
    ph = h;
    t += clamp(h, 0.015, 0.25);
  }
  return clamp(res, 0.0, 1.0);
}

// IQ AO — 5 samples along the normal, short distance, exponential falloff
float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.012 + 0.14 * float(i) / 4.0;
    float d = mapWithGround(p + h * n).x;
    occ += (h - d) * sca;
    sca *= 0.92;
  }
  return clamp(1.0 - 2.6 * occ, 0.0, 1.0);
}

// nimitz-inspired atmospheric sky. Reacts to sun height: cool/blue at midday,
// warm orange at low sun (golden hour). Strong halo. Optional horizon glow
// when sun is below ~30° — gives sunrise / sunset mood without explicit
// time-of-day preset.
vec3 sky(vec3 rd, vec3 sunDir) {
  float t = clamp(rd.y, -0.3, 1.0);
  float sunHeight = clamp(sunDir.y, 0.0, 1.0);

  // Horizon color shifts toward warm at low sun; mid blue belt + cool zenith.
  vec3 horizonHigh = vec3(0.85, 0.86, 0.82);   // midday haze (slightly cool)
  vec3 horizonLow  = vec3(1.10, 0.55, 0.30);   // sunset orange
  vec3 horizon = mix(horizonLow, horizonHigh, smoothstep(0.05, 0.45, sunHeight));

  vec3 mid    = vec3(0.50, 0.65, 0.88);
  vec3 zenith = vec3(0.12, 0.26, 0.58);

  // Below-horizon (looking down) gets darkened version of horizon — for
  // free-fly camera dipping below ground level. Smooth, no hard edge.
  vec3 belowHorizon = horizon * 0.55;
  vec3 col = mix(belowHorizon, horizon, smoothstep(-0.3, 0.0, t));
  col = mix(col, mid,    smoothstep(0.0,  0.35, t));
  col = mix(col, zenith, smoothstep(0.30, 0.95, t));

  // Sun disk + halo (stronger than before — was 0.12 halo). Disk only when
  // sun is above horizon; halo always (sets up the bright-spot reference).
  float sd = max(dot(rd, sunDir), 0.0);
  col += vec3(1.00, 0.92, 0.72) * pow(sd, 380.0) * 2.5 * step(0.0, sunDir.y);
  col += vec3(1.00, 0.78, 0.50) * pow(sd, 8.0)   * 0.25;

  // Golden-hour horizon glow: at low sun, the sky near the horizon along
  // the sun's azimuth glows warm. Only applies when sunHeight < ~0.5.
  float lowSunK = 1.0 - smoothstep(0.0, 0.50, sunHeight);
  if (lowSunK > 0.0) {
    vec3 sunFlat = normalize(vec3(sunDir.x, 0.0, sunDir.z));
    vec3 rdFlat  = normalize(vec3(rd.x, 0.0, rd.z));
    float azimuthAlign = max(dot(rdFlat, sunFlat), 0.0);
    float horizonGlow = pow(azimuthAlign, 5.0) *
                        (1.0 - smoothstep(-0.05, 0.35, abs(t)));
    col += vec3(1.0, 0.55, 0.28) * horizonGlow * lowSunK * 0.7;
  }

  return col;
}

// nimitz-style atmospheric density. Distance + height combined:
//   distance term — saturates around t=50 (1 - exp(-t * 0.018))
//   height term   — fog hugs ground (exp(-(y+1)*0.5)), mountains see less
// Tuned conservatively after cathedral test render — previous coefficients
// fogged out close (5-15 unit) buildings too aggressively. Now < 25% fog
// at t=15, ~40% at t=40. Result keeps near geometry crisp while still
// giving deep atmospheric perspective on distant elements.
float atmosphereDensity(vec3 p, float t) {
  float heightK = exp(-max(p.y + 1.0, 0.0) * 0.50);
  float distK   = 1.0 - exp(-t * 0.018);
  return clamp(0.15 * heightK + 0.55 * distK, 0.0, 0.85);
}

float checker(vec2 p) {
  vec2 i = floor(p);
  return mod(i.x + i.y, 2.0);
}

// Stochastic AA dither uses hash21 from NOISE_GLSL (Hoskins canonical naming:
// 2-in 1-out). Removed local duplicate to avoid GLSL redefinition error now
// that the noise library is prepended via includeLibrary=true.

// Gamma + clip. Reinhard was too aggressive — it pulled white down to 0.5
// before gamma, leaving everything washed-out. Diffuse-mostly scenes don't
// need HDR compression (lighting tops out near 1.5); we just clamp + gamma.
vec3 tonemap(vec3 c) {
  return pow(clamp(c, 0.0, 1.0), vec3(0.4545));
}

// IQ cosine palette — warm-leaning artistic palette. Used as the fallback
// when a subject doesn't carry a material (hash-by-index for visual variety).
vec3 cosPalette(float h) {
  vec3 a = vec3(0.50, 0.50, 0.52);
  vec3 b = vec3(0.55, 0.55, 0.50);
  vec3 c = vec3(0.85, 1.00, 1.18);
  vec3 d = vec3(0.00, 0.33, 0.67);
  return a + b * cos(6.28318530718 * (c * h + d));
}

// HSV → RGB. Used for material albedo where 'hue' is intuitive 0=red,
// 0.33=green, 0.66=blue (matches LLM/artist mental model).
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Fetch the material for a given leaf index. Returns sentinel sat<0 if the
// index is out of range or the slot is unset.
//
// WebGL1 GLSL spec restricts uniform-array indexing to "constant index
// expressions" — only literals, const globals, and *loop indices* are
// allowed. ANGLE / strict drivers enforce this; modern desktop drivers
// often relax it. We walk a fixed-trip loop and pick the target index via
// 'if (j == target)' to stay portable. ~96 compare ops per fetch — trivial
// on a modern GPU. Switch to a 1D texture LUT if MAX_MATERIAL grows past
// ~256 or if profilers point here.
vec4 fetchMaterial(float idx) {
  int target = int(idx) - 1;  // imin's objectIndex is 1-based
  if (target < 0 || target >= MAX_MATERIAL) return vec4(0.0, -1.0, 0.0, 0.0);
  for (int j = 0; j < MAX_MATERIAL; j++) {
    if (j == target) return u_leafMaterial[j];
  }
  return vec4(0.0, -1.0, 0.0, 0.0);  // unreachable; satisfies path-analysis
}

// Parallel fetch for the pattern LUT. Same indexing scheme as fetchMaterial.
// Returns vec4(code, scale, strength, reserved); code 0 = no pattern.
vec4 fetchPattern(float idx) {
  int target = int(idx) - 1;
  if (target < 0 || target >= MAX_MATERIAL) return vec4(0.0);
  for (int j = 0; j < MAX_MATERIAL; j++) {
    if (j == target) return u_leafPattern[j];
  }
  return vec4(0.0);
}

// Parallel fetch for the extended material (tone) LUT. .x = value/brightness.
// Default 1.0 means "full bright", matches old behavior pre-value-field.
vec4 fetchTone(float idx) {
  int target = int(idx) - 1;
  if (target < 0 || target >= MAX_MATERIAL) return vec4(1.0, 0.0, 0.0, 0.0);
  for (int j = 0; j < MAX_MATERIAL; j++) {
    if (j == target) return u_leafTone[j];
  }
  return vec4(1.0, 0.0, 0.0, 0.0);
}

// Apply a Shane-style cellular pattern to base albedo. Pattern is a
// surface-color overlay (no geometry change). Uses the surface normal to
// pick a 2D projection so brick / hex courses align with the world up-axis
// regardless of which way the wall faces.
vec3 applyPattern(vec3 base, vec3 worldP, vec3 normal, vec4 pat) {
  int code = int(pat.x + 0.5);
  float scale = pat.y;
  float strength = pat.z;
  vec3 nAbs = abs(normal);

  if (code == 1) {
    // brick — pick 2D plane based on dominant normal axis so courses are
    // always horizontal (Y stays vertical). Floor-facing surfaces fall back
    // to XZ projection (brick laid in plan view).
    vec2 uv;
    if (nAbs.x > nAbs.y && nAbs.x > nAbs.z) {
      uv = vec2(worldP.z, worldP.y);   // X-facing wall: tangential=Z, vertical=Y
    } else if (nAbs.y > nAbs.z) {
      uv = vec2(worldP.x, worldP.z);   // floor / ceiling: pseudo-bricks in plan
    } else {
      uv = vec2(worldP.x, worldP.y);   // Z-facing wall: tangential=X, vertical=Y
    }
    vec2 bp = brickPattern2(uv * scale, vec2(1.0, 0.4));
    float brickTint = 0.80 + 0.40 * bp.x;
    float mortar = smoothstep(0.0, 0.05, bp.y);  // 1 = brick face, 0 = mortar
    vec3 brickColor = base * brickTint;
    vec3 mortarColor = base * 0.45;
    return mix(base, mix(mortarColor, brickColor, mortar), strength);
  }
  if (code == 2) {
    // hex tiling — pick 2D plane same way. For floors (Y normal), use XZ.
    vec2 uv;
    if (nAbs.x > nAbs.y && nAbs.x > nAbs.z) {
      uv = vec2(worldP.z, worldP.y);
    } else if (nAbs.y > nAbs.z) {
      uv = vec2(worldP.x, worldP.z);
    } else {
      uv = vec2(worldP.x, worldP.y);
    }
    vec2 hp = hexTile(uv * scale, 1.0);
    float hexTint = 0.85 + 0.30 * hp.x;
    float grid = smoothstep(0.0, 0.04, hp.y);
    return mix(base, base * hexTint * grid, strength);
  }
  if (code == 3) {
    // cells — voronoi 3D, naturally orientation-independent
    vec3 vor = voronoi3D(worldP * scale);
    float cellTint = 0.78 + 0.44 * vor.x;
    float edge = smoothstep(0.0, 0.08, vor.z);
    return mix(base, base * cellTint * (0.7 + 0.3 * edge), strength);
  }
  if (code == 4) {
    // cracked — voronoi edges as dark crack lines (3D, orientation-independent)
    float cracks = crackedField(worldP * scale, 0.4);
    return mix(base, base * (0.55 + 0.45 * cracks), strength);
  }
  return base;
}

// Cheap secondary raymarch for reflections. Shorter step budget than the
// primary (32 vs 128) — reflections are visual sweetener, not main signal.
// Returns vec3(t, matId, hitIdx); matId=0 means miss.
vec3 raymarchShort(vec3 ro, vec3 rd, float maxDist) {
  float t = 0.04;  // small bias to avoid self-intersection at ground
  for (int i = 0; i < 32; i++) {
    vec3 p = ro + rd * t;
    vec2 dm = mapWithGround(p);
    if (dm.x < EPS * (1.0 + 0.4 * t)) {
      return vec3(t, dm.y, minIndex);
    }
    if (t > maxDist) break;
    t += dm.x;
  }
  return vec3(maxDist, 0.0, 0.0);
}

// Quick-and-dirty shading for reflection-ray hits. No shadow / AO / rim — just
// material albedo + sun diffuse + sky ambient. The reflection is dim relative
// to the primary surface so the cost-quality tradeoff favors cheap.
vec3 shadeReflection(vec3 p, vec3 rd, float matId, float hitIdx, vec3 sunDir) {
  vec3 n = calcNormal(p);
  vec3 toLight = normalize(u_lightPos - p);
  float diff = max(dot(n, toLight), 0.0);
  float skyL = clamp(0.5 + 0.5 * n.y, 0.0, 1.0);

  vec3 base;
  float glowK = 0.0;
  if (matId > 1.5) {
    vec4 mat = fetchMaterial(hitIdx);
    if (mat.y < 0.0) {
      base = cosPalette(fract(hitIdx * 0.6180339887));
    } else {
      vec4 tone = fetchTone(hitIdx);
      base = hsv2rgb(vec3(mat.x, mat.y, tone.x));
      glowK = mat.w;
    }
  } else {
    base = vec3(0.78, 0.76, 0.70);  // ground neutral
  }

  vec3 sunCol = vec3(1.05, 0.96, 0.84);
  vec3 skyCol = vec3(0.50, 0.62, 0.84);
  return base * sunCol * diff * 1.0 + base * skyCol * skyL * 0.35 + base * glowK * 1.4;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  vec3 rd = normalize(uv.x * u_camRight + uv.y * u_camUp + u_focal * u_camFwd);
  vec3 ro = u_camPos;
  vec3 sunDir = normalize(u_lightPos);

  // ---- Raymarch ----
  // Stochastic AA: offset starting t by sub-step noise per pixel. Free
  // antialiasing on silhouettes — neighboring pixels sample slightly different
  // depths along the same ray so the visibility boundary dithers across them.
  float t = hash21(gl_FragCoord.xy) * 0.012;
  float matId = 0.0;
  float hitIdx = 0.0;  // captured at hit; downstream sceneSDF calls clobber minIndex
  bool hit = false;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    vec2 dm = mapWithGround(p);
    if (dm.x < EPS * (1.0 + 0.4 * t)) {
      hit = true; matId = dm.y;
      hitIdx = minIndex;  // capture immediately — normal/shadow/AO calls below will overwrite
      break;
    }
    if (t > MAX_DIST) break;
    t += dm.x;
  }

  vec3 col;
  if (!hit) {
    col = sky(rd, sunDir);
  } else {
    // ---- Shading ----
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 toLight = normalize(u_lightPos - p);
    vec3 V = -rd;
    vec3 H = normalize(toLight + V);

    float diff = max(dot(n, toLight), 0.0);
    float spec = pow(max(dot(n, H), 0.0), 24.0);
    float ao   = calcAO(p, n);
    float skyL = clamp(0.5 + 0.5 * n.y, 0.0, 1.0);                 // hemispheric sky light
    float rim  = pow(1.0 - max(dot(n, V), 0.0), 4.0);              // fresnel rim
    float bnc  = clamp(0.5 - 0.5 * n.y, 0.0, 1.0);                 // bounce light from ground

    float shadowK = 1.0;
    if (u_shadowsOn > 0.5) {
      float lightDist = length(u_lightPos - p);
      shadowK = softShadow(p + n * 0.002, toLight, 0.02, lightDist, 12.0);
    }

    // Base albedo + material params:
    //   - object hits (matId=2): material LUT keyed by hit leaf index. If the
    //     LUT slot is unset (sat<0 sentinel), fall back to hash-by-index
    //     cosine palette for visual variety.
    //   - ground (matId=1): cool neutral or checker (no material support yet)
    vec3 base;
    float metalK = 0.0;
    float glowK = 0.0;
    if (matId > 1.5) {
      vec4 mat = fetchMaterial(hitIdx);
      if (mat.y < 0.0) {
        base = cosPalette(fract(hitIdx * 0.6180339887));
      } else {
        // Full HSV from material LUT + value from tone LUT. value < 1.0
        // produces actually-dark colors (matte-black, brick, etc.) which
        // hue+sat alone cannot.
        vec4 tone = fetchTone(hitIdx);
        base = hsv2rgb(vec3(mat.x, mat.y, tone.x));
        metalK = mat.z;
        glowK  = mat.w;
      }
    } else if (u_checkerOn > 0.5) {
      float c = checker(p.xz);
      base = mix(vec3(0.90, 0.86, 0.78), vec3(0.74, 0.70, 0.62), c);
    } else {
      base = vec3(0.78, 0.76, 0.70);
    }

    // Per-leaf Shane-style surface pattern (brick / hex / cells / cracked).
    // Applied BEFORE fbm modulation so fbm gives organic variation on top
    // of the structured pattern. Pattern is opt-in via Subject.pattern field.
    // Pattern uses surface normal for orientation-aware 2D projection (so
    // brick courses are horizontal regardless of which way the wall faces).
    if (matId > 1.5) {
      vec4 pat = fetchPattern(hitIdx);
      if (pat.x > 0.5) {
        base = applyPattern(base, p, n, pat);
      }
    }

    // Procedural surface texture (Hoskins fbm). Gated by "plasticness":
    // metals + emissives keep smooth uniform surfaces; matte diffuse gets
    // ±10% albedo variance to break up plastic-looking uniformity. The
    // 6.0 scale gives ~6 visible bumps per world unit — good for stone /
    // wood / brick at typical camera distance.
    float plasticGate = (1.0 - metalK) * (1.0 - smoothstep(0.0, 0.5, glowK));
    float texDetail = fbm3_lite(p * 6.0);
    base *= mix(1.0, 0.82 + 0.36 * texDetail, plasticGate * 0.7);

    // Light colors
    vec3 sunCol    = vec3(1.05, 0.96, 0.84);
    vec3 skyCol    = vec3(0.50, 0.62, 0.84);
    vec3 bounceCol = vec3(0.55, 0.48, 0.40);
    vec3 rimCol    = vec3(0.55, 0.66, 0.80);

    // Compose lighting. Metal suppresses diffuse + tints specular toward
    // base color (the canonical metal/non-metal split). Glow adds emissive
    // last, unshadowed.
    float diffK = 1.0 - 0.85 * metalK;
    vec3  specTint = mix(vec3(1.0), base, metalK);
    float specBoost = 0.45 + 1.8 * metalK;

    vec3 lin = vec3(0.0);
    lin += base * sunCol    * diff * shadowK * 1.35 * diffK;
    lin += base * skyCol    * skyL * ao      * 0.42 * diffK;
    lin += base * bounceCol * bnc  * ao      * 0.18 * diffK;
    lin += specTint * sunCol * spec * shadowK * specBoost;
    lin += rimCol * rim * ao                 * 0.18;

    // Single-bounce reflection on the ground plane. Fresnel-weighted so
    // grazing angles reflect strongly (the wet-floor / polished-stone look),
    // near-vertical angles mostly show ground base. Reflection ray is shorter
    // (12 units, 32 steps) — visual sweetener, not main signal.
    if (u_reflectOn > 0.5 && matId < 1.5) {
      vec3 rrd = reflect(rd, n);
      vec3 hit2 = raymarchShort(p + n * 0.01, rrd, 12.0);
      vec3 refl;
      if (hit2.y > 0.5) {
        vec3 p2 = p + n * 0.01 + rrd * hit2.x;
        refl = shadeReflection(p2, rrd, hit2.y, hit2.z, sunDir);
      } else {
        refl = sky(rrd, sunDir);
      }
      // Schlick fresnel: F0=0.04 for dielectrics; grazing angle → 1.0
      float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
      lin = mix(lin, refl, fres * 0.55);  // 0.55 cap so even mirror grazing keeps some ground tint
    }

    // Atmospheric perspective: height-modulated fog (nimitz model).
    // Ground-hugging haze + saturating distance attenuation. Emissive added
    // after fog so glow (lighthouse beacon, neon) punches through atmosphere.
    float fog = atmosphereDensity(p, t);
    col = mix(lin, sky(rd, sunDir), fog);
    col += base * glowK * 1.4;
  }

  gl_FragColor = vec4(tonemap(col), 1.0);
}`;
}

// =============================================================================
// Controller
// =============================================================================

export function createFly3DRenderer({ canvas, getControls, onCamUpdate, onFps }) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL not supported');

  canvas.addEventListener('webglcontextlost', (e) => {
    console.error('[fly3d] WebGL context lost', e);
    e.preventDefault();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    console.warn('[fly3d] WebGL context restored — re-upload required');
  });

  const camState = { position: [0, 0.3, -3.0], yaw: 0, pitch: 0 };
  const defaultCam = { position: [...camState.position], yaw: 0, pitch: 0 };

  let program = null;
  let uniformsCache = {};
  let rafId = null;
  let flyHandle = null;
  // Per-leaf material + pattern LUTs — built at uploadSDF time from
  // compileSDF3ToGLSL() output. Float32Arrays of MAX_MATERIAL * 4. Sentinels:
  //   materialLUT[i*4+1] = -1   → no material, shader uses hash palette
  //   patternLUT[i*4+0]  = 0    → no pattern, shader skips applyPattern
  const MAX_MATERIAL = 96;
  const materialLUT = new Float32Array(MAX_MATERIAL * 4);
  const toneLUT     = new Float32Array(MAX_MATERIAL * 4);
  const patternLUT  = new Float32Array(MAX_MATERIAL * 4);

  // ---- one-time vbuf + vs ----
  const vbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vs = compileShader(VS_SRC, gl.VERTEX_SHADER);

  // ---- camera math ----
  function computeFwd(yaw, pitch) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw),   sy = Math.sin(yaw);
    return [sy * cp, -sp, cy * cp];
  }
  function computeRight(fwd) {
    const m = Math.hypot(fwd[2], fwd[0]);
    if (m < 1e-6) return [1, 0, 0];
    return [fwd[2] / m, 0, -fwd[0] / m];
  }
  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }
  function lightFromSpherical(azim, alt, dist) {
    return [
      dist * Math.sin(azim) * Math.cos(alt),
      dist * Math.sin(alt),
      -dist * Math.cos(azim) * Math.cos(alt),
    ];
  }

  // ---- shader compile ----
  function compileShader(src, type) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(log);
    }
    return sh;
  }

  function uploadSDF(sdf) {
    // emitObjectIndex: true → scene() updates `minIndex` global with the closest
    // leaf's index. Fragment shader uses minIndex to pick per-subject color via
    // an IQ cosine palette — fixes the "everything is grey" look.
    const result = compileSDF3ToGLSL(sdf, {
      sceneFnName: 'sceneSDF',
      includeLibrary: true,
      emitObjectIndex: true,
    });
    if (result.error) throw new Error(`compileSDF3ToGLSL: ${result.error}`);

    let fs;
    try {
      fs = compileShader(buildFragmentShader(result.glsl), gl.FRAGMENT_SHADER);
    } catch (e) {
      console.error('Fragment shader source was:\n', buildFragmentShader(result.glsl));
      throw new Error(`GLSL shader compile failed: ${e.message}`);
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(prog)}`);
    }

    if (program) gl.deleteProgram(program);
    program = prog;

    gl.useProgram(program);
    const a_pos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(a_pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

    uniformsCache = {};
    for (const name of [
      'u_resolution', 'u_camPos', 'u_camFwd', 'u_camRight', 'u_camUp', 'u_focal',
      'u_lightPos', 'u_shadowsOn', 'u_groundOn', 'u_checkerOn', 'u_reflectOn',
      'u_leafMaterial[0]', 'u_leafTone[0]', 'u_leafPattern[0]',
    ]) {
      uniformsCache[name] = gl.getUniformLocation(program, name);
    }

    // Build per-leaf material + tone LUTs from compile result. Materials use
    // sentinel sat=-1 for "no material" fallback; tones default to value=1.0
    // (full brightness, preserves pre-value-field behavior).
    materialLUT.fill(0);
    toneLUT.fill(0);
    for (let i = 0; i < MAX_MATERIAL; i++) {
      materialLUT[i * 4 + 1] = -1.0;  // sat sentinel
      toneLUT[i * 4 + 0]     = 1.0;   // value default
    }
    const leafMaterials = result.leafMaterials || [];
    if (leafMaterials.length > MAX_MATERIAL) {
      console.warn(`[fly3d] scene has ${leafMaterials.length} leaves; LUT capped at ${MAX_MATERIAL}. Excess leaves render with hash-palette fallback.`);
    }
    for (let i = 0; i < Math.min(leafMaterials.length, MAX_MATERIAL); i++) {
      const m = leafMaterials[i];
      if (m == null) continue;
      materialLUT[i * 4 + 0] = m.hue;
      materialLUT[i * 4 + 1] = m.sat;
      materialLUT[i * 4 + 2] = m.metal;
      materialLUT[i * 4 + 3] = m.glow;
      toneLUT[i * 4 + 0] = m.value ?? 1.0;
    }

    // Build per-leaf pattern LUT. Default zeros = code=0 = no pattern.
    patternLUT.fill(0);
    const leafPatterns = result.leafPatterns || [];
    for (let i = 0; i < Math.min(leafPatterns.length, MAX_MATERIAL); i++) {
      const p = leafPatterns[i];
      if (p == null) continue;
      patternLUT[i * 4 + 0] = p.code;
      patternLUT[i * 4 + 1] = p.scale;
      patternLUT[i * 4 + 2] = p.strength;
      // [3] reserved for future use (e.g. rotation, sub-variant)
    }

    return result.glsl.length;
  }

  let _debugFirstDraw = true;
  function draw() {
    if (!program) return;
    const c = getControls();

    const fwd = computeFwd(camState.yaw, camState.pitch);
    const right = computeRight(fwd);
    const up = cross(fwd, right);
    const lpos = lightFromSpherical(c.lightAzim, c.lightAlt, c.lightDist);

    // Defensive state reset — WebGL context is shared with other renderers
    // (e.g. bobShader) on the same canvas; their leftover state (FBO binding,
    // depth/blend, vertex attrib pointers) would silently break our draw.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);
    gl.useProgram(program);
    const a_pos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(a_pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, canvas.width, canvas.height);
    // Black clear (shader covers every pixel; clear is a safety net for blank
    // frames when context state is bad — black is less alarming than magenta).
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniformsCache.u_resolution, canvas.width, canvas.height);
    gl.uniform3f(uniformsCache.u_camPos, camState.position[0], camState.position[1], camState.position[2]);
    gl.uniform3f(uniformsCache.u_camFwd, fwd[0], fwd[1], fwd[2]);
    gl.uniform3f(uniformsCache.u_camRight, right[0], right[1], right[2]);
    gl.uniform3f(uniformsCache.u_camUp, up[0], up[1], up[2]);
    gl.uniform1f(uniformsCache.u_focal, c.fov);
    gl.uniform3f(uniformsCache.u_lightPos, lpos[0], lpos[1], lpos[2]);
    gl.uniform1f(uniformsCache.u_shadowsOn, c.shadowsOn ? 1.0 : 0.0);
    gl.uniform1f(uniformsCache.u_groundOn,  c.groundOn  ? 1.0 : 0.0);
    gl.uniform1f(uniformsCache.u_checkerOn, c.checkerOn ? 1.0 : 0.0);
    // Reflection defaults ON if caller doesn't supply a flag — wet-floor look
    // is a major visual upgrade. Caller can disable via `controls.reflectOn = false`.
    gl.uniform1f(uniformsCache.u_reflectOn, (c.reflectOn === false) ? 0.0 : 1.0);
    if (uniformsCache['u_leafMaterial[0]'] != null) {
      gl.uniform4fv(uniformsCache['u_leafMaterial[0]'], materialLUT);
    }
    if (uniformsCache['u_leafTone[0]'] != null) {
      gl.uniform4fv(uniformsCache['u_leafTone[0]'], toneLUT);
    }
    if (uniformsCache['u_leafPattern[0]'] != null) {
      gl.uniform4fv(uniformsCache['u_leafPattern[0]'], patternLUT);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (_debugFirstDraw) {
      _debugFirstDraw = false;
      const err = gl.getError();
      const errName = err === gl.NO_ERROR ? 'NO_ERROR'
        : err === gl.INVALID_ENUM ? 'INVALID_ENUM'
        : err === gl.INVALID_VALUE ? 'INVALID_VALUE'
        : err === gl.INVALID_OPERATION ? 'INVALID_OPERATION'
        : err === gl.INVALID_FRAMEBUFFER_OPERATION ? 'INVALID_FRAMEBUFFER_OPERATION'
        : err === gl.OUT_OF_MEMORY ? 'OUT_OF_MEMORY'
        : err === gl.CONTEXT_LOST_WEBGL ? 'CONTEXT_LOST_WEBGL'
        : `0x${err.toString(16)}`;
      console.log('%c[fly3d] first frame drawn', 'color:#7fa97f; font-weight:600', {
        glError: errName,
        canvasW: canvas.width, canvasH: canvas.height,
        canvasVisible: canvas.style.display,
        camPos: camState.position,
        camYaw: camState.yaw, camPitch: camState.pitch,
        a_pos_loc: a_pos,
      });
    }
  }

  let frameCount = 0;
  let fpsLast = performance.now();

  function loop() {
    draw();
    frameCount++;
    const now = performance.now();
    if (now - fpsLast > 500) {
      const fps = frameCount / ((now - fpsLast) / 1000);
      if (onFps) onFps(fps);
      frameCount = 0;
      fpsLast = now;
    }
    if (onCamUpdate) onCamUpdate(camState);
    rafId = requestAnimationFrame(loop);
  }

  // ---- public API ----
  return {
    /**
     * Compile new SDF and start rendering. Idempotent — re-call to swap SDF.
     * Throws on compile / shader / link failure.
     */
    render(sdf) {
      const bytes = uploadSDF(sdf);
      if (!flyHandle) {
        flyHandle = attachFlyControls(canvas, () => camState, (patch) => Object.assign(camState, patch), {
          speed: 1.5,
          speedBoost: 4.0,
          onReset: () => {
            camState.position = [...defaultCam.position];
            camState.yaw = defaultCam.yaw;
            camState.pitch = defaultCam.pitch;
          },
        });
      }
      _debugFirstDraw = true;
      if (!rafId) {
        fpsLast = performance.now();
        frameCount = 0;
        loop();
      }
      return { bytes };
    },

    /**
     * Stop rendering, release pointer lock, detach input handlers. WebGL
     * resources kept so re-mount is cheap (just call render() again).
     */
    unmount() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (flyHandle) { flyHandle.detach(); flyHandle = null; }
    },

    resetCamera() {
      camState.position = [...defaultCam.position];
      camState.yaw = defaultCam.yaw;
      camState.pitch = defaultCam.pitch;
    },

    setCamState(patch) {
      if (patch.position) camState.position = [...patch.position];
      if (patch.yaw != null)   camState.yaw   = patch.yaw;
      if (patch.pitch != null) camState.pitch = patch.pitch;
    },

    /**
     * dry-run: 不真编译 GLSL，只 walk AST 判断 SDF 能不能 compile。
     * 用来在 dispatch 前先 check，给 user friendlier error message。
     */
    canRender(sdf) {
      return canCompileSDF3(sdf);
    },

    getCamState() { return { ...camState, position: [...camState.position] }; },
  };
}
