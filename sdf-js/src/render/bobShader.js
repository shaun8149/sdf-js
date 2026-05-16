// =============================================================================
// bobShader —— GPU shader Lambert + Autoscope-style 量化色块渲染器
// -----------------------------------------------------------------------------
// 2026-05-17 MOVE from examples/mvp/bob-shader-renderer.js → src/render/bobShader.js
// 让 examples/sdf/autoscope-clone 和 MVP 都能 import。Controller API:
//   const bob = createBobShaderRenderer({ canvas, getControls, ... callbacks });
//   bob.render(sdf);     // compile + start rAF
//   bob.unmount();       // stop + release pointer lock
//   bob.shufflePalette() // re-bake palette texture
//
// 视觉签名（Autoscope idiom）：
//   - 21 palette pool（PALETTES from autoscope.js）烤进 sampler2D u_palette
//   - imin / ismoothUnion 维护 objectIndex / minIndex（区分多 object 上色）
//   - spaceCol(p, objNum) → 量化色块（IQ floor 离散 + Autoscope u_coldiv 频率）
//   - 缓慢漂移噪声（NOISESPEED ≈ 0.00008，BOB 静图"活着"签名）
//   - 4 种阴影上色风格（channel swap / hue rot 180° / hue rot 90° / 暗化）
//   - Paper bg + sky gradient
//
// 调用方传入 `worldScale` 调整量化频率：MVP 用 8.0（LLM 0.5-unit SDF），
// autoscope-clone 用 0.8（autoscope 10-20-unit SDF）。
// =============================================================================

import { compileSDF3ToGLSL, canCompileSDF3 } from '../sdf/sdf3.compile.js';
import {
  PALETTES, SKIES, PAPERS,
  pickShuffled, pick, bakePaletteTexture, hexToVec3,
} from '../palette/autoscope.js';
import { attachFlyControls } from '../input/fly-controls.js';

const VS_SRC = `attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

// =============================================================================
// Post-process fragment shader (autoscope 2-pass grain 的核心)
// -----------------------------------------------------------------------------
// Pass 1 (低分 buffer) 已存好纯 palette 色（u_simpleColor=1，不做 HSL）。pass 2 跑：
//   col1 = sampleBuffer(uv)              ← 几乎不扰动 → shape 保持锐利
//   col2 = sampleBuffer(uv + 大扰动)      ← 采远处随机 cell → 随机 palette 色
//   HSL mix: 用 col1 的 sat+lum + col2 的 hue → 同形状内每像素 hue 不同 = grain
//   colorLeak: 25% 像素直接保留 col1 raw → 部分纯色 patch
//
// u_postNoise=0 → col1=col2 → 跟单 pass 一样无 grain
// u_postNoise=1 → autoscope 默认 yNoise=0.15 (远处 cell 24 格)
// =============================================================================
const POST_FS_SRC = `#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_buffer;
uniform vec2  u_resolution;
uniform vec2  u_bufferRes;
uniform float u_time;
uniform float u_postNoise;       // 0..2，0 = 关，1 = autoscope 默认
uniform float u_postNFactor;     // 0..1.5，octave noise nFactor
uniform float u_postNoiseCap;    // 0.1..0.8，autoscope u_noiseCap clamp

#define OCTAVES 6
#define NOISESPEED 0.00008

float hash13(vec3 p3) {
  p3 += u_time * NOISESPEED;
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 grad2(ivec2 z) {
  float a = hash13(vec3(z, 0.0)) * 6.2831853;
  return vec2(cos(a), sin(a));
}

float gnoise(vec2 p) {
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(grad2(i + ivec2(0,0)), f - vec2(0,0)),
        dot(grad2(i + ivec2(1,0)), f - vec2(1,0)), u.x),
    mix(dot(grad2(i + ivec2(0,1)), f - vec2(0,1)),
        dot(grad2(i + ivec2(1,1)), f - vec2(1,1)), u.x), u.y);
}

float octaves(vec2 uv, float scale, float factor, float multiplier, float nFactor) {
  multiplier *= 1.0 + nFactor * (gnoise(uv * 1.0) + 0.5);
  uv *= scale;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  float f = 0.0;
  for (int i = 0; i < OCTAVES; i++) {
    f += factor * gnoise(uv);
    uv = m * uv;
    factor *= multiplier;
  }
  return f;
}

