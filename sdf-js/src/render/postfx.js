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
const float ATLAS_MAX_DIST = 200.0;

float computeCoC(float depthNorm, float focalDist, float aperture, float focalLength) {
  if (aperture <= 0.0) return 0.0;
  float dist = depthNorm * ATLAS_MAX_DIST;
  if (depthNorm >= 0.999) return 0.0; // sky 不模糊
  return abs(aperture * (focalLength * (dist - focalDist)) /
             (dist * (focalDist - focalLength)));
}

// 32-tap golden-ratio disk
#define DOF_TAPS 32

vec3 dofSample(vec2 uv, float coc) {
  if (coc < 0.001) return texture2D(u_scene, uv).rgb;
  vec3 acc = vec3(0.0);
  float total = 0.0;
  float aspect = u_sceneRes.y / u_sceneRes.x;
  float fIndex = 0.0;
  for (int i = 0; i < DOF_TAPS; i++) {
    vec2 r = hash22(vec3(uv.x, uv.y, fract(u_time * 0.123 + fIndex * 1.234)));
    float theta = r.x * 6.2831853;
    // Less-dense centre exponent 0.4 → 更像 bokeh disk
    float radius = coc * pow(r.y, 0.4);
    vec2 tapUV = uv + vec2(sin(theta) * aspect, cos(theta)) * radius;
    if (tapUV.x < 0.0 || tapUV.x > 1.0 || tapUV.y < 0.0 || tapUV.y > 1.0) {
      fIndex += 1.0;
      continue;
    }
    vec4 tap = texture2D(u_scene, tapUV);
    float tapCoC = computeCoC(tap.a, u_focalDistance, u_aperture, u_focalLength);
    // 散景权重：跟 tapCoC 成正比（远焦区域贡献更大 bokeh 块）
    float w = max(tapCoC, 0.0001);
    acc += tap.rgb * w;
    total += w;
    fIndex += 1.0;
  }
  return acc / max(total, 0.001);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_canvasRes;
  vec4 sceneSample = texture2D(u_scene, uv);
  float depthNorm = sceneSample.a;
  float coc = min(computeCoC(depthNorm, u_focalDistance, u_aperture, u_focalLength), u_dofMaxRadius);

  vec3 col = (coc > 0.001) ? dofSample(uv, coc) : sceneSample.rgb;
  col *= u_exposure;

  // Bloom mix (linear screen-space add，硬上限避免烧穿)
  vec3 bloom = texture2D(u_bloom, uv).rgb;
  col = mix(col, col + bloom, u_bloomMix);

  // Lens flare 在 tonemap 之前加，让 flare 自然进 HDR range
  col = applyLensFlare(col, uv, u_lensFlareStrength);

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
    const exposure          = p.exposure          ?? 1.0;
    const vignetteStrength  = p.vignetteStrength  ?? 0.4;
    const bloomMix          = p.bloomMix          ?? 0.15;
    const bloomThreshold    = p.bloomThreshold    ?? 0.8;
    const lensFlareStrength = p.lensFlareStrength ?? 0.2;
    const gamma             = p.gamma             ?? 2.2;
    const aperture          = p.aperture          ?? 0.0;
    const focalDistance     = p.focalDistance     ?? 5.0;
    const focalLength       = p.focalLength       ?? 0.15;
    const dofMaxRadius      = p.dofMaxRadius      ?? 0.05;

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
  lensFlareStrength: 0.15,
  gamma: 2.2,
  // DoF 默认关 — 必须 scene 显式提供 camera.aperture > 0 才开
  aperture: 0.0,
  focalDistance: 5.0,
  focalLength: 0.15,
  dofMaxRadius: 0.05,
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
