// =============================================================================
// postfx —— Atlas 共享电影级 post-process 管线
// -----------------------------------------------------------------------------
// 2026-05-24 Sprint 1 / Cinematic Pipeline
//
// 输入：HDR linear scene texture (rgba16f) + depth in alpha
// 输出：tonemapped canvas
//
// 三步走：
//   1. Bright-pass + downsample → bloomLowTex (320×240 hardcap, 内 17×17 高斯)
//   2. Composite → canvas
//      = HDR scene
//      × DoF (32-tap golden-ratio disk, CoC from camera.aperture + focalDistance)
//      + bloom (低分辨率上采样 mix)
//      + lens flare (3 个 RGB-shifted sample 模拟色散)
//      × vignette
//      → ACES tonemap → gamma 2.2 → canvas
//
// 兼容性：需要 WebGL2 + `EXT_color_buffer_float`。renderer 端创建 context 时
// 已经 probe；postfx 这边假设可用，调用方负责 fallback。
//
// SceneData 接入：
//   camera.aperture / camera.focalDistance — DoF
//   defaults.postFx.{exposure, vignette, bloom, lensFlare, tonemap} — 强度
// =============================================================================

const POSTFX_VS_SRC = `attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

// -----------------------------------------------------------------------------
// Bloom pre-pass: 17×17 高斯 at 低分辨率（MttGz4 Buffer B 同款）
// 输出预滤后的 bloom 纹理供 composite pass mix。
// -----------------------------------------------------------------------------
const BLOOM_FS_SRC = `#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_scene;
uniform vec2 u_bloomRes;
uniform vec2 u_sceneRes;
uniform float u_threshold; // 亮度阈值，超过这条才进 bloom；0 = 全通

#define KERNEL_SIZE 8
#define BLOOM_STRENGTH 6.0

void main() {
  vec2 vUV = gl_FragCoord.xy / u_bloomRes;
  vec3 result = vec3(0.0);
  float total = 0.0;
  float fY = -float(KERNEL_SIZE);
  for (int y = -KERNEL_SIZE; y <= KERNEL_SIZE; y++) {
    float fX = -float(KERNEL_SIZE);
    for (int x = -KERNEL_SIZE; x <= KERNEL_SIZE; x++) {
      vec2 vOffset = vec2(fX, fY);
      vec2 vTapUV = (gl_FragCoord.xy + vOffset + 0.5) / u_bloomRes;
      // 边界外回 0 防 wrap artefact
      if (vTapUV.x < 0.0 || vTapUV.x > 1.0 || vTapUV.y < 0.0 || vTapUV.y > 1.0) {
        fX += 1.0;
        continue;
      }
      vec3 col = texture2D(u_scene, vTapUV).rgb;
      // Sanitize HDR sample — NaN/Inf in rgba16f propagates through Gaussian
      // and produces large black blocks on canvas after upsample. Defensive:
      // replace NaN per-channel + cap to a sane HDR ceiling.
      if (col.r != col.r) col.r = 0.0;
      if (col.g != col.g) col.g = 0.0;
      if (col.b != col.b) col.b = 0.0;
      col = clamp(col, vec3(0.0), vec3(100.0));
      // Bright pass：只让亮度超过阈值的部分通过；soft knee 防硬切
      float lum = max(max(col.r, col.g), col.b);
      float knee = max(0.0, lum - u_threshold);
      col = col * (knee / max(lum, 0.001));
      vec2 vDelta = vOffset / float(KERNEL_SIZE);
      float f = dot(vDelta, vDelta);
      float w = exp2(-f * BLOOM_STRENGTH);
      result += col * w;
      total += w;
      fX += 1.0;
    }
    fY += 1.0;
  }
  gl_FragColor = vec4(result / total, 1.0);
}`;

// -----------------------------------------------------------------------------
// Composite pass: 合成 + tonemap + post-FX
// -----------------------------------------------------------------------------
const COMPOSITE_FS_SRC = `#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_scene;       // HDR linear scene (RGB + depth in alpha)
uniform sampler2D u_bloom;       // 预滤好的 bloom 纹理
uniform vec2 u_canvasRes;
uniform vec2 u_sceneRes;         // scene FBO 实际分辨率（可能 < canvas）
uniform float u_exposure;
uniform float u_vignetteStrength;
uniform float u_bloomMix;        // 0..1 bloom 进 final 的强度
uniform float u_lensFlareStrength; // 0..1
uniform float u_gamma;
// DoF 参数（aperture=0 关闭）
uniform float u_aperture;
uniform float u_focalDistance;
uniform float u_focalLength;     // 镜头焦距，DoF 公式用，typical 0.15
uniform float u_dofMaxRadius;    // CoC 上限，避免极端模糊（典型 0.05 = 屏幕宽 5%）
uniform float u_time;            // 跨帧 jitter，避免 DoF banding
// Sprint 2: 当前 + 上一帧 camera basis，用于 motion blur reproject
uniform vec3  u_curCamPos;
uniform vec3  u_curCamFwd;
uniform vec3  u_curCamRight;
uniform vec3  u_curCamUp;
uniform float u_curCamFocal;
uniform vec3  u_prevCamPos;
uniform vec3  u_prevCamFwd;
uniform vec3  u_prevCamRight;
uniform vec3  u_prevCamUp;
uniform float u_prevCamFocal;
uniform float u_motionBlurStrength;  // 0 = off；shutter angle 0..1（0.5 = MttGz4 default）
uniform float u_prevCamValid;        // 0 = 第一帧 skip motion blur
uniform float u_sceneMaxDist;        // ATLAS_MAX_DIST，用于 depth → world 反推

