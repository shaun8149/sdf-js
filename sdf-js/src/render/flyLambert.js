// =============================================================================
// flyLambert —— GPU shader Lambert + pointer-lock fly camera 渲染器
// -----------------------------------------------------------------------------
// 2026-05-17 MOVE from examples/mvp/fly3d-renderer.js → src/render/flyLambert.js
// MVP 切到 'fly3d' mode 时调用 render(sdf)；切走时 unmount()。examples/sdf 里
// 的独立 demo 页 shader-lambert-browser.js 用同样的 shader template + fly-controls。
// =============================================================================

import { compileSDF3ToGLSL, canCompileSDF3, IMIN_GLSL } from '../sdf/sdf3.compile.js';
import { attachFlyControls } from '../input/fly-controls.js';
import { createPostFxPipeline, resolvePostFxParams, DEFAULT_POSTFX } from './postfx.js';
import { evaluateCameraSequence, sequenceStateToCamState, totalDuration as seqTotalDuration } from '../scene/camera-sequence.js';

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
// Sprint 8: blueprint shot mode. When set to 1, the entire scene is rendered
// as a technical schematic — silhouette edges + light fill on a dark graph-
// paper background. Set per-frame from cameraSequence shot.renderer field.
uniform float u_blueprintMode;
// Per-leaf material LUT (xyzw = hue, sat, metal, glow). sat < 0 sentinel
// means "no material — fall back to hash palette". Indexed by minIndex-1
// (IMIN_GLSL's imin increments objectIndex BEFORE checking, so minIndex
// values are 1..numLeaves).
// 2026-05-24: bumped 96 → 256 to support large scatter scenes (cathedral
// scatter×3 = ~180 leaves, carrier fleet×5 = ~200 leaves). Was overflowing
// the LUT and tail leaves rendered with hash-palette pastel rainbow.
uniform vec4  u_leafMaterial[256];
// Per-leaf extended material — x = value (HSV brightness), y = kind
// (0 = Lambert, 1 = sea-shading branch); z/w reserved. Separate LUT because
// vec4 already full with hue/sat/metal/glow. Default value=1.0 (full
// brightness); matte-black-style presets use ~0.2. kind defaults to 0.
uniform vec4  u_leafTone[256];
// Per-leaf pattern LUT (x = pattern code, y = scale, z = strength, w = reserved).
// code: 0=none, 1=brick, 2=hex, 3=cells, 4=cracked. Same indexing as material.
uniform vec4  u_leafPattern[256];

// Sprint 4: u_subjectOffset[4] is declared in NOISE_GLSL prelude (shared by
// BOB GPU + Blueprint too). FLY 3D actively uploads per-frame from the
// evaluator's CarInt output; other renderers leave it at default vec3(0).
#define MAX_SUBJECT_MOTION 4

// Sprint 3: volume primitives. Each slot:
//   u_volumeKindCenter[i] = vec4(kind, cx, cy, cz)   — kind: 0=smoke, 1=flame, 2=fog, 3=god-rays
//   u_volumeSizeDensity[i] = vec4(sx, sy, sz, density)
//   u_volumeColor[i]       = vec4(r, g, b, noiseScale)
// u_volumeCount = active slots (0..MAX_VOLUMES). Sprint 5 bumped 8→12 to
// support multi-emitter rocket exhaust (4 booster flames + center + trail
// smoke + pad smoke + fog + god-rays = 9 active for rocket-launch).
#define MAX_VOLUMES 12
uniform vec4  u_volumeKindCenter[MAX_VOLUMES];
uniform vec4  u_volumeSizeDensity[MAX_VOLUMES];
uniform vec4  u_volumeColor[MAX_VOLUMES];
uniform int   u_volumeCount;

#define MAX_STEPS    200
#define MAX_DIST     200.0  // matches BOB GPU; was 40, too small for fleet/scatter scenes
#define EPS          0.0008
#define GROUND_Y     -1.0
#define MAX_MATERIAL 256

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