// HSL 工具（glsl-hsl2rgb / IQ 同源）
float hue2rgb(float f1, float f2, float hue) {
  if (hue < 0.0) hue += 1.0; else if (hue > 1.0) hue -= 1.0;
  if ((6.0 * hue) < 1.0) return f1 + (f2 - f1) * 6.0 * hue;
  if ((2.0 * hue) < 1.0) return f2;
  if ((3.0 * hue) < 2.0) return f1 + (f2 - f1) * ((2.0/3.0) - hue) * 6.0;
  return f1;
}
vec3 hsl2rgb(vec3 hsl) {
  if (hsl.y == 0.0) return vec3(hsl.z);
  float f2 = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.y * hsl.z;
  float f1 = 2.0 * hsl.z - f2;
  return vec3(
    hue2rgb(f1, f2, hsl.x + 1.0/3.0),
    hue2rgb(f1, f2, hsl.x),
    hue2rgb(f1, f2, hsl.x - 1.0/3.0));
}
vec3 rgb2hsl(vec3 col) {
  float vmax = max(max(col.r, col.g), col.b);
  float vmin = min(min(col.r, col.g), col.b);
  float c = vmax - vmin;
  vec3 hsl = vec3(0.0, 0.0, (vmax + vmin) * 0.5);
  if (c > 0.0) {
    hsl.y = hsl.z < 0.5 ? c / (vmax + vmin) : c / (2.0 - vmax - vmin);
    if (col.r == vmax) hsl.x = ((vmax - col.b) / 6.0 + c / 2.0) / c - ((vmax - col.g) / 6.0 + c / 2.0) / c;
    else if (col.g == vmax) hsl.x = ((vmax - col.r) / 6.0 + c / 2.0) / c - ((vmax - col.b) / 6.0 + c / 2.0) / c + 1.0/3.0;
    else hsl.x = ((vmax - col.g) / 6.0 + c / 2.0) / c - ((vmax - col.r) / 6.0 + c / 2.0) / c + 2.0/3.0;
    if (hsl.x < 0.0) hsl.x += 1.0; else if (hsl.x > 1.0) hsl.x -= 1.0;
  }
  return hsl;
}

vec3 sampleBuffer(vec2 uv) {
  return texture2D(u_buffer, uv).rgb;
}

