// =============================================================================
// bob-shader-renderer —— MVP 的 "BOB GPU" pill 后端
// -----------------------------------------------------------------------------
// Fork 自 fly3d-renderer.js，保留：
//   - compileSDF3ToGLSL (emitObjectIndex=true) 把 LLM SDF compile 到 GLSL
//   - fly camera (pointer lock + WASD)
//   - WebGL pipeline (vertex buffer + program)
//
// 替换/新增：
//   - Autoscope 调色板（21 palette pool）烤进 sampler2D u_palette
//   - imin / ismoothUnion 维护 objectIndex / minIndex（区分多 object 上色）
//   - spaceCol(p, objNum) → 量化色块（IQ floor 离散 + Autoscope u_coldiv 频率）
//   - 缓慢漂移噪声（NOISESPEED ≈ 0.00008，BOB 静图"活着"签名）
//   - 4 种阴影上色风格（channel swap / hue rot 180° / hue rot 90° / 暗化）
//   - Paper bg + sky gradient（Autoscope 三层 sky/paper/object 区分）
//
// 跟 fly3d 共享 #c-webgl canvas（两个 controller 各管自己 program，mode 切换 swap）。
// =============================================================================

import { compileSDF3ToGLSL, canCompileSDF3 } from '../../src/sdf/sdf3.compile.js';
import {
  PALETTES, SKIES, PAPERS,
  pickShuffled, pick, bakePaletteTexture, hexToVec3,
} from '../../src/palette/autoscope.js';
import { attachFlyControls } from '../sdf/helpers/fly-controls.js';

const VS_SRC = `attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

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
uniform float u_time;
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

#define PI       3.1415926535
#define TWOPI    6.2831853071
#define MAX_STEPS 100
#define MAX_DIST  30.0
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

vec3 calcNormal(vec3 p) {
  const float e = 0.0008;
  return normalize(vec3(
    sceneSDF(p + vec3(e, 0, 0)) - sceneSDF(p - vec3(e, 0, 0)),
    sceneSDF(p + vec3(0, e, 0)) - sceneSDF(p - vec3(0, e, 0)),
    sceneSDF(p + vec3(0, 0, e)) - sceneSDF(p - vec3(0, 0, e))
  ));
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt) {
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < 24; i++) {
    if (t >= maxt) break;
    float h = sceneSDF(ro + rd * t);
    if (h < 0.0005) return 0.0;
    res = min(res, 8.0 * h / t);
    t += clamp(h, 0.01, 0.2);
  }
  return clamp(res, 0.0, 1.0);
}

// ============================================================================
// Autoscope-style space color quantization
// ============================================================================

// p → 两个 [0,1) 色索引（row0 = palette1，row1 = palette2）
// objNum：raymarch 命中后 minIndex 的值；ground 用 0
//
// 注意：Autoscope 原版假设场景 ~20 单位（建筑 10-20 高）；我们 LLM 输出 ~0.5-1
// 单位。同样 coldiv=1.5 在 autoscope 出 30 cells / 在我们这只出 1-2 cells →
// 整个物体一个色块看起来 mono。WORLD_SCALE 给 LLM 尺度补偿 ~10× 量化频率。
const float WORLD_SCALE = 8.0;
vec2 spaceCol(vec3 p, float objNum) {
  // 不同 object 用不同色块密度（让 union 多 leaf 颜色变化丰富）
  float coldivMod = u_coldiv / (1.0 + mod(objNum, 5.0) - 2.5);
  p *= coldivMod * WORLD_SCALE;

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

  float c1 = mod(i, u_paletteLen) / u_paletteLen;
  float c2 = mod(objNum, u_paletteLen) / u_paletteLen;
  return vec2(c1, c2);
}

vec3 paletteCol(float idx, float row) {
  // row=0 → 上半行（palette1）；row=1 → 下半行（palette2）
  // fract() 保证 u ∈ [0,1) → 跟 CLAMP_TO_EDGE wrap 配合不超界
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

  // ---- Raymarch（同时跟 ground 比较；用 minIndex 记 object id）----
  float t = 0.0;
  bool hit = false;
  bool hitGround = false;
  float lastObjIdx = 0.0;
  vec3 hitP = vec3(0.0);

  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d_obj = sceneSDF(p);  // 这一调用更新全局 minIndex
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

    // 加 noise 扰动 p 让色块边缘有"水彩晕染"
    vec3 pn = hitP + 0.05 * vec3(
      gnoise(hitP.xz * 2.0),
      gnoise(hitP.xy * 2.0 + 50.0),
      gnoise(hitP.yz * 2.0 + 100.0)
    );

    vec2 ci = spaceCol(pn, objNum);
    vec3 col1 = paletteCol(ci.x, 0.0);
    vec3 col2 = paletteCol(ci.y, 1.0);
    col = mix(col1, col2, 0.25);

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

  // 提饱和度（避免发灰）+ 曝光 + gamma
  col = saturateColor(col, u_saturation);
  col *= u_exposure;
  col = pow(clamp(col, 0.0, 1.0), vec3(0.4545));
  gl_FragColor = vec4(col, 1.0);
}`;
}

// ============================================================================
// Controller
// ============================================================================

export function createBobShaderRenderer({ canvas, getControls, onCamUpdate, onFps, onPaletteChange }) {
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
      'u_shadowsOn', 'u_groundOn', 'u_noiseSpeed', 'u_exposure', 'u_saturation',
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

    gl.useProgram(program);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.uniform2f(uniformsCache.u_resolution, canvas.width, canvas.height);
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

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
    getPaletteSample() { return paletteState?.sample ?? null; },
  };
}