// Combined LUT fetch — looks up material + tone + pattern in ONE loop pass.
// Previously had 3 separate fetch functions = 3 × 96-iteration loops per
// pixel = 288 compare ops per leaf hit. Combined fetch is 96 iterations
// total → 3× speedup on per-pixel LUT cost.
//
// WebGL1 GLSL spec restricts uniform-array indexing to "constant index
// expressions" — only literals, const globals, and *loop indices* are
// allowed. ANGLE / strict drivers enforce this; modern desktop drivers
// often relax it. We walk a fixed-trip loop and pick the target index via
// 'if (j == target)'. ~96 compares per pixel (was 288). Texture LUT would
// be O(1) but requires a refactor of all 3 uniform arrays.
void fetchLeafData(float idx, out vec4 mat, out vec4 tone, out vec4 pat) {
  int target = int(idx) - 1;  // imin's objectIndex is 1-based
  mat  = vec4(0.0, -1.0, 0.0, 0.0);   // sentinel: no material
  tone = vec4(1.0,  0.0, 0.0, 0.0);   // default: full brightness
  pat  = vec4(0.0);                    // default: no pattern
  if (target < 0 || target >= MAX_MATERIAL) return;
  for (int j = 0; j < MAX_MATERIAL; j++) {
    if (j == target) {
      mat  = u_leafMaterial[j];
      tone = u_leafTone[j];
      pat  = u_leafPattern[j];
      return;
    }
  }
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
    vec4 mat, tone, pat;
    fetchLeafData(hitIdx, mat, tone, pat);
    if (mat.y < 0.0) {
      base = cosPalette(fract(hitIdx * 0.6180339887));
    } else {
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

// Multi-layer star field — sky-only post-process. 3 octaves of cellular
// stars with shrinking grid + brightness. Masked by sun altitude so stars
// only appear at twilight/night. Idiom from soft-servo/jake 'Tree in the
// wind' (recipe-only port, our own hash impl via forestHash1).
vec3 atlasStarsOverlay(vec3 col, vec3 rd, vec3 sunDir, float t) {
  float nightK = 1.0 - smoothstep(-0.1, 0.32, sunDir.y);
  if (nightK < 0.02 || rd.y < 0.02) return col;
  float horizonK = smoothstep(0.02, 0.4, rd.y);

  float rdY = max(0.06, rd.y + 0.35);
  vec2 baseUv = rd.xz / rdY;
  baseUv.x += t * 0.008;

  vec3 stars = vec3(0.0);
  float scale = 1.0;
  for (int i = 0; i < 3; i++) {
    vec2 uvL = baseUv + vec2(float(i) * 1.618, 0.0);
    float cell = 0.08 * scale;
    vec2 id = floor(uvL / cell + 0.5);
    vec2 q = uvL - cell * id;
    float seed = id.x * 31.7 + id.y * 67.3 + float(i) * 113.1;
    float h1 = forestHash1(seed);
    float h2 = forestHash1(seed * 1.31 + 7.0);
    float h3 = forestHash1(seed * 2.71 + 11.0);
    q -= cell * (vec2(h1, h2) - 0.5) * 0.6;
    float heat = h3 * h3;
    float starR = (0.04 + heat * 0.09) * cell;
    float fade = smoothstep(starR, 0.0, length(q));
    vec3 starColor = vec3(0.85, 0.88, 0.96) + 0.20 * vec3(h1, h2, h3);
    stars += fade * fade * starColor * (0.5 + heat * 1.4);
    scale *= 0.55;
  }
  return col + stars * horizonK * nightK;
}

// IQ sdOctogon 2D — for lens flare ghosts. Centred at origin, radius r.
float sdOctogon2D(vec2 p, float r) {
  const vec3 ko = vec3(-0.9238795325, 0.3826834323, 0.4142135623);
  p = abs(p);
  p -= 2.0 * min(dot(vec2( ko.x, ko.y), p), 0.0) * vec2( ko.x, ko.y);
  p -= 2.0 * min(dot(vec2(-ko.x, ko.y), p), 0.0) * vec2(-ko.x, ko.y);
  p -= vec2(clamp(p.x, -ko.z * r, ko.z * r), r);
  return length(p) * sign(p.y);
}

// Lens flares — screen-space post. 6 octagon ghosts along sun line + 8-blade
// aperture starburst at sun. Masked by sun-above-horizon. Recipe inspired by
// soft-servo/jake (no source copy; offsets/colors are our own).
vec3 atlasLensFlares(vec3 col, vec2 uv, vec3 sunDir) {
  if (sunDir.y < 0.0) return col;  // sun below horizon
  float zProj = dot(sunDir, u_camFwd);
  if (zProj < 0.05) return col;    // sun behind camera

  float pScale = u_focal / zProj;
  vec2 sunUv = vec2(
    dot(sunDir, u_camRight) * pScale,
    dot(sunDir, u_camUp)    * pScale
  );

  // Off-screen sun → most flares miss; clamp distance to skip if sun too far
  vec2 vToSun = sunUv - uv;
  float dToSun = length(vToSun);

  vec3 sunCol = vec3(1.0, 0.92, 0.72);
  vec3 flares = vec3(0.0);

  // 6 octagon ghosts at sun-line offsets
  flares += 0.45 * vec3(0.10, 0.15, 0.04) * smoothstep(0.04, 0.0, sdOctogon2D(uv - sunUv *  0.50, 0.18));
  flares += 0.55 * vec3(0.02, 0.10, 0.10) * smoothstep(0.03, 0.0, sdOctogon2D(uv - sunUv *  0.25, 0.10));
  flares += 0.65 * vec3(0.12, 0.10, 0.08) * smoothstep(0.02, 0.0, sdOctogon2D(uv - sunUv *  0.12, 0.06));
  flares += 0.40 * vec3(0.15, 0.06, 0.03) * smoothstep(0.02, 0.0, sdOctogon2D(uv - sunUv * -0.18, 0.10));
  flares += 0.30 * vec3(0.04, 0.16, 0.10) * smoothstep(0.04, 0.0, sdOctogon2D(uv - sunUv * -0.40, 0.22));
  flares += 0.20 * vec3(0.18, 0.05, 0.02) * smoothstep(0.10, 0.0, sdOctogon2D(uv - sunUv * -1.20, 0.30));

  // 8-blade aperture starburst centered on sun
  if (dToSun < 1.6) {
    float ang = atan(vToSun.y, vToSun.x);
    float burst = 0.5 + 0.5 * cos(8.0 * ang + 1.5708);
    burst = pow(burst, 80.0);
    float falloff = smoothstep(1.4, 0.04, dToSun);
    flares += burst * falloff * sunCol * 0.45;
  }
  // Soft halo at sun
  float halo = smoothstep(0.30, 0.0, dToSun);
  flares += halo * halo * sunCol * 0.12;

  return col + flares * 0.5;
}

// =============================================================================
// Sprint 6: Auto point lights from emissive volumes
// -----------------------------------------------------------------------------
// Surface-side companion to applyVolumes' emissive integration. For every
// flame / god-ray volume, treat the volume center as a point light and add a
// Lambert contribution to nearby surfaces. Makes the launch-pad glow orange
// under the rocket exhaust, etc. No per-light shadow march (too expensive for
// up to 12 volumes × per-pixel) — inverse-square falloff via volume radius
// gives a credible local-illumination feel.
// =============================================================================
vec3 emissiveVolumeLight(vec3 p, vec3 n, vec3 base, float metalK) {
  if (u_volumeCount <= 0) return vec3(0.0);
  vec3 sum = vec3(0.0);
  for (int j = 0; j < MAX_VOLUMES; j++) {
    if (j >= u_volumeCount) break;
    vec4 kc = u_volumeKindCenter[j];
    int kind = int(kc.x + 0.5);
    if (kind != 1 && kind != 3) continue;  // emissive kinds only
    vec4 sd = u_volumeSizeDensity[j];
    vec4 col = u_volumeColor[j];
    vec3 lp = kc.yzw;
    vec3 toL = lp - p;
    float dist2 = dot(toL, toL);
    if (dist2 < 0.0001) continue;
    float dist = sqrt(dist2);
    toL /= dist;
    // Inverse-square falloff with volume radius. r-based denominator means a
    // small flame volume has tight reach, a big god-ray cone fills the scene.
    float r = max(max(sd.x, sd.y), sd.z);
    float att = (r * r) / (r * r + dist2);
    float diff = max(dot(n, toL), 0.0);
    // col.rgb already has colorIntensity baked (see setVolumes). sd.w = density.
    vec3 lightCol = col.rgb * sd.w;
    // Tint by base; for metals base is dark so add white floor so a chrome tower
    // actually picks up the orange flame. Boosted multiplier (0.18→0.55) +
    // 'tint' floor make the effect visible on dark-metal gantries.
    vec3 tint = mix(base, vec3(0.55) + base * 0.45, metalK);
    sum += tint * lightCol * diff * att * 0.55;
  }
  return sum;
}

// =============================================================================
// Sprint 3: Volume raymarch pass
// -----------------------------------------------------------------------------
// Density functions for the 4 volume kinds + an 'applyVolumes' integrator that
// runs after the surface hit and accumulates color × density along the eye ray.
// MttGz4 FX_Apply 模式 — fixed 32 steps with adaptive size escalation.
// =============================================================================

// Domain-wrap a 3D position into the volume's local box, normalized to [-1,1].
// Returns vec4(localPos, distance-to-bbox-surface). dist < 0 → inside bbox.
vec4 volumeLocalPos(vec3 p, vec3 center, vec3 size) {
  vec3 lp = (p - center) / max(size, vec3(0.001));
  vec3 d = abs(lp) - vec3(1.0);
  float distOutside = length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
  return vec4(lp, distOutside);
}

// Smoke: bumpy spherical/conic profile inside bbox, fbm-modulated.
float smokeDensity(vec3 lp, float noiseScale, float t) {
  // Falloff: smooth sphere falloff in local space (1 at center, 0 at corner)
  float falloff = 1.0 - smoothstep(0.0, 1.0, length(lp));
  if (falloff <= 0.0) return 0.0;
  // 3D fbm with slow drift
  vec3 nPos = lp * noiseScale + vec3(0.0, -t * 0.15, 0.0);
  float n = fbm3_lite(nPos);
  // Skew density: more in upper half (smoke rises)
  float rise = mix(0.6, 1.1, clamp(lp.y * 0.5 + 0.5, 0.0, 1.0));
  return clamp(falloff * (n * 0.8 + 0.3) * rise, 0.0, 1.0);
}

// Flame: tighter spherical profile + slow fbm + upward bias. Glow handled by color.
// Sprint 5: density floor raised (n*0.3+0.85 vs old n*0.9+0.5) so flame stays
// SOLID with subtle wisp variation, not strobing on/off. Time speed slowed
// from 1.2 to 0.5 to remove visible flicker. Boost overall to 1.4× so
// even modest user density values render as opaque fire.
float flameDensity(vec3 lp, float noiseScale, float t) {
  // Cone-like falloff: wide at base, narrow at top
  float radial = length(lp.xz) / max(0.3 + 0.6 * (1.0 - clamp(lp.y, 0.0, 1.0)), 0.05);
  if (radial > 1.0) return 0.0;
  float falloff = (1.0 - smoothstep(0.7, 1.0, radial)) * (1.0 - smoothstep(0.85, 1.0, lp.y));
  vec3 nPos = lp * noiseScale + vec3(0.0, -t * 0.5, 0.0);
  float n = fbm3_lite(nPos);
  // Heavy floor (0.85 base + 0.3*n) → density never drops below ~70% of peak.
  // Old (0.5 + 0.9*n) had density swinging 5%-140% = visible strobe.
  return clamp(falloff * (n * 0.3 + 0.85) * 1.4, 0.0, 1.0);
}

// Ground fog: layered density below center.y + size.y/2, fbm-perturbed.
float fogDensity(vec3 lp, float noiseScale, float t) {
  // Above bbox top → 0
  if (lp.y > 1.0) return 0.0;
  // Exponential falloff above floor
  float heightFalloff = exp(-max(lp.y + 1.0, 0.0) * 1.5);
  vec3 nPos = lp * vec3(noiseScale * 0.5, 0.5, noiseScale * 0.5) + vec3(t * 0.04, 0.0, t * 0.03);
  float n = fbm3_lite(nPos);
  return clamp(heightFalloff * (n * 0.5 + 0.5) * 0.7, 0.0, 1.0);
}

// God-rays: directional shaft. lp.y treated as "along ray", lp.xz as "across ray".
// Mostly density along center axis, modulated by fbm for atmospheric striation.
float godRayDensity(vec3 lp, float noiseScale, float t) {
  float radial = length(lp.xz);
  if (radial > 1.0) return 0.0;
  float falloff = pow(1.0 - radial, 2.0);
  vec3 nPos = lp * vec3(noiseScale, noiseScale * 0.3, noiseScale) + vec3(0.0, t * 0.06, 0.0);
  float n = fbm3_lite(nPos);
  return clamp(falloff * (n * 0.4 + 0.6) * 0.45, 0.0, 1.0);
}

// March from ro along rd up to tMax, accumulating volume contribution.
// Returns vec4(rgb pre-multiplied, transmittance). Final color = col.rgb + bg * col.a
//
// IMPORTANT (GLSL ES 1.00 constraint): array index expressions must be const
// or loop counters. So we cannot extract volumeDensityAt(p, slot) as a helper —
// the per-volume density dispatch is INLINED into the loop body where 'j' is
// the loop counter. Indexing u_volumeKindCenter[j] is then legal.
//
// Sprint 6: sunDir parameter added for sun-fog forward-Mie scatter (god-rays
// through fog volume when ray points near sun).
vec4 applyVolumes(vec3 ro, vec3 rd, float tMax, vec3 sunDir) {
  if (u_volumeCount <= 0) return vec4(0.0, 0.0, 0.0, 1.0);
  // Sprint 5: bumped 32→64 + dt CAP at 0.5 world units. Fixed dt was tMax/N;
  // for far shots (tMax=200), that gave dt=6.25 world units while flame
  // volumes are only ~2.6 tall → many samples missed flames entirely → fire
  // appeared "broken" / "fragmented". Capping ensures fine sampling regardless
  // of how far the ray's surface hit is. Tradeoff: rays beyond 64×0.5=32 world
  // units won't reach volumes, but volumes are usually near subject anyway.
  const int VOL_STEPS = 64;
  const float VOL_DT_MAX = 0.5;
  float jitter = hash21(gl_FragCoord.xy + vec2(u_time * 60.0, 0.0)) * 0.5;
  float dt = min(tMax / float(VOL_STEPS), VOL_DT_MAX);
  vec3 acc = vec3(0.0);
  float transmit = 1.0;
  float t = dt * (0.5 + jitter * 0.5);
  for (int i = 0; i < VOL_STEPS; i++) {
    if (t > tMax || transmit < 0.02) break;
    vec3 p = ro + rd * t;
    // Sprint 5: split emissive (flame, god-rays) vs absorptive (smoke, fog).
    // Emissive volumes ADD light without reducing transmittance — fire is
    // luminous and visually punches through smoke. Absorptive volumes follow
    // Beer-Lambert (block light + add their own color via dual-mix).
    // Previously all volumes used absorptive blend → smoke in FRONT of flame
    // killed transmit before ray reached flame → flame looked dim.
    vec3 emissiveCol = vec3(0.0);
    vec3 absorbCol = vec3(0.0);
    float absorbDens = 0.0;
    for (int j = 0; j < MAX_VOLUMES; j++) {
      if (j >= u_volumeCount) break;
      vec4 kc  = u_volumeKindCenter[j];
      vec4 sd  = u_volumeSizeDensity[j];
      vec4 col = u_volumeColor[j];
      vec4 loc = volumeLocalPos(p, kc.yzw, sd.xyz);
      if (loc.w > 0.05) continue;
      int kind = int(kc.x + 0.5);
      float d = 0.0;
      bool isEmissive = false;
      if (kind == 0)      { d = smokeDensity(loc.xyz, col.w, u_time); }
      else if (kind == 1) { d = flameDensity(loc.xyz, col.w, u_time); isEmissive = true; }
      else if (kind == 2) { d = fogDensity(loc.xyz, col.w, u_time); }
      else                { d = godRayDensity(loc.xyz, col.w, u_time); isEmissive = true; }
      d *= sd.w;
      if (d <= 0.001) continue;
      if (isEmissive) {
        emissiveCol += col.rgb * d;
      } else {
        absorbCol += col.rgb * d;
        absorbDens += d;
        // Sprint 6: sun fog flare. Forward-Mie scatter through fog volume —
        // when the eye ray points near the sun, fog particles scatter sunlight
        // back toward the camera. Peaked at sun direction, falls off sharply.
        // Only applies to fog (kind=2); smoke is too opaque, flame already emits.
        if (kind == 2 && sunDir.y > -0.05) {
          float sunAlign = max(dot(rd, sunDir), 0.0);
          // Henyey-Greenstein-ish forward lobe (g ~ 0.7). pow(x, 16) is the
          // cheap approximation. Magnitude tuned so distant fog with sun
          // dead-ahead lights up like a god-ray cone without blowing out.
          float mie = pow(sunAlign, 16.0);
          emissiveCol += vec3(1.0, 0.85, 0.55) * mie * d * 2.5;
        }
      }
    }
    // Emissive contribution: pure additive, no opacity reduction. Multiplied
    // by transmit so light from emissive volume behind opaque smoke is dimmed
    // (physically correct: you can't see through opaque dust).
    if (length(emissiveCol) > 0.001) {
      acc += transmit * emissiveCol * dt;
    }
    // Absorptive contribution: standard Beer-Lambert blend.
    if (absorbDens > 0.001) {
      vec3 c = absorbCol / absorbDens;
      float a = 1.0 - exp(-absorbDens * dt * 1.5);
      acc += transmit * a * c;
      transmit *= (1.0 - a);
    }
    t += dt;
  }
  return vec4(acc, transmit);
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
    // Stars overlay — twilight/night only (masked by sun altitude). Layered
    // before clouds so clouds cover stars (correct depth order).
    col = atlasStarsOverlay(col, rd, sunDir, u_time);
    // Volumetric cloud overlay (robobo1221-inspired, sky-only). Returns the
    // sky color unchanged when looking down; mixes in clouds for rays going
    // up. Lit by sunDir + warm sun palette matching the sky() horizon glow.
    col = atlasCloudOverlay(col, rd, sunDir, gl_FragCoord.xy, u_time);
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
    vec3 base = vec3(0.0);
    float metalK = 0.0;
    float glowK = 0.0;
    bool isSea = false;         // material.kind == 'sea'         (tone.y ~ 1)
    bool isMountain = false;    // material.kind == 'mountain'    (tone.y ~ 2)
    bool isEmissive = false;    // material.kind == 'emissive'    (tone.y ~ 3)
    bool isTranslucent = false; // material.kind == 'translucent' (tone.y ~ 4)
    bool isSnowy = false;       // material.kind == 'snowy'       (tone.y ~ 5)
    vec4 leafMat, leafTone, leafPat;
    if (matId > 1.5) {
      fetchLeafData(hitIdx, leafMat, leafTone, leafPat);
      // Route by material kind. tone.y carries an integer-encoded kind.
      // Check higher kinds first (5 > 4 > 3 > 2 > 1 > 0).
      if (leafTone.y > 4.5) {
        isSnowy = true;
        base = hsv2rgb(vec3(leafMat.x, leafMat.y, leafTone.x));
        metalK = leafMat.z;
        glowK  = leafMat.w;
      } else if (leafTone.y > 3.5) {
        isTranslucent = true;
        base = hsv2rgb(vec3(leafMat.x, leafMat.y, leafTone.x));
        metalK = leafMat.z;
        glowK  = leafMat.w;
      } else if (leafTone.y > 2.5) {
        isEmissive = true;
        base = hsv2rgb(vec3(leafMat.x, leafMat.y, leafTone.x));
        glowK  = leafMat.w;
      } else if (leafTone.y > 1.5) {
        isMountain = true;
      } else if (leafTone.y > 0.5) {
        isSea = true;  // skip Lambert; handled in sea-shading block below
      } else if (leafMat.y < 0.0) {
        base = cosPalette(fract(hitIdx * 0.6180339887));
      } else {
        // Full HSV from material LUT + value from tone LUT. value < 1.0
        // produces actually-dark colors (matte-black, brick, etc.) which
        // hue+sat alone cannot.
        base = hsv2rgb(vec3(leafMat.x, leafMat.y, leafTone.x));
        metalK = leafMat.z;
        glowK  = leafMat.w;
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
    // leafPat was already fetched above in the combined fetchLeafData call.
    if (matId > 1.5 && !isSea && !isMountain && leafPat.x > 0.5) {
      base = applyPattern(base, p, n, leafPat);
    }

    if (isSea) {
      // ---- Sea-shading branch (afl_ext-inspired, MIT) -----------------------
      // Replaces the entire Lambert path for sea-surface hits. Reads the same
      // sea height function as the SDF tracer so the normal matches the
      // surface exactly; samples atmosphere for reflection + sun glint;
      // mixes in subsurface scattering proportional to crest height.
      float seaDist = length(p - ro);
      float seaEps = max(0.01, seaDist * 0.001);
      vec3 seaN = atlasSeaNormal(p.xz, seaEps, 1.0, 0.6, u_time);
      // Smooth normal with distance to kill far-field high-frequency noise
      // (otherwise the horizon shimmers with aliased crests).
      seaN = mix(seaN, vec3(0.0, 1.0, 0.0), 0.8 * min(1.0, sqrt(seaDist * 0.005)));

      // Schlick fresnel. F0=0.04 dielectric water. Grazing → 1.0.
      float seaFres = 0.04 + 0.96 * pow(1.0 - max(0.0, dot(-rd, seaN)), 5.0);

      // Reflect ray; force upward bounce so we always sample sky hemisphere.
      vec3 R = reflect(rd, seaN);
      R.y = abs(R.y);
      vec3 reflection = atlasSeaAtmosphere(R, sunDir) + vec3(1.0) * atlasSeaSun(R, sunDir);

      // Scene reflection — short raymarch in R direction picks up nearby
      // emissive geometry (canal lamps, lit windows). The shimmering reflected
      // streetlamp is the iconic Venice-canal look; without it, sea is just
      // atmospheric. Limited to 12-unit reach to keep cost bounded.
      if (u_reflectOn > 0.5) {
        vec3 hit2 = raymarchShort(p + seaN * 0.02, R, 25.0);
        if (hit2.y > 0.5) {
          vec3 p2 = p + seaN * 0.02 + R * hit2.x;
          vec3 reflScene = shadeReflection(p2, R, hit2.y, hit2.z, sunDir);
          // Scene reflection brightness scales with fresnel — mostly visible
          // at grazing angles where seaFres → 1, which is also where lamp
          // reflections naturally appear on real water.
          reflection += reflScene * 0.9;
        }
      }

      // Subsurface scattering — bluish tint modulated by crest height.
      // Crest pixels show more scattering than troughs (more water above
      // sub-surface backscatter source).
      float crestK = clamp(0.2 + (p.y + 1.0) * 0.5, 0.0, 1.0);
      vec3 scattering = vec3(0.0293, 0.0698, 0.1717) * 0.1 * crestK;

      // 2026-05-24 fix (after lake-district screenshot showed tan/desert-looking
      // water on top-down aerial view): add explicit lake/water albedo so the
      // low-fresnel (steep viewing angle) case still shows recognizable water
      // color. The afl_ext atmosphere reflection is designed for grazing-angle
      // ocean rays (camera near sea level); for aerial views Fresnel ≈ 0.04
      // making 'reflection * fres' near-black and post-FX bleed fills it with
      // sky color. Mixing reflection toward a teal-cyan base by (1-fres) keeps
      // top-down water visibly blue while preserving grazing-angle reflectivity.
      vec3 waterAlbedo = vec3(0.04, 0.15, 0.22);   // dark teal lake / coastal water
      col = mix(waterAlbedo, reflection, seaFres) * 1.6 + scattering;
    } else if (isEmissive) {
      // Emissive: bypass lighting equation. Color = base * (1 + 4*glow). Used
      // by meteor-streak (warm-white tail, glow ~ 2.0 default). ACES later
      // rolls off the high values for cinematic punch.
      col = base * (1.0 + 4.0 * glowK);
      // Atmospheric perspective still applies — distant meteors fade into sky
      float emFog = atmosphereDensity(p, t);
      col = mix(col, sky(rd, sunDir), emFog * 0.4);
    } else if (isTranslucent) {
      // Translucent: standard Lambert + Henyey-Greenstein backlight. When sun
      // is behind the surface, rd aligns with sunDir → HG phase peaks → leaf
      // glows red-warm. Recipe from soft-servo/jake 'Tree in the wind' (no
      // source copy — independent HG phase derivation from IQ formula).
      vec3 sunCol = vec3(1.05, 0.96, 0.84);
      vec3 skyCol = vec3(0.50, 0.62, 0.84);
      float diffT = max(dot(n, toLight), 0.0);
      // Backlight via HG phase. g=0.5 = forward-skewed scattering. albedo²
      // gives the saturated tint that real translucent foliage shows. Mask by
      // shadowK so backlit-but-shadowed leaves don't bloom.
      float cosA = clamp(dot(sunDir, -rd), -1.0, 1.0);
      float g = 0.5;
      float k = 1.55*g - 0.55*g*g*g;
      float f = 1.0 - k * cosA;
      float hgPhase = (1.0 - k*k) / (12.5664 * f * f);
      vec3 backlight = hgPhase * shadowK * base * base * sunCol * 4.0;
      vec3 lit = base * sunCol * diffT * shadowK * 1.05
               + base * skyCol * skyL * ao * 0.40
               + backlight;
      float tFog = atmosphereDensity(p, t);
      col = mix(lit, sky(rd, sunDir), tFog);
    } else if (isSnowy) {
      // ---- Snowy material kind (IQ Snow Bridge recipe-only port) -----------
      // Standard Lambert with the underlying base color, then blend snow on top
      // of upward-facing patches with noise coverage + cosine micro-normal
      // sparkle specular. Use on bridges / statues / buildings / branches for
      // fresh-snow look. Mountain kind has its OWN snow line (altitude-based);
      // snowy is for low-altitude objects (y < 20).
      vec3 sunCol = vec3(1.05, 0.96, 0.84);
      vec3 skyAmbient = sky(n, sunDir) * 0.55;
      float diffS = max(dot(n, toLight), 0.0);
      // Underlying material Lambert
      vec3 litBase = base * sunCol * diffS * shadowK * 1.15
                   + base * skyAmbient * skyL * ao * 0.55;

      // Snow coverage: upward-facing + noise-patched
      float snowFlat = smoothstep(0.45, 0.85, n.y);
      float patchNoise = fbm3_lite(p * 0.45);
      float snowK = mix(snowFlat, 0.9, 0.75 * smoothstep(0.1, 1.0, patchNoise));

      // Snow base color — near-white with slight cool tint, plus fine fbm
      float snowVar = fbm3_lite(p * 3.5) * 0.5 + 0.5;
      vec3 snowCol = mix(vec3(0.80, 0.83, 0.88), vec3(0.94, 0.96, 1.00), snowVar);
      // Snow Lambert (full sun, slight blue ambient)
      vec3 snowLit = snowCol * sunCol * diffS * shadowK * 1.25
                   + snowCol * vec3(0.48, 0.58, 0.78) * 0.45 * ao;

      // Sparkle spec from cosine micro-normal (cheap fake of snow crystal facets)
      vec3 cnor = normalize(n + 0.4 * vec3(
        fbm3_lite(p * 8.0 + vec3(11.0, 0.0, 0.0)) - 0.5,
        abs(fbm3_lite(p * 8.0 + vec3(0.0, 11.0, 0.0)) - 0.5),
        fbm3_lite(p * 8.0 + vec3(0.0, 0.0, 11.0)) - 0.5));
      float spark = pow(max(dot(reflect(rd, cnor), sunDir), 0.0), 18.0);
      snowLit += snowK * spark * vec3(1.0, 0.97, 0.88) * 0.7 * shadowK;

      // Mix material Lambert with snow Lambert by snowK
      vec3 lin = mix(litBase, snowLit, snowK);

      // Subtle fresnel rim
      lin += vec3(0.55, 0.66, 0.78) * rim * ao * 0.10;

      float snFog = atmosphereDensity(p, t);
      col = mix(lin, sky(rd, sunDir), snFog * 0.7);
    } else if (isMountain) {
      // ---- Mountain-shading branch (Sprint A2: 4-layer altitude/normal blend) ----
      // Kolaczynski-style terrainColor: rock base → ground (low) → grass (mid +
      // gentle slopes) → snow (high + gentle slopes). Each layer modulated by
      // normal.y so steep cliffs stay rock no matter altitude (correct alpine
      // geology — rock is exposed where it's too steep for soil to settle).
      // Plus IQ outdoor 3-light + slope-AO + height-fog from earlier mountain
      // branch — those parts unchanged.

      // Slope and altitude factors used by all layers.
      float slopeUp = clamp(n.y, 0.0, 1.0);                 // 1 = flat, 0 = vertical cliff
      float yPos    = p.y;

      // fbm color variation — coarse mottling per layer (no IBL needed)
      float texVar = fbm3_lite(p * 0.4);
      float fineVar = fbm3_lite(p * 2.0) * 0.5;

      // 2026-05-24 Sprint A5 (Canyon ship): rock + ground layers respect
      // material HSV hue/sat as a tint, so terrain-canyon (red sandstone) and
      // future colored-terrain primitives can override the default gray-brown
      // without renderer code changes. Sat near 0 → tint is white → no change
      // (backward-compat with existing mountain auto-attach hue=0.6 sat=0.05).
      vec3 rockTint = hsv2rgb(vec3(leafMat.x, leafMat.y, 1.0));

      // Layer 1: ROCK (base, always present, mottled gray-brown × tint)
      vec3 rockCol = mix(vec3(0.16, 0.14, 0.13), vec3(0.28, 0.24, 0.20), texVar) * rockTint;
      vec3 baseCol = rockCol;

      // Layer 2: GROUND (low altitude, brown-tan × tint). Below y=2, gentle slopes.
      vec3 groundCol = mix(vec3(0.30, 0.22, 0.14), vec3(0.42, 0.32, 0.20), texVar) * rockTint;
      float groundK = (1.0 - smoothstep(-4.0, 6.0, yPos)) * smoothstep(0.25, 0.55, slopeUp);
      baseCol = mix(baseCol, groundCol, groundK);

      // Layer 3: GRASS (mid altitude, gentle slopes, dark forest green with mottling).
      // NOT tinted — grass is always green regardless of rock color.
      vec3 grassCol = mix(vec3(0.10, 0.22, 0.06), vec3(0.20, 0.36, 0.10), texVar);
      float grassK = smoothstep(-1.0, 6.0, yPos) * (1.0 - smoothstep(12.0, 22.0, yPos))
                   * smoothstep(0.55, 0.85, slopeUp);
      baseCol = mix(baseCol, grassCol, grassK);

      // Layer 4: SNOW (high altitude, gentle slopes, near-white with sun tint)
      vec3 snowCol = mix(vec3(0.86, 0.88, 0.94), vec3(0.96, 0.97, 1.00), fineVar);
      float snowAlt  = smoothstep(20.0, 38.0, yPos);
      float snowSlope = smoothstep(0.55, 0.85, slopeUp);
      // Sun-facing bias — slopes facing the sun accumulate more snow
      float snowSunBias = 0.5 + 0.5 * smoothstep(-0.2, 0.6, dot(n, sunDir));
      float snowK = snowAlt * snowSlope * snowSunBias;
      baseCol = mix(baseCol, snowCol, snowK);

      // ---- Lighting: IQ outdoor 3-light ----
      float diffM    = max(dot(sunDir, n), 0.0);
      float ambM     = clamp(0.5 + 0.5 * n.y, 0.0, 1.0);
      vec3 backDir   = normalize(vec3(-sunDir.x, 0.0, -sunDir.z));
      float backM    = max(0.5 + 0.5 * dot(backDir, n), 0.0);
      // Fresnel rim on rock + ground edges (silhouette pop for distant peaks)
      float fresM = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);

      vec3 mountSun  = vec3(1.05, 0.96, 0.84);
      vec3 mountSky  = sky(n, sunDir) * 0.55;  // Sprint 6: procedural-IBL ambient
      vec3 mountBack = vec3(0.40, 0.50, 0.60);

      // Asymmetric shadow color split (IQ Elevated trick): sun shadow tinted
      // warm-orange in R, cooler-orange G, cool-blue B. Without this, mountain
      // shadows look uniformly dark; with it they have aerial-perspective hue.
      vec3 sunDiffuse = vec3(1.05, 0.96, 0.84) * 1.3
                       * vec3(shadowK, shadowK*shadowK*0.5+0.5*shadowK, shadowK*shadowK*0.8+0.2*shadowK);
      vec3 mountLin = diffM * sunDiffuse;
      mountLin += (ao * ambM * 0.55) * mountSky;
      mountLin += (backM * 0.28) * mountBack;

      // ---- Snow Schlick highlight (IQ Elevated idiom) ----
      // Schlick-Fresnel spec with F0=0.04 dielectric → snow grazing angles
      // glint white-gold. Only fires where snowK > 0 + sun-aligned half-vector.
      vec3 halfV = normalize(sunDir - rd);
      float schlick = 0.04 + 0.96 * pow(clamp(1.0 + dot(halfV, rd), 0.0, 1.0), 5.0);
      mountLin += (0.7 + 0.3 * snowK) * schlick * vec3(7.0, 5.0, 3.0) * 0.30 * diffM * shadowK
                * pow(clamp(dot(n, halfV), 0.0, 1.0), 16.0);

      // ---- Snow Fresnel rim — subsurface translucency at grazing angles ----
      // Snow at the silhouette edge picks up sky reflection through subsurface
      // scattering. cos⁴ falloff with ref.y bias (only upward-reflecting rims
      // glow — physically correct).
      vec3 refR = reflect(rd, n);
      mountLin += snowK * 0.65 * pow(fresM, 1.0) * vec3(0.3, 0.5, 0.6)
                * smoothstep(0.0, 0.6, refR.y);

      // Lower-altitude fresnel rim (rock + ground edge pop for distant peaks)
      mountLin += vec3(0.55, 0.66, 0.78) * fresM * ao * 0.18 * (1.0 - snowK);

      col = baseCol * mountLin;

      // Height-based atmospheric fog (IQ idiom). Distant peaks fade into sky.
      // 2026-05-24: dialed fogC 0.50 → 0.28 + fogB 0.018 → 0.012 + clamp 0.85 →
      // 0.65 after jet-aircraft test reported "雾气太大看不清地形". Distant peaks
      // still atmospheric but mid-distance reads cleanly.
      float mountDist = length(p - ro);
      float fogB = 0.012;
      float fogC = 0.28;
      float rdy = max(abs(rd.y), 0.01) * sign(rd.y + 1e-4);
      float fogAmt = fogC * (1.0 - exp(-mountDist * rdy * fogB)) / rdy;
      fogAmt = clamp(fogAmt, 0.0, 0.65);
      col = mix(col, sky(rd, sunDir), fogAmt);
    } else {
      // Procedural surface texture (Hoskins fbm). Gated by "plasticness":
      // metals + emissives keep smooth uniform surfaces; matte diffuse gets
      // ±10% albedo variance to break up plastic-looking uniformity. The
      // 6.0 scale gives ~6 visible bumps per world unit — good for stone /
      // wood / brick at typical camera distance.
      float plasticGate = (1.0 - metalK) * (1.0 - smoothstep(0.0, 0.5, glowK));
      float texDetail = fbm3_lite(p * 6.0);
      base *= mix(1.0, 0.82 + 0.36 * texDetail, plasticGate * 0.7);

      // Light colors. Sprint 6: ambient sky color is sampled from procedural
      // sky() in the surface-normal direction (procedural IBL irradiance) —
      // upward-facing surfaces get zenith blue, lateral get horizon tint, and
      // at golden hour all ambient warms naturally. Replaces fixed constant.
      vec3 sunCol    = vec3(1.05, 0.96, 0.84);
      vec3 skyCol    = sky(n, sunDir) * 0.55;
      vec3 bounceCol = vec3(0.55, 0.48, 0.40);
      vec3 rimCol    = sky(normalize(n + vec3(0.0, 0.4, 0.0)), sunDir) * 0.7;

      // Compose lighting. Metal suppresses diffuse + tints specular toward
      // base color (the canonical metal/non-metal split). Glow adds emissive
      // last, unshadowed.
      float diffK = 1.0 - 0.85 * metalK;
      vec3  specTint = mix(vec3(1.0), base, metalK);
      float specBoost = 0.45 + 1.8 * metalK;

      vec3 lin = vec3(0.0);
      lin += base * sunCol    * diff * shadowK * 1.35 * diffK;
      lin += base * skyCol    * skyL * ao      * 0.55 * diffK;
      lin += base * bounceCol * bnc  * ao      * 0.18 * diffK;
      lin += specTint * sunCol * spec * shadowK * specBoost;
      lin += rimCol * rim * ao                 * 0.22;

      // Sprint 6: procedural-IBL env reflection. For metallic objects, sample
      // sky() in the reflection direction as the environment map. Free (no
      // cubemap), updates automatically with sun. Sky already handles sun
      // disk + halo so chrome / gold pick up the bright sun reflection.
      // Dielectrics also get a weak env reflection (Schlick F0=0.04) — gives
      // glass / polished stone / wet leaves a subtle sheen that fixed constants
      // never had. Skipped on ground (handled by raymarchShort reflection below).
      if (matId > 1.5) {
        vec3 R = reflect(rd, n);
        vec3 envRefl = sky(R, sunDir);
        float F0 = mix(0.04, 1.0, metalK);
        float fres = F0 + (1.0 - F0) * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 envTint = mix(envRefl, envRefl * base, metalK * 0.7);
        // Stronger for metals (chrome is mostly mirror), subtle for dielectrics.
        lin = mix(lin, envTint, fres * (0.35 + 0.45 * metalK));
      }

      // Sprint 6: emissive-volume point lights. Flame + god-ray volumes light
      // nearby surfaces (rocket exhaust lights up the pad, god-rays warm the
      // foreground). Pre-shadow contribution — we don't shadow-march these
      // for performance, the inverse-square falloff handles occlusion roughly.
      lin += emissiveVolumeLight(p, n, base, metalK);

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
  }

  // In-shader sun-position lens flares (octagon SDF + 8-blade starburst),
  // anchored on sun screen position. Kept HDR-side so they tonemap naturally
  // and stack with postfx's bloom-derived RGB-shifted ghost flares.
  col = atlasLensFlares(col, uv, sunDir);

  // Sprint 3: volume pass — integrate smoke/flame/fog/god-ray density along the
  // eye ray, blend into the surface color. tMax = the surface hit distance (t)
  // or MAX_DIST for sky pixels. Volume contribution is added BEFORE post-FX so
  // bloom can boost emissive flame voxels and DoF can blur the volume.
  // Skip volumes in blueprint mode — they're atmospheric, not schematic.
  if (u_volumeCount > 0 && u_blueprintMode < 0.5) {
    float volTMax = hit ? t : MAX_DIST;
    vec4 volRes = applyVolumes(ro, rd, volTMax, sunDir);
    col = col * volRes.a + volRes.rgb;
  }

  // Sprint 8: Blueprint-as-shot. Replace the entire HDR color with a technical
  // schematic look — silhouette outline + light fill on dark graph paper.
  // Triggered when cameraSequence current shot has renderer='blueprint'.
  if (u_blueprintMode > 0.5) {
    // Graph-paper background. Dark blue base + faint grid lines + subtle vignette.
    vec2 gridUV = gl_FragCoord.xy / max(u_resolution.y, 1.0) * 20.0;
    float gridX = smoothstep(0.0, 0.04, abs(fract(gridUV.x) - 0.5));
    float gridY = smoothstep(0.0, 0.04, abs(fract(gridUV.y) - 0.5));
    float grid = min(gridX, gridY);  // 0 ON grid line, 1 between
    vec3 bgDark   = vec3(0.04, 0.07, 0.13);
    vec3 bgLine   = vec3(0.10, 0.18, 0.30);
    vec3 bp = mix(bgLine, bgDark, grid);

    if (hit) {
      // Silhouette edge: angle between view ray and surface normal. Near-edge
      // → dot small → bright outline. Two-tier: thin sharp outer + softer inner.
      vec3 Vbp = -rd;
      float ndv = max(dot(calcNormal(ro + rd * t), Vbp), 0.0);
      float outline = 1.0 - smoothstep(0.0, 0.35, ndv);
      // Light surface fill — slight shading toward camera, white-blue tint.
      vec3 fillCol = vec3(0.62, 0.78, 0.95);
      vec3 lineCol = vec3(0.92, 0.96, 1.00);
      bp = mix(fillCol, lineCol, outline);
      // Add a darker silhouette ring on top for definition.
      bp = mix(bp, lineCol, smoothstep(0.92, 1.0, outline) * 0.6);
    }
    col = bp;
  }

  // Sprint 2 (2026-05-24): HDR-output sanitation. rgba16f preserves NaN/Inf
  // which propagates through bloom Gaussian + DoF taps and explodes as black
  // rectangles on canvas (~30-40 px each). Replace NaN per-channel with 0,
  // cap to [0, 100] to avoid float16 overflow producing Inf downstream.
  if (col.r != col.r) col.r = 0.0;
  if (col.g != col.g) col.g = 0.0;
  if (col.b != col.b) col.b = 0.0;
  col = clamp(col, vec3(0.0), vec3(100.0));

  // Sprint 1 (2026-05-24): write HDR linear color + depth in alpha to FBO.
  // ACES tonemap / vignette / bloom / RGB-ghost flare / gamma / DoF moved to
  // postfx.js composite pass — scene shader's job is just spectrally-correct
  // HDR + linear depth. ATLAS_MAX_DIST in postfx.js must match MAX_DIST here.
  // Sky pixels get alpha=1.0 (max depth) so DoF doesn't blur sky against itself.
  float depthNorm = hit ? clamp(t / MAX_DIST, 0.0, 1.0) : 1.0;
  gl_FragColor = vec4(col, depthNorm);
}`;
}

// =============================================================================
// Controller
// =============================================================================

// 2026-05-23 perf: render the scene shader at lower internal resolution
// (renderScale × canvas) and upsample to the canvas via a trivial blit pass.
// At 900×900 canvas, default scale 0.6 = 540×540 internal = 36% the fragment
// cost (with MAX_STEPS=200 + Lambert+LUT+reflection+sky+AA per pixel, this is
// the difference between smooth 60fps and choppy 20fps on a fleet scene).
// Adjust upward (closer to 1.0) for sharper detail at perf cost.
export function createFly3DRenderer({ canvas, getControls, onCamUpdate, onFps, renderScale = 0.6 }) {
  // Sprint 1 (2026-05-24): WebGL2 + EXT_color_buffer_float required for HDR
  // rgba16f scene FBO. Fallback to WebGL1 is intentionally NOT provided — once
  // FLY 3D adopts HDR pipeline, the post-FX shader's tonemap/bloom/DoF math
  // depends on linear HDR input. Without rgba16f we'd silently clamp at 1.0
  // and the cinematic look would degrade to "old fly3d but worse". Better to
  // surface a clear error than ship a broken-looking renderer.
  const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: false });
  if (!gl) {
    throw new Error('[fly3d] WebGL2 not supported (Sprint 1+ requires WebGL2 for HDR pipeline). ' +
      'Update browser or fall back to BOB GPU renderer.');
  }
  const colorBufferFloatExt = gl.getExtension('EXT_color_buffer_float');
  if (!colorBufferFloatExt) {
    throw new Error('[fly3d] EXT_color_buffer_float not supported (rgba16f FBO unavailable). ' +
      'Update GPU driver or fall back to BOB GPU renderer.');
  }
  // OES_texture_float_linear lets the bloom FBO be sampled with LINEAR
  // filtering (smooth upsample). If missing, postfx falls back to NEAREST
  // and bloom looks blocky but doesn't crash.
  gl.getExtension('OES_texture_float_linear');

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
  // Sprint 2 (2026-05-24): pending deferred render — see render() comments.
  // Heavy GPU compile is rAF-deferred so the cleared canvas paints first.
  let pendingRender = null;
  // Wall-clock origin for u_time uniform (in seconds). Drives time-aware
  // SDF primitives like sdWaves (sea surface animation). Reset on first
  // render() call so each new scene starts at t=0.
  let timeStart = performance.now();
  // Shader program cache — key = GLSL source string, value = compiled+linked
  // WebGL program. Switching renderers (BOB GPU → FLY 3D) or back to a scene
  // we've already compiled hits cache instead of recompiling (which can take
  // 200-500ms on complex scenes — the BIG source of perceived page lag).
  const programCache = new Map();
  const PROGRAM_CACHE_MAX = 6;
  // Per-leaf material + pattern LUTs — built at uploadSDF time from
  // compileSDF3ToGLSL() output. Float32Arrays of MAX_MATERIAL * 4. Sentinels:
  //   materialLUT[i*4+1] = -1   → no material, shader uses hash palette
  //   patternLUT[i*4+0]  = 0    → no pattern, shader skips applyPattern
  // 2026-05-24: bumped to 256 to match the shader-side cap. See uniform array
  // declarations + the rationale comment near `uniform vec4 u_leafMaterial`.
  const MAX_MATERIAL = 256;
  const materialLUT = new Float32Array(MAX_MATERIAL * 4);
  const toneLUT     = new Float32Array(MAX_MATERIAL * 4);
  const patternLUT  = new Float32Array(MAX_MATERIAL * 4);

  // Sprint 3 volume LUTs — 3 vec4 slots per volume (kindCenter / sizeDensity / color)
  // up to MAX_VOLUMES=12 (matches shader). Re-uploaded per render() via setVolumes().
  const MAX_VOLUMES = 12;
  const volumeKindCenterLUT  = new Float32Array(MAX_VOLUMES * 4);
  const volumeSizeDensityLUT = new Float32Array(MAX_VOLUMES * 4);
  const volumeColorLUT       = new Float32Array(MAX_VOLUMES * 4);
  // Sprint 6: heat-haze flame positions (xyz, radius) for postfx composite.
  // Mirrors MAX_HEAT_HAZE = 8 in postfx.js. Packed each frame from the active
  // flame subset of the volume LUTs.
  const heatHazeLUT = new Float32Array(8 * 4);
  let activeVolumeCount = 0;
  // Volume metadata (JS-side only; not uploaded as uniform). Per slot:
  //   { id, attachTo?, sceneStateKey?, baseDensity, baseGlow, baseColor[3] }
  // Used per frame to compute the actual uploaded values from base × scene-state
  // multiplier + the attachTo subject offset.
  const volumeMeta = new Array(MAX_VOLUMES).fill(null);

  // Sprint 4: per-subject motion offset (compile output tells us subjectId →
  // slot; evaluator gives us subjectId → offset per frame; we map by slot here).
  const MAX_SUBJECT_MOTION = 4;
  const subjectOffsetLUT = new Float32Array(MAX_SUBJECT_MOTION * 3);
  let activeMotionSlots = {};  // { subjectId: slot } — set by setMotionSlots()
  let subjectBaseTargets = {}; // { subjectId: [x, y, z] } — set by setSubjectBaseTargets()

  // ---- one-time vbuf + vs ----
  const vbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vs = compileShader(VS_SRC, gl.VERTEX_SHADER);

  // ---- 2026-05-23 perf + Sprint 1 HDR pipeline -----------------------------
  // The scene shader is expensive (Lambert + LUT lookups + Schlick reflection +
  // stochastic AA + IQ sky + height fog). At 900² it's ~810K fragments/frame.
  // We render to a smaller FBO (e.g. 540² at scale=0.6 = 36% the work) and
  // composite to canvas via postfx pipeline.
  //
  // Sprint 1: FBO is now rgba16f (HDR linear color + linear depth in alpha)
  // instead of RGBA8. Tonemap moved from scene shader → postfx composite.
  let sceneFbo = null, sceneTex = null;
  let sceneFboW = 0, sceneFboH = 0;

  // (Re)allocate the offscreen FBO when canvas size or renderScale changes.
  function ensureSceneFbo() {
    const targetW = Math.max(1, Math.floor(canvas.width  * renderScale));
    const targetH = Math.max(1, Math.floor(canvas.height * renderScale));
    if (sceneFbo && targetW === sceneFboW && targetH === sceneFboH) return;
    if (sceneFbo) gl.deleteFramebuffer(sceneFbo);
    if (sceneTex) gl.deleteTexture(sceneTex);
    sceneTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    // HDR: rgba16f (half float). Internal RGBA16F, format RGBA, type HALF_FLOAT.
    // EXT_color_buffer_float (probed above) guarantees this is renderable.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, targetW, targetH, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    sceneFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('[fly3d] scene HDR FBO incomplete (rgba16f issue?)');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    sceneFboW = targetW;
    sceneFboH = targetH;
  }
  ensureSceneFbo();

  // ---- Sprint 1 post-FX pipeline (bloom pre-pass + composite) --------------
  const postfx = createPostFxPipeline(gl, vbuf, { bloomWidth: 320, bloomHeight: 240 });
  // Per-scene post-FX params; compositor patches via setPostFx() when loading
  // a SceneData with defaults.postFx / camera.aperture.
  let activePostFx = { ...DEFAULT_POSTFX };

  // ---- Sprint 2 cinematic camera sequence ----------------------------------
  // When non-null, drives camState per frame from a timeline (overrides WASD
  // fly camera until user explicitly takes back via fly keys / mouse).
  let activeSequence = null;
  let sequenceStartTime = 0;  // performance.now() origin for sequence playback
  let sequencePaused = false;
  let sequencePausedAt = 0;
  let userTookCam = false;    // any WASD/mouse input flips this; resume needs explicit setSequence(scene)
  // Previous-frame camera state — fed to postfx motion blur reproject. Stored
  // in WORLD-SPACE basis (pos + fwd + right + up + fov) so the shader can
  // compute "where would this pixel have been on screen one frame ago?".
  // Updated AT END of every draw() call.
  const prevCam = {
    pos: [0, 0, 0], fwd: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0], fov: 25,
  };
  let prevCamValid = false;  // first frame: no prev → motion blur skipped

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

    const fragSource = buildFragmentShader(result.glsl);
    return uploadCompiledFrag(fragSource, result);
  }

  // 2026-05-24: split out so render() can compile GLSL sync (for instant byte
  // count) but defer GPU shader upload to next rAF (so cleared canvas paints
  // before the 200-500ms compile blocks the main thread).
  // `result` carries leafMaterials + leafPatterns + glsl for LUT upload.
  function uploadCompiledFrag(fragSource, result) {
    // Program cache: hit avoids the 200-500ms GLSL compile+link that
    // dominates "switch from BOB GPU to FLY 3D" perceived latency.
    // 2026-05-24: cache entry now carries the FS too. WebGL deleteProgram does
    // NOT release attached shaders — without explicit detach + deleteShader on
    // eviction, every FS leaks (~1MB of GLSL bytecode each). Over many scene
    // swaps that's real GPU memory pressure.
    let entry = programCache.get(fragSource);
    let cacheHit = false;
    if (entry) {
      cacheHit = true;
    } else {
      let fs;
      try {
        fs = compileShader(fragSource, gl.FRAGMENT_SHADER);
      } catch (e) {
        console.error('Fragment shader source was:\n', fragSource);
        throw new Error(`GLSL shader compile failed: ${e.message}`);
      }
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(`Program link failed: ${gl.getProgramInfoLog(prog)}`);
      }
      // LRU eviction — drop oldest cached program if at capacity. Crucial:
      // detach + delete the FS attached to the old program; otherwise the FS
      // outlives the program and leaks. The VS is shared across all programs
      // so we do NOT delete it.
      if (programCache.size >= PROGRAM_CACHE_MAX) {
        const firstKey = programCache.keys().next().value;
        const old = programCache.get(firstKey);
        gl.detachShader(old.prog, vs);
        gl.detachShader(old.prog, old.fs);
        gl.deleteShader(old.fs);
        gl.deleteProgram(old.prog);
        programCache.delete(firstKey);
      }
      entry = { prog, fs };
      programCache.set(fragSource, entry);
    }

    program = entry.prog;

    gl.useProgram(program);
    const a_pos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(a_pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

    uniformsCache = {};
    for (const name of [
      'u_resolution', 'u_camPos', 'u_camFwd', 'u_camRight', 'u_camUp', 'u_focal',
      'u_lightPos', 'u_shadowsOn', 'u_groundOn', 'u_checkerOn', 'u_reflectOn',
      'u_time',
      'u_leafMaterial[0]', 'u_leafTone[0]', 'u_leafPattern[0]',
      // Sprint 3 volume uniforms
      'u_volumeKindCenter[0]', 'u_volumeSizeDensity[0]', 'u_volumeColor[0]', 'u_volumeCount',
      // Sprint 4 subject motion offset uniform array
      'u_subjectOffset[0]',
      // Sprint 8 Blueprint-as-shot toggle
      'u_blueprintMode',
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
      // tone[1] carries material.kind (0 = standard Lambert, 1 = sea, ...).
      // The renderer's sea-shading branch reads this to decide whether to
      // route a hit through Lambert or through the fresnel+atmosphere path.
      toneLUT[i * 4 + 1] = m.kind ?? 0;
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

    // Upload LUTs ONCE per program load. Uniforms persist on the program
    // object across draw calls, so re-uploading per frame is pure waste
    // (3 × uniform4fv × 96 vec4 = ~1KB upload/frame + driver call overhead).
    if (uniformsCache['u_leafMaterial[0]'] != null) {
      gl.uniform4fv(uniformsCache['u_leafMaterial[0]'], materialLUT);
    }
    if (uniformsCache['u_leafTone[0]'] != null) {
      gl.uniform4fv(uniformsCache['u_leafTone[0]'], toneLUT);
    }
    if (uniformsCache['u_leafPattern[0]'] != null) {
      gl.uniform4fv(uniformsCache['u_leafPattern[0]'], patternLUT);
    }

    if (cacheHit) console.log('[fly3d] program cache hit — skipped GLSL compile');
    return result.glsl.length;
  }

  let _debugFirstDraw = true;
  function draw() {
    if (!program) return;
    const c = getControls();

    // ---- Sprint 2: cameraSequence drives camera if present + not overridden ----
    // Evaluator runs every frame (cheap), produces (pos, target, fov, aperture).
    // We mutate camState in-place so all existing pos/yaw/pitch consumers (e.g.
    // onCamUpdate broadcast) see the sequence-driven state.
    let sequenceFov = null;
    let sequenceAperture = null;
    let sequenceFocalDist = null;
    // Sprint 8: per-shot exposure override + renderer override (Blueprint-as-shot).
    let sequenceExposure = null;
    let sequenceShotRenderer = null;
    // Sprint 4: per-frame subject motion offsets + scene-state. Both are
    // produced by the sequence evaluator and feed: (a) subject SDF translate
    // uniform u_subjectOffset[slot], (b) volume center mutation (attachTo),
    // (c) volume density/glow multipliers (sceneStateKey lookup).
    let frameSubjectOffsets = {};
    let frameSceneState = {};
    if (activeSequence && !sequencePaused && !userTookCam) {
      const tSec = (performance.now() - sequenceStartTime) / 1000;
      const state = evaluateCameraSequence(activeSequence, tSec, { subjectBaseTargets });
      if (state) {
        const cs = sequenceStateToCamState(state);
        camState.position[0] = cs.position[0];
        camState.position[1] = cs.position[1];
        camState.position[2] = cs.position[2];
        camState.yaw = cs.yaw;
        camState.pitch = cs.pitch;
        sequenceFov = cs.fov;
        sequenceAperture = cs.aperture;
        sequenceFocalDist = cs.focalDistance;
        if (typeof state.exposure === 'number') sequenceExposure = state.exposure;
        if (state.shotRenderer) sequenceShotRenderer = state.shotRenderer;
        frameSubjectOffsets = state.subjectOffsets || {};
        frameSceneState = state.sceneState || {};
      }
    }

    // Push subject offset LUT (per-slot). Use activeMotionSlots map to place
    // each subject's offset at the right slot. Unassigned slots stay vec3(0).
    for (let i = 0; i < MAX_SUBJECT_MOTION * 3; i++) subjectOffsetLUT[i] = 0;
    for (const id in activeMotionSlots) {
      const slot = activeMotionSlots[id];
      const off = frameSubjectOffsets[id];
      if (slot >= 0 && slot < MAX_SUBJECT_MOTION && off) {
        subjectOffsetLUT[slot*3]   = off.offset[0];
        subjectOffsetLUT[slot*3+1] = off.offset[1];
        subjectOffsetLUT[slot*3+2] = off.offset[2];
      }
    }

    // Per-frame mutate volume LUTs: (a) attachTo subjects offset their center,
    // (b) sceneStateKey scales their density (LUT[slot].w slot in sizeDensity).
    for (let i = 0; i < activeVolumeCount; i++) {
      const meta = volumeMeta[i];
      if (!meta) continue;
      let cx = meta.baseCenter[0], cy = meta.baseCenter[1], cz = meta.baseCenter[2];
      if (meta.attachTo && frameSubjectOffsets[meta.attachTo]) {
        const off = frameSubjectOffsets[meta.attachTo].offset;
        cx += off[0]; cy += off[1]; cz += off[2];
      }
      volumeKindCenterLUT[i*4+1] = cx;
      volumeKindCenterLUT[i*4+2] = cy;
      volumeKindCenterLUT[i*4+3] = cz;
      // sceneStateKey multiplier on density. Allows shot.sceneState.thrusterLevel
      // to scale flame density 0..1 (off / on) without changing the JSON volume.
      let densityMul = 1.0;
      if (meta.sceneStateKey && typeof frameSceneState[meta.sceneStateKey] === 'number') {
        densityMul = frameSceneState[meta.sceneStateKey];
      }
      volumeSizeDensityLUT[i*4+3] = meta.baseDensity * densityMul;
    }

    const fwd = computeFwd(camState.yaw, camState.pitch);
    const right = computeRight(fwd);
    const up = cross(fwd, right);
    const lpos = lightFromSpherical(c.lightAzim, c.lightAlt, c.lightDist);

    // Defensive state reset — WebGL context is shared with other renderers
    // (e.g. bobShader) on the same canvas; their leftover state (FBO binding,
    // depth/blend, vertex attrib pointers) would silently break our draw.
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);

    // === Pass 1: render scene to low-res FBO (renderScale × canvas) ============
    ensureSceneFbo();
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
    gl.useProgram(program);
    const a_pos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(a_pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, sceneFboW, sceneFboH);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniformsCache.u_resolution, sceneFboW, sceneFboH);
    gl.uniform3f(uniformsCache.u_camPos, camState.position[0], camState.position[1], camState.position[2]);
    gl.uniform3f(uniformsCache.u_camFwd, fwd[0], fwd[1], fwd[2]);
    gl.uniform3f(uniformsCache.u_camRight, right[0], right[1], right[2]);
    gl.uniform3f(uniformsCache.u_camUp, up[0], up[1], up[2]);
    // FOV: sequence override > getControls() fallback
    const activeFov = sequenceFov ?? c.fov;
    gl.uniform1f(uniformsCache.u_focal, activeFov);
    gl.uniform3f(uniformsCache.u_lightPos, lpos[0], lpos[1], lpos[2]);
    gl.uniform1f(uniformsCache.u_shadowsOn, c.shadowsOn ? 1.0 : 0.0);
    gl.uniform1f(uniformsCache.u_groundOn,  c.groundOn  ? 1.0 : 0.0);
    gl.uniform1f(uniformsCache.u_checkerOn, c.checkerOn ? 1.0 : 0.0);
    // Reflection defaults ON if caller doesn't supply a flag — wet-floor look
    // is a major visual upgrade. Caller can disable via `controls.reflectOn = false`.
    gl.uniform1f(uniformsCache.u_reflectOn, (c.reflectOn === false) ? 0.0 : 1.0);
    // Sprint 8: Blueprint-as-shot mode toggle (1 when current cameraSequence shot
    // has renderer='blueprint'). Replaces full HDR shading with silhouette-on-
    // graph-paper schematic look. Volumes are skipped in this mode.
    if (uniformsCache.u_blueprintMode != null) {
      gl.uniform1f(uniformsCache.u_blueprintMode, sequenceShotRenderer === 'blueprint' ? 1.0 : 0.0);
    }
    // u_time drives time-aware primitives (sdWaves animation). Without
    // this set, waves were static — sea looked frozen.
    if (uniformsCache.u_time != null) {
      gl.uniform1f(uniformsCache.u_time, (performance.now() - timeStart) / 1000);
    }
    // Sprint 3: volume LUTs. Uploaded per draw because the count + params may
    // change when setVolumes() is called between scene loads. Volume effects
    // typically don't animate per-frame though u_time inside density funcs
    // provides drift / fbm motion.
    if (uniformsCache.u_volumeCount != null) {
      gl.uniform1i(uniformsCache.u_volumeCount, activeVolumeCount);
    }
    if (activeVolumeCount > 0) {
      if (uniformsCache['u_volumeKindCenter[0]'] != null) {
        gl.uniform4fv(uniformsCache['u_volumeKindCenter[0]'], volumeKindCenterLUT);
      }
      if (uniformsCache['u_volumeSizeDensity[0]'] != null) {
        gl.uniform4fv(uniformsCache['u_volumeSizeDensity[0]'], volumeSizeDensityLUT);
      }
      if (uniformsCache['u_volumeColor[0]'] != null) {
        gl.uniform4fv(uniformsCache['u_volumeColor[0]'], volumeColorLUT);
      }
    }
    // Sprint 4: subject motion offset (always upload — defaults to vec3(0) per
    // slot when no subject is at that slot, so a fixed-camera scene is unaffected).
    if (uniformsCache['u_subjectOffset[0]'] != null) {
      gl.uniform3fv(uniformsCache['u_subjectOffset[0]'], subjectOffsetLUT);
    }
    // LUTs are uploaded once per program load in uploadSDF — uniforms persist
    // on the program object, so re-uploading per frame would be pure waste.
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // === Pass 2+3: post-FX composite (bloom + DoF + motion blur + composite) ===
    // Per-frame postfx params start from activePostFx (scene defaults) and
    // get patched with sequence camera overrides (aperture / focalDistance)
    // when a cameraSequence is driving the camera.
    const tSec = (performance.now() - timeStart) / 1000;
    const framePostFx = { ...activePostFx };
    if (sequenceAperture != null) framePostFx.aperture = sequenceAperture;
    if (sequenceFocalDist != null) framePostFx.focalDistance = sequenceFocalDist;
    // Sprint 8: per-shot exposure ramp overrides defaults.postFx.exposure.
    // When shot.exposure is set (number or [from, to]), the evaluator returns
    // the ramped value and we override here. Untouched shots keep the global.
    if (sequenceExposure != null) framePostFx.exposure = sequenceExposure;
    // Current-frame camera basis (for motion blur reproject in postfx)
    framePostFx._curCamPos    = camState.position;
    framePostFx._curCamFwd    = fwd;
    framePostFx._curCamRight  = right;
    framePostFx._curCamUp     = up;
    framePostFx._curCamFov    = activeFov;
    // Previous-frame camera basis (motion blur). First frame has no prev →
    // skip motion blur by sending zero-strength signal.
    framePostFx._prevCamValid = prevCamValid;
    framePostFx._prevCamPos   = prevCam.pos;
    framePostFx._prevCamFwd   = prevCam.fwd;
    framePostFx._prevCamRight = prevCam.right;
    framePostFx._prevCamUp    = prevCam.up;
    framePostFx._prevCamFov   = prevCam.fov;
    // Sprint 6: pack flame volumes into heat-haze LUT for the composite pass.
    // Only kind=1 (flame); god-rays are too diffuse for haze. Reuses the per-
    // frame mutated volumeKindCenterLUT (already includes subject motion).
    let hazeCount = 0;
    for (let i = 0; i < activeVolumeCount && hazeCount < 8; i++) {
      const kind = volumeKindCenterLUT[i * 4];
      if (Math.round(kind) !== 1) continue;
      const cx = volumeKindCenterLUT[i * 4 + 1];
      const cy = volumeKindCenterLUT[i * 4 + 2];
      const cz = volumeKindCenterLUT[i * 4 + 3];
      const sx = volumeSizeDensityLUT[i * 4];
      const sy = volumeSizeDensityLUT[i * 4 + 1];
      const sz = volumeSizeDensityLUT[i * 4 + 2];
      const density = volumeSizeDensityLUT[i * 4 + 3];
      // Skip flames with effectively zero density (sceneStateKey * baseDensity)
      // so pre-ignition rocket has no haze.
      if (density < 0.1) continue;
      heatHazeLUT[hazeCount * 4]     = cx;
      heatHazeLUT[hazeCount * 4 + 1] = cy;
      heatHazeLUT[hazeCount * 4 + 2] = cz;
      heatHazeLUT[hazeCount * 4 + 3] = Math.max(sx, sy, sz);
      hazeCount++;
    }
    framePostFx._heatHazeCount = hazeCount;
    framePostFx._heatHaze = heatHazeLUT;
    postfx.render(sceneTex, sceneFboW, sceneFboH, canvas.width, canvas.height, framePostFx, tSec);

    // ---- End-of-frame: snapshot current camera into prevCam for next draw ----
    prevCam.pos[0] = camState.position[0];
    prevCam.pos[1] = camState.position[1];
    prevCam.pos[2] = camState.position[2];
    prevCam.fwd[0] = fwd[0];   prevCam.fwd[1] = fwd[1];   prevCam.fwd[2] = fwd[2];
    prevCam.right[0] = right[0]; prevCam.right[1] = right[1]; prevCam.right[2] = right[2];
    prevCam.up[0] = up[0];     prevCam.up[1] = up[1];     prevCam.up[2] = up[2];
    prevCam.fov = activeFov;
    prevCamValid = true;

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
      // ---- Step 1: Generate GLSL (CPU only, fast ~5ms) ----
      // Done sync so we can return bytes for the lift-info display.
      const result = compileSDF3ToGLSL(sdf, {
        sceneFnName: 'sceneSDF',
        includeLibrary: true,
        emitObjectIndex: true,
      });
      if (result.error) throw new Error(`compileSDF3ToGLSL: ${result.error}`);
      const fragSource = buildFragmentShader(result.glsl);
      const bytes = fragSource.length;

      // ---- Step 2: Clear canvas to BLACK IMMEDIATELY ----
      // Critical: paint dispatched here is what browser composites if/when c-gpu
      // becomes visible during the deferred phase below. Stopping the old
      // scene from lingering during heavy shader compile.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.flush();

      // ---- Step 3: Defer heavy GPU compile to next animation frame ----
      // Why: GPU shader compile + link can take 200-500ms for FLY 3D's heavy
      // scene shader (cache miss on a new SDF). That work blocks the main
      // thread, preventing the browser from compositing the cleared canvas.
      // Result: user sees the OLD scene the entire compile window.
      //
      // rAF gives the browser a paint cycle BEFORE compile starts. After that
      // cycle, the cleared black canvas is visible. Compile then blocks, but
      // user sees black (correct loading state) instead of stale scene.
      //
      // Cancellation: if a newer render() arrives before pending rAF fires,
      // we cancel the old one to avoid compiling a stale SDF.
      if (pendingRender != null) cancelAnimationFrame(pendingRender);
      pendingRender = requestAnimationFrame(() => {
        pendingRender = null;
        try {
          uploadCompiledFrag(fragSource, result);
        } catch (e) {
          console.error('[fly3d] deferred upload failed:', e);
          return;
        }
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
        timeStart = performance.now();
        if (!rafId) {
          fpsLast = performance.now();
          frameCount = 0;
          loop();
        }
      });
      return { bytes };
    },

    /**
     * Stop rendering, release pointer lock, detach input handlers. WebGL
     * resources kept so re-mount is cheap (just call render() again).
     *
     * 2026-05-24: ALSO clear canvas to black + clear HDR scene FBO. Without
     * this, the canvas keeps showing the last frame for the entire duration
     * of the next scene's shader compile (200-500ms for FLY 3D's heavy scene
     * shader on cache miss), which reads as "previous scene visible during
     * switch" / "FLY 3D switches slower than BOB GPU" to users. BOB GPU's
     * unmount has always done this; FLY 3D missed it pre-Sprint-1.
     */
    unmount() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (pendingRender != null) { cancelAnimationFrame(pendingRender); pendingRender = null; }
      if (flyHandle) { flyHandle.detach(); flyHandle = null; }
      // Clear scene FBO so its rgba16f doesn't keep stale HDR pixels that
      // post-FX would composite into the next first frame.
      if (sceneFbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
        gl.viewport(0, 0, sceneFboW, sceneFboH);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      // Clear canvas to black immediately. Old frame disappears NOW, not
      // 200-500ms later when the next shader compile finishes.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      // Motion blur needs a fresh starting frame on next mount — the old
      // prevCam would now point at a stale camera basis from a different
      // scene, producing wildly wrong reprojection vectors on frame 1.
      prevCamValid = false;
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
      // Also update `defaultCam` so R-key reset jumps back to the LAST-SET
      // scene camera, not the hardcoded fly3d module default [0, 0.3, -3]
      // (which is meaningless for compositor scenes with their own cameras).
      if (patch.position) defaultCam.position = [...patch.position];
      if (patch.yaw != null)   defaultCam.yaw   = patch.yaw;
      if (patch.pitch != null) defaultCam.pitch = patch.pitch;
    },

    /**
     * dry-run: 不真编译 GLSL，只 walk AST 判断 SDF 能不能 compile。
     * 用来在 dispatch 前先 check，给 user friendlier error message。
     */
    canRender(sdf) {
      return canCompileSDF3(sdf);
    },

    getCamState() { return { ...camState, position: [...camState.position] }; },

    /**
     * Apply per-scene post-FX overrides (called by compositor when loading a
     * SceneData with defaults.postFx or camera.aperture). Pass-through to the
     * shared resolver — undefined fields fall back to DEFAULT_POSTFX.
     */
    setPostFx(scene, camera) {
      activePostFx = resolvePostFxParams(scene, camera);
    },

    /**
     * Sprint 3: install up to MAX_VOLUMES (8) volume primitives for the next
     * draw. Pass [] or null to clear. Volume color values 0-255 (RGB) are
     * auto-detected and normalized to 0-1.
     */
    setVolumes(volumes) {
      const KIND_INDEX = { 'smoke': 0, 'flame': 1, 'fog': 2, 'god-rays': 3 };
      const list = Array.isArray(volumes) ? volumes : [];
      activeVolumeCount = Math.min(list.length, MAX_VOLUMES);
      for (let i = 0; i < activeVolumeCount; i++) {
        const v = list[i];
        const kind = KIND_INDEX[v.kind] ?? 0;
        const cx = v.center[0], cy = v.center[1], cz = v.center[2];
        const sx = v.size[0],   sy = v.size[1],   sz = v.size[2];
        const density = (typeof v.density === 'number') ? v.density : 1.0;
        const noiseScale = (typeof v.noiseScale === 'number') ? v.noiseScale : 2.5;
        // Auto-normalize color: max > 1 → assume 0-255 sRGB (then renorm to 0-1).
        // Sprint 5: optional `colorIntensity` multiplier (default 1.0). Lets
        // flame volumes push HDR brightness so they actually trigger bloom
        // and read as "fire" not "wisp". e.g. colorIntensity: 3.0 makes the
        // already-bright orange color emit at 3× → bloom kicks in heavily.
        let r = 0.8, g = 0.8, b = 0.8;
        if (Array.isArray(v.color)) {
          [r, g, b] = v.color;
          if (Math.max(r, g, b) > 1.01) { r /= 255; g /= 255; b /= 255; }
        }
        const colorIntensity = (typeof v.colorIntensity === 'number') ? v.colorIntensity : 1.0;
        r *= colorIntensity; g *= colorIntensity; b *= colorIntensity;
        volumeKindCenterLUT[i*4]   = kind;
        volumeKindCenterLUT[i*4+1] = cx;
        volumeKindCenterLUT[i*4+2] = cy;
        volumeKindCenterLUT[i*4+3] = cz;
        volumeSizeDensityLUT[i*4]   = sx;
        volumeSizeDensityLUT[i*4+1] = sy;
        volumeSizeDensityLUT[i*4+2] = sz;
        volumeSizeDensityLUT[i*4+3] = density;
        volumeColorLUT[i*4]   = r;
        volumeColorLUT[i*4+1] = g;
        volumeColorLUT[i*4+2] = b;
        volumeColorLUT[i*4+3] = noiseScale;
        // Sprint 4: stash per-volume metadata so draw() can re-mutate the LUTs
        // each frame based on subject motion (attachTo) + per-shot sceneState.
        volumeMeta[i] = {
          attachTo: v.attachTo || null,
          sceneStateKey: v.sceneStateKey || null,
          baseCenter: [cx, cy, cz],
          baseDensity: density,
        };
      }
      // Clear unused slots' metadata
      for (let i = activeVolumeCount; i < MAX_VOLUMES; i++) volumeMeta[i] = null;
    },

    /**
     * Sprint 4: register the subject motion slot map from compile().motionSlots.
     * Called by compositor when loading a scene with cameraSequence.subjectMotion.
     */
    setMotionSlots(slots) {
      activeMotionSlots = slots || {};
    },

    /**
     * Sprint 4: register subject base positions so cameraSequence target's
     * `{relativeTo}` can resolve to a world-absolute position. Map of
     * { subjectId: [x, y, z] } (the subject's static transform.translate).
     */
    setSubjectBaseTargets(map) {
      subjectBaseTargets = map || {};
    },

    // ---- Sprint 2: cameraSequence control surface ----
    /**
     * Bind a cameraSequence to this renderer. From this point on every frame
     * pulls (pos, target, fov, aperture) from the sequence at the current
     * wall-clock offset. Pass null to detach (back to WASD fly camera).
     *
     * Calling setSequence() ALSO resets the userTookCam latch — re-engaging the
     * sequence after user fly interaction. This is the "scrubber play" hook.
     */
    setSequence(seq) {
      activeSequence = seq || null;
      sequenceStartTime = performance.now();
      sequencePaused = false;
      userTookCam = false;
      prevCamValid = false;  // motion blur skip on cut-over frame
    },
    setSequenceTime(tSec) {
      if (!activeSequence) return;
      sequenceStartTime = performance.now() - tSec * 1000;
      sequencePaused = false;
      userTookCam = false;
    },
    setSequencePaused(paused) {
      if (paused && !sequencePaused) {
        sequencePausedAt = performance.now();
        sequencePaused = true;
      } else if (!paused && sequencePaused) {
        // Resume: shift start time forward by paused duration
        sequenceStartTime += (performance.now() - sequencePausedAt);
        sequencePaused = false;
        userTookCam = false;
      }
    },
    getSequenceTime() {
      if (!activeSequence) return 0;
      const now = sequencePaused ? sequencePausedAt : performance.now();
      return (now - sequenceStartTime) / 1000;
    },
    getSequenceDuration() {
      return activeSequence ? seqTotalDuration(activeSequence) : 0;
    },
    isSequenceActive() {
      return !!activeSequence && !userTookCam;
    },
  };
}