void main() {
  // [-1,1] uv space —— autoscope idiom；octave 频率匹配 main.frag wavelength
  vec2 uv = 2.0 * (gl_FragCoord.xy / u_resolution - 0.5);

  // patches: 低频 octave 空间强度 modulator（0.04..0.5）
  float patches = clamp(octaves(uv + 4.0, 2.0, 0.8, 0.5, u_postNFactor), 0.04, u_postNoiseCap);

  // amount: 第 2 个低频 octave，符号化 Y 振幅 modulator → 区域性 Y 扰动方向变化
  // autoscope main.frag render(): float amount = octaves(-uv, 5., .95, .95, u_nFactor);
  float amount = octaves(-uv, 5.0, 0.95, 0.95, u_postNFactor);

  // col1: 极小扰动（autoscope: xNoise=0.001, yNoise=0.001）→ shape 边界锐利
  vec2 perturb1 = vec2(
    octaves(uv + 2.0, 2.0, 0.95, 0.95, u_postNFactor),
    octaves(uv,      2.0, 0.95, 0.95, u_postNFactor)
  ) * 0.001 * patches * u_postNoise;
  vec2 sUV1 = (uv + perturb1) * 0.5 + 0.5;
  vec4 col1Data = texture2D(u_buffer, sUV1);
  vec3 col1 = col1Data.rgb;
  float depth = col1Data.a;  // 0=近物 / 1=sky；depth 让 sky 像素 11× X 扰动

  // col2: 大扰动（autoscope: xNoise=0.002+depth*0.02, yNoise=0.15*amount）
  vec2 perturb2 = vec2(
    octaves(uv + 2.0, 2.0, 0.95, 0.95, u_postNFactor) * (0.002 + depth * 0.02),
    octaves(uv,      2.0, 0.95, 0.95, u_postNFactor) * 0.15 * amount
  ) * patches * u_postNoise;
  vec2 sUV2 = (uv + perturb2) * 0.5 + 0.5;
  vec3 col2 = texture2D(u_buffer, sUV2).rgb;

  // HSL mix: sky 用 col1.hue 主导 (0.35)，object 用 col2.hue 主导 (0.9)
  // autoscope idiom: mix(col1hsl.x, col2hsl.x, (col1.w == 1.) ? .35 : .9)
  vec3 hsl1 = rgb2hsl(col1);
  vec3 hsl2 = rgb2hsl(col2);
  float hueMix = depth >= 0.999 ? 0.35 : 0.9;
  vec3 mixed = hsl2rgb(vec3(mix(hsl1.x, hsl2.x, hueMix), hsl1.y, hsl1.z));

  // colorLeak: 25% 像素保留 col1 raw（autoscope u_colorLeak=0.25）
  vec3 col = mix(mixed, col1, 0.25);

  gl_FragColor = vec4(col, 1.0);
}`;

// 模板：把 compile 出来的 SDF3 GLSL（含 sceneSDF + IMIN_GLSL globals）拼进 main()
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
// u_time 由 SDF3_GLSL 自己声明（time-modulated primitives 用），这里不重复
uniform sampler2D u_palette;
uniform float u_paletteLen;
uniform vec3  u_paper;       // 纸面底色
uniform vec3  u_sky1;        // 天空高光
uniform vec3  u_sky2;        // 天空阴影
uniform float u_coldiv;      // 色块频率（小=大块 0.5；大=小块 4.0）
uniform int   u_coloration;  // 0/1/2: 三种 spaceCol 投影
uniform int   u_shadowMode;  // 0/1/2/3: 阴影上色风格
uniform float u_shadowStrength;
uniform float u_shadowsOn;
uniform float u_groundOn;
uniform float u_noiseSpeed;  // 0=静止；0.00008=Autoscope 默认（缓慢流）
uniform float u_exposure;
uniform float u_saturation;
uniform float u_worldScale;  // spaceCol 量化频率补偿：MVP 8.0（LLM ~0.5 单位），autoscope-clone 0.8（autoscope ~10 单位）

// ---- Autoscope-style 随机化 knobs（让单 hash 变体空间 5×）-----------------
// 默认 0/false = 无效果（MVP 不开），autoscope-clone 用 PRNG 随机化
uniform vec2  u_mirror;       // (mirrorX, mirrorZ) 0/1，sceneSDF input p 镜像
uniform float u_twist;        // 0=off，0.1-0.2 = 明显弯曲；per-ray uv.y * u_twist
uniform int   u_twistType;    // 0=Y轴 / 1=Z轴 / 2=X轴 旋转
uniform vec3  u_gridRot;      // spaceCol 色块网格旋转（rad）
uniform float u_simpleColor;  // 1.0 = 跳过 HSL mix 输出纯 palette 色（2-pass mode：让 post pass 做 HSL grain）

#define PI       3.1415926535
#define TWOPI    6.2831853071
// MVP 用 0.5-unit SDF 不需要远 raymarch；autoscope-clone 跨度 50+ 单位需要远
// 兼顾两者：200 dist + 200 steps（GPU 上仍 60fps 在大多数现代显卡）
#define MAX_STEPS 200
#define MAX_DIST  200.0
#define EPS       0.001
#define GROUND_Y  -1.0

// ============================================================================
// 噪声 + HSL 工具（IQ XdXGW8 hash13 + glsl-hsl2rgb）
// ============================================================================

float hash13(vec3 p3) {
  p3 += u_time * u_noiseSpeed;  // 时间漂移
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 grad2(vec2 z) {
  float a = hash13(vec3(z, 0.0)) * TWOPI;
  return vec2(cos(a), sin(a));
}

float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(grad2(i + vec2(0,0)), f - vec2(0,0)),
        dot(grad2(i + vec2(1,0)), f - vec2(1,0)), u.x),
    mix(dot(grad2(i + vec2(0,1)), f - vec2(0,1)),
        dot(grad2(i + vec2(1,1)), f - vec2(1,1)), u.x),
    u.y);
}

float hue2rgb(float f1, float f2, float hue) {
  if (hue < 0.0) hue += 1.0;
  else if (hue > 1.0) hue -= 1.0;
  if ((6.0 * hue) < 1.0) return f1 + (f2 - f1) * 6.0 * hue;
  if ((2.0 * hue) < 1.0) return f2;
  if ((3.0 * hue) < 2.0) return f1 + (f2 - f1) * ((2.0/3.0) - hue) * 6.0;
  return f1;
}
vec3 hsl2rgb(vec3 hsl) {
  if (hsl.y == 0.0) return vec3(hsl.z);
  float f2 = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.y * hsl.z;
  float f1 = 2.0 * hsl.z - f2;
  return vec3(
    hue2rgb(f1, f2, hsl.x + 1.0/3.0),
    hue2rgb(f1, f2, hsl.x),
    hue2rgb(f1, f2, hsl.x - 1.0/3.0));
}
vec3 rgb2hsl(vec3 col) {
  float vmax = max(max(col.r, col.g), col.b);
  float vmin = min(min(col.r, col.g), col.b);
  float c = vmax - vmin;
  vec3 hsl = vec3(0.0, 0.0, (vmax + vmin) * 0.5);
  if (c > 0.0) {
    hsl.y = hsl.z < 0.5 ? c / (vmax + vmin) : c / (2.0 - vmax - vmin);
    if (col.r == vmax) hsl.x = ((vmax - col.b) / 6.0 + c / 2.0) / c - ((vmax - col.g) / 6.0 + c / 2.0) / c;
    else if (col.g == vmax) hsl.x = ((vmax - col.r) / 6.0 + c / 2.0) / c - ((vmax - col.b) / 6.0 + c / 2.0) / c + 1.0/3.0;
    else hsl.x = ((vmax - col.g) / 6.0 + c / 2.0) / c - ((vmax - col.r) / 6.0 + c / 2.0) / c + 2.0/3.0;
    if (hsl.x < 0.0) hsl.x += 1.0;
    if (hsl.x > 1.0) hsl.x -= 1.0;
  }
  return hsl;
}
vec3 saturateColor(vec3 col, float floorSat) {
  vec3 hsl = rgb2hsl(col);
  hsl.y = max(hsl.y, floorSat);
  return hsl2rgb(hsl);
}

// ============================================================================
// SDF normal + soft shadow
// ============================================================================

// mappedScene: 在调用 sceneSDF 前对 p 应用 mirror（autoscope 风格 X/Z 对称）。
// 所有 SDF 评估（raymarch / calcNormal / softShadow）都走这个 wrapper 保持一致。
float mappedScene(vec3 p) {
  if (u_mirror.x > 0.5) p.x = abs(p.x);
  if (u_mirror.y > 0.5) p.z = abs(p.z);
  return sceneSDF(p);
}

vec3 calcNormal(vec3 p) {
  const float e = 0.0008;
  return normalize(vec3(
    mappedScene(p + vec3(e, 0, 0)) - mappedScene(p - vec3(e, 0, 0)),
    mappedScene(p + vec3(0, e, 0)) - mappedScene(p - vec3(0, e, 0)),
    mappedScene(p + vec3(0, 0, e)) - mappedScene(p - vec3(0, 0, e))
  ));
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt) {
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < 24; i++) {
    if (t >= maxt) break;
    float h = mappedScene(ro + rd * t);
    if (h < 0.0005) return 0.0;
    res = min(res, 8.0 * h / t);
    t += clamp(h, 0.01, 0.2);
  }
  return clamp(res, 0.0, 1.0);
}

// ============================================================================
// Autoscope-style space color quantization
// ============================================================================

// chessGetCol：i + cellAB chessboard offset → [0,1) palette 索引
// autoscope buffer.frag getCol() 1:1 移植：默认 i += (floor(cellAB.x)+floor(cellAB.y))%2
// 让相邻像素 cell 交错 +0/+1 → 单 cell 内部呈"双色棋盘"质感（autoscope 标志）
float chessGetCol(float i, vec2 cellAB) {
  i += mod(floor(cellAB.x) + floor(cellAB.y), 2.0);
  return mod(i, u_paletteLen) / u_paletteLen;
}

// p → 两个 [0,1) 色索引（统一 getCol：idx<0.5 → palette1，idx>=0.5 → palette2）
// 三个 autoscope 色彩限制机制 1:1 移植：
//   1. cellAB chessboard offset（chessGetCol 内部）
//   2. scene-wide objectIndex parity → c1 *= 0.5 锁死 palette1（一半 hash 只用 5-8 色）
//   3. c2 也走统一 getCol，不再硬绑 palette2 → accent 色可来自任一 palette 行
//
// objNum：raymarch 命中后 minIndex 的值；ground 用 0
// cellAB：buffer 像素坐标 floor(gl_FragCoord.xy)，控制 chessboard 交错
//
// 注意：Autoscope 原版假设场景 ~20 单位（建筑 10-20 高）；我们 LLM 输出 ~0.5-1
// 单位。同样 coldiv=1.5 在 autoscope 出 30 cells / 在我们这只出 1-2 cells →
// 整个物体一个色块看起来 mono。u_worldScale uniform 由 caller 传：MVP 8.0
// （LLM 0.5-单位 SDF），autoscope-clone 0.8（autoscope 10-单位 SDF）。
vec2 spaceCol(vec3 p, vec2 cellAB, float objNum) {
  // 不同 object 用不同色块密度（让 union 多 leaf 颜色变化丰富）
  float coldivMod = u_coldiv / (1.0 + mod(objNum, 5.0) - 2.5);
  p *= coldivMod * u_worldScale;
  // gridRot：autoscope idiom，让色块网格跟物体轴线错开 → 交叉条纹效果
  // 0 default = no rotation; π/4 or π/2 是 autoscope 常见取值
  p = rotX(u_gridRot.x) * p;
  p = rotY(u_gridRot.y) * p;
  p = rotZ(u_gridRot.z) * p;

  float i = 0.0;
  if (u_coloration == 0) {
    // 线性投影 + 7/5/3 不同权重让 X/Y/Z 色相互不对齐
    i = 7.0 * floor(p.x) + 3.0 * floor(p.z) + 5.0 * floor(p.y);
  } else if (u_coloration == 1) {
    // 物体竖纹 / 地面横纹
    i = objNum > 0.0 ? floor(p.y) : floor(p.z);
  } else {
    // 极坐标（环形色带）
    float l = floor(length(p.xz));
    float d = l * TWOPI;
    float a = floor((d / 1.0) * atan(p.x, p.z) / TWOPI + l * l) + 5.0 * floor(p.y);
    i = l + a;
  }
  i += objNum;  // object index 偏移 → 不同物体走不同色相

  float c1 = chessGetCol(i, cellAB);
  // autoscope buffer.frag:336 scene-wide parity：objectIndex 是 emitObjectIndex 编译时
  // 生成的全局，scene() 末尾值 = 总 imin 调用次数（每个像素都一样）。
  // 奇数 → c1 *= 0.5 → c1 < 0.5 → paletteColByIdx 锁死 palette1（单图 5-8 色）
  // 偶数 → c1 不变 → 可能 palette1 或 palette2（10-12 色）
  if (mod(objectIndex, 2.0) == 1.0) c1 *= 0.5;

  float c2 = chessGetCol(objNum, cellAB);
  return vec2(c1, c2);
}

// 统一 paletteColByIdx：idx ∈ [0,1)，idx<0.5 → palette1，idx>=0.5 → palette2
// autoscope main.frag:155 getCol() 1:1 移植
vec3 paletteColByIdx(float idx) {
  float row = idx >= 0.5 ? 0.5 : 0.0;  // y=0.75 (palette2) or y=0.25 (palette1)
  if (idx >= 0.5) idx -= 0.5;
  idx *= 2.0;  // remap [0, 0.5) → [0, 1)
  float u = fract(idx + (1.0 / u_paletteLen) * 0.5);
  return texture2D(u_palette, vec2(u, row + 0.25)).rgb;
}

// 旧 paletteCol(idx, row)：硬绑 row 0/1 选择，1-pass mode（非 autoscope-clone）继续用
vec3 paletteCol(float idx, float row) {
  float u = fract(idx + (1.0 / u_paletteLen) * 0.5);
  return texture2D(u_palette, vec2(u, row * 0.5 + 0.25)).rgb;
}

vec3 sky(vec3 rd) {
  float t = 0.5 * (rd.y + 1.0);
  return mix(u_sky2, u_sky1, t);
}

// 阴影 4 种风格（Autoscope u_shadow 0/1/2/3）
vec3 shadeShadow(vec3 col) {
  if (u_shadowMode == 0) {
    // channel swap brg + 部分变暗
    col.rgb = col.brg;
    col.rg *= u_shadowStrength;
  } else if (u_shadowMode == 1) {
    col *= u_shadowStrength;
    vec3 h = rgb2hsl(col);
    col = hsl2rgb(vec3(h.x + 0.5, h.y, h.z));  // hue 旋 180°
  } else if (u_shadowMode == 2) {
    col *= u_shadowStrength;
    vec3 h = rgb2hsl(col);
    col = hsl2rgb(vec3(h.x + 0.25, h.y, h.z));  // hue 旋 90°
  } else {
    col *= u_shadowStrength;  // 直接暗化
  }
  return col;
}

// ============================================================================
// 主入口
// ============================================================================

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  vec3 rd = normalize(uv.x * u_camRight + uv.y * u_camUp + u_focal * u_camFwd);
  vec3 ro = u_camPos;

  // Autoscope twist：每个像素的 ray 沿 uv.y 比例绕轴旋转，做出"竖线弧形弯曲"效果
  // u_twist=0 时跳过（perf saver）
  if (u_twist != 0.0) {
    float angle = uv.y * u_twist;
    mat3 tw;
    if (u_twistType == 0)      tw = rotY(angle);
    else if (u_twistType == 1) tw = rotZ(angle);
    else                       tw = rotX(angle);
    ro = tw * ro;
    rd = tw * rd;
  }

  // ---- Raymarch（同时跟 ground 比较；用 minIndex 记 object id）----
  float t = 0.0;
  bool hit = false;
  bool hitGround = false;
  float lastObjIdx = 0.0;
  vec3 hitP = vec3(0.0);

  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d_obj = mappedScene(p);  // 这一调用更新全局 minIndex
    float curObjIdx = minIndex;  // 缓存：下次 sceneSDF 调用会覆盖

    float d_gnd = u_groundOn > 0.5 ? (p.y - GROUND_Y) : 1e6;
    float d = min(d_obj, d_gnd);

    if (d < EPS) {
      hit = true;
      hitP = p;
      if (d_gnd < d_obj) hitGround = true;
      else lastObjIdx = curObjIdx;
      break;
    }
    if (t > MAX_DIST) break;
    t += d;
  }

  vec3 col;
  if (!hit) {
    col = sky(rd);
  } else {
    vec3 n = hitGround ? vec3(0.0, 1.0, 0.0) : calcNormal(hitP);
    vec3 toLight = normalize(u_lightPos - hitP);
    float diff = max(dot(n, toLight), 0.0);

    // Object number: ground = 0, 物体 = lastObjIdx
    float objNum = hitGround ? 0.0 : lastObjIdx;

    // cellAB：buffer 像素坐标，喂 spaceCol 做 chessboard offset（autoscope idiom）
    vec2 cellAB = floor(gl_FragCoord.xy);

    // 双层 spaceCol + HSL hue mix —— Autoscope main.frag 的 BOB 点彩签名
    // Layer 1 (lo)：小幅低频噪声扰动 → "主色"层
    vec3 pn1 = hitP + 0.04 * vec3(
      gnoise(hitP.xz * 2.0),
      gnoise(hitP.xy * 2.0 + 50.0),
      gnoise(hitP.yz * 2.0 + 100.0)
    );
    vec2 ci1 = spaceCol(pn1, cellAB, objNum);
    // 2-pass mode（autoscope-clone）：用 unified paletteColByIdx → 走 autoscope-faithful row 切换
    // 1-pass mode（MVP）：用旧 paletteCol(idx, row=0/1) → 保持原视觉
    vec3 lo;
    if (u_simpleColor > 0.5) {
      lo = mix(paletteColByIdx(ci1.x), paletteColByIdx(ci1.y), 0.25);
      col = lo;
    } else {
      lo = mix(paletteCol(ci1.x, 0.0), paletteCol(ci1.y, 1.0), 0.25);
      // 1-pass mode：world-space dual-layer HSL mix（近似 autoscope grain）
      vec3 pn2 = hitP + 0.18 * vec3(
        gnoise(hitP.xz * 8.0 + 13.0),
        gnoise(hitP.xy * 8.0 + 200.0),
        gnoise(hitP.yz * 8.0 + 300.0)
      );
      vec2 ci2 = spaceCol(pn2, cellAB, objNum);
      vec3 hi = mix(paletteCol(ci2.x, 0.0), paletteCol(ci2.y, 1.0), 0.25);
      vec3 hslLo = rgb2hsl(lo);
      vec3 hslHi = rgb2hsl(hi);
      col = hsl2rgb(vec3(
        mix(hslLo.x, hslHi.x, 0.6),
        hslLo.y,
        mix(hslLo.z, hslHi.z, 0.4)
      ));
      col = mix(col, lo, 0.25);
    }

    // BINARY shadow（Autoscope 签名 —— 不做 Lambert 平滑过渡，保留色块锐利）
    //   1. 法向背向光源 (diff<0.05) → 自遮挡 shadow
    //   2. soft-shadow raymarch < 0.5 → 被其它物体挡 shadow
    //   3. 其它 → 全亮 (palette block 原色不变)
    bool inShadow = (diff < 0.05);
    if (!inShadow && u_shadowsOn > 0.5) {
      float shadowK = softShadow(hitP + n * 0.002, toLight, 0.02, length(u_lightPos - hitP));
      if (shadowK < 0.5) inShadow = true;
    }
    if (inShadow) col = shadeShadow(col);

    // 远雾（Autoscope idiom）：只 t>5 才开始衰减，max 40% 混入 sky
    float fogT = max(0.0, (t - 5.0) / MAX_DIST);
    col = mix(col, sky(rd), min(fogT * 0.4, 0.4));
  }

  // 提饱和度（避免发灰）+ 曝光（autoscope idiom：sRGB palette 直输，不做 gamma）
  col = saturateColor(col, u_saturation);
  col *= u_exposure;
  col = clamp(col, 0.0, 1.0);

  // Depth signal in alpha：sky / 远处 = 1，近物 = 0。post pass 用这个 scale 扰动
  // → autoscope idiom：sky 像素 11× X 扰动 → col2 采远处 cell → grain 出现在 sky
  float depthSignal = hit ? clamp((t - 5.0) / MAX_DIST, 0.0, 1.0) : 1.0;
  gl_FragColor = vec4(col, depthSignal);
}`;
}

