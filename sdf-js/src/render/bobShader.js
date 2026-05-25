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
// Post-process fragment shader — 2026-05-23 autoscope main.frag 1:1 port
// -----------------------------------------------------------------------------
// Buffer FBO 现在存的是 vec4(c1, c2, shadowFlag, depth) 索引而非 resolved color。
// Post FS 做：palette lookup + per-pixel cell membership + neighbor blur +
//             double-sample HSL mix + margin border + low-res AA。
//
// 关键架构（跟 BOB v1 的"FBO 直接 RGB"完全不同）：
//   1. 每像素 → cellAB / cellUV (autoscope grid 概念)
//   2. sampleCell(cellAB) 取 (c1, c2, shadow, depth)
//   3. renderCell：palette getCol + sky branch + 4 种 shadow mode 都在这里
//   4. 4 邻居 cell distance-thresholded blur (noise-driven d) — 棋盘"渗透"质感
//   5. renderPixel × 2 (col1 紧 / col2 大噪声) → HSL hue mix or 直乘
//   6. paper margin border
//   7. 低分辨率 3-sample AA
// =============================================================================
const POST_FS_SRC = `#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_buffer;
uniform sampler2D u_palette;
uniform vec2  u_resolution;
uniform vec2  u_bufferRes;
uniform float u_time;
uniform float u_paletteLen;
uniform vec3  u_sky1;
uniform vec3  u_sky2;
uniform vec3  u_bg;             // paper / 边距底色
uniform float u_grid;           // post FS 的 cell 数（autoscope u_grid，跟 bufferRes 通常一样）
uniform float u_ratio;          // canvas aspect ratio (w/h)
uniform int   u_renderType;     // 0 = HSL hue remap; 1 = col1 × col2 直乘
uniform int   u_shadow;         // shadow mode 0..3
uniform float u_shadowStrength;
uniform float u_margin;         // paper border 比例 (0.08..0.2 typical)
uniform float u_saturation;     // saturate floor
uniform float u_exposure;
uniform float u_colorLeak;      // autoscope u_colorLeak: 多少 col1 raw 漏过
uniform float u_noiseCap;       // patches clamp 上限
uniform float u_nFactor;        // octave noise nFactor
uniform float u_nOffset;        // noise offset
uniform float u_rotateCanvas;   // canvas drift rad/sec (autoscope idiom)
uniform float u_seed;           // hash 种子

#define OCTAVES 8
#define NOISESPEED 0.00008
#define PI 3.1415926538
#define TWOPI 6.2831853072
#define sqrt05 0.7071067812

// autoscope 同款 xFactor：buffer 实际宽度可能跟 grid*ratio 略差，做 UV 补偿
float xFactor = (u_bufferRes.x / u_bufferRes.y) / u_ratio;

// ---- 噪声 (autoscope 同款 random / grad / noise / octaves) -------------------
float bobHashTime(vec2 p) {
  p += u_time * NOISESPEED;
  vec3 p3 = fract(vec3(p.xyx + 1.0 + u_seed * 0.0001) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 grad2(ivec2 z) {
  float a = bobHashTime(vec2(z.x, z.y)) * TWOPI;
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

// ---- HSL utils (glsl-hsl2rgb) ----------------------------------------------
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
vec3 saturateColor(vec3 col, float floorSat) {
  vec3 h = rgb2hsl(col);
  h.y = max(h.y, floorSat);
  return hsl2rgb(h);
}
vec2 rotate2D(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c) * p;
}

// ---- buffer / palette sampling ---------------------------------------------
// buffer FBO 存 vec4(c1, c2, shadowFlag, depth)
//   c1, c2 ∈ [0, 1) — palette indices
//   shadowFlag: 0=in shadow, 1=lit (autoscope convention)
//   depth: clamp((t-5)/MAX_DIST, 0, 1)
// Note: autoscope main.frag flips Y to compensate for p5.js top-left origin
// vs WebGL bottom-left. We render raw WebGL → no flip needed.
vec4 sampleCell(vec2 sampleUV) {
  return texture2D(u_buffer, vec2(sampleUV.x * xFactor, sampleUV.y));
}

// getCol：palette index ∈ [0,1) → palette texture lookup
// idx < 0.5 → palette1 (y=0.25)；idx >= 0.5 → palette2 (y=0.75)
vec3 getCol(float i) {
  float y = 0.25;
  if (i >= 0.5) { y = 0.75; i -= 0.5; }
  i *= 2.0;
  return texture2D(u_palette, vec2(i + (1.0 / u_paletteLen) * 0.5, y)).rgb;
}

// renderCell：取一个 cell 的最终色（含 sky / shadow mode 4 种）
// base = 上一层 cell 颜色，用 min(base, col) 让前景压暗背景（autoscope idiom）
// cellAB = 当前 cell 的整数坐标（post-FS 网格），用于 sky chess (per-cell 大块棋盘，
// 不是 per-buffer-pixel 小棋盘 dither)
vec4 renderCell(vec2 uv, vec3 base, vec2 cellAB) {
  uv.y *= u_ratio;
  vec2 sampleUV = fract(uv * 0.5 + 0.5);
  vec4 bufferData = sampleCell(sampleUV);
  float c1 = bufferData.r;
  float c2 = bufferData.g;
  float shadowFlag = bufferData.b;
  float dist = bufferData.a;

  vec3 col = base;
  if (c1 > 0.99 && c2 > 0.99) {
    // Sky: sky1/sky2 by per-cell chess. Compute chess from cellAB at post-FS
    // granularity (not buffer-pixel). Bold large cells matching autoscope ref.
    float skyChess = mod(floor(cellAB.x) + floor(cellAB.y), 2.0);
    col = (skyChess == 0.0) ? u_sky1 : u_sky2;
  } else {
    // Object: palette1 × palette2 25% mix
    col = mix(getCol(c1), getCol(c2), 0.25);
    if (shadowFlag == 0.0) {
      // In shadow — 4 modes
      if (u_shadow == 0) {
        col.rgb = col.brg;
        col.rg *= u_shadowStrength;
      } else if (u_shadow == 1) {
        col *= u_shadowStrength;
        vec3 h = rgb2hsl(col);
        col = hsl2rgb(vec3(h.x + 0.5, h.y, h.z));
      } else if (u_shadow == 2) {
        col *= u_shadowStrength;
        vec3 h = rgb2hsl(col);
        col = hsl2rgb(vec3(h.x + 0.25, h.y, h.z));
      } else {
        col *= u_shadowStrength;
      }
    }
  }
  return vec4(min(base, col), dist);
}

// renderPixel：核心。给屏幕 (pixelXY) → 算出该像素属于哪个 cell + 4 邻居 blur
//   xNoise / yNoise / nFactor 控制 UV perturbation（col1 用小 / col2 用大）
vec4 renderPixel(vec2 pixelXY, float xNoise, float yNoise, float nFactor) {
  vec2 uv = 2.0 * (pixelXY / u_resolution.xy - 0.5);
  uv.y /= u_ratio;
  uv = rotate2D(uv, u_rotateCanvas * u_time);  // canvas drift

  // patches = 低频 noise 强度 modulator
  if (u_renderType == 0) {
    float patches = clamp(octaves(uv + 4.0, 2.0, 0.8, 0.5, nFactor), 0.04, u_noiseCap);
    uv += vec2(
      (octaves(uv + 2.0, 2.0, 0.95, 0.95, nFactor) + u_nOffset) * xNoise * patches,
      (octaves(uv,       2.0, 0.95, 0.95, nFactor) + u_nOffset) * yNoise * patches
    );
  } else {
    float patches = clamp(octaves(uv + 4.0, 2.0, 0.8, 0.5, nFactor) + 0.95, 0.04, u_noiseCap);
    uv -= vec2(
      (octaves(uv + 2.0, 10.0, 0.95, 0.95, nFactor) + u_nOffset) * xNoise * patches,
      (octaves(uv,       10.0, 0.95, 0.95, nFactor) + u_nOffset) * yNoise * patches
    );
  }

  // Cell membership: 把 uv 转回屏幕坐标 → 算出 cellAB / cellUV
  float cellSizePixels = u_resolution.y / u_grid;
  vec2 cellSizeUV = vec2(cellSizePixels) / u_resolution.xy;
  vec2 uvnorm = uv;
  uvnorm.y *= u_ratio;
  vec2 xy = (uvnorm * 0.5 + 0.5) * u_resolution.xy;
  vec2 cellAB = floor(xy / cellSizePixels);
  vec2 cellUV = fract(xy / cellSizePixels);

  vec4 cell = renderCell(uv, u_bg, cellAB);
  vec3 col = cell.rgb;

  // 4-邻居 cell blur — noise-driven distance threshold (autoscope main.frag 1:1)
  // d 是 cell 单元内的半径阈值，noise 让 d 不规则 → "棋盘单元渗透"质感。
  // 邻居 cellAB shifts by neighbor offset (用于 sky chess 在邻居单元的正确 hue)
  float d = sqrt05 + 0.1 + 0.5 * octaves(cellAB.x * cellAB.y + cellUV * 0.5, 5.0, 0.5, 0.5, nFactor);
  if (distance(cellUV, vec2(0.5, -0.5)) < d) {
    col = renderCell(uv + vec2(0.0, -1.0) * cellSizeUV, col.rgb, cellAB + vec2(0.0, -1.0)).rgb;
  } else if (distance(cellUV, vec2(-0.5, 0.5)) < d) {
    col = renderCell(uv + vec2(-1.0, 0.0) * cellSizeUV, col.rgb, cellAB + vec2(-1.0, 0.0)).rgb;
  } else if (distance(cellUV, vec2(1.5, 0.5)) < d) {
    col = renderCell(uv + vec2(1.0, 0.0) * cellSizeUV, col.rgb, cellAB + vec2(1.0, 0.0)).rgb;
  } else if (distance(cellUV, vec2(0.5, 1.5)) < d) {
    col = renderCell(uv + vec2(0.0, 1.0) * cellSizeUV, col.rgb, cellAB + vec2(0.0, 1.0)).rgb;
  }
  return vec4(col, cell.w);
}

// render：double-sample (col1 cell-locked / col2 大 noise) + HSL mix or 直乘
vec3 render(vec2 xy) {
  vec3 col;
  vec2 uv = 2.0 * (gl_FragCoord.xy / u_resolution.xy - 0.5);
  uv.y /= u_ratio;
  float amount = octaves(-uv, 5.0, 0.95, 0.95, u_nFactor);

  // col1: 紧贴 cell（autoscope: xNoise=0.001, yNoise=0.001 or 0.0025）
  vec4 col1 = (u_renderType == 0)
    ? renderPixel(xy, 0.001, 0.001, 0.0)
    : renderPixel(xy, 0.001, 0.0025, u_nFactor);
  // col2: 大 Y noise 采远处 cell（autoscope: yNoise=0.15*amount）
  vec4 col2 = renderPixel(xy, 0.002 + col1.w * 0.02, 0.15 * amount, u_nFactor);

  // 远景雾：dist<1 时朝 sky 靠拢
  if (col1.w < 1.0) {
    col1.rgb = mix(col1.rgb, u_sky1, col1.w * 0.4);
    col2.rgb = mix(col2.rgb, u_sky2, col1.w * 0.4);
  }

  if (u_renderType == 0) {
    // HSL hue 重映射：col1 sat+lum + col2 hue mix (sky=0.35, object=0.9)
    vec3 hsl1 = rgb2hsl(col1.rgb);
    vec3 hsl2 = rgb2hsl(col2.rgb);
    col = mix(
      hsl2rgb(vec3(
        mix(hsl1.x, hsl2.x, (col1.w == 1.0) ? 0.35 : 0.9),
        hsl1.y,
        hsl1.z
      )),
      col1.rgb,
      u_colorLeak
    );
    col *= u_exposure * 0.5;
  } else {
    // Direct multiply: col1 * col2 — deeper / darker palette
    col = mix(col1.rgb * col2.rgb * u_exposure, col1.rgb, 0.2);
  }
  return saturateColor(col, u_saturation);
}

// ---- 主入口：paper margin border + low-res 3-sample AA ----------------------
void main() {
  vec3 col = u_bg;
  float b = u_resolution.y * u_margin * 0.5;
  bool outside = gl_FragCoord.y < b || gl_FragCoord.y > u_resolution.y - b
              || gl_FragCoord.x < b || gl_FragCoord.x > u_resolution.x - b;
  if (!outside) {
    if (u_resolution.y < 1000.0) {
      // 低分辨率：3 偏移点平均（廉价 AA）
      vec3 c1 = render(gl_FragCoord.xy);
      vec3 c2 = render(gl_FragCoord.xy + vec2(1.0, 0.0));
      vec3 c3 = render(gl_FragCoord.xy + vec2(0.0, 1.0));
      col = mix(c1, mix(c2, c3, 0.5), 0.5);
    } else {
      col = render(gl_FragCoord.xy);
    }
  }
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
// Autoscope 移植 idiom #1: chessGetCol 周期参数（cellAB.x*xMod + cellAB.y*yMod）
// xMod/yMod=1 = 默认 (BOB v1 行为)；2/3 = 棋盘密度变化；0 = 无 offset 平涂
uniform float u_xMod;         // chessboard period X axis (autoscope: r([1,2,2,2,3]))
uniform float u_yMod;         // chessboard period Y axis
// Autoscope 移植 idiom #3: 第二种 palette 应用方式
//   0 = HSL hue 重映射 (BOB v1)；1 = palette1/palette2 直 mix，无 HSL
uniform int   u_renderType;
// Autoscope 移植 idiom #5: canvas-level 时间漂移 (rad/sec)。-0.015..0.015 典型
// 极慢（10 分钟一圈），但能让静止场景"活起来"。
uniform float u_rotateCanvas;
// Autoscope 移植 idiom #6: 9 种 ambient 动画模式（1:1 移植 autoscope buffer.frag）
//   0 = off (default), 1-9 = camera/view/uv/light 各种 time-driven 漂移
uniform int   u_animation;
uniform float u_length;       // 动画 cycle 长度（sec），mode 8/9 光源振荡周期

#define PI       3.1415926535
#define TWOPI    6.2831853071
// MVP 用 0.5-unit SDF 不需要远 raymarch；autoscope-clone 跨度 50+ 单位需要远
// 兼顾两者：200 dist + 200 steps（GPU 上仍 60fps 在大多数现代显卡）
#define MAX_STEPS 200
#define MAX_DIST  200.0
#define EPS       0.001
#define GROUND_Y  -1.0

// ============================================================================
// 噪声 + HSL 工具（IQ XdXGW8 hash + glsl-hsl2rgb）
// Note: bobHashTime replaces a local hash13 that collided with noise.glsl's
// canonical hash13 (Hoskins 1->3 naming). Same math, time-drifted, vec3->float.
// ============================================================================

float bobHashTime(vec3 p3) {
  p3 += u_time * u_noiseSpeed;
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 grad2(vec2 z) {
  float a = bobHashTime(vec3(z, 0.0)) * TWOPI;
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

// Binary occlusion test — matches autoscope's getLight() idiom. Returns 1.0
// if light is unobstructed, 0.0 if blocked. Uses standard sphere tracing
// (step = actual SDF distance) instead of clamped soft-shadow stepping, so
// it can reach across the whole scene (autoscope uses 500 steps × MAX_DIST=200).
// Tall thin columns / lighthouses now cast long ground shadows because the
// raymarch from a far ground point toward the light actually reaches them.
float lightOcclusion(vec3 ro, vec3 rd, float mint, float maxt) {
  float t = mint;
  for (int i = 0; i < 80; i++) {
    if (t >= maxt) break;
    float h = mappedScene(ro + rd * t);
    if (h < 0.001) return 0.0;   // blocked: ray hit an SDF before reaching light
    t += max(h, 0.02);            // sphere tracing — step by actual distance
  }
  return 1.0;                     // ray reached light unobstructed
}

// ============================================================================
// Autoscope-style space color quantization
// ============================================================================

// chessGetCol：autoscope buffer.frag getCol() 1:1 移植（2026-05-23 修正版）
//   xMod==0 && yMod==0  → 2-state chess: i += mod(floor(x)+floor(y), 2)
//                         autoscope hash 20% 比例走这条（标准 2 色 staircase）
//   xMod>0  / yMod>0    → multi-state offset: i += mod(floor(x), xMod) + mod(floor(y), yMod)
//                         autoscope 80% 走这条；xMod=1 → offset=0 (无 chess)；xMod=2/3 → multi-state
//
// 2026-05-23 fix: 之前版本写反了 — 用 floor(x*xMod) mod 2 而不是 mod(floor(x), xMod)。
// 二者完全不同语义。autoscope 是 multi-state staircase；我之前是 2-state at finer grid。
// 视觉差很大；新版本严格按 autoscope main.frag getCol() 语义实现。
float chessGetCol(float i, vec2 cellAB) {
  if (u_xMod == 0.0 && u_yMod == 0.0) {
    i += mod(floor(cellAB.x) + floor(cellAB.y), 2.0);
  } else {
    float xm = max(u_xMod, 0.001);
    float ym = max(u_yMod, 0.001);
    i += mod(floor(cellAB.x), xm) + mod(floor(cellAB.y), ym);
  }
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
  } else if (u_coloration == 2) {
    // 极坐标（环形色带）
    float l = floor(length(p.xz));
    float d = l * TWOPI;
    float a = floor((d / 1.0) * atan(p.x, p.z) / TWOPI + l * l) + 5.0 * floor(p.y);
    i = l + a;
  } else {
    // Autoscope 移植 idiom #4: hash-cell coloration mode 3
    // 每个 floor(p) 格子拿一个 deterministic hash → Voronoi-like 色彩分布
    // autoscope: r() < .025 ? 3 : ... — 2.5% rate，出现时画面有种"随机马赛克"质感
    vec3 cell = floor(p);
    float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    i = floor(h * 100.0) + 5.0 * floor(p.y);
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
  vec3 base = mix(u_sky2, u_sky1, t);
  // Subtle procedural chroma variation — adds stipple texture on top of the
  // dual-color gradient. With sky1/sky2 now cross-palette picked, the
  // gradient itself has hue contrast; this just adds fine-grain breakup.
  float n = gnoise(rd.xy * 4.0);
  base += 0.04 * vec3(n, -n * 0.5, n * 0.3);
  return clamp(base, 0.0, 1.0);
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

  // Autoscope 移植 idiom #5: canvas-level 缓慢漂移。u_rotateCanvas (rad/sec)
  // 跟 u_time 相乘 → 整个画面绕屏幕中心慢转。0.015 rad/s = 7 分钟一圈，
  // 极微但能让静图"活着"。0 = 关闭。
  if (u_rotateCanvas != 0.0) {
    float ca_angle = u_time * u_rotateCanvas;
    float ca = cos(ca_angle), sa = sin(ca_angle);
    uv = mat2(ca, -sa, sa, ca) * uv;
  }

  // Autoscope 移植 idiom #6: animation modes 6 & 7 (uv distortion)
  //   6 = radial zoom: 边缘像素远离中心 → "放射" feel
  //   7 = horizontal zoom: x²-weighted → 左右两边持续放大
  if (u_animation == 6) {
    uv *= 1.0 + u_time * 0.05 * length(uv);
  } else if (u_animation == 7) {
    uv.x *= 1.0 + u_time * 0.05 * abs(uv.x) * abs(uv.x);
  }

  vec3 rd = normalize(uv.x * u_camRight + uv.y * u_camUp + u_focal * u_camFwd);
  vec3 ro = u_camPos;

  // Autoscope 移植 idiom #6: animation modes 1-5 (camera / view transform)
  //   1 = dolly-in (ro along forward)
  //   2 = orbit + dolly-out (ro+rd 绕 Y 转，同时后退)
  //   3 = lateral X drift
  //   4 = yaw-only (rd 绕 Y 转，ro 不动)
  //   5 = zoom-in (faster dolly-in than mode 1)
  if (u_animation == 1) {
    ro += u_camFwd * u_time * 0.10;
  } else if (u_animation == 2) {
    // Orbit + dolly-out — speed halved 2026-05-23 per user
    float a = u_time * 0.025;
    float c2 = cos(a), s2 = sin(a);
    mat3 Rm = mat3(c2, 0.0, s2,  0.0, 1.0, 0.0,  -s2, 0.0, c2);
    ro = Rm * ro;
    rd = Rm * rd;
    ro -= u_camFwd * u_time * 0.05;
  } else if (u_animation == 3) {
    ro.x += u_time * 0.05;
  } else if (u_animation == 4) {
    float a = u_time * 0.03;
    float c4 = cos(a), s4 = sin(a);
    mat3 Rv = mat3(c4, 0.0, s4,  0.0, 1.0, 0.0,  -s4, 0.0, c4);
    rd = Rv * rd;
  } else if (u_animation == 5) {
    ro += u_camFwd * u_time * 0.25;
  }

  // animation modes 8-9 (light position oscillation) — modulate local copy
  vec3 lpos = u_lightPos;
  if (u_animation == 8) {
    lpos.x *= cos(TWOPI * u_time / max(u_length, 1.0));
  } else if (u_animation == 9) {
    lpos.z *= cos(TWOPI * u_time / max(u_length, 1.0));
  }

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

  // ============================================================================
  // Autoscope-faithful 2-pass mode (u_simpleColor > 0.5)
  // ----------------------------------------------------------------------------
  // 2026-05-23 rewrite: pass 1 stores INDICES not resolved color. Post FS does
  // palette lookup + cell-membership + neighbor blur + shadow modes.
  // Format matches autoscope buffer.frag: vec4(c1, c2, shadowFlag, depth)
  //   c1, c2 ∈ [0, 1) — palette indices from spaceCol
  //   shadowFlag: 0 = in shadow, 1 = lit (autoscope convention)
  //   depth: clamp((t - 5) / MAX_DIST, 0, 1) — 0=near, 1=far/sky
  // For sky pixels: (1, 1, chess_pattern, 1) — sentinel for post FS sky branch
  // ============================================================================
  if (u_simpleColor > 0.5) {
    vec4 outBuf;
    if (!hit) {
      // Sky marker: c1=c2=1 (sentinel), B unused (post FS computes its own
      // chess from cellAB so chess granularity is per-cell, not per-buffer-pixel).
      // Before the fix this stored buffer-pixel chess which canvas displayed as
      // ~2.8px dither — autoscope reference has bold large sky chess instead.
      outBuf = vec4(1.0, 1.0, 0.0, 1.0);
    } else {
      vec3 n2 = hitGround ? vec3(0.0, 1.0, 0.0) : calcNormal(hitP);
      vec3 toL = normalize(lpos - hitP);
      float diff2 = max(dot(n2, toL), 0.0);
      bool inShadow2 = (diff2 < 0.05);
      if (!inShadow2 && u_shadowsOn > 0.5) {
        float lit2 = lightOcclusion(hitP + n2 * 0.002, toL, 0.02, length(lpos - hitP));
        if (lit2 < 0.5) inShadow2 = true;
      }
      float objNum2 = hitGround ? 0.0 : lastObjIdx;
      vec2 cellAB2 = floor(gl_FragCoord.xy);
      // autoscope: spaceCol uses raw hitP — no fbm pre-perturbation. The
      // organic feel comes from post FS noise+cell blur, not pre-perturb.
      vec2 ci_ts = spaceCol(hitP, cellAB2, objNum2);
      float shadowFlag = inShadow2 ? 0.0 : 1.0;
      float depthOut = clamp((t - 5.0) / MAX_DIST, 0.0, 1.0);
      outBuf = vec4(ci_ts.x, ci_ts.y, shadowFlag, depthOut);
    }
    gl_FragColor = outBuf;
    return;
  }

  // ============================================================================
  // Legacy single-pass mode (u_simpleColor < 0.5)
  // BOB v1 behaviour preserved for MVP / compositor consumers
  // ============================================================================
  vec3 col;
  if (!hit) {
    col = sky(rd);
  } else {
    vec3 n = hitGround ? vec3(0.0, 1.0, 0.0) : calcNormal(hitP);
    vec3 toLight = normalize(lpos - hitP);
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
      // 1-pass mode：world-space dual-layer mix。两种渲染风格 (autoscope renderType):
      //   0 = HSL hue 重映射 (BOB v1 default)
      //   1 = palette 直 mix，无 HSL → 色彩更鲜更平涂
      vec3 pn2 = hitP + 0.18 * vec3(
        gnoise(hitP.xz * 8.0 + 13.0),
        gnoise(hitP.xy * 8.0 + 200.0),
        gnoise(hitP.yz * 8.0 + 300.0)
      );
      vec2 ci2 = spaceCol(pn2, cellAB, objNum);
      vec3 hi = mix(paletteCol(ci2.x, 0.0), paletteCol(ci2.y, 1.0), 0.25);
      if (u_renderType == 1) {
        // Direct mix — flat poster aesthetic. 0.5 weight = 等比例 lo/hi
        col = mix(lo, hi, 0.5);
      } else {
        // HSL hue remap (default): take lo's sat+lum, mix hue from lo+hi
        vec3 hslLo = rgb2hsl(lo);
        vec3 hslHi = rgb2hsl(hi);
        col = hsl2rgb(vec3(
          mix(hslLo.x, hslHi.x, 0.6),
          hslLo.y,
          mix(hslLo.z, hslHi.z, 0.4)
        ));
        col = mix(col, lo, 0.25);
      }
    }

    // BINARY shadow（Autoscope 签名 —— 不做 Lambert 平滑过渡，保留色块锐利）
    //   1. 法向背向光源 (diff<0.05) → 自遮挡 shadow
    //   2. soft-shadow raymarch < 0.5 → 被其它物体挡 shadow
    //   3. 其它 → 全亮 (palette block 原色不变)
    bool inShadow = (diff < 0.05);
    if (!inShadow && u_shadowsOn > 0.5) {
      float lit = lightOcclusion(hitP + n * 0.002, toLight, 0.02, length(lpos - hitP));
      if (lit < 0.5) inShadow = true;
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
  // Sprint 1 (2026-05-24): switch to WebGL2 context. Canvas shares a single
  // context with FLY 3D — once FLY 3D opens it as webgl2, this call returns
  // the same webgl2 context. BOB GPU's GLSL ES 1.00 shaders still compile on
  // webgl2 (backward compatible). BOB GPU pipeline (autoscope painterly) is
  // intentionally NOT migrated to the postfx HDR composite — its tuned cell-blur
  // / palette quantization / poster aesthetic is a self-contained visual
  // signature; cinematic tonemap+bloom+DoF would homogenize it. FLY 3D is the
  // photoreal cinematic renderer; BOB GPU stays the painterly renderer.
  const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: false });
  if (!gl) throw new Error('[bob-gpu] WebGL2 not supported');
  // Sprint 12: enable LINEAR filtering for RGBA32F (Rune heightmap sampler).
  // Idempotent — if FLY 3D already enabled it on the shared context, no-op.
  gl.getExtension('OES_texture_float_linear');

  const camState = { position: [0, 0.3, -3.0], yaw: 0, pitch: 0 };
  const defaultCam = { position: [...camState.position], yaw: 0, pitch: 0 };

  let program = null;
  let uniformsCache = {};
  let rafId = null;
  let flyHandle = null;
  let paletteState = null;  // { tex, length, palette1, palette2, paper, sky1, sky2 }
  // Sprint 12 Rune erosion heightmap (uploaded by setRuneHeightmap, sampled
  // in shader's sdTerrainErodedRune). Bound to texture unit 2 so it doesn't
  // collide with the palette texture (unit 0).
  let runeHeightmapTex = null;
  let runeHeightmapW = 0, runeHeightmapH = 0;

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
      'u_buffer', 'u_palette', 'u_resolution', 'u_bufferRes', 'u_time',
      'u_paletteLen', 'u_sky1', 'u_sky2', 'u_bg',
      'u_grid', 'u_ratio',
      'u_renderType', 'u_shadow', 'u_shadowStrength',
      'u_margin', 'u_saturation', 'u_exposure',
      'u_colorLeak', 'u_noiseCap', 'u_nFactor', 'u_nOffset',
      'u_rotateCanvas', 'u_seed',
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
    // Pick sky1 and sky2 from TWO different SKIES sub-palettes.
    // SKIES contains some monochromatic sub-palettes (e.g. all-blue tones);
    // when both sky1+sky2 came from the same sub-palette the gradient was flat.
    // Cross-palette pairing guarantees hue contrast in the sky gradient.
    const skyA     = pickShuffled(SKIES);
    const skyB     = pickShuffled(SKIES);
    const sky1     = skyA[0];
    const sky2     = skyB[0];
    const { tex, length } = bakePaletteTexture(gl, palette1, palette2, paper);
    paletteState = {
      tex, length,
      paletteVec: { paper: hexToVec3(paper), sky1: hexToVec3(sky1), sky2: hexToVec3(sky2) },
      sample: { palette1, palette2, paper, sky1, sky2 },
    };
    if (onPaletteChange) onPaletteChange(paletteState.sample);
    return paletteState;
  }

  // ---- applyStyle: accept Generator-V output (BobStyle) for deterministic palette
  // -----------------------------------------------------------------------------
  // Lets caller (autoscope-clone) drive palette selection from a styleHash-derived
  // BobStyle instead of bob's internal Math.random pick. style is the pure-data
  // JSON from `randomizeBobStyle(rng)` in src/render/bobShader-style.js.
  // -----------------------------------------------------------------------------
  function applyStyle(style) {
    if (paletteState && paletteState.tex) gl.deleteTexture(paletteState.tex);
    const { palette1, palette2, paper, sky1, sky2 } = style;
    const { tex, length } = bakePaletteTexture(gl, palette1, palette2, paper, {
      skipRate:  style.paletteSkipRate  ?? 0.05,
      bgIsBlack: style.paletteBgIsBlack ?? false,
    });
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

    if (program) {
      // Detach + delete the OLD fragment shader to actually free GPU memory.
      // Without this, deleteProgram() only marks the program — attached
      // shader objects stay alive forever, leaking ~10–50KB per scene swap.
      gl.detachShader(program, vs);
      if (program._fs) {
        gl.detachShader(program, program._fs);
        gl.deleteShader(program._fs);
      }
      gl.deleteProgram(program);
    }
    program = prog;
    program._fs = fs;

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
      // Autoscope idiom upgrade (2026-05-23): xMod/yMod chess + renderType + rotateCanvas
      'u_xMod', 'u_yMod', 'u_renderType', 'u_rotateCanvas',
      // Autoscope animation modes 1-9 (idiom #6, 2026-05-23)
      'u_animation', 'u_length',
      // Sprint 12 Rune erosion heightmap sampler + active flag.
      'u_heightmap', 'u_runeActive',
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

    // Sprint 12: Rune erosion heightmap (TEXTURE2 — palette is on 0).
    if (runeHeightmapTex != null && uniformsCache.u_heightmap != null) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, runeHeightmapTex);
      gl.uniform1i(uniformsCache.u_heightmap, 2);
    }
    if (uniformsCache.u_runeActive != null) {
      gl.uniform1f(uniformsCache.u_runeActive, runeHeightmapTex != null ? 1.0 : 0.0);
    }

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
    // Autoscope idiom upgrade (2026-05-23):
    gl.uniform1f(uniformsCache.u_xMod, c.xMod ?? 1.0);
    gl.uniform1f(uniformsCache.u_yMod, c.yMod ?? 1.0);
    gl.uniform1i(uniformsCache.u_renderType, (c.renderType ?? 0) | 0);
    gl.uniform1f(uniformsCache.u_rotateCanvas, c.rotateCanvas ?? 0.0);
    gl.uniform1i(uniformsCache.u_animation, (c.animation ?? 0) | 0);
    gl.uniform1f(uniformsCache.u_length, c.length ?? 60.0);

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

      // bufferTex (TEXTURE1) — indices vec4(c1,c2,shadow,depth) from pass 1
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, bufferTex);
      gl.uniform1i(postUniforms.u_buffer, 1);
      // palette (TEXTURE0) — same as pass 1, post FS does palette lookup
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, paletteState.tex);
      gl.uniform1i(postUniforms.u_palette, 0);
      gl.uniform1f(postUniforms.u_paletteLen, paletteState.length);
      gl.uniform3f(postUniforms.u_sky1, ...paletteState.paletteVec.sky1);
      gl.uniform3f(postUniforms.u_sky2, ...paletteState.paletteVec.sky2);
      gl.uniform3f(postUniforms.u_bg,   ...paletteState.paletteVec.paper);

      gl.uniform2f(postUniforms.u_resolution, canvas.width, canvas.height);
      gl.uniform2f(postUniforms.u_bufferRes, bufferResolution, bufferResolution);
      gl.uniform1f(postUniforms.u_time, tSec);
      gl.uniform1f(postUniforms.u_grid, bufferResolution);
      gl.uniform1f(postUniforms.u_ratio, canvas.width / canvas.height);

      gl.uniform1i(postUniforms.u_renderType, (c.renderType ?? 0) | 0);
      gl.uniform1i(postUniforms.u_shadow, (c.shadowMode ?? 0) | 0);
      gl.uniform1f(postUniforms.u_shadowStrength, c.shadowStrength ?? 0.5);
      gl.uniform1f(postUniforms.u_margin, c.margin ?? 0.08);
      gl.uniform1f(postUniforms.u_saturation, c.saturation ?? 0.8);
      gl.uniform1f(postUniforms.u_exposure, c.exposure ?? 2.5);
      gl.uniform1f(postUniforms.u_colorLeak, c.postColorLeak ?? c.colorLeak ?? 0.25);
      gl.uniform1f(postUniforms.u_noiseCap, c.postNoiseCap ?? c.noiseCap ?? 0.5);
      gl.uniform1f(postUniforms.u_nFactor, c.postNFactor ?? c.nFactor ?? 1.0);
      gl.uniform1f(postUniforms.u_nOffset, c.nOffset ?? 0.0);
      gl.uniform1f(postUniforms.u_rotateCanvas, c.rotateCanvas ?? 0.0);
      gl.uniform1f(postUniforms.u_seed, c.seed ?? 1.0);

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
      // Clear framebuffer to black so the next scene doesn't briefly show
      // stale pixels from this one while its new shader is compiling.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    shufflePalette() {
      rebakePalette();
    },
    // Generator-V handoff: caller supplies a BobStyle object (from
    // randomizeBobStyle in bobShader-style.js) — bob uses its palette
    // selection + skip/bg-variety opts deterministically.
    applyStyle(style) {
      applyStyle(style);
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
    // Sprint 12 Rune erosion heightmap (CPU bake from compile.js → GPU texture).
    // Same shape as flyLambert.setRuneHeightmap and blueprint.setRuneHeightmap;
    // BOB binds to TEXTURE2 (palette is on 0). null clears.
    setRuneHeightmap(baked) {
      if (!baked) {
        if (runeHeightmapTex) gl.deleteTexture(runeHeightmapTex);
        runeHeightmapTex = null;
        runeHeightmapW = 0; runeHeightmapH = 0;
        return;
      }
      const { data, width, height } = baked;
      if (!(data instanceof Float32Array) || data.length !== width * height * 4) {
        throw new Error(`[bob-gpu] setRuneHeightmap: bad data shape ${data?.length} vs ${width*height*4}`);
      }
      if (!runeHeightmapTex || width !== runeHeightmapW || height !== runeHeightmapH) {
        if (runeHeightmapTex) gl.deleteTexture(runeHeightmapTex);
        runeHeightmapTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, runeHeightmapTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        runeHeightmapW = width;
        runeHeightmapH = height;
      } else {
        gl.bindTexture(gl.TEXTURE_2D, runeHeightmapTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, data);
      }
    },
  };
}