// Sprint 6: heat haze. Up to 8 flame volumes contribute screen-space UV
// distortion above their world centers. xyz = world center, w = max radius
// (axis-aligned bounding sphere). Slot count in u_heatHazeCount.
#define MAX_HEAT_HAZE 8
uniform vec4  u_heatHaze[MAX_HEAT_HAZE];
uniform int   u_heatHazeCount;

// ---- ACES filmic tonemap (Narkowicz 2015 fit, public domain) ----------------
vec3 acesTonemap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// ---- Vignette ---------------------------------------------------------------
vec3 applyVignette(vec3 col, vec2 uv, float strength) {
  vec2 offset = (uv - 0.5) * sqrt(2.0);
  float dist = dot(offset, offset);
  float shade = mix(1.0, 1.0 - strength, dist);
  return col * shade;
}

// ---- Lens flare (cheap, 3 RGB-shifted disk samples) -------------------------
vec3 applyLensFlare(vec3 col, vec2 uv, float strength) {
  if (strength <= 0.0) return col;
  vec2 c = uv - 0.5;
  // 反向通过中心的 ghost ring
  vec3 flare = vec3(0.0);
  flare.r += texture2D(u_bloom, 0.5 + c * -0.55).r * 1.5;
  flare.g += texture2D(u_bloom, 0.5 + c * -0.525).g * 1.5;
  flare.b += texture2D(u_bloom, 0.5 + c * -0.50).b * 1.5;
  // 微 halo
  vec3 halo = texture2D(u_bloom, 0.5 + c * 0.6).rgb * 0.15;
  return col + (flare + halo) * strength;
}

// ---- Hash for DoF jitter ----------------------------------------------------
vec2 hash22(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract(vec2((p.x + p.y) * p.z, (p.x + p.z) * p.y));
}

// ---- CoC --------------------------------------------------------------------
// Atlas 约定：depth (alpha) 是 linear distance / MAX_DIST in [0, 1]。
// MAX_DIST 在 FLY 3D 是 200 → 实际世界单位距离 d = alpha * MAX_DIST。
// 这里把 alpha 视为归一化深度，配 focalDistance / aperture 算 CoC。

float computeCoC(float depthNorm, float focalDist, float aperture, float focalLength) {
  if (aperture <= 0.0) return 0.0;
  float dist = depthNorm * u_sceneMaxDist;
  if (depthNorm >= 0.999) return 0.0; // sky 不模糊
  return abs(aperture * (focalLength * (dist - focalDist)) /
             (dist * (focalDist - focalLength)));
}

// 32-tap golden-ratio disk (DoF + motion blur 联合)
#define DOF_TAPS 32

// Reconstruct world position from current screen UV + linear depth using
// the current frame's camera basis. Mirrors FLY 3D scene shader's ray
// construction: rd = normalize(uv.x * R + uv.y * U + focal * F).
vec3 reconstructWorldPos(vec2 uv, float depthNorm) {
  // NDC-style: x in [-aspect, aspect], y in [-1, 1] (same as scene shader main())
  float aspect = u_sceneRes.x / u_sceneRes.y;
  vec2 viewUV = vec2((uv.x * 2.0 - 1.0) * aspect, uv.y * 2.0 - 1.0);
  vec3 rd = normalize(viewUV.x * u_curCamRight + viewUV.y * u_curCamUp + u_curCamFocal * u_curCamFwd);
  return u_curCamPos + rd * (depthNorm * u_sceneMaxDist);
}