// ============================================================================
// Controller
// ============================================================================

export function createBobShaderRenderer({
  canvas, getControls, onCamUpdate, onFps, onPaletteChange,
  twoPass = false,           // ← autoscope 2-pass FBO + post-process
  bufferResolution = 320,    // FBO 边长（默认 320×320 — autoscope idiom）
}) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL not supported');

  const camState = { position: [0, 0.3, -3.0], yaw: 0, pitch: 0 };
  const defaultCam = { position: [...camState.position], yaw: 0, pitch: 0 };

  let program = null;
  let uniformsCache = {};
  let rafId = null;
  let flyHandle = null;
  let paletteState = null;  // { tex, length, palette1, palette2, paper, sky1, sky2 }

  // ---- one-time vbuf + vs ----
  const vbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

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

  const vs = compileShader(VS_SRC, gl.VERTEX_SHADER);

  // ---- 2-pass FBO setup（autoscope sand painting）------------------------
  let fbo = null, bufferTex = null;
  let postProgram = null, postUniforms = {};
  if (twoPass) {
    // Color attachment: bufferResolution × bufferResolution RGBA8
    bufferTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, bufferTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bufferResolution, bufferResolution, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);  // autoscope idiom: 块状放大
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bufferTex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`FBO incomplete (status ${status})`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Compile post-process program（一次性，跟 sceneSDF 无关）
    const postFS = compileShader(POST_FS_SRC, gl.FRAGMENT_SHADER);
    postProgram = gl.createProgram();
    gl.attachShader(postProgram, vs);
    gl.attachShader(postProgram, postFS);
    gl.linkProgram(postProgram);
    if (!gl.getProgramParameter(postProgram, gl.LINK_STATUS)) {
      throw new Error(`postProgram link failed: ${gl.getProgramInfoLog(postProgram)}`);
    }
    for (const name of [
      'u_buffer', 'u_resolution', 'u_bufferRes', 'u_time',
      'u_postNoise', 'u_postNFactor', 'u_postNoiseCap',
    ]) {
      postUniforms[name] = gl.getUniformLocation(postProgram, name);
    }
  }

  // ---- camera math ----
  function computeFwd(yaw, pitch) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    return [sy * cp, -sp, cy * cp];
  }
  function computeRight(fwd) {
    const m = Math.hypot(fwd[2], fwd[0]);
    if (m < 1e-6) return [1, 0, 0];
    return [fwd[2] / m, 0, -fwd[0] / m];
  }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function lightFromSpherical(azim, alt, dist) {
    return [
      dist * Math.sin(azim) * Math.cos(alt),
      dist * Math.sin(alt),
      -dist * Math.cos(azim) * Math.cos(alt),
    ];
  }

  // ---- palette ----
  function rebakePalette() {
    if (paletteState && paletteState.tex) gl.deleteTexture(paletteState.tex);
    const palette1 = pickShuffled(PALETTES);
    const palette2 = pickShuffled(PALETTES);
    const paper    = pick(PAPERS);
    const sky      = pickShuffled(SKIES);
    const sky1     = sky[0];
    const sky2     = sky[1 % sky.length];
    const { tex, length } = bakePaletteTexture(gl, palette1, palette2, paper);
    paletteState = {
      tex, length,
      paletteVec: { paper: hexToVec3(paper), sky1: hexToVec3(sky1), sky2: hexToVec3(sky2) },
      sample: { palette1, palette2, paper, sky1, sky2 },
    };
    if (onPaletteChange) onPaletteChange(paletteState.sample);
    return paletteState;
  }

  // ---- upload SDF (compile shader + cache uniforms) ----
  function uploadSDF(sdf) {
    const result = compileSDF3ToGLSL(sdf, {
      sceneFnName: 'sceneSDF',
      includeLibrary: true,
      emitObjectIndex: true,  // BOB GPU 关键：side-effect imin → minIndex 给 spaceCol 用
    });
    if (result.error) throw new Error(`compileSDF3ToGLSL: ${result.error}`);

    let fs;
    try {
      fs = compileShader(buildFragmentShader(result.glsl), gl.FRAGMENT_SHADER);
    } catch (e) {
      console.error('Full FS source:\n', buildFragmentShader(result.glsl));
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
      'u_lightPos', 'u_time', 'u_palette', 'u_paletteLen',
      'u_paper', 'u_sky1', 'u_sky2',
      'u_coldiv', 'u_coloration', 'u_shadowMode', 'u_shadowStrength',
      'u_shadowsOn', 'u_groundOn', 'u_noiseSpeed', 'u_exposure', 'u_saturation', 'u_worldScale',
      'u_mirror', 'u_twist', 'u_twistType', 'u_gridRot', 'u_simpleColor',
    ]) {
      uniformsCache[name] = gl.getUniformLocation(program, name);
    }

    if (!paletteState) rebakePalette();
    return result.glsl.length;
  }

  const startTime = performance.now();

  function draw() {
    if (!program || !paletteState) return;
    const c = getControls();

    const fwd = computeFwd(camState.yaw, camState.pitch);
    const right = computeRight(fwd);
    const up = cross(fwd, right);
    const lpos = lightFromSpherical(c.lightAzim, c.lightAlt, c.lightDist);
    const tSec = (performance.now() - startTime) / 1000;

    // ---- Pass 1: render scene SDF（直接到 canvas 或先到 FBO）----
    if (twoPass) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, bufferResolution, bufferResolution);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    gl.useProgram(program);
    // 切 program 后必须重 bind attribute pointer
    const a_pos1 = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(a_pos1);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.vertexAttribPointer(a_pos1, 2, gl.FLOAT, false, 0, 0);

    const targetW = twoPass ? bufferResolution : canvas.width;
    const targetH = twoPass ? bufferResolution : canvas.height;
    gl.uniform2f(uniformsCache.u_resolution, targetW, targetH);
    gl.uniform3f(uniformsCache.u_camPos, ...camState.position);
    gl.uniform3f(uniformsCache.u_camFwd, ...fwd);
    gl.uniform3f(uniformsCache.u_camRight, ...right);
    gl.uniform3f(uniformsCache.u_camUp, ...up);
    gl.uniform1f(uniformsCache.u_focal, c.fov);
    gl.uniform3f(uniformsCache.u_lightPos, ...lpos);
    gl.uniform1f(uniformsCache.u_time, tSec);

    // palette texture binding
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, paletteState.tex);
    gl.uniform1i(uniformsCache.u_palette, 0);
    gl.uniform1f(uniformsCache.u_paletteLen, paletteState.length);

    gl.uniform3f(uniformsCache.u_paper, ...paletteState.paletteVec.paper);
    gl.uniform3f(uniformsCache.u_sky1, ...paletteState.paletteVec.sky1);
    gl.uniform3f(uniformsCache.u_sky2, ...paletteState.paletteVec.sky2);

    gl.uniform1f(uniformsCache.u_coldiv, c.coldiv);
    gl.uniform1i(uniformsCache.u_coloration, c.coloration | 0);
    gl.uniform1i(uniformsCache.u_shadowMode, c.shadowMode | 0);
    gl.uniform1f(uniformsCache.u_shadowStrength, c.shadowStrength);
    gl.uniform1f(uniformsCache.u_shadowsOn, c.shadowsOn ? 1.0 : 0.0);
    gl.uniform1f(uniformsCache.u_groundOn, c.groundOn ? 1.0 : 0.0);
    gl.uniform1f(uniformsCache.u_noiseSpeed, c.noiseSpeed);
    gl.uniform1f(uniformsCache.u_exposure, c.exposure);
    gl.uniform1f(uniformsCache.u_saturation, c.saturation);
    gl.uniform1f(uniformsCache.u_worldScale, c.worldScale ?? 8.0);
    // Autoscope randomization knobs（caller 不传则全 0 = 无效果）
    gl.uniform2f(uniformsCache.u_mirror, c.mirrorX ? 1.0 : 0.0, c.mirrorZ ? 1.0 : 0.0);
    gl.uniform1f(uniformsCache.u_twist, c.twist ?? 0.0);
    gl.uniform1i(uniformsCache.u_twistType, (c.twistType ?? 0) | 0);
    const gr = c.gridRot ?? [0, 0, 0];
    gl.uniform3f(uniformsCache.u_gridRot, gr[0], gr[1], gr[2]);
    // 2-pass 模式让 pass 1 出纯 palette 色，pass 2 做 dual-sample HSL grain
    gl.uniform1f(uniformsCache.u_simpleColor, twoPass ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // ---- Pass 2: post-process FBO → canvas（autoscope sand painting）----
    if (twoPass) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);

      gl.useProgram(postProgram);
      const a_pos2 = gl.getAttribLocation(postProgram, 'a_pos');
      gl.enableVertexAttribArray(a_pos2);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
      gl.vertexAttribPointer(a_pos2, 2, gl.FLOAT, false, 0, 0);

      // 跟 palette (TEXTURE0) 分开用 TEXTURE1
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, bufferTex);
      gl.uniform1i(postUniforms.u_buffer, 1);
      gl.uniform2f(postUniforms.u_resolution, canvas.width, canvas.height);
      gl.uniform2f(postUniforms.u_bufferRes, bufferResolution, bufferResolution);
      gl.uniform1f(postUniforms.u_time, tSec);
      gl.uniform1f(postUniforms.u_postNoise, c.postNoise ?? 1.0);
      gl.uniform1f(postUniforms.u_postNFactor, c.postNFactor ?? 1.0);
      gl.uniform1f(postUniforms.u_postNoiseCap, c.postNoiseCap ?? 0.5);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
      if (!rafId) {
        fpsLast = performance.now();
        frameCount = 0;
        loop();
      }
      return { bytes };
    },
    unmount() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (flyHandle) { flyHandle.detach(); flyHandle = null; }
    },
    shufflePalette() {
      rebakePalette();
    },
    resetCamera() {
      camState.position = [...defaultCam.position];
      camState.yaw = defaultCam.yaw;
      camState.pitch = defaultCam.pitch;
    },
    canRender(sdf) {
      return canCompileSDF3(sdf);
    },
    getCamState() { return { ...camState, position: [...camState.position] }; },
    setCamState(patch) {
      if (patch.position) camState.position = [...patch.position];
      if (patch.yaw != null)   camState.yaw   = patch.yaw;
      if (patch.pitch != null) camState.pitch = patch.pitch;
    },
    getPaletteSample() { return paletteState?.sample ?? null; },
  };
}