// Project a world position through the previous frame's camera into UV.
// If the point is behind the camera (localZ <= 0), returns (-1, -1) sentinel.
vec2 projectToPrevUV(vec3 worldPos) {
  vec3 offset = worldPos - u_prevCamPos;
  float localZ = dot(offset, u_prevCamFwd);
  if (localZ <= 0.01) return vec2(-1.0, -1.0);
  float localX = dot(offset, u_prevCamRight);
  float localY = dot(offset, u_prevCamUp);
  // Inverse of viewUV = uv * 2 - 1 * (aspect, 1):
  //   viewUV.x = (localX * focal) / localZ  → uv.x = (viewUV.x / aspect + 1) * 0.5
  //   viewUV.y = (localY * focal) / localZ  → uv.y = (viewUV.y + 1) * 0.5
  float aspect = u_sceneRes.x / u_sceneRes.y;
  float vx = (localX * u_prevCamFocal) / localZ;
  float vy = (localY * u_prevCamFocal) / localZ;
  return vec2(vx / aspect * 0.5 + 0.5, vy * 0.5 + 0.5);
}

// Combined DoF + motion blur sample. For each of 32 taps:
//   1. step along motion vector (uv → prevUV) by fraction in [-0.5, 0.5] * shutter
//   2. on top of that, jitter by golden-ratio disk of radius = coc
// MttGz4 Buffer C 同款双效循环。
vec3 dofMotionBlurSample(vec2 uv, float coc, vec2 motionVec) {
  if (coc < 0.001 && length(motionVec) < 0.0005) {
    return texture2D(u_scene, uv).rgb;
  }
  vec3 acc = vec3(0.0);
  float total = 0.0;
  float aspect = u_sceneRes.y / u_sceneRes.x;
  float fIndex = 0.0;
  float f = 0.0;
  float invTaps = 1.0 / float(DOF_TAPS);
  for (int i = 1; i <= DOF_TAPS; i++) {
    // Motion-blur sweep position
    vec2 mvTap = mix(uv, uv + motionVec, f - 0.5);

    // DoF disk jitter on top
    vec2 r = hash22(vec3(uv.x, uv.y, fract(u_time * 0.123 + fIndex * 1.234)));
    float theta = r.x * 6.2831853;
    float radius = coc * pow(r.y, 0.4);
    vec2 tapUV = mvTap + vec2(sin(theta) * aspect, cos(theta)) * radius;

    if (tapUV.x >= 0.0 && tapUV.x <= 1.0 && tapUV.y >= 0.0 && tapUV.y <= 1.0) {
      vec4 tap = texture2D(u_scene, tapUV);
      float tapCoC = computeCoC(tap.a, u_focalDistance, u_aperture, u_focalLength);
      float w = max(tapCoC, 0.001);
      acc += tap.rgb * w;
      total += w;
    }
    f += invTaps;
    fIndex += 1.0;
  }
  return acc / max(total, 0.001);
}

// Sprint 6: heat haze UV distortion. For each flame volume, reconstruct the
// surface world position behind the current pixel and check whether the pixel
// is "above + behind" the flame. Heat plume cone widens with height and
// dissipates at ~5 units up. fbm-via-sin gives a cheap shimmer offset.
vec2 heatHazeUV(vec2 uv) {
  if (u_heatHazeCount <= 0) return uv;
  // Need surface world position. Sample original (un-distorted) depth first.
  vec4 firstSample = texture2D(u_scene, uv);
  float dn = firstSample.a;
  if (dn >= 0.999) return uv;  // sky pixel: no haze (cheap exit)
  vec3 worldPos = reconstructWorldPos(uv, dn);
  float haze = 0.0;
  for (int i = 0; i < MAX_HEAT_HAZE; i++) {
    if (i >= u_heatHazeCount) break;
    vec4 hv = u_heatHaze[i];
    vec3 toFlame = worldPos - hv.xyz;
    // Only pixels above flame Y center get distortion (heat rises). Cone
    // widens with height, intensity dissipates ~5 units up.
    float yAbove = toFlame.y;
    if (yAbove < -hv.w) continue;
    float horizDist = length(toFlame.xz);
    float coneRad = max(hv.w * 0.8, 0.1) + max(yAbove, 0.0) * 0.4;
    float radial = horizDist / coneRad;
    float falloff = exp(-radial * radial) * exp(-max(yAbove, 0.0) * 0.18);
    haze += falloff * hv.w;
  }
  if (haze < 0.005) return uv;
  // Cheap fbm via summed sines. Vertical bands shimmer with time — looks like
  // hot air rising. Horizontal component is subtler (heat plumes are vertical).
  float n1 = sin(uv.y * 72.0 - u_time * 5.0) + sin(uv.y * 41.0 + u_time * 3.7) * 0.6;
  float n2 = sin(uv.x * 24.0 + u_time * 2.1) * 0.4;
  vec2 offset = vec2(n2, n1) * haze * 0.0035;
  return clamp(uv + offset, vec2(0.001), vec2(0.999));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_canvasRes;
  vec2 hazedUV = heatHazeUV(uv);
  vec4 sceneSample = texture2D(u_scene, hazedUV);
  float depthNorm = sceneSample.a;
  float coc = min(computeCoC(depthNorm, u_focalDistance, u_aperture, u_focalLength), u_dofMaxRadius);

  // Sprint 2: motion blur reproject. Sky pixels (depth=1.0) get zero motion
  // blur — they're at infinity, prev camera projection is degenerate.
  vec2 motionVec = vec2(0.0);
  if (u_motionBlurStrength > 0.0 && u_prevCamValid > 0.5 && depthNorm < 0.999) {
    vec3 worldPos = reconstructWorldPos(uv, depthNorm);
    vec2 prevUV = projectToPrevUV(worldPos);
    if (prevUV.x >= 0.0) {
      motionVec = (uv - prevUV) * u_motionBlurStrength;
      // Cap motion vector to avoid wild reaches when camera makes big jumps
      // (e.g. shot cut). 8% of screen is plenty for cinematic motion.
      float mvLen = length(motionVec);
      if (mvLen > 0.08) motionVec *= 0.08 / mvLen;
    }
  }

  // Sprint 6: pass hazedUV (not uv) into DoF/motion-blur sampler so heat haze
  // composites correctly when DoF is also active. Offset is small (~0.35%) so
  // motion reproject above (using original uv) stays valid.
  vec3 col = (coc > 0.001 || length(motionVec) > 0.0005)
    ? dofMotionBlurSample(hazedUV, coc, motionVec)
    : sceneSample.rgb;
  // Sanitize HDR result before exposure/bloom/flare math (NaN propagates).
  if (col.r != col.r) col.r = 0.0;
  if (col.g != col.g) col.g = 0.0;
  if (col.b != col.b) col.b = 0.0;
  col = clamp(col, vec3(0.0), vec3(100.0));
  col *= u_exposure;

  // Bloom mix (linear screen-space add，硬上限避免烧穿)
  vec3 bloom = texture2D(u_bloom, uv).rgb;
  if (bloom.r != bloom.r) bloom.r = 0.0;
  if (bloom.g != bloom.g) bloom.g = 0.0;
  if (bloom.b != bloom.b) bloom.b = 0.0;
  bloom = clamp(bloom, vec3(0.0), vec3(100.0));
  col = mix(col, col + bloom, u_bloomMix);

  // Lens flare 在 tonemap 之前加，让 flare 自然进 HDR range
  col = applyLensFlare(col, uv, u_lensFlareStrength);

  // Final HDR safety: cap before tonemap so ACES gets sane input
  col = clamp(col, vec3(0.0), vec3(100.0));

  // ACES tonemap → SDR
  col = acesTonemap(col);

  // Vignette in SDR (post-tonemap，保留色彩)
  col = applyVignette(col, uv, u_vignetteStrength);

  // Gamma
  col = pow(col, vec3(1.0 / u_gamma));

  gl_FragColor = vec4(col, 1.0);
}`;

// =============================================================================
// Factory
// =============================================================================

/**
 * 创建 post-FX 管线。
 *
 * @param {WebGL2RenderingContext} gl - 必须已 probe `EXT_color_buffer_float`
 *        (调用方需在 createXxxRenderer 里完成 probe；postfx 假设可用)
 * @param {WebGLBuffer} vbuf - shared full-screen quad VBO
 * @param {Object} opts
 * @param {number} [opts.bloomWidth=320]
 * @param {number} [opts.bloomHeight=240]
 * @returns {{
 *   render: (sceneTex, sceneW, sceneH, canvasW, canvasH, params, tSec) => void,
 *   resize: (canvasW, canvasH) => void,
 *   dispose: () => void,
 * }}
 *
 * params 字段（每帧可变）：
 *   exposure          (default 1.0)
 *   vignetteStrength  (default 0.4)
 *   bloomMix          (default 0.15)
 *   bloomThreshold    (default 0.8)
 *   lensFlareStrength (default 0.2)
 *   gamma             (default 2.2)
 *   aperture          (default 0.0 = no DoF)
 *   focalDistance     (default 5.0)
 *   focalLength       (default 0.15)
 *   dofMaxRadius      (default 0.05)
 */
export function createPostFxPipeline(gl, vbuf, opts = {}) {
  const bloomW = opts.bloomWidth ?? 320;
  const bloomH = opts.bloomHeight ?? 240;

  // ---- Shader helpers ----
  function compile(src, type, label) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(`[postfx] ${label} compile failed: ${log}`);
    }
    return sh;
  }
  function link(vs, fs, label) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`[postfx] ${label} link failed: ${gl.getProgramInfoLog(p)}`);
    }
    return p;
  }

  const vs = compile(POSTFX_VS_SRC, gl.VERTEX_SHADER, 'postfx VS');
  const bloomFS = compile(BLOOM_FS_SRC, gl.FRAGMENT_SHADER, 'bloom FS');
  const compositeFS = compile(COMPOSITE_FS_SRC, gl.FRAGMENT_SHADER, 'composite FS');
  const bloomProgram = link(vs, bloomFS, 'bloom program');
  const compositeProgram = link(vs, compositeFS, 'composite program');

  const bloomU = {
    u_scene: gl.getUniformLocation(bloomProgram, 'u_scene'),
    u_bloomRes: gl.getUniformLocation(bloomProgram, 'u_bloomRes'),
    u_sceneRes: gl.getUniformLocation(bloomProgram, 'u_sceneRes'),
    u_threshold: gl.getUniformLocation(bloomProgram, 'u_threshold'),
  };
  const compU = {
    u_scene: gl.getUniformLocation(compositeProgram, 'u_scene'),
    u_bloom: gl.getUniformLocation(compositeProgram, 'u_bloom'),
    u_canvasRes: gl.getUniformLocation(compositeProgram, 'u_canvasRes'),
    u_sceneRes: gl.getUniformLocation(compositeProgram, 'u_sceneRes'),
    u_exposure: gl.getUniformLocation(compositeProgram, 'u_exposure'),
    u_vignetteStrength: gl.getUniformLocation(compositeProgram, 'u_vignetteStrength'),
    u_bloomMix: gl.getUniformLocation(compositeProgram, 'u_bloomMix'),
    u_lensFlareStrength: gl.getUniformLocation(compositeProgram, 'u_lensFlareStrength'),
    u_gamma: gl.getUniformLocation(compositeProgram, 'u_gamma'),
    u_aperture: gl.getUniformLocation(compositeProgram, 'u_aperture'),
    u_focalDistance: gl.getUniformLocation(compositeProgram, 'u_focalDistance'),
    u_focalLength: gl.getUniformLocation(compositeProgram, 'u_focalLength'),
    u_dofMaxRadius: gl.getUniformLocation(compositeProgram, 'u_dofMaxRadius'),
    u_time: gl.getUniformLocation(compositeProgram, 'u_time'),
    // Sprint 2 motion blur uniforms
    u_curCamPos: gl.getUniformLocation(compositeProgram, 'u_curCamPos'),
    u_curCamFwd: gl.getUniformLocation(compositeProgram, 'u_curCamFwd'),
    u_curCamRight: gl.getUniformLocation(compositeProgram, 'u_curCamRight'),
    u_curCamUp: gl.getUniformLocation(compositeProgram, 'u_curCamUp'),
    u_curCamFocal: gl.getUniformLocation(compositeProgram, 'u_curCamFocal'),
    u_prevCamPos: gl.getUniformLocation(compositeProgram, 'u_prevCamPos'),
    u_prevCamFwd: gl.getUniformLocation(compositeProgram, 'u_prevCamFwd'),
    u_prevCamRight: gl.getUniformLocation(compositeProgram, 'u_prevCamRight'),
    u_prevCamUp: gl.getUniformLocation(compositeProgram, 'u_prevCamUp'),
    u_prevCamFocal: gl.getUniformLocation(compositeProgram, 'u_prevCamFocal'),
    u_motionBlurStrength: gl.getUniformLocation(compositeProgram, 'u_motionBlurStrength'),
    u_prevCamValid: gl.getUniformLocation(compositeProgram, 'u_prevCamValid'),
    u_sceneMaxDist: gl.getUniformLocation(compositeProgram, 'u_sceneMaxDist'),
    // Sprint 6: heat haze. Array uniform fetched by [0] indexed name.
    u_heatHaze: gl.getUniformLocation(compositeProgram, 'u_heatHaze[0]'),
    u_heatHazeCount: gl.getUniformLocation(compositeProgram, 'u_heatHazeCount'),
  };

  // ---- Bloom FBO（低分辨率 HDR；filter LINEAR 让 composite 上采样平滑）----
  // Atlas: rgba16f WebGL2 only. 调用方保证 context 是 webgl2.
  let bloomTex = null;
  let bloomFbo = null;

  function rebuildBloomFbo() {
    if (bloomTex) gl.deleteTexture(bloomTex);
    if (bloomFbo) gl.deleteFramebuffer(bloomFbo);
    bloomTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bloomTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, bloomW, bloomH, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    bloomFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bloomTex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('[postfx] bloom FBO incomplete (rgba16f not supported?)');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  rebuildBloomFbo();

  function bindQuad(program) {
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  function render(sceneTex, sceneW, sceneH, canvasW, canvasH, params, tSec) {
    const p = params || {};
    const exposure = p.exposure ?? 1.0;
    const vignetteStrength = p.vignetteStrength ?? 0.4;
    const bloomMix = p.bloomMix ?? 0.15;
    const bloomThreshold = p.bloomThreshold ?? 0.8;
    const lensFlareStrength = p.lensFlareStrength ?? 0.2;
    const gamma = p.gamma ?? 2.2;
    const aperture = p.aperture ?? 0.0;
    const focalDistance = p.focalDistance ?? 5.0;
    const focalLength = p.focalLength ?? 0.15;
    const dofMaxRadius = p.dofMaxRadius ?? 0.05;

    // ---- Pass A: bloom pre-blur ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomFbo);
    gl.viewport(0, 0, bloomW, bloomH);
    bindQuad(bloomProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(bloomU.u_scene, 0);
    gl.uniform2f(bloomU.u_bloomRes, bloomW, bloomH);
    gl.uniform2f(bloomU.u_sceneRes, sceneW, sceneH);
    gl.uniform1f(bloomU.u_threshold, bloomThreshold);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // ---- Pass B: composite → canvas ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasW, canvasH);
    bindQuad(compositeProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(compU.u_scene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloomTex);
    gl.uniform1i(compU.u_bloom, 1);
    gl.uniform2f(compU.u_canvasRes, canvasW, canvasH);
    gl.uniform2f(compU.u_sceneRes, sceneW, sceneH);
    gl.uniform1f(compU.u_exposure, exposure);
    gl.uniform1f(compU.u_vignetteStrength, vignetteStrength);
    gl.uniform1f(compU.u_bloomMix, bloomMix);
    gl.uniform1f(compU.u_lensFlareStrength, lensFlareStrength);
    gl.uniform1f(compU.u_gamma, gamma);
    gl.uniform1f(compU.u_aperture, aperture);
    gl.uniform1f(compU.u_focalDistance, focalDistance);
    gl.uniform1f(compU.u_focalLength, focalLength);
    gl.uniform1f(compU.u_dofMaxRadius, dofMaxRadius);
    gl.uniform1f(compU.u_time, tSec);

    // Sprint 2 motion blur uniforms (only if caller provided camera basis)
    const motionBlur = p.motionBlurStrength ?? 0.5;
    const sceneMaxDist = p.sceneMaxDist ?? 200.0;
    gl.uniform1f(compU.u_motionBlurStrength, motionBlur);
    gl.uniform1f(compU.u_sceneMaxDist, sceneMaxDist);
    gl.uniform1f(compU.u_prevCamValid, p._prevCamValid ? 1.0 : 0.0);
    if (p._curCamPos) {
      gl.uniform3f(compU.u_curCamPos, p._curCamPos[0], p._curCamPos[1], p._curCamPos[2]);
      gl.uniform3f(compU.u_curCamFwd, p._curCamFwd[0], p._curCamFwd[1], p._curCamFwd[2]);
      gl.uniform3f(compU.u_curCamRight, p._curCamRight[0], p._curCamRight[1], p._curCamRight[2]);
      gl.uniform3f(compU.u_curCamUp, p._curCamUp[0], p._curCamUp[1], p._curCamUp[2]);
      gl.uniform1f(compU.u_curCamFocal, p._curCamFov);
    }
    if (p._prevCamPos) {
      gl.uniform3f(compU.u_prevCamPos, p._prevCamPos[0], p._prevCamPos[1], p._prevCamPos[2]);
      gl.uniform3f(compU.u_prevCamFwd, p._prevCamFwd[0], p._prevCamFwd[1], p._prevCamFwd[2]);
      gl.uniform3f(
        compU.u_prevCamRight,
        p._prevCamRight[0],
        p._prevCamRight[1],
        p._prevCamRight[2],
      );
      gl.uniform3f(compU.u_prevCamUp, p._prevCamUp[0], p._prevCamUp[1], p._prevCamUp[2]);
      gl.uniform1f(compU.u_prevCamFocal, p._prevCamFov);
    }

    // Sprint 6: heat haze flame volumes. _heatHaze is Float32Array(MAX×4) and
    // _heatHazeCount the active slot count. Caller (flyLambert render()) packs
    // it from the per-frame flame volume LUT.
    const hazeCount = p._heatHazeCount ?? 0;
    if (compU.u_heatHazeCount != null) gl.uniform1i(compU.u_heatHazeCount, hazeCount);
    if (hazeCount > 0 && p._heatHaze && compU.u_heatHaze != null) {
      gl.uniform4fv(compU.u_heatHaze, p._heatHaze);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function resize(_canvasW, _canvasH) {
    // bloom FBO 是固定 320×240，跟 canvas 无关；保留 hook 给未来用
  }

  function dispose() {
    if (bloomTex) gl.deleteTexture(bloomTex);
    if (bloomFbo) gl.deleteFramebuffer(bloomFbo);
    gl.deleteProgram(bloomProgram);
    gl.deleteProgram(compositeProgram);
    gl.deleteShader(vs);
    gl.deleteShader(bloomFS);
    gl.deleteShader(compositeFS);
  }

  return { render, resize, dispose };
}

// =============================================================================
// Default post-FX params for SceneData defaults.postFx
// -----------------------------------------------------------------------------
// 给现有 demo 用的合理默认；scene 不显式提供 postFx 字段时这些值会让 12 个
// 现有 demo 立刻变电影感（曝光略提 + 中度 vignette + 轻 bloom + 弱 lens flare）
// =============================================================================
export const DEFAULT_POSTFX = Object.freeze({
  exposure: 1.0,
  vignetteStrength: 0.4,
  bloomMix: 0.18,
  bloomThreshold: 0.85,
  // Sprint 2: lens flare RGB-shift ghost was too punchy in HDR mode — the
  // engine emissive's bloom blob projects a CMYK ghost across the frame.
  // Default lowered from 0.15 → 0.05; cinematic flare is OPT-IN via scene.
  lensFlareStrength: 0.05,
  gamma: 2.2,
  // DoF 默认关 — 必须 scene 显式提供 camera.aperture > 0 才开
  aperture: 0.0,
  focalDistance: 5.0,
  focalLength: 0.15,
  dofMaxRadius: 0.05,
  // Sprint 2: motion blur shutter angle (0..1)。0.5 = MttGz4 default。
  // 跟 camera 动 OR sequence active 才有效；静态镜头无 motion = 无 blur。
  motionBlurStrength: 0.5,
  // ATLAS_MAX_DIST：postfx depth unpack 必须跟 FLY 3D scene shader MAX_DIST 一致
  sceneMaxDist: 200.0,
});

/**
 * 合并 scene-supplied postFx params 跟 DEFAULT_POSTFX。
 * scene 未提供的字段走 default。
 */
export function resolvePostFxParams(scene, camera) {
  const overrides = (scene && scene.defaults && scene.defaults.postFx) || {};
  const merged = { ...DEFAULT_POSTFX, ...overrides };
  // 如果 camera 有 aperture/focalDistance，优先用 camera 的
  if (camera) {
    if (typeof camera.aperture === 'number') merged.aperture = camera.aperture;
    if (typeof camera.focalDistance === 'number') merged.focalDistance = camera.focalDistance;
  }
  return merged;
}
